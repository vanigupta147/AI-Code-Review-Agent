from models import ReviewReport, ReviewRequest

from agent.llm import review_with_llm


def run_review(request: ReviewRequest) -> ReviewReport:
    return review_with_llm(
        request.code, request.language, input_kind=request.input_kind
    )
