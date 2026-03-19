import type { Finding, ReviewReport } from "../types/review";

interface ReportPanelProps {
  report: ReviewReport | null;
  onApplySuggestion?: (finding: Finding) => void;
}

const severityClass: Record<string, string> = {
  error: "severity-error",
  warning: "severity-warning",
  suggestion: "severity-suggestion",
};

export function ReportPanel({
  report,
  onApplySuggestion,
}: ReportPanelProps) {
  if (!report) return null;

  return (
    <section className="report-panel" aria-label="Review report">
      <h3 className="report-summary">{report.summary}</h3>
      <ul className="findings-list">
        {report.findings.length === 0 ? (
          <li className="finding finding-empty">No issues found.</li>
        ) : (
          report.findings.map((f, i) => (
            <li key={i} className="finding">
              <div className="finding-header">
                <span className={`finding-severity ${severityClass[f.severity] ?? ""}`}>
                  {f.severity}
                </span>
                <span className="finding-meta">
                  Line {f.line} · {f.category}
                </span>
              </div>
              <p className="finding-message">{f.message}</p>
              {f.suggestion && (
                <div className="finding-suggestion">
                  <span className="finding-suggestion-label">Suggestion:</span>
                  <div className="finding-suggestion-code">
                    <code>{f.suggestion}</code>
                  </div>
                  {onApplySuggestion && (
                    <button
                      type="button"
                      className="apply-btn"
                      onClick={() => onApplySuggestion(f)}
                    >
                      Apply
                    </button>
                  )}
                </div>
              )}
            </li>
          ))
        )}
      </ul>
      {report.findings.length > 0 && (
        <p className="report-panel-footer">
          Apply fixes above, or run Review again after editing your code.
        </p>
      )}
    </section>
  );
}
