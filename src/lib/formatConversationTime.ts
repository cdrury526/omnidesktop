/** SQLite `datetime('now')` values — UTC wall time without a `Z` suffix. */
function parseSqliteUtc(isoLike: string): Date {
  const trimmed = isoLike.trim();
  if (!trimmed) return new Date(NaN);
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  return new Date(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
}

const cstFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

/** Last-activity time for a conversation row, in US Central (CST/CDT). */
export function formatConversationTime(updatedAt: string): string {
  const date = parseSqliteUtc(updatedAt);
  if (Number.isNaN(date.getTime())) return updatedAt;
  return cstFormatter.format(date);
}
