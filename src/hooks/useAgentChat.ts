/**
 * The chat session for the active conversation: the transcript, the composer
 * input, the busy/queue/form-pending flags, and every turn/form action built on
 * the `@openrouter/agent` loop (run / cancel / HITL resume / self-repair / the
 * message queue). It owns the slide-out panel's `activation` too, since the form
 * lifecycle is part of the same flow.
 *
 * App keeps connection, the conversation list, and rendering; this hook is the
 * seam that keeps App under the 600-line cap. The logic here is a verbatim lift
 * from the former App.tsx — behaviour (and the debug-bridge contract) unchanged.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  callTool,
  type ServerInfo,
  type ToolCallInfo,
  type ModelContext,
} from "../mcp/host-bridge";
import {
  buildMcpTools,
  runTurn,
  resumeTurn,
  openForm,
  repairToolCall,
  describedButDidntCall,
  displayItemsFromState,
  pendingHitlCall,
  toolCardsFromState,
  type DisplayItem,
} from "../agent/runner";
import { isFormSubmit, isFormCancel, readFormDirty, validateResult, type FormSpec } from "@omni/forms-dsl";
import { Modal } from "antd";
import { logEvent, type EventSource } from "../lib/events";
import {
  createConversation,
  getMessages,
  getConversationState,
  conversationStateAccessor,
  logFormEvent,
  touchConversation,
} from "../lib/db";

interface UseAgentChatArgs {
  apiKey: string;
  model: string;
  server: ServerInfo | null;
  conversationId: number | null;
  setConversationId: (id: number | null) => void;
  /** Refresh the conversation list (recency) after a turn touches a chat. */
  onConversationsChanged: () => void;
  /** Surface a "need key/model" message in App's connection error banner. */
  setConnError: (msg: string | null) => void;
}

export function useAgentChat({
  apiKey,
  model,
  server,
  conversationId,
  setConversationId,
  onConversationsChanged,
  setConnError,
}: UseAgentChatArgs) {
  const [messages, setMessages] = useState<DisplayItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Messages typed while the agent is busy or a form is open are queued, not
  // sent (sending mid-form would abandon it). They flush when the agent is free.
  const [queued, setQueued] = useState<string[]>([]);
  const [formPending, setFormPending] = useState(false);
  const [activation, setActivation] = useState<ToolCallInfo | null>(null);
  const flushingRef = useRef(false);
  // Aborts the in-flight turn (Sender's cancel button → runner's result.cancel()).
  const abortRef = useRef<AbortController | null>(null);

  // The latest server, readable from stable callbacks without re-binding them.
  const serverRef = useRef<ServerInfo | null>(null);
  useEffect(() => {
    serverRef.current = server;
  }, [server]);

  // Whether the open form has unsaved input — reported by the form app (the host
  // can't see inside the cross-origin iframe). Drives the confirm-on-cancel.
  const formDirtyRef = useRef(false);
  // Summon a panel for a fresh tool call; the new form starts clean so a stale
  // dirty flag from a previous form can't trigger a spurious discard prompt.
  const summonPanel = useCallback((info: ToolCallInfo) => {
    formDirtyRef.current = false;
    setActivation(info);
  }, []);

  /** Reflect persisted state into the transcript + the "form open?" flag. */
  const applyState = useCallback((state: unknown) => {
    setMessages(displayItemsFromState(state));
    setFormPending(!!pendingHitlCall(state));
  }, []);

  // Last-seen status per tool callId, so we emit tool.call once and tool.result
  // on the pending→resolved transition. Tool args/results live in
  // conversation_state; the event just references them by callId.
  const toolSeenRef = useRef<Map<string, string>>(new Map());

  /** Emit tool.call / tool.result events for new or newly-resolved tool calls. */
  const emitToolEvents = useCallback((convId: number, state: unknown) => {
    for (const card of toolCardsFromState(state)) {
      const prev = toolSeenRef.current.get(card.callId);
      if (prev === undefined) {
        logEvent({ source: "system", type: "tool.call", conversationId: convId, data: { callId: card.callId, name: card.name } });
      }
      if (card.status !== "pending" && prev !== card.status) {
        logEvent({ source: "system", type: "tool.result", conversationId: convId, data: { callId: card.callId, name: card.name, status: card.status } });
      }
      toolSeenRef.current.set(card.callId, card.status);
    }
  }, []);

  /** Seed seen-cards without logging (when loading an existing conversation). */
  const seedToolSeen = useCallback((state: unknown) => {
    for (const card of toolCardsFromState(state)) toolSeenRef.current.set(card.callId, card.status);
  }, []);

  /**
   * Reflect a conversation's persisted SDK state into the UI: render the full
   * transcript (text bubbles + tool cards) and, if the conversation is paused
   * awaiting form input, re-mount the panel for the pending call so the user
   * can still submit — even after a reload.
   */
  const hydrate = useCallback(async (id: number) => {
    const state = await getConversationState(id);
    if (state) {
      setMessages(displayItemsFromState(state));
      seedToolSeen(state); // existing tool calls are "seen" — don't re-log history
      const pending = pendingHitlCall(state);
      setFormPending(!!pending);
      const srv = serverRef.current;
      if (pending && srv?.tools.has(pending.name)) {
        const info = callTool(srv, pending.name, pending.args);
        summonPanel(info);
      } else {
        setActivation(null);
      }
      return;
    }
    // Legacy text-only conversations (pre SDK-state migration).
    const rows = await getMessages(id);
    setMessages(rows.map((r) => ({ kind: "msg", role: r.role as "user" | "assistant", content: r.content })));
    setFormPending(false);
    setActivation(null);
  }, [summonPanel, seedToolSeen]);

  /** Reset the chat surface (App's "new chat" / deleting the active conversation). */
  const resetChat = useCallback(() => {
    setMessages([]);
    setQueued([]);
    setFormPending(false);
    setActivation(null);
    toolSeenRef.current.clear();
    formDirtyRef.current = false;
  }, []);

  const appendDeltaToLastAssistant = useCallback((delta: string) => {
    setMessages((msgs) => {
      const next = msgs.slice();
      const last = next[next.length - 1];
      if (last?.kind === "msg" && last.role === "assistant") {
        next[next.length - 1] = { ...last, content: last.content + delta };
      }
      return next;
    });
  }, []);

  const setAssistantError = useCallback((msg: string) => {
    setMessages((m) => {
      const next = m.slice();
      const last = next[next.length - 1];
      if (last?.kind === "msg" && last.role === "assistant" && !last.content) {
        next[next.length - 1] = { ...last, content: `⚠️ ${msg}` };
      }
      return next;
    });
  }, []);

  /** Run one user turn for `text`. Returns the conversation id it ran against. */
  const runUserTurn = useCallback(
    async (text: string, source: EventSource = "user"): Promise<number | null> => {
      if (!text || busy) return null;
      if (!apiKey) { setConnError("Enter your OpenRouter API key first."); return null; }
      if (!model) { setConnError("Pick a model first."); return null; }
      setConnError(null);

      let convId = conversationId;
      if (convId == null) {
        convId = await createConversation(text.slice(0, 60));
        setConversationId(convId);
      }

      setMessages((m) => [
        ...m,
        { kind: "msg", role: "user", content: text },
        { kind: "msg", role: "assistant", content: "" },
      ]);
      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const startedAt = performance.now();
      logEvent({ source, type: "turn.start", conversationId: convId, data: { model, chars: text.length } });

      const tools = server ? buildMcpTools(server, summonPanel) : [];
      const state = conversationStateAccessor(convId);
      try {
        await runTurn({ apiKey, model, userText: text, state, tools, onTextDelta: appendDeltaToLastAssistant, signal: controller.signal });
        let st = await getConversationState(convId);
        // Self-repair: if the model described a form but didn't call the tool,
        // re-prompt once with the tool forced (only when the forms tool exists).
        if (!controller.signal.aborted && server?.tools.has("request_user_input") && !pendingHitlCall(st) && describedButDidntCall(st)) {
          logEvent({ source: "repair", type: "repair.fired", conversationId: convId });
          await repairToolCall({ apiKey, model, state, tools, onTextDelta: appendDeltaToLastAssistant, signal: controller.signal });
          st = await getConversationState(convId);
        }
        // Reconcile with persisted state (surfaces tool cards). The panel, if a
        // form paused, was already opened by onAutoSummon mid-turn.
        applyState(st);
        emitToolEvents(convId, st);
        const ms = Math.round(performance.now() - startedAt);
        if (controller.signal.aborted) {
          logEvent({ source, type: "turn.cancelled", conversationId: convId, data: { ms } });
        } else {
          logEvent({ source, type: "turn.end", conversationId: convId, data: { ms, formOpened: !!pendingHitlCall(st) } });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setAssistantError(msg);
        logEvent({ source, type: "turn.error", conversationId: convId, data: { ms: Math.round(performance.now() - startedAt), error: msg } });
      } finally {
        setBusy(false);
        abortRef.current = null;
        await touchConversation(convId);
        onConversationsChanged();
      }
      return convId;
    },
    [busy, apiKey, model, conversationId, server, setConnError, setConversationId, summonPanel, appendDeltaToLastAssistant, applyState, emitToolEvents, setAssistantError, onConversationsChanged],
  );

  /** Send (or queue) a message. `raw` comes from Sender's onSubmit. */
  const submit = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setInput("");
    // Only send when the agent is "open"; otherwise queue (and show it queued).
    if (busy || formPending) {
      setQueued((q) => [...q, text]);
      logEvent({ source: "user", type: "queue.enqueue", conversationId, data: { reason: busy ? "busy" : "form-open" } });
      return;
    }
    await runUserTurn(text);
  }, [busy, formPending, conversationId, runUserTurn]);

  /** Cancel the in-flight turn (Sender's cancel button). */
  const cancelTurn = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Flush the next queued message once the agent is free (not busy, no open form).
  useEffect(() => {
    if (busy || formPending || queued.length === 0 || flushingRef.current) return;
    flushingRef.current = true;
    const next = queued[0];
    setQueued((q) => q.slice(1));
    logEvent({ source: "queue", type: "queue.flush", conversationId, data: { remaining: queued.length - 1 } });
    void runUserTurn(next, "queue").finally(() => {
      flushingRef.current = false;
    });
  }, [busy, formPending, queued, conversationId, runUserTurn]);

  /**
   * Feed an output back to the pending HITL call and resume. `build` derives the
   * output + the form_events log from the pending call. Shared by submit/cancel.
   */
  const resumePendingCall = useCallback(
    async (
      build: (pending: { callId: string; name: string; args: Record<string, unknown> }) => {
        output: unknown;
        log: Parameters<typeof logFormEvent>[0];
      } | null,
    ): Promise<number | null> => {
      const convId = conversationId;
      if (convId == null || busy) return null;
      const pending = pendingHitlCall(await getConversationState(convId));
      if (!pending) return null;

      const built = build(pending);
      if (!built) return null;
      void logFormEvent(built.log);
      logEvent({ source: "user", type: `form.${built.log.status}`, conversationId: convId, data: { tool: pending.name } });

      setActivation(null);
      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;
      setMessages((m) => [...m, { kind: "msg", role: "assistant", content: "" }]);

      const accessor = conversationStateAccessor(convId);
      const tools = server ? buildMcpTools(server, summonPanel) : [];
      try {
        await resumeTurn({ apiKey, model, callId: pending.callId, output: built.output, state: accessor, tools, onTextDelta: appendDeltaToLastAssistant, signal: controller.signal });
        const st = await getConversationState(convId);
        applyState(st);
        emitToolEvents(convId, st);
        if (controller.signal.aborted) logEvent({ source: "user", type: "turn.cancelled", conversationId: convId });
      } catch (e) {
        setAssistantError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
        abortRef.current = null;
        await touchConversation(convId);
        onConversationsChanged();
      }
      return convId;
    },
    [conversationId, busy, server, apiKey, model, summonPanel, appendDeltaToLastAssistant, applyState, emitToolEvents, setAssistantError, onConversationsChanged],
  );

  /** Validate the submitted values host-side (untrusted iframe) and resume. */
  const resolvePendingForm = useCallback(
    (values: Record<string, unknown>) =>
      resumePendingCall((pending) => {
        const spec = pending.args as unknown as FormSpec;
        const check = validateResult(spec, values);
        return {
          output: check.ok ? check.cleaned : { error: "invalid_result", issues: check.issues },
          log: { conversationId, toolName: pending.name, spec, specValid: true, issues: check.ok ? undefined : check.issues, result: values, status: "submitted" },
        };
      }),
    [resumePendingCall, conversationId],
  );

  /** Resolve the pending form as cancelled so the agent unblocks. */
  const cancelPendingForm = useCallback(
    () =>
      resumePendingCall((pending) => ({
        output: { cancelled: true, reason: "The user dismissed the form without submitting." },
        log: { conversationId, toolName: pending.name, spec: pending.args, specValid: true, status: "cancelled" },
      })),
    [resumePendingCall, conversationId],
  );

  /** Cancel, confirming first only if the user has entered something. */
  const requestCancel = useCallback(() => {
    if (formDirtyRef.current) {
      Modal.confirm({
        title: "Discard your answers?",
        content: "The form will be cancelled and what you've entered cleared.",
        okText: "Discard",
        okType: "danger",
        cancelText: "Keep editing",
        onOk: () => void cancelPendingForm(),
      });
    } else {
      void cancelPendingForm();
    }
  }, [cancelPendingForm]);

  // The form app pushes submit / cancel / dirty signals here (updateModelContext).
  const onAppContext = useCallback(
    async (ctx: ModelContext | null) => {
      const sc = ctx?.structuredContent;
      if (isFormSubmit(sc)) return void resolvePendingForm(sc.values as Record<string, unknown>);
      if (isFormCancel(sc)) return requestCancel();
      const dirty = readFormDirty(sc);
      if (dirty !== null) formDirtyRef.current = dirty;
    },
    [resolvePendingForm, requestCancel],
  );

  // Closing the pane on a pending form cancels it (same as the form's Cancel);
  // otherwise it just dismisses a display-only app panel.
  const onPaneClose = useCallback(async () => {
    const st = conversationId != null ? await getConversationState(conversationId) : null;
    if (pendingHitlCall(st)) requestCancel();
    else setActivation(null);
  }, [conversationId, requestCancel]);

  /** Deterministically open a form (debug bridge `/openform`). */
  const openFormBridge = useCallback(
    async (spec: unknown) => {
      if (busy) return { error: "busy" };
      if (!apiKey || !model || !server) return { error: "need apiKey + model + connected server" };
      let convId = conversationId;
      if (convId == null) {
        convId = await createConversation(`form: ${(spec as { title?: string })?.title ?? "untitled"}`);
        setConversationId(convId);
      }
      setBusy(true);
      setMessages((m) => [...m, { kind: "msg", role: "assistant", content: "" }]);
      const accessor = conversationStateAccessor(convId);
      const tools = buildMcpTools(server, summonPanel);
      try {
        await openForm({ apiKey, model, spec, state: accessor, tools, onTextDelta: appendDeltaToLastAssistant });
        const st = await getConversationState(convId);
        applyState(st);
        emitToolEvents(convId, st);
      } catch (e) {
        setAssistantError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
        await touchConversation(convId);
        onConversationsChanged();
      }
      const st = await getConversationState(convId);
      return { conversationId: convId, pending: pendingHitlCall(st), items: displayItemsFromState(st) };
    },
    [busy, apiKey, model, server, conversationId, setConversationId, summonPanel, appendDeltaToLastAssistant, applyState, emitToolEvents, setAssistantError, onConversationsChanged],
  );

  /** Debug bridge `/send`: run a turn, return the resulting transcript. */
  const sendBridge = useCallback(async (text: string) => {
    const convId = await runUserTurn(text, "debug-bridge");
    const st = convId != null ? await getConversationState(convId) : null;
    return { conversationId: convId, pending: pendingHitlCall(st), items: displayItemsFromState(st) };
  }, [runUserTurn]);

  /** Debug bridge `/submit`: resolve the pending form, return the transcript. */
  const submitBridge = useCallback(async (values: Record<string, unknown>) => {
    const convId = await resolvePendingForm(values);
    const st = convId != null ? await getConversationState(convId) : null;
    return { resolved: convId != null, pending: pendingHitlCall(st), items: displayItemsFromState(st) };
  }, [resolvePendingForm]);

  /** Debug bridge `/cancel`: cancel the pending form, return the transcript. */
  const cancelBridge = useCallback(async () => {
    const convId = await cancelPendingForm();
    const st = convId != null ? await getConversationState(convId) : null;
    return { cancelled: convId != null, pending: pendingHitlCall(st), items: displayItemsFromState(st) };
  }, [cancelPendingForm]);

  /** The chat-portion of the debug bridge's `/state` snapshot. */
  const bridgeState = useCallback(async () => {
    const st = conversationId != null ? await getConversationState(conversationId) : null;
    return { conversationId, busy, formPending, queued, connected: !!server, formDirty: formDirtyRef.current, pending: pendingHitlCall(st), items: displayItemsFromState(st) };
  }, [conversationId, busy, formPending, queued, server]);

  return {
    messages,
    input,
    setInput,
    busy,
    queued,
    setQueued,
    formPending,
    activation,
    submit,
    cancelTurn,
    runUserTurn,
    resolvePendingForm,
    cancelPendingForm,
    hydrate,
    resetChat,
    onAppContext,
    onPaneClose,
    openFormBridge,
    sendBridge,
    submitBridge,
    cancelBridge,
    bridgeState,
  };
}
