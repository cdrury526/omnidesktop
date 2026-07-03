/**
 * Per-turn telemetry extracted from the SDK's final response object.
 */
export interface TurnTelemetry {
  calls: number;
  model?: string;
  provider?: string;
  status?: string;
  finishReason?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  cost: number;
}

export function emptyTelemetry(): TurnTelemetry {
  return {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
    cost: 0,
  };
}

export function mergeTurnResponse(acc: TurnTelemetry, response: unknown): void {
  const r = response as {
    model?: string;
    status?: unknown;
    incompleteDetails?: { reason?: string } | null;
    openrouterMetadata?: { attempts?: Array<{ provider?: string }> };
    usage?: {
      inputTokens?: number; outputTokens?: number; totalTokens?: number; cost?: number;
      inputTokensDetails?: { cachedTokens?: number };
      outputTokensDetails?: { reasoningTokens?: number };
    } | null;
  };
  acc.calls += 1;
  if (typeof r.model === "string") acc.model = r.model;
  if (typeof r.status === "string") acc.status = r.status;
  if (r.incompleteDetails?.reason) acc.finishReason = r.incompleteDetails.reason;
  const attempts = r.openrouterMetadata?.attempts;
  if (Array.isArray(attempts) && attempts.length) {
    acc.provider = attempts[attempts.length - 1]?.provider ?? acc.provider;
  }
  const u = r.usage;
  if (u) {
    acc.inputTokens += u.inputTokens ?? 0;
    acc.outputTokens += u.outputTokens ?? 0;
    acc.totalTokens += u.totalTokens ?? 0;
    acc.cachedTokens += u.inputTokensDetails?.cachedTokens ?? 0;
    acc.reasoningTokens += u.outputTokensDetails?.reasoningTokens ?? 0;
    acc.cost += u.cost ?? 0;
  }
}

export function telemetryData(t: TurnTelemetry): Record<string, unknown> {
  if (t.calls === 0) return {};
  const out: Record<string, unknown> = {
    calls: t.calls,
    inputTokens: t.inputTokens,
    outputTokens: t.outputTokens,
    totalTokens: t.totalTokens,
  };
  if (t.model) out.usedModel = t.model;
  if (t.provider) out.provider = t.provider;
  if (t.status) out.status = t.status;
  if (t.finishReason) out.finishReason = t.finishReason;
  if (t.cachedTokens) out.cachedTokens = t.cachedTokens;
  if (t.reasoningTokens) out.reasoningTokens = t.reasoningTokens;
  if (t.cost) out.cost = t.cost;
  return out;
}
