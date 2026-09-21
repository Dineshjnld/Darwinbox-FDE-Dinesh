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

### Single-Service Render Deployment

Deploy the root `Dockerfile` as one Render Web Service:

1. Service type: Web Service, runtime: Docker.
2. Root directory: repository root (`/`).
3. Dockerfile path: `./Dockerfile`.
4. Health check path: `/health`.
5. Do not create separate frontend, backend, or mock-target Render services.

The container runs Nginx, FastAPI, the internal mock target, and the TanStack Start UI. Render's public URL routes to Nginx: `/` and client-side routes go to the UI, `/api/*` goes to FastAPI, `/docs` and `/openapi.json` go to Swagger/OpenAPI, `/health` is the service health check, and `/mock-api/*` reaches the private mock target. The browser uses `VITE_API_URL=/api`; it never connects directly to MongoDB.

Set these Render environment variables from `.env.example`:

```env
APP_ENV=production
MONGODB_URI=<Render secret: MongoDB Atlas connection string>
MONGODB_DATABASE=migration_copilot
REQUIRE_MONGODB=true
CEREBRAS_API_KEY=<Render secret>
LLM_PROVIDER=cerebras
LLM_MODEL=qwen-3.8-27b
CEREBRAS_BASE_URL=https://api.cerebras.ai/v1
LLM_FALLBACK_PROVIDER=gemini
GEMINI_API_KEY=<Render secret>
GEMINI_MODEL=gemini-2.5-flash
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
TARGET_PROVIDER=mock
MOCK_TARGET_URL=http://127.0.0.1:8081
MOCK_FAILURE_RATE=0.0
MOCK_FAIL_ONCE_ID=EMP005
DARWINBOX_MCP_URL=
DARWINBOX_API_URL=
DARWINBOX_API_KEY=
DEFAULT_TENANT_ID=demo-tenant
LOG_LEVEL=INFO
CORS_ORIGINS=https://<your-service>.onrender.com
```

Render supplies `PORT`; Nginx binds to it at startup. MongoDB Atlas remains the managed persistence layer. Keep `TARGET_PROVIDER=mock` until a real Darwinbox tenant and adapter credentials are configured. The local `docker-compose.yml` remains a three-container development stack.

## Security boundaries

Secrets remain in environment variables and are not included in prompts or audit payloads. Uploads are size- and extension-validated. Target mutations use idempotency keys and policy gates. Human review is mandatory for ambiguous mappings, conflicts, unresolved validation errors, and destructive operations.
