import traceback

from fastapi import APIRouter, HTTPException

from models import ReviewReport, ReviewRequest
from agent.review_agent import run_review

router = APIRouter(prefix="/review", tags=["review"])


def _is_quota_error(message: str) -> bool:
    lower = message.lower()
    return (
        "quota" in lower
        or "exceeded" in lower
        or "rate limit" in lower
        or "insufficient_quota" in lower
        or "billing" in lower
    )


@router.post("", response_model=ReviewReport)
@router.post("/", response_model=ReviewReport)
async def post_review(body: ReviewRequest) -> ReviewReport:
    if not (body.code or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Missing or empty 'code' in request body.",
        )
    try:
        return run_review(body)
    except Exception as err:  # noqa: BLE001
        traceback.print_exc()
        raw = str(err)
        if _is_quota_error(raw):
            raise HTTPException(
                status_code=429,
                detail="Rate limit or quota exceeded. Try again later or check your LLM provider.",
            ) from err
        raise HTTPException(status_code=500, detail=raw) from err
