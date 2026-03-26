import { useCallback, useRef, useState } from "react";
import { CodeEditor } from "./components/CodeEditor";
import { FileUpload } from "./components/FileUpload";
import { LanguageSelector } from "./components/LanguageSelector";
import { ReportPanel } from "./components/ReportPanel";
import { submitReview, submitReviewGithub } from "./api/review";
import type { Finding, ReviewReport } from "./types/review";
import {
  buildAppliedLine,
  clampLineIndex,
} from "./utils/applySuggestion";
import { shouldFetchGithubUrl } from "./utils/githubUrl";
import "./App.css";

const APPLY_FEEDBACK_MS = 2500;

type InputMode = "code" | "github";

export default function App() {
  const [inputMode, setInputMode] = useState<InputMode>("code");
  const [code, setCode] = useState("");
  const [githubOrDiff, setGithubOrDiff] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [applyFeedback, setApplyFeedback] = useState<string | null>(null);
  const applyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const showApplyFeedback = useCallback((msg: string) => {
    if (applyFeedbackTimerRef.current) {
      clearTimeout(applyFeedbackTimerRef.current);
    }
    setApplyFeedback(msg);
    applyFeedbackTimerRef.current = setTimeout(() => {
      setApplyFeedback(null);
      applyFeedbackTimerRef.current = null;
    }, APPLY_FEEDBACK_MS);
  }, []);

  const handleFileLoaded = useCallback(
    (content: string, filename: string, detectedLang: string | null) => {
      setError(null);
      setReport(null);
      setInputMode("code");
      setCode(content);
      setUploadedFilename(filename);
      if (detectedLang) setLanguage(detectedLang);
    },
    []
  );

  const handleCodeChange = useCallback((v: string) => {
    setCode(v);
    setUploadedFilename(null);
  }, []);

  const handleReview = useCallback(async () => {
    setError(null);
    setReport(null);
    if (inputMode === "github") {
      const raw = githubOrDiff.trim();
      if (!raw) {
        setError("Paste a GitHub PR, commit, or compare URL, or a unified diff.");
        return;
      }
      setLoading(true);
      try {
        const result = shouldFetchGithubUrl(githubOrDiff)
          ? await submitReviewGithub(raw.split("\n")[0].trim())
          : await submitReview({
              code: raw,
              language: "diff",
              input_kind: "diff",
            });
        setReport(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Review failed");
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!code.trim()) {
      setError("Paste code or upload a file to review.");
      return;
    }
    setLoading(true);
    try {
      const result = await submitReview({
        code,
        language,
        filename: uploadedFilename ?? undefined,
        input_kind: "code",
      });
      setReport(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setLoading(false);
    }
  }, [code, githubOrDiff, inputMode, language, uploadedFilename]);

  const handleApplySuggestion = useCallback(
    (finding: Finding) => {
      if (!finding.suggestion || finding.line < 1) return;
      const lines = code.split("\n");
      const idx = clampLineIndex(finding.line, lines.length);
      const { line: newLine, replaceWithCode } = buildAppliedLine(
        finding.suggestion,
        language
      );

      if (lines.length === 0) {
        setCode(newLine);
        showApplyFeedback("Applied");
      } else {
        const before = lines.slice(0, idx);
        const after = lines.slice(idx + 1);
        setCode([...before, newLine, ...after].join("\n"));
        showApplyFeedback(
          replaceWithCode
            ? `Replaced line ${idx + 1}`
            : `Replaced line ${idx + 1} with comment`
        );
      }
      setReport((prev) => {
        if (!prev) return null;
        const rest = prev.findings.filter((f) => f !== finding);
        const summary =
          rest.length === 0
            ? "No issues remaining."
            : `${rest.length} issue${rest.length === 1 ? "" : "s"} remaining`;
        return { summary, findings: rest };
      });
    },
    [code, language, showApplyFeedback]
  );

  const handleFileError = useCallback((msg: string) => setError(msg), []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Code Review Agent</h1>
        <p className="tagline">
          Paste a snippet, upload a file, or use a GitHub URL / PR diff — review
          on demand.
        </p>
      </header>

      <div className="input-mode-tabs" role="tablist" aria-label="Input source">
        <button
          type="button"
          role="tab"
          aria-selected={inputMode === "code"}
          className={`mode-tab ${inputMode === "code" ? "active" : ""}`}
          onClick={() => {
            setInputMode("code");
            setError(null);
          }}
          disabled={loading}
        >
          Code / file
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={inputMode === "github"}
          className={`mode-tab ${inputMode === "github" ? "active" : ""}`}
          onClick={() => {
            setInputMode("github");
            setError(null);
          }}
          disabled={loading}
        >
          GitHub URL or diff
        </button>
      </div>

      <div className="app-toolbar">
        {inputMode === "code" && (
          <LanguageSelector
            value={language}
            onChange={setLanguage}
            disabled={loading}
          />
        )}
        {inputMode === "code" && (
          <FileUpload
            onLoaded={handleFileLoaded}
            onError={handleFileError}
            disabled={loading}
          />
        )}
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
          {inputMode === "code" ? (
            <>
              <div className="editor-label-row">
                <label className="editor-label" htmlFor="code-editor">
                  Code
                </label>
                {uploadedFilename && (
                  <span className="uploaded-filename" title={uploadedFilename}>
                    Loaded: {uploadedFilename}
                  </span>
                )}
              </div>
              <CodeEditor
                value={code}
                onChange={handleCodeChange}
                disabled={loading}
              />
            </>
          ) : (
            <>
              <div className="editor-label-row">
                <label className="editor-label" htmlFor="github-diff-input">
                  GitHub URL or unified diff
                </label>
              </div>
              <p className="github-hint">
                Paste a PR, commit, or compare URL (fetched via GitHub API) — or
                paste a raw unified diff. Optional: set{" "}
                <code>GITHUB_TOKEN</code> in <code>backend/.env</code> for
                private repos and higher rate limits.
              </p>
              <textarea
                id="github-diff-input"
                className="code-editor github-diff-input"
                value={githubOrDiff}
                onChange={(e) => setGithubOrDiff(e.target.value)}
                disabled={loading}
                placeholder={`https://github.com/owner/repo/pull/123\nor paste unified diff output (diff --git ...)`}
                spellCheck={false}
              />
            </>
          )}
        </div>
        <div className="report-wrap">
          <label className="report-label">Report</label>
          <ReportPanel
            report={report}
            onApplySuggestion={
              inputMode === "code" ? handleApplySuggestion : undefined
            }
          />
          {!report && !loading && (
            <p className="report-placeholder">
              {inputMode === "code"
                ? "Paste code, upload a file, then click \"Review\" for feedback."
                : "Paste a GitHub link or diff, then click \"Review\"."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
