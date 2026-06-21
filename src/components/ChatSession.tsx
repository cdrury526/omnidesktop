/**
 * One live chat session — the unit a tab wraps. Owns its conversation id and the
 * `useAgentChat` loop, and renders the transcript + composer + its own slide-out
 * MCP pane. Every open tab mounts one of these and stays mounted (hidden tabs
 * are `display:none`), so a backgrounded session keeps streaming its turn.
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
import { AppPane } from "./AppPane";
import { ChatWelcome } from "./ChatWelcome";
import { useAgentChat } from "../hooks/useAgentChat";
import type { DisplayItem } from "../agent/runner";
import type { ServerInfo } from "../mcp/host-bridge";

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

/** One tool call as a ThoughtChain step with expandable args/result detail. */
function ToolStep({ item }: { item: ToolItem }) {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const map = TOOL_STATUS[item.status];
  const argsText = pretty(item.args);
  const resultText = item.status === "pending" ? "" : pretty(item.result);
  const detail = [argsText && `arguments:\n${argsText}`, resultText && `result:\n${resultText}`]
    .filter(Boolean)
    .join("\n\n");
  return (
    <ThoughtChain
      className="tool-chain"
      items={[
        {
          key: item.callId || item.name,
          title: item.name,
          description: map.label,
          status: map.status,
          blink: item.status === "pending",
          collapsible: !!detail,
          content: detail ? <pre className="tool-detail">{detail}</pre> : undefined,
        },
      ]}
      expandedKeys={expandedKeys}
      onExpand={setExpandedKeys}
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
    conversationId,
    setConversationId,
    onConversationsChanged,
    setConnError,
  });
  const {
    messages, input, setInput, busy, queued, setQueued, formPending, activation,
    codeMode, workingDir, folderMissing, setCodeMode, setWorkingDir,
    submit, cancelTurn, hydrate, startProjectChat, onAppContext, onPaneClose,
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
        contentRender: (content: unknown) => <ToolStep item={content as ToolItem} />,
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
    [setQueued],
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

      <AppPane activation={activation} onClose={onPaneClose} onContextUpdate={onAppContext} />
    </section>
  );
}
