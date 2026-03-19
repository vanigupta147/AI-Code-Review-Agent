import type { ReviewReport, ReviewRequest } from "../types/review";

const API_BASE =
  typeof import.meta.env?.VITE_API_URL === "string"
    ? import.meta.env.VITE_API_URL
    : "/api";

export async function submitReview(
  request: ReviewRequest
): Promise<ReviewReport> {
  const res = await fetch(`${API_BASE}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Review request failed");
  }
  return res.json() as Promise<ReviewReport>;
}
