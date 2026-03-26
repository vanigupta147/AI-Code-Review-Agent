from typing import Literal, Optional

from pydantic import BaseModel, Field


Severity = Literal["error", "warning", "suggestion"]


class Finding(BaseModel):
    line: int
    severity: Severity
    category: str
    message: str
    suggestion: Optional[str] = None
    rule_source: Optional[Literal["llm", "eslint", "rule"]] = "llm"


class ReviewReport(BaseModel):
    summary: str
    findings: list[Finding] = Field(default_factory=list)


class ReviewRequest(BaseModel):
    code: str
    language: str = "javascript"
    filename: Optional[str] = None
    input_kind: Literal["code", "diff"] = Field(
        default="code",
        description="When 'diff', the payload is a unified diff (patch), not plain source.",
    )


class GithubUrlRequest(BaseModel):
    """Fetch unified diff from a GitHub PR, commit, or compare URL via the REST API."""

    url: str
