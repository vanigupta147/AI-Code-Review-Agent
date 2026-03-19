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
