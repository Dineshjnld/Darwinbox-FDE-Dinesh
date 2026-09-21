# Darwinbox Migration Copilot

An AI-powered agent for client data migration & integration. Ingests messy multi-format source files, autonomously maps fields to a target schema, cleans and validates data, and pushes to a mock target API — stopping only for genuinely ambiguous cases that require human review.

## Architecture

```
React + TypeScript UI  ←── REST/SSE  ──→  FastAPI Control Plane
                                            │
                              LangGraph Migration Workflow
                              profiler → mapper → reconciler → validator
                                            │
                              decision gate → executor → verifier → finalize
                                            │
                              TargetAdapter → Mock API / Darwinbox MCP
```

## What the agent does autonomously

- **Multi-file ingestion**: Reads CSV/XLSX files with different column names, formats, and date conventions
- **Autonomous mapping**: Uses deterministic evidence (name similarity, aliases, sample compatibility, type checking) to map source fields to the target schema — 25/26 fields auto-mapped in the demo
- **Data cleaning**: Normalizes whitespace, casing, dates, emails, and enum values
- **Duplicate reconciliation**: Merges records across source systems using identity keys (employee_id, email)
- **Validation**: Checks against the target schema contract

## What gets escalated to a human

The agent only surfaces cases when genuinely ambiguous:
- **Ambiguous field mapping**: A generic `status` column could map to `employment_status`, `employee_status`, or `account_status`
- **Conflicting source values**: Two source systems provide different values for the same employee (e.g., different departments)
- **Validation errors**: Fields that cannot be resolved after normalization

Safe normalization and strong identity matches are `AUTO`. Ambiguous mappings, conflicting values, and unresolved validation errors are `REVIEW`. Destructive operations are `BLOCK`.

## Tech Stack

- **Backend**: Python/FastAPI + LangGraph + Motor (MongoDB) + Pydantic
- **Frontend**: React/TypeScript + Vite + Recharts + Lucide React
- **Mock Target**: FastAPI stub with deterministic failure injection (EMP005 fails once)
- **Data**: Pandas + OpenPyXL + PyYAML
- **Orchestration**: Docker Compose (MongoDB, backend, mock-target, frontend)

## Setup

### Quick Start (Docker Compose)

```bash
# Copy environment template
cp .env.example .env

# Start everything
docker compose up --build
```

Then open **http://localhost:5173** in your browser.

### Run the Demo

1. Click **"Create demo migration"** — loads 4 sample files (CSV + XLSX)
2. The agent profiles, maps, reconciles, and validates automatically
3. The migration pauses at **Review** with 2 escalations (ambiguous `status` + conflicting department)
4. Go to **Escalations** tab, click **Approve** on each card
5. The graph resumes, pushes records to the mock target
6. EMP005 fails deterministically → click **Retry** → all 4 succeed
7. Watch the **Audit** tab for full lineage

### Local Development

```bash
# Terminal 1: MongoDB
docker compose up mongo

# Terminal 2: Mock target
cd mock_target && uvicorn app.main:app --port 8081

# Terminal 3: Backend
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 4: Frontend
cd frontend && npm install && npm run dev
```

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest -q tests/
ruff check app tests
```

All 6 tests pass, including the end-to-end workflow test that verifies:
- Escalation creation → approval → resume → execution → failure → retry → completion

## Sample Data

The demo includes 4 source files representing the same employees with inconsistencies:
- **employees_hr.csv**: HR tool export with `emp_id`, `fname`, `surname`, mixed date formats (`20/01/2024`, `2024-02-01`, `20-Jan-2024`)
- **employees_legacy.csv**: Legacy system with `employee_number`, `given_name`, `last_name`, different date formats
- **employees_payroll.csv**: Payroll system with `employee_id`, `employee_name`, `business_unit` (different department names)
- **employees_legacy.xlsx**: Excel version of legacy data

Key challenges handled: duplicate records (EMP001-EMP005 appear across files), conflicting department values, ambiguous `status` column, whitespace/casing differences, mixed date formats.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/migrations` | GET/POST | List/create migrations |
| `/api/migrations/{id}` | GET | Get migration status |
| `/api/migrations/{id}/start` | POST | Start the migration workflow |
| `/api/migrations/{id}/resume` | POST | Resume after review |
| `/api/migrations/{id}/files/sample` | POST | Load sample data |
| `/api/migrations/{id}/escalations` | GET | List escalations |
| `/api/escalations/{id}/resolve` | POST | Resolve escalation (approve/correct/skip) |
| `/api/migrations/{id}/executions` | GET | List execution results |
| `/api/migrations/{id}/executions/retry` | POST | Retry failed executions |
| `/api/migrations/{id}/rollback` | POST | Rollback all successful mutations |
| `/api/migrations/{id}/audit` | GET | Full audit trail |
| `/api/migrations/{id}/events` | GET | SSE live events |

## Autonomy Boundary Design

| Score | Autonomy | Example |
|-------|----------|---------|
| ≥ 82% | AUTO | `emp_id` → `employee_id`, `email` → `email` |
| 72-81% | REVIEW | Fields with moderate evidence |
| < 72% or ambiguous | REVIEW | `status` column, conflicting values |
| Destructive | BLOCK | Delete operations |

The confidence score combines 6 weighted evidence signals: semantic similarity (25%), name similarity (25%), sample compatibility (18%), type compatibility (18%), historical evidence (7%), business rule (7%).

## Security

- Secrets stay in environment variables and private context — never in model prompts
- Tool allowlists restrict what each agent can call
- Idempotency keys make every mutation safe to retry
- Uploads are size/extension validated, stored securely, never executed
- Policy gates block unauthorized mutations

## Demo Recording Guide

To demonstrate the system:
1. Start the stack: `docker compose up --build`
2. Open http://localhost:5173
3. Click **"Create demo migration"**
4. Navigate to **Escalations** tab — show the 2 review cards with their "WHY" explanations
5. Click **Approve** on each escalation — show the graph resuming
6. Show **Execution** tab — EMP005 fails, then succeeds after Retry
7. Show **Audit** tab — chronological lineage of all events

## Future Work

Production deployment would add authenticated tenant configuration, durable LangGraph checkpoints, provider contract tests, richer Darwinbox schema discovery, and operational alerting without changing the autonomy boundary.

The application was independently implemented using LangGraph/LangChain. Neuro SAN was studied only as an architectural reference for patterns such as tool separation, private data handling, middleware/policy controls and agent observability. No Neuro SAN source code is used as a dependency.
