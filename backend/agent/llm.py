import json
import os

import httpx

from models import Finding, ReviewReport

# Ollama defaults: base URL, model name, and timeout (seconds)
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")
OLLAMA_TIMEOUT = float(os.environ.get("OLLAMA_TIMEOUT", "300"))


SYSTEM_PROMPT = """You are a code review assistant. Review the provided code and return a JSON object with this exact shape (no markdown, no extra text):
{
  "summary": "Brief one-line summary (e.g. '5 issues found')",
  "findings": [
    {
      "line": 1,
      "severity": "error" | "warning" | "suggestion",
      "category": "style" | "security" | "best-practice" | "readability" | "performance" | "bug-risk" | "other",
      "message": "Short description of the issue",
      "suggestion": "One-line concrete fix when possible (actual code to replace the line), or short recommendation"
    }
  ]
}

Rules:
- List ALL issues you find in one response. Be comprehensive so the user gets a full review without re-running.
- severity: "error" for bugs/security, "warning" for likely issues, "suggestion" for improvements.
- Include every issue you can find (up to 30). If code is fine, return empty findings and summary "No issues found".
- Line numbers must be integers (1-based). One finding per issue; use the line where the issue is.
- suggestion: prefer a single line of replacement code the user can apply (e.g. "const x = 1" not "Use const"). If the fix is not a simple replacement, give a short actionable line.
- Return only valid JSON, no code fences or explanation."""


def review_with_llm(code: str, language: str) -> ReviewReport:
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Language: {language}\n\nCode:\n```\n{code}\n```",
            },
        ],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.1},
    }

    with httpx.Client(timeout=OLLAMA_TIMEOUT) as client:
        resp = client.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload,
        )
        resp.raise_for_status()

    body = resp.json()
    raw = (body.get("message") or {}).get("content") or ""
    raw = raw.strip()
    if not raw:
        raise ValueError("Empty LLM response")

    # Ollama may wrap JSON in markdown code blocks; strip them
    if raw.startswith("```"):
        lines = raw.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw = "\n".join(lines)

    data = json.loads(raw)
    findings = data.get("findings") or []
    summary = data.get("summary") or f"{len(findings)} issues found"

    out_findings = []
    for f in findings:
        if not isinstance(f, dict):
            continue
        out_findings.append(
            Finding(
                line=f.get("line", 1),
                severity=f.get("severity", "suggestion"),
                category=f.get("category", "other"),
                message=f.get("message", ""),
                suggestion=f.get("suggestion"),
                rule_source="llm",
            )
        )

    return ReviewReport(summary=summary, findings=out_findings)
