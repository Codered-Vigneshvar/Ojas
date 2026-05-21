# Ojas — Clinical Patient Workspace Starter Kit

> A full-stack, patient workspace for doctors — built as an extensible foundation for adding AI/agentic capabilities.

**Ojas** (Sanskrit: ओजस् — "vitality, life force") Ojas is an AI-powered patient management system built to make clinic software simpler, faster, and easier to use.

Most patient management platforms require doctors or clinic staff to move through multiple screens, forms, and buttons just to complete basic tasks like creating a patient profile, updating visit notes, checking history, or adding prescriptions. This often makes clinics dependent on trained assistants or admin staff.

Ojas changes this by using a simple, natural-language-first interface.

Instead of filling every field manually, a doctor or staff member can select a patient and type or speak information in plain language. This could include symptoms, diagnosis, treatment details, prescriptions, follow-up notes, or general observations. Ojas then understands the input, organizes it, and stores it in the correct patient record.

## Core Idea

Ojas works like an intelligent clinic assistant that helps users:

- Create and search patients using phone numbers
- Capture consultation notes easily
- Organize patient history, visits, prescriptions, and follow-ups
- Reduce repetitive clicks and manual work
- Retrieve patient information through natural language
- Lower the learning curve for clinic staff

## Vision

The goal of Ojas is to create a zero-friction patient management experience where doctors can focus more on care and less on software.



---

## ✨ What You Get

| Feature | Status |
|---|---|
| Patient CRUD (create, list, search, open) | ✅ Ready |
| Document upload (PDF, images, files) | ✅ Ready |
| Clinical note creation | ✅ Ready |
| Audio recording (raw play, save, delete) | ✅ Ready |
| Artifact timeline with type badges | ✅ Ready |
| Artifact preview (PDF, images, audio) | ✅ Ready |
| Presigned download URLs (S3/MinIO) | ✅ Ready |
| JWT authentication scaffold | ✅ Ready |
| Audit logging | ✅ Ready |
| STT Transcription | 🔌 Extension point |
| AI Chat / Search / Labeling | 🔌 Extension point |
| RAG with vector embeddings | 🔌 Extension point |
| Auto-labelling pipeline | 🔌 Extension point |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)              │
│                        localhost:5173                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Patient List │  │  Workspace   │  │  Artifact Detail │   │
│  │  (Home.tsx)   │  │ (Patient.tsx)│  │  Modal           │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API (JSON)
┌──────────────────────────┴──────────────────────────────────┐
│                    Backend (FastAPI + Python)                │
│                    localhost:8000                            │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Routes   │  │  Services    │  │  Repositories        │   │
│  │ patients  │  │ patient_svc  │  │  patient_repo        │   │
│  │ artifacts │  │ artifact_svc │  │  artifact_repo       │   │
│  │ health    │  │              │  │                      │   │
│  └──────────┘  └──────────────┘  └──────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  🔌 AI Extension Points (see below)                  │   │
│  │  • ojas/llm/       — LLM client interface            │   │
│  │  • ojas/embeddings/ — Embedding client interface     │   │
│  │  • ojas/workers/    — Background pipeline (arq)      │   │
│  │  • ojas/services/   — Retrieval / Chat services      │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                     Infrastructure (Docker)                  │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│  │ PostgreSQL │  │  Redis   │  │  MinIO (S3-compatible)   │  │
│  │   :5432    │  │  :6379   │  │   :9000 (API) :9001 (UI)│  │
│  └───────────┘  └──────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **macOS / Linux** (Windows via WSL2)
- **Docker** (or [Colima](https://github.com/abiosoft/colima) for macOS)
- **Python 3.11+** with [uv](https://github.com/astral-sh/uv)
- **Node.js 18+** with pnpm
- **ffmpeg** (optional, if you plan to add audio transcoding back)

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/ojas.git
cd ojas
cp .env.example .env   # review and edit if needed
```

### 2. Start Infrastructure

```bash
# Option A: Docker Desktop
docker compose up -d

# Option B: Colima (macOS ARM)
colima start
docker compose up -d
```

This starts PostgreSQL, Redis, and MinIO.

### 3. Setup Backend

```bash
cd apps/api
uv sync                       # install Python deps
uv run alembic upgrade head   # run migrations
cd ../..
uv run python scripts/seed_dev_data.py   # seed dev clinic + user
```

### 4. Setup Frontend

```bash
cd apps/web
pnpm install
```

### 5. Run Everything

```bash
# From project root:
./start.sh
# Or manually:
# Terminal 1: cd apps/api && uv run uvicorn ojas.main:app --reload --port 8000
# Terminal 2: cd apps/web && pnpm dev
```

Open **http://localhost:5173** — you should see the patient list with two demo patients.

---

## 📁 Project Structure

```
ojas/
├── apps/
│   ├── api/                          # FastAPI backend
│   │   ├── src/ojas/
│   │   │   ├── config.py             # Pydantic settings (env vars)
│   │   │   ├── main.py               # FastAPI app factory
│   │   │   ├── core/                 # Auth, errors, logging, audit
│   │   │   ├── db/                   # SQLAlchemy engine + session
│   │   │   ├── models/               # SQLAlchemy ORM models
│   │   │   │   ├── artifact.py       # Artifact (documents, notes, audio)
│   │   │   │   ├── patient.py        # Patient
│   │   │   │   ├── user.py           # Doctor/user
│   │   │   │   ├── clinic.py         # Clinic (multi-tenant)
│   │   │   │   └── audit_log.py      # Audit trail
│   │   │   ├── repositories/         # Data access layer
│   │   │   ├── routes/               # API route handlers
│   │   │   │   ├── patients.py       # /patients/* endpoints
│   │   │   │   ├── artifacts.py      # /artifacts/* endpoints
│   │   │   │   └── health.py         # /health endpoint
│   │   │   ├── schemas/              # Pydantic request/response models
│   │   │   ├── services/             # Business logic
│   │   │   │   ├── artifact_service.py  # Upload, note, audio, delete
│   │   │   │   └── patient_service.py   # Patient CRUD
│   │   │   ├── storage/              # S3/MinIO object storage
│   │   │   ├── stt/                  # Speech-to-text (faster-whisper)
│   │   │   │   ├── base.py           # STTClient ABC
│   │   │   │   ├── local_client.py   # faster-whisper implementation
│   │   │   │   └── stub_client.py    # Dev stub (no GPU needed)
│   │   │   └── utils/                # Helpers
│   │   ├── alembic/                  # Database migrations
│   │   ├── tests/                    # pytest test suite
│   │   └── pyproject.toml            # Python deps & config
│   │
│   └── web/                          # React + Vite frontend
│       └── src/
│           ├── pages/
│           │   ├── Home.tsx           # Patient list
│           │   └── Patient.tsx        # Patient workspace
│           ├── components/
│           │   ├── PatientWorkspace/   # Workspace UI components
│           │   ├── AudioPlayer.tsx     # Custom audio player
│           │   └── ...
│           ├── lib/
│           │   └── api.ts             # Axios API client
│           ├── hooks/
│           │   └── useRecorder.ts     # MediaRecorder hook
│           └── types/
│               └── index.ts           # TypeScript type definitions
│
├── scripts/                          # Dev scripts
│   ├── seed_dev_data.py              # Seed demo patients
│   ├── bootstrap_db.sh              # Bootstrap Postgres
│   └── reset_local.sh               # Reset local data
│
├── docs/                             # Architecture docs
├── docker-compose.yml                # Infra (Postgres, Redis, MinIO)
├── start.sh                          # One-command dev startup
├── Makefile                          # Common commands
└── .env.example                      # Environment template
```

---

## 🔌 Extension Guide: Adding AI Capabilities

This starter kit is designed for you to add AI features on top. The architecture follows a clean separation — all AI logic lives in dedicated modules that plug into the existing service layer.

### Extension Point 1: LLM Client

Create an LLM module to call language models (local or cloud).

```
apps/api/src/ojas/llm/
├── __init__.py          # Factory: get_llm_client()
├── base.py              # LLMClient ABC with generate() and stream()
└── your_client.py       # Your implementation (OpenAI, Ollama, vLLM, etc.)
```

**Step 1:** Create the base interface:

```python
# ojas/llm/base.py
from abc import ABC, abstractmethod

class LLMMessage:
    def __init__(self, role: str, content: str):
        self.role = role
        self.content = content

class LLMClient(ABC):
    @abstractmethod
    async def generate(self, messages: list[LLMMessage], **kwargs) -> str:
        """Generate a response and return the full text."""

    @abstractmethod
    async def stream(self, messages: list[LLMMessage], **kwargs):
        """Stream response tokens."""
```

**Step 2:** Implement for your LLM backend:

```python
# ojas/llm/openai_client.py
import httpx
from ojas.llm.base import LLMClient, LLMMessage

class OpenAIClient(LLMClient):
    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        self._client = httpx.AsyncClient(...)
        self._model = model

    async def generate(self, messages, **kwargs) -> str:
        # Call OpenAI API
        ...
```

**Step 3:** Wire it up:

```python
# ojas/llm/__init__.py
def get_llm_client() -> LLMClient:
    return OpenAIClient(api_key=settings.openai_api_key)
```

---

### Extension Point 2: Embeddings

Create an embedding module for vector search / RAG.

```
apps/api/src/ojas/embeddings/
├── __init__.py          # Factory: get_embedding_client()
├── base.py              # EmbeddingClient ABC
└── your_client.py       # sentence-transformers, OpenAI, etc.
```

```python
# ojas/embeddings/base.py
from abc import ABC, abstractmethod

class EmbeddingClient(ABC):
    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts."""

    @abstractmethod
    def embed_one(self, text: str) -> list[float]:
        """Embed a single text."""
```

You'll also need to:
1. Add `pgvector` to `pyproject.toml`
2. Create an `Embedding` model in `ojas/models/`
3. Create an `EmbeddingRepository` in `ojas/repositories/`
4. Create a migration to add the `embeddings` table

---

### Extension Point 3: Background Worker Pipeline

Use `arq` (already in Redis docker-compose) to process artifacts asynchronously.

```
apps/api/src/ojas/workers/
├── __init__.py          # enqueue_labeling() helper
└── tasks.py             # WorkerSettings + task functions
```

```python
# ojas/workers/tasks.py
from arq import cron
from ojas.db.session import async_session_factory

async def run_labeling_pipeline(ctx, artifact_id: str):
    async with async_session_factory() as session:
        # 1. Extract text from artifact
        # 2. Call LLM to classify + summarize
        # 3. Generate embeddings
        # 4. Store results
        pass

class WorkerSettings:
    functions = [run_labeling_pipeline]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
```

Add to `start.sh`:
```bash
$UV run arq ojas.workers.tasks.WorkerSettings 2>&1 | sed 's/^/[worker] /' &
```

---

### Extension Point 4: Chat / RAG Service

Create a retrieval service that combines embeddings + LLM:

```python
# ojas/services/retrieval_service.py
class RetrievalService:
    def __init__(self, session, llm, embedder, actor_id):
        self._llm = llm
        self._embedder = embedder
        # ...

    async def answer(self, patient_id, question) -> dict:
        # 1. Embed the question
        q_vector = self._embedder.embed_one(question)
        # 2. ANN search — patient-scoped at SQL level
        chunks = await self._emb_repo.search(patient_id, q_vector, top_k=8)
        # 3. Build prompt with retrieved context
        # 4. Call LLM
        # 5. Return structured answer
```

Then add a route:
```python
# In ojas/routes/patients.py
@router.post("/{patient_id}/ask")
async def ask_patient(patient_id, body: AskRequest, ...):
    svc = RetrievalService(session=session, llm=get_llm_client(), ...)
    return await svc.answer(patient_id, body.question)
```

And wire the frontend:
```typescript
// In lib/api.ts
export async function askPatient(patientId: string, question: string) {
  const { data } = await api.post(`/patients/${patientId}/ask`, { question });
  return data;
}
```

---

### Extension Point 5: Frontend AI Panel

The `Patient.tsx` workspace has a designated "AI Extension Point" area in the right panel. Replace it with your AI UI:

```tsx
// Replace the dashed-border placeholder in Patient.tsx with:
<AskPanel
  patientFirstName={firstName}
  onPromptClick={handleAsk}
  // ...
/>
```

---

## 📡 API Reference

### Patients

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/patients` | Create a patient |
| `GET` | `/patients` | List patients (optionally `?q=search`) |
| `GET` | `/patients/:id` | Get a patient |
| `POST` | `/patients/:id/open` | Mark patient as accessed |

### Artifacts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/patients/:id/artifacts` | List patient's artifacts |
| `POST` | `/patients/:id/artifacts/upload` | Upload a file |
| `POST` | `/patients/:id/artifacts/note` | Create a text note |
| `POST` | `/patients/:id/artifacts/audio` | Save recorded audio |
| `GET` | `/artifacts/:id` | Get artifact details |
| `PATCH` | `/artifacts/:id` | Update title/summary |
| `DELETE` | `/artifacts/:id` | Delete an artifact |
| `GET` | `/artifacts/:id/download` | Get presigned download URL |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health check |

---

## 🧪 Testing

```bash
# Backend tests (requires running Postgres with ojas_test database)
cd apps/api && uv run pytest

# Frontend type check & build
cd apps/web && pnpm build
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+ · FastAPI · SQLAlchemy 2.0 · Alembic |
| Frontend | React 18 · TypeScript · Vite · TanStack Query |
| Database | PostgreSQL 16 (pgvector-ready) |
| Cache/Queue | Redis 7 |
| Object Storage | MinIO (S3-compatible) |
| Speech-to-Text | 🔌 Extension point (scaffolding in `stt/` ready) |
| Auth | JWT (python-jose) |
| Logging | structlog |
| Testing | pytest + pytest-asyncio · Vitest |

---

## 📝 License

MIT

---

Built with care as a foundation for clinical AI tools. Add your intelligence layer and ship something that matters. 🧠
