"""Resolve GitHub web URLs to API endpoints and fetch unified diff text."""

import os
import re
from urllib.parse import urlparse

import httpx

GITHUB_API = "https://api.github.com"
MAX_DIFF_BYTES = 2 * 1024 * 1024  # cap response size


def _strip_git_suffix(name: str) -> str:
    return name[:-4] if name.endswith(".git") else name


def _headers() -> dict[str, str]:
    token = (os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or "").strip()
    h = {
        "Accept": "application/vnd.github.diff",
        "User-Agent": "AI-Code-Review-Agent",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def build_api_url(url: str) -> str:
    raw = url.strip()
    if not raw:
        raise ValueError("Empty URL.")
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    parsed = urlparse(raw)
    host = (parsed.netloc or "").lower()
    if "github.com" not in host:
        raise ValueError("URL must be a github.com link.")
    path = (parsed.path or "").strip("/")
    if not path:
        raise ValueError("Missing repository path.")
    parts = path.split("/")
    if len(parts) < 2:
        raise ValueError("Invalid GitHub URL.")
    owner, repo = parts[0], _strip_git_suffix(parts[1])
    if len(parts) == 2:
        raise ValueError(
            "Repository-only URLs are not supported. "
            "Use a pull request, commit, or compare URL, or paste a unified diff."
        )
    kind = parts[2].lower()
    if kind == "pull" and len(parts) >= 4:
        try:
            num = int(parts[3])
        except ValueError as exc:
            raise ValueError("Invalid pull request number.") from exc
        return f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{num}"
    if kind == "compare" and len(parts) >= 4:
        basehead = parts[3]
        if not basehead or "..." not in basehead:
            raise ValueError(
                "Compare URL must include base...head (e.g. main...feature)."
            )
        return f"{GITHUB_API}/repos/{owner}/{repo}/compare/{basehead}"
    if kind == "commit" and len(parts) >= 4:
        sha = parts[3]
        if not re.fullmatch(r"[a-f0-9]{7,40}", sha, re.I):
            raise ValueError("Invalid commit SHA.")
        return f"{GITHUB_API}/repos/{owner}/{repo}/commits/{sha}"
    raise ValueError(
        "Unsupported GitHub URL. Use a pull request, commit, or compare link."
    )


def fetch_github_diff(url: str) -> str:
    api_url = build_api_url(url)
    with httpx.Client(timeout=120.0) as client:
        resp = client.get(api_url, headers=_headers())
    if resp.status_code == 404:
        raise ValueError(
            "GitHub returned 404: that PR, commit, or compare may not exist, or the "
            "URL is wrong. For private repositories, set GITHUB_TOKEN in backend/.env."
        )
    if resp.status_code in (401, 403):
        raise ValueError(
            "GitHub API access denied. Set GITHUB_TOKEN for private repos or higher limits."
        )
    if resp.status_code == 429:
        raise ValueError("GitHub API rate limit exceeded. Set GITHUB_TOKEN or try later.")
    resp.raise_for_status()
    text = resp.text
    if len(text) > MAX_DIFF_BYTES:
        raise ValueError("Diff too large to review (over 2 MB). Try a smaller change.")
    if not text.strip():
        raise ValueError("Empty diff from GitHub.")
    return text
