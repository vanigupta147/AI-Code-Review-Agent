import type { ReviewReport, ReviewRequest } from "../types/review";

const API_BASE =
  typeof import.meta.env?.VITE_API_URL === "string"
    ? import.meta.env.VITE_API_URL
    : "/api";

function parseJsonError(
  body: unknown,
  fallback: string
): string {
  if (!body || typeof body !== "object") return fallback;
  const o = body as Record<string, unknown>;
  if (typeof o.error === "string") return o.error;
  const d = o.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0] && typeof d[0] === "object" && d[0] !== null) {
    const first = d[0] as { msg?: string };
    if (typeof first.msg === "string") return first.msg;
  }
  return fallback;
}

export async function submitReview(
  request: ReviewRequest
): Promise<ReviewReport> {
  const res = await fetch(`${API_BASE}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(parseJsonError(err, res.statusText));
  }
  return res.json() as Promise<ReviewReport>;
}

/** Upload a file for review (multipart). Backend reads UTF-8 text. */
export async function submitReviewUpload(
  file: File,
  language: string
): Promise<ReviewReport> {
  const form = new FormData();
  form.append("file", file);
  form.append("language", language);
  const res = await fetch(`${API_BASE}/review/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(parseJsonError(err, "Review upload failed"));
  }
  return res.json() as Promise<ReviewReport>;
}
