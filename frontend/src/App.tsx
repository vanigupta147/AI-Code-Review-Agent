import { useState } from "react";
import { CodeEditor } from "./components/CodeEditor";
import { LanguageSelector } from "./components/LanguageSelector";
import { ReportPanel } from "./components/ReportPanel";
import { submitReview } from "./api/review";
import type { Finding, ReviewReport } from "./types/review";
import "./App.css";

export default function App() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReview = async () => {
    setError(null);
    setReport(null);
    if (!code.trim()) {
      setError("Please enter some code to review.");
      return;
    }
    setLoading(true);
    try {
      const result = await submitReview({ code, language });
      setReport(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setLoading(false);
    }
  };

  const [applyFeedback, setApplyFeedback] = useState<string | null>(null);

  const handleApplySuggestion = (finding: Finding) => {
    if (!finding.suggestion || finding.line < 1) return;
    const suggestion = finding.suggestion.trim();
    const lines = code.split("\n");
    // Clamp to valid line so we always replace, never append (avoids adding lines when report line is off)
    let idx = Math.max(0, finding.line - 1);
    if (idx >= lines.length && lines.length > 0) idx = lines.length - 1;
    const commentPrefix = language === "python" ? "# " : "// ";

    // Single line that looks like code → replace the line; else replace with one comment line (never insert + keep)
    const isSingleLine = !suggestion.includes("\n");
    const looksLikeCode =
      /[=;(){}\[\]]|^\s*(const|let|var|return|if|for|def |import |from )/m.test(suggestion) &&
      suggestion.length < 200;
    const replaceWithCode = isSingleLine && looksLikeCode;

    const newLine = replaceWithCode
      ? suggestion
      : commentPrefix + (isSingleLine ? suggestion : suggestion.split("\n")[0].trim());

    if (lines.length === 0) {
      setCode(newLine);
      setApplyFeedback("Applied");
    } else {
      const before = lines.slice(0, idx);
      const after = lines.slice(idx + 1);
      setCode([...before, newLine, ...after].join("\n"));
      setApplyFeedback(replaceWithCode ? `Replaced line ${idx + 1}` : `Replaced line ${idx + 1} with comment`);
    }
    // Remove only this finding so the rest stay visible
    setReport((prev) => {
      if (!prev) return null;
      const rest = prev.findings.filter((f) => f !== finding);
      const summary =
        rest.length === 0
          ? "No issues remaining."
          : `${rest.length} issue${rest.length === 1 ? "" : "s"} remaining`;
      return { summary, findings: rest };
    });
    window.setTimeout(() => setApplyFeedback(null), 2500);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Code Review Agent</h1>
        <p className="tagline">Paste a snippet, get review feedback (on-demand)</p>
      </header>

      <div className="app-toolbar">
        <LanguageSelector
          value={language}
          onChange={setLanguage}
          disabled={loading}
        />
        <button
          type="button"
          className="review-btn"
          onClick={handleReview}
          disabled={loading}
        >
          {loading ? "Reviewing…" : "Review"}
        </button>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {applyFeedback && (
        <div className="apply-feedback" role="status">
          {applyFeedback}
        </div>
      )}

      <div className="app-main">
        <div className="editor-wrap">
          <label className="editor-label" htmlFor="code-editor">
            Code
          </label>
          <CodeEditor value={code} onChange={setCode} disabled={loading} />
        </div>
        <div className="report-wrap">
          <label className="report-label">Report</label>
          <ReportPanel
            report={report}
            onApplySuggestion={handleApplySuggestion}
          />
          {!report && !loading && (
            <p className="report-placeholder">
              Click &quot;Review&quot; to get feedback.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
