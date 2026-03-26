import json
import os

import httpx

from models import Finding, ReviewReport

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")


def _ollama_httpx_timeout() -> httpx.Timeout:
    """Read timeout for Ollama /api/chat. Large PR diffs can take many minutes locally."""
    raw = (os.environ.get("OLLAMA_TIMEOUT") or "900").strip()
    if raw.lower() in ("0", "-1", "none", "unlimited"):
        return httpx.Timeout(
            connect=30.0,
            read=None,
            write=300.0,
            pool=None,
        )
    seconds = float(raw)
    return httpx.Timeout(
        connect=30.0,
        read=seconds,
        write=300.0,
        pool=seconds,
    )

DIFF_SYSTEM_PROMPT = """You are a code review assistant reviewing a unified diff (git patch). Focus on what changed: bugs, security, regressions, API breaks, tests, and style in the new/changed lines. Return a JSON object with this exact shape (no markdown, no extra text):
{
  "summary": "Brief one-line summary (e.g. '3 issues in the diff')",
  "findings": [
    {
      "line": 1,
      "severity": "error" | "warning" | "suggestion",
      "category": "style" | "security" | "best-practice" | "readability" | "performance" | "bug-risk" | "other",
      "message": "Short description of the issue",
      "suggestion": "Concrete fix or recommendation"
    }
  ]
}

Rules:
- Line numbers refer to the line number in the unified diff text provided (1-based, counting from the start of the diff).
- List ALL issues you find (up to 30). If the diff looks fine, return empty findings and summary "No issues found".
- severity: "error" for bugs/security, "warning" for likely issues, "suggestion" for improvements.
- Return only valid JSON, no code fences or explanation."""

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


def _strip_json_fence(raw: str) -> str:
    if not raw.startswith("```"):
        return raw
    lines = raw.split("\n")
    if lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines)


def _findings_from_payload(data: dict) -> list[Finding]:
    findings = data.get("findings") or []
    out: list[Finding] = []
    for f in findings:
        if not isinstance(f, dict):
            continue
        out.append(
            Finding(
                line=f.get("line", 1),
                severity=f.get("severity", "suggestion"),
                category=f.get("category", "other"),
                message=f.get("message", ""),
                suggestion=f.get("suggestion"),
                rule_source="llm",
            )
        )
    return out


def review_with_llm(
    code: str, language: str, *, input_kind: str = "code"
) -> ReviewReport:
    system = DIFF_SYSTEM_PROMPT if input_kind == "diff" else SYSTEM_PROMPT
    block_label = "Unified diff" if input_kind == "diff" else "Code"
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": f"Language: {language}\n\n{block_label}:\n```\n{code}\n```",
            },
        ],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.1},
    }

    url = f"{OLLAMA_BASE_URL}/api/chat"
    with httpx.Client(timeout=_ollama_httpx_timeout()) as client:
        resp = client.post(url, json=payload)
        resp.raise_for_status()
        body = resp.json()

    raw = ((body.get("message") or {}).get("content") or "").strip()
    if not raw:
        raise ValueError("Empty LLM response")

    raw = _strip_json_fence(raw)
    data = json.loads(raw)
    findings = _findings_from_payload(data)
    summary = data.get("summary") or f"{len(findings)} issues found"

    return ReviewReport(summary=summary, findings=findings)
