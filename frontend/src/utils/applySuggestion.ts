/** Heuristic: single-line suggestion that looks like code (for Apply button). */
const LOOKS_LIKE_CODE =
  /[=;(){}\[\]]|^\s*(const|let|var|return|if|for|def |import |from )/m;

export function commentPrefixForLanguage(language: string): string {
  return language === "python" ? "# " : "// ";
}

export function suggestionLooksLikeCode(suggestion: string): boolean {
  const trimmed = suggestion.trim();
  return (
    !trimmed.includes("\n") &&
    trimmed.length < 200 &&
    LOOKS_LIKE_CODE.test(trimmed)
  );
}

export function buildAppliedLine(
  suggestion: string,
  language: string
): { line: string; replaceWithCode: boolean } {
  const trimmed = suggestion.trim();
  const isSingleLine = !trimmed.includes("\n");
  const replaceWithCode = suggestionLooksLikeCode(trimmed);
  const prefix = commentPrefixForLanguage(language);
  const line = replaceWithCode
    ? trimmed
    : prefix +
      (isSingleLine ? trimmed : trimmed.split("\n")[0].trim());
  return { line, replaceWithCode };
}

/** 0-based index; clamps so we always replace an existing line when possible. */
export function clampLineIndex(lineNumber1Based: number, lineCount: number): number {
  if (lineCount <= 0) return 0;
  let idx = Math.max(0, lineNumber1Based - 1);
  if (idx >= lineCount) idx = lineCount - 1;
  return idx;
}
