export type ToolUsageStatus =
  | "pending"
  | "awaiting_approval"
  | "done"
  | "error"
  | "cancelled"
  | "rejected";

export interface ToolUsageEvent {
  id: number;
  ts: string;
  type: string;
  conversation_id: number | null;
  data: string | null;
}

export interface ToolUsageStateRow {
  conversationId: number;
  updatedAt?: string;
  state: unknown;
}

export interface ToolUsageRecord {
  conversationId: number;
  callId: string;
  toolName: string;
  args?: unknown;
  output?: unknown;
  status: ToolUsageStatus;
  ok?: boolean;
  error?: string;
  code?: string;
  approval: "none" | "pending" | "approved" | "rejected";
  model?: string;
  stateUpdatedAt?: string;
}

export interface CodeTelemetrySummary {
  toolName: string;
  starts: number;
  ends: number;
  errors: number;
  failures: number;
  timeouts: number;
  truncated: number;
  durationsMs: number[];
}

export interface ToolUsageReport {
  records: ToolUsageRecord[];
  summary: {
    totalCalls: number;
    byTool: Record<string, number>;
    byStatus: Record<string, number>;
    byModel: Record<string, number>;
    codeTelemetry: CodeTelemetrySummary[];
  };
}

const MAX_VALUE_STRING = 8_000;

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > MAX_VALUE_STRING
      ? `${value.slice(0, MAX_VALUE_STRING)}…[truncated]`
      : value;
  }
  if (Array.isArray(value)) return value.map(normalizeValue);
  const obj = objectRecord(value);
  if (!obj) return value;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, normalizeValue(v)]));
}

function callIdOf(item: Record<string, unknown>): string {
  return String(item.call_id ?? item.callId ?? item.id ?? "");
}

function outputOf(item: Record<string, unknown>): unknown {
  return normalizeValue(parseMaybeJson(item.output ?? item.result));
}

function statusFromOutput(output: unknown): ToolUsageStatus {
  const obj = objectRecord(output);
  if (obj) {
    if (obj.cancelled === true || obj.status === "cancelled") return "cancelled";
    if (obj.rejected === true || obj.status === "rejected") return "rejected";
    if (obj.ok === false || obj.error != null || obj.code != null) return "error";
    return "done";
  }
  const text = typeof output === "string" ? output : JSON.stringify(output ?? "");
  if (text.includes('"cancelled"')) return "cancelled";
  if (text.includes('"rejected"') || text.includes("rejected by user")) return "rejected";
  if (text.includes('"error"')) return "error";
  return "done";
}

function errorParts(output: unknown): Pick<ToolUsageRecord, "ok" | "error" | "code"> {
  const obj = objectRecord(output);
  if (!obj) return {};
  return {
    ok: typeof obj.ok === "boolean" ? obj.ok : undefined,
    error: obj.error == null ? undefined : String(obj.error),
    code: obj.code == null ? undefined : String(obj.code),
  };
}

function eventData(event: ToolUsageEvent): Record<string, unknown> {
  const parsed = parseMaybeJson(event.data);
  return objectRecord(parsed) ?? {};
}

function eventCallIds(event: ToolUsageEvent): string[] {
  const data = eventData(event);
  if (Array.isArray(data.callIds)) return data.callIds.map(String);
  if (data.callId != null) return [String(data.callId)];
  return [];
}

function latestModelFor(events: ToolUsageEvent[], conversationId: number): string | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.conversation_id !== conversationId || event.type !== "turn.start") continue;
    const model = eventData(event).model;
    if (model != null) return String(model);
  }
  return undefined;
}

function approvalByCall(events: ToolUsageEvent[]): Map<string, ToolUsageRecord["approval"]> {
  const out = new Map<string, ToolUsageRecord["approval"]>();
  for (const event of events) {
    if (event.type !== "tool.approve" && event.type !== "tool.reject") continue;
    const approval = event.type === "tool.approve" ? "approved" : "rejected";
    for (const callId of eventCallIds(event)) out.set(callId, approval);
  }
  return out;
}

function codeTelemetry(events: ToolUsageEvent[]): CodeTelemetrySummary[] {
  const byName = new Map<string, CodeTelemetrySummary>();
  const entry = (name: string) => {
    let current = byName.get(name);
    if (!current) {
      current = {
        toolName: name,
        starts: 0,
        ends: 0,
        errors: 0,
        failures: 0,
        timeouts: 0,
        truncated: 0,
        durationsMs: [],
      };
      byName.set(name, current);
    }
    return current;
  };

  for (const event of events) {
    if (!event.type.startsWith("code_tool.")) continue;
    const data = eventData(event);
    const name = String(data.name ?? "unknown");
    const current = entry(name);
    if (event.type === "code_tool.start") current.starts += 1;
    if (event.type === "code_tool.end") {
      current.ends += 1;
      if (data.ok === false) current.failures += 1;
      if (data.truncated) current.truncated += 1;
      if (typeof data.durationMs === "number") current.durationsMs.push(data.durationMs);
    }
    if (event.type === "code_tool.error") {
      current.errors += 1;
      if (data.timeout) current.timeouts += 1;
      if (typeof data.durationMs === "number") current.durationsMs.push(data.durationMs);
    }
  }

  return [...byName.values()].sort((a, b) => a.toolName.localeCompare(b.toolName));
}

export function buildToolUsageReport(
  states: ToolUsageStateRow[],
  events: ToolUsageEvent[],
): ToolUsageReport {
  const approval = approvalByCall(events);
  const records: ToolUsageRecord[] = [];

  for (const row of states) {
    const state = objectRecord(row.state);
    const messages = Array.isArray(state?.messages) ? state.messages : [];
    const pendingIds = new Set(
      (Array.isArray(state?.pendingToolCalls) ? state.pendingToolCalls : [])
        .map((raw) => callIdOf(objectRecord(raw) ?? {}))
        .filter(Boolean),
    );
    const awaitingApproval = state?.status === "awaiting_approval";
    const byCall = new Map<string, ToolUsageRecord>();
    const model = latestModelFor(events, row.conversationId);

    for (const raw of messages) {
      const item = objectRecord(raw);
      if (!item) continue;
      if (item.type === "function_call") {
        const callId = callIdOf(item);
        if (!callId) continue;
        byCall.set(callId, {
          conversationId: row.conversationId,
          callId,
          toolName: String(item.name ?? "tool"),
          args: normalizeValue(parseMaybeJson(item.arguments ?? item.args)),
          status: awaitingApproval && pendingIds.has(callId) ? "awaiting_approval" : "pending",
          approval: approval.get(callId) ?? (awaitingApproval && pendingIds.has(callId) ? "pending" : "none"),
          model,
          stateUpdatedAt: row.updatedAt,
        });
      }
      if (item.type === "function_call_output") {
        const callId = callIdOf(item);
        const record = byCall.get(callId);
        if (!record) continue;
        const output = outputOf(item);
        record.output = output;
        record.status = statusFromOutput(output);
        Object.assign(record, errorParts(output));
        record.approval = approval.get(callId) ?? record.approval;
      }
    }

    records.push(...byCall.values());
  }

  records.sort((a, b) => b.conversationId - a.conversationId || a.callId.localeCompare(b.callId));
  const byTool: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byModel: Record<string, number> = {};
  for (const record of records) {
    byTool[record.toolName] = (byTool[record.toolName] ?? 0) + 1;
    byStatus[record.status] = (byStatus[record.status] ?? 0) + 1;
    if (record.model) byModel[record.model] = (byModel[record.model] ?? 0) + 1;
  }

  return {
    records,
    summary: {
      totalCalls: records.length,
      byTool,
      byStatus,
      byModel,
      codeTelemetry: codeTelemetry(events),
    },
  };
}
