# Migration Copilot

Migration Copilot is an enterprise AI-powered data migration and integration platform. It ingests CSV/XLSX exports, profiles source data, proposes evidence-backed mappings, reconciles records, validates the target contract, pauses for human approval when ambiguity is material, executes idempotent target operations, and records the complete audit trail.

## Architecture

```text
React + TypeScript + TanStack Start
              │ REST + Server-Sent Events
              ▼
FastAPI control plane ── LangGraph migration workflow
              │          profiler → mapper → reconciler → validator
              │          decision gate → executor → verifier → finalize
              ▼
MongoDB Atlas persistence ── TargetAdapter ── Mock target / Darwinbox MCP
```

The frontend provides Overview, Migrations, Mapping Studio, Escalations, Execution, Audit Log, Target Systems, Agent Policies, and Settings. It uses the backend API for all migration data and subscribes to live migration events over SSE.

## Product capabilities

- Multi-file CSV/XLSX intake with profiling and column type inference.
- Deterministic evidence plus LLM assistance for source-to-target mapping.
- Confidence and autonomy boundaries: safe decisions are automatic; ambiguous, conflicting, or destructive decisions require review.
- Human-in-the-loop escalation queue with approval, correction, rejection, skip, notes, and similar-record recommendations.
- Reconciliation, validation, execution, retry, rollback, verification, and audit lineage.
- Cerebras as the primary LLM provider with Gemini fallback.
- Darwinbox integration seams through `DarwinboxTargetAdapter`/MCP configuration; local development uses the mock target until a tenant supplies its Darwinbox endpoint and credentials.

## Requirements

- Docker Desktop with Compose.
- A MongoDB Atlas cluster and connection string.
- A Cerebras API key. Gemini is optional but recommended for fallback.
- Python 3.11+ and Node.js 22.12+ only for local development outside Docker.

## Quick start with Docker

```powershell
Copy-Item .env.example .env
# Edit .env and set MONGODB_URI plus the LLM credentials.
docker compose up -d --build
```

Open <http://localhost:5173>. The stack contains the frontend, FastAPI backend, and mock target. MongoDB is not run in Docker; the backend connects to the configured MongoDB Atlas cluster.

## Environment variables

The safe template is [.env.example](.env.example). Never commit `.env` or API keys.

```env
VITE_API_URL=http://localhost:8000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/?appName=Cluster0
MONGODB_DATABASE=migration_copilot
REQUIRE_MONGODB=true
CEREBRAS_API_KEY=...
LLM_PROVIDER=cerebras
LLM_MODEL=qwen-3.8-27b
CEREBRAS_BASE_URL=https://api.cerebras.ai/v1
LLM_FALLBACK_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
TARGET_PROVIDER=mock
```

`DARWINBOX_API_URL`, `DARWINBOX_API_KEY`, and `DARWINBOX_MCP_URL` are supplied by the Darwinbox integration owner when a real target tenant is provisioned. Keep `TARGET_PROVIDER=mock` for local workflow testing.

## Local development

```powershell
# Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend, in a second terminal
cd frontend
npm install
npm run dev
```

The mock target can be started separately with `cd mock_target; uvicorn app.main:app --port 8081`. Set `MOCK_TARGET_URL=http://localhost:8081` when running the backend outside Compose.

## Verification

```powershell
cd backend
python -m pytest -q tests
ruff check app tests

cd ..\frontend
npm run lint
npm run build

cd ..
docker compose config --quiet
docker compose build
```

The workflow test covers escalation creation, approval, resume, execution, failure, retry, and completion. For a manual end-to-end check, create a migration, upload source files, start it, resolve open escalations, inspect the execution records, retry a failed operation, roll back successful operations when appropriate, and review the audit log and live event stream.

## API surface

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/health` | GET | Service health |
| `/api/migrations` | GET, POST | List and create migrations |
| `/api/migrations/{id}` | GET | Migration status and counters |
| `/api/migrations/{id}/files` | GET, POST | List and upload source files |
| `/api/migrations/{id}/start` | POST | Start the workflow |
| `/api/migrations/{id}/resume` | POST | Resume after review |
| `/api/migrations/{id}/mappings` | GET | Mapping decisions and evidence |
| `/api/migrations/{id}/escalations` | GET | Human review queue |
| `/api/escalations/{id}/resolve` | POST | Apply an approval or correction |
| `/api/migrations/{id}/executions` | GET | Target operation results |
| `/api/migrations/{id}/executions/retry` | POST | Retry failed operations |
| `/api/migrations/{id}/rollback` | POST | Roll back successful mutations |
| `/api/migrations/{id}/events` | GET | SSE migration updates |
| `/api/migrations/{id}/audit` | GET | Compliance and audit trail |

## Deployment notes

The frontend is built as a Node 22 TanStack Start/Nitro server and exposed on port 3000 inside its container. Compose publishes it on port 5173. The backend is health-checked before the frontend starts, and MongoDB Atlas remains an external managed dependency. Use a secret manager for production credentials, configure authenticated tenant access, restrict CORS to the deployed frontend origin, and provide a production Darwinbox adapter before changing `TARGET_PROVIDER` from `mock`.

### Render

Deploy the root `Dockerfile` as a Render Web Service for the FastAPI API. Set the service environment variables from `.env.example`, at minimum `MONGODB_URI`, `MONGODB_DATABASE`, `REQUIRE_MONGODB`, the Cerebras/Gemini settings, `TARGET_PROVIDER`, and `CORS_ORIGINS`. Render supplies `PORT`; the image binds to it automatically. Do not set `MOCK_TARGET_URL` to the Compose hostname when deploying outside Compose. Use a separately deployed mock-target service for testing or configure the production Darwinbox adapter.

Deploy the UI as a second Render Web Service from `frontend/` using `frontend/Dockerfile`. Set `VITE_API_URL` to the public HTTPS URL of the API during the frontend image build, and set `CORS_ORIGINS` on the API to the public frontend URL. The frontend image listens on Render's `PORT` at runtime and serves the TanStack Start application.

## Security boundaries

Secrets remain in environment variables and are not included in prompts or audit payloads. Uploads are size- and extension-validated. Target mutations use idempotency keys and policy gates. Human review is mandatory for ambiguous mappings, conflicts, unresolved validation errors, and destructive operations.
