import asyncio
import traceback

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from models import GithubUrlRequest, ReviewReport, ReviewRequest
from agent.review_agent import run_review
from github_diff import fetch_github_diff

router = APIRouter(prefix="/review", tags=["review"])

MAX_UPLOAD_BYTES = 1024 * 1024  # 1 MB
MAX_DIFF_CHARS = 500_000  # guardrail for pasted/fetched unified diffs

_QUOTA_MARKERS = (
    "quota",
    "exceeded",
    "rate limit",
    "insufficient_quota",
    "billing",
)


def _is_quota_error(message: str) -> bool:
    lower = message.lower()
    return any(m in lower for m in _QUOTA_MARKERS)


async def _review_async(body: ReviewRequest) -> ReviewReport:
    """Run blocking LLM work in a thread so the event loop stays responsive."""
    try:
        return await asyncio.to_thread(run_review, body)
    except Exception as err:  # noqa: BLE001
        traceback.print_exc()
        raw = str(err)
        if _is_quota_error(raw):
            raise HTTPException(
                status_code=429,
                detail="Rate limit or quota exceeded. Try again later or check your LLM provider.",
            ) from err
        raise HTTPException(status_code=500, detail=raw) from err


@router.post("", response_model=ReviewReport)
@router.post("/", response_model=ReviewReport)
async def post_review(body: ReviewRequest) -> ReviewReport:
    if not (body.code or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Missing or empty 'code' in request body.",
        )
    if body.input_kind == "diff" and len(body.code) > MAX_DIFF_CHARS:
        raise HTTPException(
            status_code=413,
            detail=f"Diff too large (max {MAX_DIFF_CHARS} characters).",
        )
    return await _review_async(body)


@router.post("/github", response_model=ReviewReport)
async def post_review_github(body: GithubUrlRequest) -> ReviewReport:
    """Fetch unified diff for a PR, commit, or compare URL and run the same review pipeline."""
    url = (body.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="Missing or empty 'url'.")
    try:
        diff = await asyncio.to_thread(fetch_github_diff, url)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    if len(diff) > MAX_DIFF_CHARS:
        raise HTTPException(
            status_code=413,
            detail=f"Fetched diff too large (max {MAX_DIFF_CHARS} characters).",
        )
    req = ReviewRequest(code=diff, language="diff", input_kind="diff")
    return await _review_async(req)


@router.post("/upload", response_model=ReviewReport)
async def post_review_upload(
    file: UploadFile = File(...),
    language: str = Form("javascript"),
) -> ReviewReport:
    """Review a UTF-8 text file (multipart: `file` + optional `language`)."""
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB).",
        )
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="File must be UTF-8 text.",
        ) from exc
    if not text.strip():
        raise HTTPException(status_code=400, detail="Empty file.")
    lang = (language or "javascript").strip() or "javascript"
    body = ReviewRequest(
        code=text,
        language=lang,
        filename=file.filename,
    )
    return await _review_async(body)
