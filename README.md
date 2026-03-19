# AI Code Review Agent

On-demand code review: paste a snippet, get structured feedback (issues, suggestions, best practices). Includes a **frontend** and **backend API**; supports runtime (on-demand) review with an optional path to compile-time/CI gating.

## Structure

- **`backend/`** — Python (FastAPI). `POST /review` accepts `{ code, language }` and returns a review report (LLM-based).
- **`frontend/`** — React + TypeScript + Vite. Code editor, language selector, Review button, report panel with optional "Apply" for suggestions.
- **`docs/APPROACH.md`** — Design: runtime vs compile-time, FE scope, phases.

## Quick start

### Option A: Run both from root (recommended)

```bash
# From repo root
cp .env.example backend/.env
# Ensure Ollama is running (ollama serve) and pull a model (e.g. ollama pull llama3.2)
cd backend && pip install -r requirements.txt && cd ..
npm install
npm run dev
```

This starts the **backend** (http://localhost:3001) and **frontend** (http://localhost:3000) together.

### Option B: Run backend and frontend separately

**Backend:**
```bash
cd backend
cp ../.env.example .env
# Ensure Ollama is running locally (ollama serve)
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 3001
```
API runs at **http://localhost:3001**. Endpoints: `GET /health`, `POST /review`.

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
App runs at **http://localhost:3000**. Vite proxies `/api` to the backend, so no CORS setup needed when both run locally.

### 3. Use

1. Open http://localhost:3000
2. Paste code, choose language, click **Review**
3. See findings (severity, line, message, suggestion); use **Apply** to insert a suggestion into the editor

### Troubleshooting: "http proxy error: /review" or ECONNREFUSED

The frontend (Vite) proxies API calls to **http://localhost:3001**. This error means **nothing is running on port 3001**.

From repo root run `npm run dev` and confirm the Python backend (uvicorn) and Vite server both start. If the backend crashes (e.g. Ollama not running), start Ollama and restart the backend.

## Environment

| Variable | Where | Description |
|----------|--------|-------------|
| `OLLAMA_BASE_URL` | backend/.env | Optional; default `http://localhost:11434` |
| `OLLAMA_MODEL` | backend/.env | Optional; default `llama3.2` (must be pulled: `ollama pull llama3.2`) |
| `PORT` | backend/.env | Optional; default `3001` |
| `VITE_API_URL` | frontend/.env | Optional; override API base when not using Vite proxy |

## Next steps (from docs/APPROACH.md)

- **Phase 3:** Add rule-based checks (e.g. ESLint) and merge with LLM findings.
- **Phase 4:** GitHub Action or pre-commit calling `POST /review` for compile-time gating.
