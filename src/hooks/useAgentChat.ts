/**
 * The chat session for the active conversation: the transcript, the composer
 * input, the busy/queue/form-pending flags, and every turn/form action built on
 * the `@openrouter/agent` loop (run / cancel / HITL resume / self-repair / the
 * message queue). It owns the inline app's `activation` too (the live tool-call
 * handle InlineAppMount renders on its transcript card), since the form
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
import type { UseAgentChatArgs } from "./useAgentChatTypes";
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
  toolResultDetail,
  emptyTelemetry,
  telemetryData,
  LeakedToolCallError,
  type DisplayItem,
} from "../agent/runner";
import { buildAgentTools } from "./agentChatTools";
import { isFormSubmit, isFormCancel, readFormDirty, validateResult, type FormSpec } from "@omni/forms-dsl";
import { Modal } from "antd";
import { logEvent, type EventSource } from "../lib/events";
import { pathIsDir } from "../lib/fs";
import {
  createConversation,
  getMessages,
  getConversationState,
  conversationStateAccessor,
  getCodeMode,
  setCodeMode as persistCodeMode,
  logFormEvent,
  touchConversation,
} from "../lib/db";
import { TOOLCALL_LEAK_NOTICE } from "./agentChatErrors";
import { bridgeResolutionTranscript, bridgeTranscript } from "./agentChatBridge";

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
  // Code mode: bound per-conversation, injected into the agent's prompt. Held
  // here (alongside the turn loop that consumes it) and mirrored to the DB. A
  // ref keeps the latest values readable from stable turn callbacks.
  const [codeMode, setCodeModeState] = useState(false);
  const [workingDir, setWorkingDirState] = useState<string | null>(null);
  /** Saved folder path exists on disk — when false, composer is read-only. */
  const [folderMissing, setFolderMissing] = useState(false);
  const codeModeRef = useRef<{ codeMode: boolean; workingDir: string | null }>({ codeMode: false, workingDir: null });
  const folderMissingRef = useRef(false);
  useEffect(() => {
    codeModeRef.current = { codeMode, workingDir };
  }, [codeMode, workingDir]);
  useEffect(() => {
    folderMissingRef.current = folderMissing;
  }, [folderMissing]);

  /** Check whether a bound folder is reachable; updates `folderMissing`. */
  const syncFolderReachable = useCallback(async (dir: string | null, logConvId?: number | null) => {
    if (!dir) {
      setFolderMissing(false);
      return;
    }
    const ok = await pathIsDir(dir);
    setFolderMissing(!ok);
    if (!ok) {
      logEvent({
        source: "system",
        type: "codemode.folder.missing",
        conversationId: logConvId ?? conversationId,
        data: { path: dir },
      });
    }
  }, [conversationId]);

  /** The folder to inject this turn, or undefined when code mode is off/unset/unreachable. */
  const activeWorkingDir = useCallback(() => {
    const { codeMode, workingDir } = codeModeRef.current;
    if (folderMissingRef.current) return undefined;
    return codeMode ? workingDir ?? undefined : undefined;
  }, []);
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
        // Attach a truncated error/cancel detail so failures are diagnosable
        // from the event log alone (done results can be large — skip those).
        const detail = card.status === "done" ? undefined : toolResultDetail(card.result);
        logEvent({
          source: "system",
          type: "tool.result",
          conversationId: convId,
          data: { callId: card.callId, name: card.name, status: card.status, ...(detail ? { detail } : {}) },
        });
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
  // ---- code-mode setters: update UI state + persist to the active chat ----
  // (When there's no conversation yet, runUserTurn persists on creation.)

  const setCodeMode = useCallback(
    (on: boolean) => {
      setCodeModeState(on);
      const dir = codeModeRef.current.workingDir;
      if (conversationId != null) void persistCodeMode(conversationId, { codeMode: on, workingDir: dir });
      logEvent({ source: "user", type: "codemode.toggle", conversationId, data: { on, hasDir: !!dir } });
    },
    [conversationId],
  );

  const setWorkingDir = useCallback(
    (dir: string | null) => {
      setWorkingDirState(dir);
      void syncFolderReachable(dir);
      const on = codeModeRef.current.codeMode;
      if (conversationId != null) void persistCodeMode(conversationId, { codeMode: on, workingDir: dir });
      logEvent({ source: "user", type: "codemode.folder", conversationId, data: { hasDir: !!dir } });
    },
    [conversationId, syncFolderReachable],
  );

  const hydrate = useCallback(async (id: number) => {
    const cm = await getCodeMode(id);
    setCodeModeState(cm.codeMode);
    setWorkingDirState(cm.workingDir);
    await syncFolderReachable(cm.workingDir, id);
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
  }, [summonPanel, seedToolSeen, syncFolderReachable]);

  /** Reset the chat surface (App's "new chat" / deleting the active conversation). */
  const resetChat = useCallback(() => {
    setMessages([]);
    setQueued([]);
    setFormPending(false);
    setActivation(null);
    setCodeModeState(false);
    setWorkingDirState(null);
    setFolderMissing(false);
    toolSeenRef.current.clear();
    formDirtyRef.current = false;
  }, []);

  /**
   * Reset to a fresh chat already bound to `dir` (code mode on) — for the
   * Projects panel's per-project `+`. Sets state only, no DB write: the chat
   * doesn't exist yet (conversationId is about to be null), and runUserTurn
   * persists the code-mode state when it creates the conversation. Persisting
   * here would write to the *previous* conversation (stale id in this closure).
   */
  const startProjectChat = useCallback((dir: string) => {
    setMessages([]);
    setQueued([]);
    setFormPending(false);
    setActivation(null);
    toolSeenRef.current.clear();
    formDirtyRef.current = false;
    setCodeModeState(true);
    setWorkingDirState(dir);
    void syncFolderReachable(dir);
  }, [syncFolderReachable]);

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

  /** Force-replace the last assistant bubble (used to wipe leaked template text). */
  const replaceLastAssistant = useCallback((content: string) => {
    setMessages((m) => {
      const next = m.slice();
      for (let i = next.length - 1; i >= 0; i--) {
        const it = next[i];
        if (it.kind === "msg" && it.role === "assistant") {
          next[i] = { ...it, content };
          break;
        }
      }
      return next;
    });
  }, []);

  /**
   * Shared turn-failure handler. A leaked tool-call template (the model dumped
   * its native tool syntax into the text channel) gets a clear, actionable
   * notice instead of the garbled tokens; anything else is a normal error.
   * Returns true when it handled a leak (so callers can skip generic logging).
   */
  const handleTurnError = useCallback(
    (e: unknown, source: EventSource, convId: number | null): boolean => {
      if (e instanceof LeakedToolCallError) {
        replaceLastAssistant(TOOLCALL_LEAK_NOTICE);
        logEvent({ source, type: "turn.toolcall_leak", conversationId: convId, data: { model } });
        return true;
      }
      return false;
    },
    [replaceLastAssistant, model],
  );

  /** Run one user turn for `text`. Returns the conversation id it ran against. */
  const runUserTurn = useCallback(
    async (text: string, source: EventSource = "user"): Promise<number | null> => {
      if (!text || busy) return null;
      if (folderMissingRef.current && codeModeRef.current.workingDir) return null;
      if (!apiKey) { setConnError("Enter your OpenRouter API key first."); return null; }
      if (!model) { setConnError("Pick a model first."); return null; }
      setConnError(null);

      let convId = conversationId;
      if (convId == null) {
        convId = await createConversation(text.slice(0, 60));
        setConversationId(convId);
        // Persist the code-mode state chosen before the chat existed.
        const cm = codeModeRef.current;
        if (cm.codeMode || cm.workingDir) await persistCodeMode(convId, cm);
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

      const state = conversationStateAccessor(convId);
      const workingDir = activeWorkingDir();
      const tools = buildAgentTools(server, workingDir, summonPanel);
      const telemetry = emptyTelemetry();
      try {
        await runTurn({ apiKey, model, userText: text, state, tools, onTextDelta: appendDeltaToLastAssistant, signal: controller.signal, workingDir, telemetry });
        let st = await getConversationState(convId);
        // Self-repair: if the model described a form but didn't call the tool,
        // re-prompt once with the tool forced (only when the forms tool exists).
        if (!controller.signal.aborted && server?.tools.has("request_user_input") && !pendingHitlCall(st) && describedButDidntCall(st)) {
          logEvent({ source: "repair", type: "repair.fired", conversationId: convId });
          await repairToolCall({ apiKey, model, state, tools, onTextDelta: appendDeltaToLastAssistant, signal: controller.signal, workingDir, telemetry });
          st = await getConversationState(convId);
        }
        // Reconcile with persisted state (surfaces tool cards). The panel, if a
        // form paused, was already opened by onAutoSummon mid-turn.
        applyState(st);
        emitToolEvents(convId, st);
        const ms = Math.round(performance.now() - startedAt);
        if (controller.signal.aborted) {
          logEvent({ source, type: "turn.cancelled", conversationId: convId, data: { ms, ...telemetryData(telemetry) } });
        } else {
          logEvent({ source, type: "turn.end", conversationId: convId, data: { ms, formOpened: !!pendingHitlCall(st), ...telemetryData(telemetry) } });
        }
      } catch (e) {
        if (!handleTurnError(e, source, convId)) {
          const msg = e instanceof Error ? e.message : String(e);
          setAssistantError(msg);
          logEvent({ source, type: "turn.error", conversationId: convId, data: { ms: Math.round(performance.now() - startedAt), error: msg } });
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
        await touchConversation(convId);
        onConversationsChanged();
      }
      return convId;
    },
    [busy, apiKey, model, conversationId, server, setConnError, setConversationId, summonPanel, appendDeltaToLastAssistant, applyState, emitToolEvents, setAssistantError, handleTurnError, onConversationsChanged, activeWorkingDir],
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

  /** Feed an output back to the pending HITL call and resume. `build` derives the
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
      const tools = buildAgentTools(server, activeWorkingDir(), summonPanel);
      const telemetry = emptyTelemetry();
      try {
        await resumeTurn({ apiKey, model, callId: pending.callId, output: built.output, state: accessor, tools, onTextDelta: appendDeltaToLastAssistant, signal: controller.signal, workingDir: activeWorkingDir(), telemetry });
        const st = await getConversationState(convId);
        applyState(st);
        emitToolEvents(convId, st);
        if (controller.signal.aborted) logEvent({ source: "user", type: "turn.cancelled", conversationId: convId, data: telemetryData(telemetry) });
        else logEvent({ source: "user", type: "turn.end", conversationId: convId, data: { resumed: true, ...telemetryData(telemetry) } });
      } catch (e) {
        if (!handleTurnError(e, "user", convId)) setAssistantError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
        abortRef.current = null;
        await touchConversation(convId);
        onConversationsChanged();
      }
      return convId;
    },
    [conversationId, busy, server, apiKey, model, summonPanel, appendDeltaToLastAssistant, applyState, emitToolEvents, setAssistantError, handleTurnError, onConversationsChanged],
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
        if (!handleTurnError(e, "debug-bridge", convId)) setAssistantError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
        await touchConversation(convId);
        onConversationsChanged();
      }
      return bridgeTranscript(convId);
    },
    [busy, apiKey, model, server, conversationId, setConversationId, summonPanel, appendDeltaToLastAssistant, applyState, emitToolEvents, setAssistantError, handleTurnError, onConversationsChanged],
  );

  /** Debug bridge `/send`: run a turn, return the resulting transcript. */
  const sendBridge = useCallback(async (text: string) => {
    const convId = await runUserTurn(text, "debug-bridge");
    return bridgeTranscript(convId);
  }, [runUserTurn]);

  /** Debug bridge `/submit`: resolve the pending form, return the transcript. */
  const submitBridge = useCallback(async (values: Record<string, unknown>) => {
    const convId = await resolvePendingForm(values);
    return bridgeResolutionTranscript("resolved", convId);
  }, [resolvePendingForm]);

  /** Debug bridge `/cancel`: cancel the pending form, return the transcript. */
  const cancelBridge = useCallback(async () => {
    const convId = await cancelPendingForm();
    return bridgeResolutionTranscript("cancelled", convId);
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
    codeMode,
    workingDir,
    folderMissing,
    setCodeMode,
    setWorkingDir,
    submit,
    cancelTurn,
    runUserTurn,
    resolvePendingForm,
    cancelPendingForm,
    hydrate,
    resetChat,
    startProjectChat,
    onAppContext,
    openFormBridge,
    sendBridge,
    submitBridge,
    cancelBridge,
    bridgeState,
  };
}
