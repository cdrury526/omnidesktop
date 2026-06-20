/**
 * The DSL version. Bump when a change to the field union or `when` grammar is
 * not backward-compatible; specs carry `v` so a host can reject specs it can't
 * render. The agent is told (via the tool schema) to always emit the current
 * version.
 */
export const DSL_VERSION = 1 as const;
export type DslVersion = typeof DSL_VERSION;
