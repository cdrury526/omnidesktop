/**
 * One live chat session — the unit a tab wraps. Owns its conversation id and the
 * `useAgentChat` loop, and renders the transcript + composer. MCP Apps mount
 * inline on their tool card in the transcript (see InlineAppMount). Every open
 * tab mounts one of these and stays mounted (hidden tabs are `display:none`), so
 * a backgrounded session keeps streaming its turn.
 *
 * App is the shell (rail, tab bar, shared key/model/server); each session is
 * independent. A session reports its `meta` (conversation id, code mode, busy)
 * up for the tab label, and registers its debug-bridge handlers so the bridge
 * can drive whichever tab is focused.
 */
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Bubble, Sender, ThoughtChain } from "@ant-design/x";
import { AssistantMarkdown } from "./MarkdownCode";
import { ModelPicker } from "./ModelPicker";
import { CodeModeToggle } from "./CodeModeToggle";
import { FolderMissingNotice } from "./FolderMissingNotice";
import { InlineAppMount } from "./InlineAppMount";
import { ChatWelcome } from "./ChatWelcome";
import { useAgentChat } from "../hooks/useAgentChat";
import type { DisplayItem } from "../agent/runner";
import type { ServerInfo, ToolCallInfo, ModelContext } from "../mcp/host-bridge";

type ToolItem = Extract<DisplayItem, { kind: "tool" }>;

const TOOL_STATUS: Record<ToolItem["status"], { status: "loading" | "success" | "error" | "abort"; label: string }> = {
  pending: { status: "loading", label: "awaiting input" },
  done: { status: "success", label: "done" },
  error: { status: "error", label: "error" },
  cancelled: { status: "abort", label: "cancelled" },
};

function pretty(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") {
    try { return JSON.stringify(JSON.parse(v), null, 2); } catch { return v; }
  }
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

interface ToolStepProps {
  item: ToolItem;
  /** Live tool-call handle for the pending app (null when none is open). */
  activation: ToolCallInfo | null;
  /** Structured context the inline app pushes back (submit/cancel/dirty). */
  onAppContext?: (ctx: ModelContext | null) => void;
}

/**
 * One tool call as a ThoughtChain step. When this is the pending call that
 * summoned an MCP App, its body hosts the interactive sandbox iframe inline
 * (kept expanded so it can't be collapsed away mid-form); otherwise the body is
 * the expandable args/result detail.
 */
function ToolStep({ item, activation, onAppContext }: ToolStepProps) {
  const map = TOOL_STATUS[item.status];
  const key = item.callId || item.name;

  // Mount the app inline on the call that's paused awaiting it. Only one HITL
  // call is ever pending, so matching by name unambiguously hits this card.
  const showApp =
    item.status === "pending" && activation != null && activation.tool.name === item.name;

  const argsText = pretty(item.args);
  const resultText = item.status === "pending" ? "" : pretty(item.result);
  const detail = [argsText && `arguments:\n${argsText}`, resultText && `result:\n${resultText}`]
    .filter(Boolean)
    .join("\n\n");

  const content = showApp ? (
    <InlineAppMount activation={activation} onContextUpdate={onAppContext} />
  ) : detail ? (
    <pre className="tool-detail">{detail}</pre>
  ) : undefined;

  const [expandedKeys, setExpandedKeys] = useState<string[]>(showApp ? [key] : []);

  return (
    <ThoughtChain
      className="tool-chain"
      items={[
        {
          key,
          title: item.name,
          description: map.label,
          status: map.status,
          blink: item.status === "pending",
          collapsible: !!content,
          content,
        },
      ]}
      // The live form stays open: ignore collapse while the app is mounted.
      expandedKeys={showApp ? [key] : expandedKeys}
      onExpand={showApp ? () => {} : setExpandedKeys}
    />
  );
}

export interface SessionMeta {
  conversationId: number | null;
  workingDir: string | null;
  codeMode: boolean;
  busy: boolean;
  folderMissing: boolean;
}

export interface BridgeHandlers {
  openform: (spec: unknown) => Promise<unknown>;
  send: (text: string) => Promise<unknown>;
  submit: (values: Record<string, unknown>) => Promise<unknown>;
  cancel: () => Promise<unknown>;
  state: () => Promise<unknown>;
}

interface Props {
  tabKey: string;
  /** Render this session in the workspace (single or split pane). */
  visible: boolean;
  /** Keyboard / debug-bridge focus within split view. */
  focused: boolean;
  splitRole: "primary" | "secondary" | null;
  onFocusPane: () => void;
  apiKey: string;
  model: string;
  onModelChange: (id: string) => void;
  server: ServerInfo | null;
  toolPolicies: Map<string, boolean>;
  onConversationsChanged: () => void;
  initialConversationId: number | null;
  initialWorkingDir?: string | null;
  onMeta: (key: string, meta: SessionMeta) => void;
  registerBridge: (key: string, handlers: BridgeHandlers | null) => void;
}

export function ChatSession({
  tabKey,
  visible,
  focused,
  splitRole,
  onFocusPane,
  apiKey,
  model,
  onModelChange,
  server,
  toolPolicies,
  onConversationsChanged,
  initialConversationId,
  initialWorkingDir,
  onMeta,
  registerBridge,
}: Props) {
  const [conversationId, setConversationId] = useState<number | null>(initialConversationId);
  const [connError, setConnError] = useState<string | null>(null);

  const chat = useAgentChat({
    apiKey,
    model,
    server,
    toolPolicies,
    conversationId,
    setConversationId,
    onConversationsChanged,
    setConnError,
  });
  const {
    messages, input, setInput, busy, queued, setQueued, formPending, activation,
    codeMode, workingDir, folderMissing, setCodeMode, setWorkingDir,
    submit, cancelTurn, hydrate, startProjectChat, onAppContext,
  } = chat;

  const composerBlocked = folderMissing && !!workingDir;

  // Hydrate the bound conversation (or seed a project-bound new chat) once.
  useEffect(() => {
    if (initialConversationId != null) void hydrate(initialConversationId);
    else if (initialWorkingDir) startProjectChat(initialWorkingDir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Report meta up for the tab label / spinner.
  useEffect(() => {
    onMeta(tabKey, { conversationId, workingDir, codeMode, busy, folderMissing });
  }, [tabKey, conversationId, workingDir, codeMode, busy, folderMissing, onMeta]);

  // Register debug-bridge handlers (read live via a ref so identities stay
  // stable — App dispatches bridge calls to the focused tab's handlers).
  const chatRef = useRef(chat);
  chatRef.current = chat;
  useEffect(() => {
    const handlers: BridgeHandlers = {
      openform: (spec) => chatRef.current.openFormBridge(spec),
      send: (text) => chatRef.current.sendBridge(text),
      submit: (values) => chatRef.current.submitBridge(values),
      cancel: () => chatRef.current.cancelBridge(),
      state: () => chatRef.current.bridgeState(),
    };
    registerBridge(tabKey, handlers);
    return () => registerBridge(tabKey, null);
  }, [tabKey, registerBridge]);

  const roles = useMemo(
    () => ({
      user: {
        placement: "end" as const,
        styles: { content: { background: "var(--user-bubble-bg)", color: "var(--user-bubble-text)" } },
        contentRender: (content: unknown) => (
          <div className="bubble-user-text">{String(content ?? "")}</div>
        ),
      },
      assistant: {
        placement: "start" as const,
        contentRender: (content: unknown, info: { status?: string }) => (
          <AssistantMarkdown content={String(content ?? "")} live={info?.status === "loading"} />
        ),
      },
      tool: {
        placement: "start" as const,
        variant: "borderless" as const,
        contentRender: (content: unknown) => (
          <ToolStep item={content as ToolItem} activation={activation} onAppContext={onAppContext} />
        ),
      },
      queued: {
        placement: "end" as const,
        variant: "borderless" as const,
        contentRender: (content: unknown) => {
          const q = content as { text: string; index: number };
          return (
            <div className="bubble queued">
              <span className="queued-text">{q.text}</span>
              <span className="queued-tag">queued</span>
              <button
                className="queued-remove"
                title="Remove from queue"
                onClick={() => setQueued((qs) => qs.filter((_, j) => j !== q.index))}
              >
                ✕
              </button>
            </div>
          );
        },
      },
    }),
    [setQueued, activation, onAppContext],
  );

  const bubbleItems = useMemo(() => {
    const items = messages.map((m, i) => {
      if (m.kind === "tool") return { key: `m${i}`, role: "tool", content: m };
      const streaming = m.role === "assistant" && i === messages.length - 1 && busy;
      return { key: `m${i}`, role: m.role, content: m.content, streaming, loading: streaming && !m.content };
    });
    queued.forEach((text, index) =>
      items.push({ key: `q${index}`, role: "queued", content: { text, index } } as never),
    );
    return items as ComponentProps<typeof Bubble.List>["items"];
  }, [messages, queued, busy]);

  return (
    <section
      className={[
        "chat-session",
        visible && "visible",
        focused && "focused",
        splitRole && `split-${splitRole}`,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={!visible}
      onPointerDown={onFocusPane}
    >
      <div className="session-main">
        <div className="session-bar">
          <CodeModeToggle
            codeMode={codeMode}
            workingDir={workingDir}
            folderMissing={folderMissing}
            onCodeModeChange={setCodeMode}
            onWorkingDirChange={setWorkingDir}
          />
        </div>

        {connError && <div className="error-banner">{connError}</div>}

        <section className="messages">
          {bubbleItems && bubbleItems.length > 0 ? (
            <Bubble.List items={bubbleItems} role={roles} autoScroll style={{ height: "100%" }} />
          ) : composerBlocked ? (
            <div className="chat-welcome folder-missing-empty">
              <FolderMissingNotice path={workingDir!} onPickFolder={setWorkingDir} />
            </div>
          ) : (
            <ChatWelcome onPick={submit} />
          )}
        </section>

        <section className="composer">
          {composerBlocked && (bubbleItems?.length ?? 0) > 0 && (
            <FolderMissingNotice path={workingDir!} onPickFolder={setWorkingDir} />
          )}
          <Sender
            value={input}
            onChange={setInput}
            onSubmit={submit}
            loading={busy}
            disabled={composerBlocked}
            readOnly={composerBlocked}
            onCancel={cancelTurn}
            onKeyDown={(e) => {
              if (busy && e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit(input);
                return false;
              }
            }}
            autoSize={{ minRows: 1, maxRows: 6 }}
            placeholder={
              composerBlocked
                ? "Project folder missing — choose a folder above to send messages"
                : !server
                  ? "Connect a server in Settings to start"
                  : busy
                    ? "Agent is working — Enter queues, ✕ cancels"
                    : formPending
                      ? "Form open — your message will queue (Enter)"
                      : codeMode
                        ? "Ask Omni to write code, refactor, or debug…"
                        : "Message… (Enter to send)"
            }
          />
          <div className="composer-footer">
            <ModelPicker value={model} onChange={onModelChange} />
          </div>
        </section>
      </div>
    </section>
  );
}
