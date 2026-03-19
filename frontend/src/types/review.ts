export type Severity = "error" | "warning" | "suggestion";

export interface Finding {
  line: number;
  severity: Severity;
  category: string;
  message: string;
  suggestion?: string;
  rule_source?: "llm" | "eslint" | "rule";
}

export interface ReviewReport {
  summary: string;
  findings: Finding[];
}

export interface ReviewRequest {
  code: string;
  language: string;
  filename?: string;
}
