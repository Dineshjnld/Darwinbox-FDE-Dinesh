# Migration Copilot

**Forward Deployed Engineer Take-Home — AI Agent for Client Data Migration & Integration**

Migration Copilot is a governed AI-assisted migration workflow for heterogeneous client HCM data. It accepts multiple CSV/XLSX exports for the same entity, profiles inconsistent source schemas and values, proposes evidence-backed source-to-target mappings, reconciles records, validates them against a target contract, pauses when ambiguity requires human judgment, executes controlled target operations, verifies results, and records an audit trail.

## Demo

![](https://github.com/user-attachments/assets/1d83aba7-b96e-47fa-ae13-4720d0e37fa5)

[Download the compressed demo video](./Video_demo-Darwinbox.mp4)

The prototype is designed around one core principle:

> **AI proposes → Control Plane evaluates → Human resolves ambiguity → System executes → Audit records the outcome.**

## 1. Assignment coverage

The implementation is designed to address the six core requirements of the take-home:

| Requirement | Implementation |
|---|---|
| Multi-file ingestion & reconciliation | CSV/XLSX uploads, profiling, type inference, normalization, duplicate/conflict reconciliation |
| Autonomous mapping & cleanup | Evidence-backed mapping with deterministic signals plus LLM assistance |
| Defensible escalation boundary | AUTO / REVIEW / BLOCK decision gate using confidence, risk and policy |
| Human-in-the-loop UI | Escalation queue with evidence, Approve/Correct/Reject/Skip, notes and resume |
| Mock target integration | Per-record execution, idempotency, simulated failure, retry, rollback and verification |
| Delta solutioning | Control/policy layer, private context, scoped tools, audit lineage and Darwinbox-ready adapter |

## 2. Architecture

```text
                         React + TypeScript
                     TanStack Start / Nitro UI
                              │
                       REST + Server-Sent Events
                              │
                              ▼
                     FastAPI Control Plane
                              │
                              ▼
                       LangGraph Workflow
                              │
       ┌──────────────┬───────┴────────┬──────────────┐
       ▼              ▼                ▼              ▼
    Profiler        Mapper         Reconciler     Validator
       │              │                │              │
       └──────────────┴────────────────┴──────────────┘
                              │
                              ▼
                       Decision Gate
                       /     |      \
                    AUTO    REVIEW   BLOCK
                              │
                         Human Review
                              │
                              ▼
                 Executor → Verifier → Finalize
                              │
                 ┌────────────┴─────────────┐
                 ▼                          ▼
          MongoDB Atlas               TargetAdapter
                                      /          \
                              Mock Target      Darwinbox
                                               MCP / REST
```

### Main components

- **Frontend:** React, TypeScript, TanStack Start/Nitro, Tailwind CSS and enterprise workflow UI.
- **API:** FastAPI/Python.
- **Agent orchestration:** LangGraph.
- **LLM layer:** Cerebras primary provider with Gemini fallback.
- **Persistence:** MongoDB Atlas.
- **Control plane:** confidence engine, risk engine, policy engine, permission boundaries, private context and audit.
- **Target integration:** `TargetAdapter` abstraction with a mock target and Darwinbox integration seams.
- **Live progress:** Server-Sent Events (SSE).
- **Deployment:** Docker; local Compose or a single Render Web Service.

## 3. Agent workflow

```text
INGEST
  ↓
PROFILE
  ↓
MAP
  ↓
RECONCILE
  ↓
VALIDATE
  ↓
DECISION GATE
  ├── AUTO ───────────────┐
  ├── REVIEW → Human ────┤
  └── BLOCK ──────────────┤
                           ↓
                         EXECUTE
                           ↓
                        VERIFY
                           ↓
                         AUDIT
```

The LLM is not given unrestricted mutation authority. The control plane evaluates the proposed action separately from the model's reasoning.

## 4. Autonomy boundary

### AUTO

The agent can proceed when the transformation is low-risk, deterministic or strongly evidenced and does not create a materially ambiguous business decision.

Examples:

- File profiling and column type inference.
- Obvious source-to-target field mappings.
- Whitespace/casing normalization.
- Recognized date-format normalization.
- Strong duplicate matches.
- Deterministic schema validation.
- Retry of transient target failures.

### REVIEW

The workflow pauses when evidence is insufficient, source systems conflict, or business meaning is ambiguous.

Examples:

- One source field could map to multiple target fields.
- Conflicting department/status values across source files.
- Uncertain date interpretation.
- Unresolved duplicate records.
- Low-confidence transformation.
- Repeated validation failure.
- Sensitive-field overwrite.

The consultant sees the evidence and can **Approve, Correct, Reject or Skip**, optionally adding a note or applying the decision to similar records.

### BLOCK

The operation is not allowed through normal autonomous execution.

Examples:

- Unauthorized tool/action.
- Missing stable employee identity.
- Invalid target contract.
- Destructive mutation without the required approval path.
- Operation outside the configured permission scope.

## 5. Confidence and decision control

Mapping confidence is deterministic evidence aggregation rather than an LLM self-rating.

The current confidence engine combines:

- Semantic similarity — 25%
- Source-name similarity — 25%
- Sample-value compatibility — 18%
- Target type compatibility — 18%
- Historical evidence — 7%
- Business-rule evidence — 7%

The resulting score is combined with ambiguity, operation risk and permissions.

Current autonomy thresholds include:

```text
unsafe action                  → BLOCK
ambiguous OR confidence < .72  → REVIEW
confidence >= .82              → AUTO
otherwise                      → REVIEW
```

This means a high model confidence alone cannot authorize a target mutation.

## 6. Human-in-the-loop experience

The UI provides:

- Live migration progress.
- Source file and mapping visibility.
- Mapping Studio.
- Escalation queue.
- Source/target evidence.
- Candidate alternatives.
- Confidence and risk information.
- Approve / Correct / Reject / Skip.
- Optional notes.
- Apply-to-similar decision.
- Resume from the paused migration state.
- Execution results.
- Retry and rollback controls.
- Audit trail.

The workflow does not restart the complete migration after an escalation; it resumes from the review boundary and continues with execution/verification.

## 7. Reconciliation and validation

The sample migration uses an employee target contract:

```yaml
entity: employee
fields:
  employee_id: string, required, unique
  first_name: string, required
  last_name: string, required
  email: email, required
  date_of_birth: date, optional
  date_of_joining: date, required
  department: string, optional
  employment_status: enum
    - ACTIVE
    - INACTIVE
    - TERMINATED
```

The sample data includes:

- `employees_hr.csv`
- `employees_legacy.csv`
- `employees_legacy.xlsx`
- `employees_payroll.csv`
- `target_schema.yaml`

The workflow is intentionally designed to encounter inconsistent field names/formats, duplicate records, missing values and conflicting information so that the escalation boundary can be demonstrated.

## 8. Execution, retry, rollback and audit

Target writes are performed through the target adapter rather than directly from agent reasoning.

The mock target supports:

- Employee create.
- Employee update.
- Lookup/list.
- Verification.
- Rollback.
- Idempotency keys.
- Per-record success/failure.
- Deterministic transient failure simulation.

By default:

```env
MOCK_FAILURE_RATE=0.0
MOCK_FAIL_ONCE_ID=EMP005
```

`EMP005` is configured to fail once so the demo can show a failed operation followed by retry and successful completion.

Audit records capture migration and execution events, while execution records retain per-record status and recovery information.

## 9. Private context and security boundary

Sensitive references and credentials are kept outside the normal LLM context. Protected data is resolved through authorized application tools when required.

Security boundaries include:

- Secrets supplied through environment variables.
- No credentials embedded in prompts.
- No direct MongoDB access from the browser.
- File extension/size validation.
- Policy-controlled target mutations.
- Idempotent target operations.
- Tenant/migration identifiers on persisted records.
- Human review for material ambiguity and destructive operations.

For production, add SSO/RBAC, secret management, encryption, stronger tenant isolation, retention controls and authenticated tenant-specific target access.

## 10. Local setup

### Prerequisites

Recommended:

- Docker Desktop + Docker Compose.
- MongoDB Atlas cluster and connection string.
- Cerebras API key.
- Gemini API key for fallback (optional but recommended).

For development without Docker:

- Python 3.11+
- Node.js 22.12+

### Step 1 — Clone

```powershell
git clone https://github.com/Dineshjnld/Darwinbox-FDE-Dinesh.git
cd Darwinbox-FDE-Dinesh
```

### Step 2 — Configure environment

```powershell
Copy-Item .env.example .env
```

Edit `.env`:

```env
APP_ENV=development

MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/?appName=Cluster0
MONGODB_DATABASE=migration_copilot
REQUIRE_MONGODB=true
MONGODB_SERVER_SELECTION_TIMEOUT_MS=10000

CEREBRAS_API_KEY=<your-key>
LLM_PROVIDER=cerebras
LLM_MODEL=qwen-3.8-27b
CEREBRAS_BASE_URL=https://api.cerebras.ai/v1

LLM_FALLBACK_PROVIDER=gemini
GEMINI_API_KEY=<optional-key>
GEMINI_MODEL=gemini-2.5-flash
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta

TARGET_PROVIDER=mock
MOCK_TARGET_URL=http://localhost:8081
MOCK_FAILURE_RATE=0.0
MOCK_FAIL_ONCE_ID=EMP005

DARWINBOX_MCP_URL=
DARWINBOX_API_URL=
DARWINBOX_API_KEY=

CORS_ORIGINS=http://localhost:5173
DEFAULT_TENANT_ID=demo-tenant
MAX_UPLOAD_MB=10
LOG_LEVEL=INFO
```

Never commit `.env` or API keys.

> If the MongoDB password contains reserved URL characters, URL-encode them in the connection string.

### Step 3 — Start the complete local stack

```powershell
docker compose up -d --build
```

Open:

```text
http://localhost:5173
```

Backend API:

```text
http://localhost:8000
```

Swagger:

```text
http://localhost:8000/docs
```

Health:

```text
http://localhost:8000/health
```

Mock target:

```text
http://localhost:8081/health
```

Check services:

```powershell
docker compose ps
docker compose logs -f
```

Stop:

```powershell
docker compose down
```

## 11. Local development without Docker

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Mock target

In another terminal:

```powershell
cd mock_target
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8081
```

Set:

```env
MOCK_TARGET_URL=http://localhost:8081
```

### Frontend

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

For local Vite development, `.env` uses:

```env
VITE_API_URL=http://localhost:8000
```

The frontend API client appends the `/api/...` route paths.

## 12. End-to-end demo flow

For the take-home demo:

1. Open the Migration Copilot UI.
2. Create a new migration.
3. Load or upload the sample CSV/XLSX files.
4. Confirm the employee target schema.
5. Start the migration.
6. Observe profiling, mapping, reconciliation and validation.
7. Open the escalation queue when the agent encounters material ambiguity.
8. Inspect the source value, proposed target, evidence, confidence and risk.
9. Resolve the escalation using **Approve**, **Correct**, **Reject** or **Skip**.
10. Resume the migration.
11. Open Execution to inspect per-record results.
12. Show the simulated `EMP005` transient failure.
13. Retry the failed operation.
14. Verify completion.
15. Open Audit Log to show the recorded workflow and execution events.

This demonstrates the required human-in-the-loop scenario rather than only showing a happy-path migration.

## 13. API surface

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | API/Mongo health and target provider |
| `/api/migrations` | GET/POST | List/create migrations |
| `/api/migrations/{id}` | GET | Migration state and counters |
| `/api/migrations/{id}/files` | GET/POST | List/upload files |
| `/api/migrations/{id}/files/sample` | POST | Load bundled sample data |
| `/api/migrations/{id}/start` | POST | Start migration workflow |
| `/api/migrations/{id}/resume` | POST | Resume after review |
| `/api/migrations/{id}/mappings` | GET | Mapping decisions/evidence |
| `/api/migrations/{id}/escalations` | GET | Escalation queue |
| `/api/escalations/{id}/resolve` | POST | Resolve escalation |
| `/api/migrations/{id}/executions` | GET | Execution records |
| `/api/migrations/{id}/executions/retry` | POST | Retry failed operations |
| `/api/migrations/{id}/rollback` | POST | Roll back target mutations |
| `/api/migrations/{id}/events` | GET | SSE live events |
| `/api/migrations/{id}/audit` | GET | Audit events |

## 14. Testing and verification

Backend tests:

```powershell
cd backend
python -m pytest -q tests
ruff check app tests
```

Frontend:

```powershell
cd frontend
npm run lint
npm run build
```

Compose:

```powershell
docker compose config --quiet
docker compose build
```

The end-to-end workflow test covers:

- migration creation
- sample attachment
- workflow execution
- escalation creation
- escalation approval
- resume
- target execution
- simulated failure
- retry
- completion

## 15. Single-service Render deployment

The repository also contains a root `Dockerfile` for a single Render Web Service.

### Render configuration

- **Service:** Web Service
- **Runtime:** Docker
- **Root directory:** repository root
- **Dockerfile:** `./Dockerfile`
- **Health check:** `/health`
- **No separate frontend/backend/mock services**

The single container runs:

```text
Render
  │
  ▼
Nginx
  ├── /              → TanStack Start UI
  ├── /api/*         → FastAPI :8000
  ├── /docs          → FastAPI Swagger
  ├── /openapi.json  → FastAPI OpenAPI
  ├── /health        → FastAPI health
  └── /mock-api/*    → internal mock target
```

Render supplies the public `PORT`. The entrypoint generates the Nginx configuration from that value.

Recommended Render environment:

```env
APP_ENV=production
MONGODB_URI=<Render secret>
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

The browser should use:

```env
VITE_API_URL=/api
```

in the production frontend build so API requests stay on the same public origin.

## 16. Darwinbox integration boundary

The prototype deliberately defaults to:

```env
TARGET_PROVIDER=mock
```

The migration workflow depends on the `TargetAdapter` abstraction rather than hard-coding target-specific business logic.

A future tenant-specific deployment can configure:

```env
DARWINBOX_MCP_URL=<tenant-provided endpoint>
DARWINBOX_API_URL=<tenant-provided API endpoint>
DARWINBOX_API_KEY=<secret>
```

and implement/use the Darwinbox adapter with the required tenant authorization and permissions.

No Darwinbox tenant URL, credential or production endpoint is invented or committed to this repository.

## 17. Project structure

```text
migration-copilot/
├── backend/
│   ├── app/
│   │   ├── agents/          # LangGraph workflow and nodes
│   │   ├── api/             # FastAPI routes
│   │   ├── control_plane/   # confidence, risk, policy, permissions, audit
│   │   ├── db/              # MongoDB / memory store
│   │   ├── integrations/    # Mock + Darwinbox adapter boundary
│   │   ├── models/          # API/domain models
│   │   ├── services/        # migration/file/event services
│   │   └── tools/           # controlled agent tools
│   └── tests/
├── frontend/
│   └── src/
│       ├── features/
│       ├── pages/
│       └── services/
├── mock_target/
├── sample_data/
├── deploy/
│   ├── nginx.conf.template
│   ├── supervisord.conf
│   └── entrypoint.sh
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## 18. What I would build next

For production adoption:

1. **Production Darwinbox connector** — tenant authorization, scoped MCP/REST tools and platform permissions.
2. **Dry-run and impact analysis** — show predicted creates, updates and conflicts before target writes.
3. **Customer-specific mapping memory** — reuse approved mappings and transformations with strict tenant isolation.
4. **Enterprise security** — SSO/RBAC, secret management, encryption, retention and stronger tenant isolation.
5. **Evaluation framework** — mapping accuracy, escalation precision, false-autonomy rate, migration success and recovery metrics.
6. **Scale and operations** — resumable large-file jobs, rate-limit handling, stronger observability and production controls.

## 19. Submission

**Working prototype:** `https://fde-darwinbox.onrender.com`

**Source repository:** `https://github.com/Dineshjnld/Darwinbox-FDE-Dinesh`

The submission demo should show at least one genuine escalation being resolved through the UI, followed by execution/recovery and the resulting audit trail.
