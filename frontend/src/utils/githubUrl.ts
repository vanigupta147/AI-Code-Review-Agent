/** True when the input is only a GitHub web URL (fetch diff via API). Multi-line unified diff returns false. */
export function shouldFetchGithubUrl(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const lower = t.slice(0, 64).toLowerCase();
  if (
    lower.startsWith("diff --git") ||
    lower.startsWith("--- ") ||
    lower.startsWith("+++ ") ||
    lower.startsWith("index ")
  ) {
    return false;
  }
  const firstLine = t.split("\n")[0].trim();
  if (!/^https?:\/\/(www\.)?github\.com\//i.test(firstLine)) return false;
  const nl = t.indexOf("\n");
  const rest = nl === -1 ? "" : t.slice(nl + 1).trim();
  return !rest;
}
