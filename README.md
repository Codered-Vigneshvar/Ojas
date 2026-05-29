# Ojas — Clinical Patient Management Workspace

> **Ojas** (Sanskrit: ओजस् — "vitality, life force") is a full-stack, AI-powered patient management workspace that lets doctors capture consultation data through notes, audio, and documents — and automatically structures, consolidates, and summarizes everything using GPT-4o.

---

## What It Does

Instead of manual data entry, doctors capture raw clinical data in any form. Ojas processes it in the background, builds a unified **clinical manifest** from all artifacts, and uses that to power an AI summary and contextual Q&A — all without hallucination, because the AI only uses facts from the manifest.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11 · FastAPI · SQLAlchemy 2.0 (async) · Alembic |
| Frontend | React 18 · TypeScript · Vite · TailwindCSS · TanStack Query |
| Database | PostgreSQL 16 + pgvector |
| Cache | Redis 7 |
| Object Storage | MinIO (S3-compatible) |
| AI / LLM | OpenAI GPT-4o, GPT-4o-mini, GPT-4o Vision |
| Speech-to-Text | Deepgram nova-2 (fallback: faster-whisper) |
| Auth | JWT + bcrypt |
| Logging | structlog (structured JSON) |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Frontend  (React + Vite :5173)         │
│  Home.tsx          Patient.tsx         Modals        │
│  PatientList       ConsultationScribe  RecordModal   │
│  CreatePatient     SnippetSidebar      NoteModal     │
│                    ConsultationHistory UploadModal   │
└──────────────────────────┬──────────────────────────┘
                           │ REST / JSON
┌──────────────────────────┴──────────────────────────┐
│              Backend  (FastAPI :8000)               │
│                                                     │
│  Routes          Services            Repositories   │
│  /patients       PatientService      PatientRepo    │
│  /consultations  ArtifactService     ArtifactRepo   │
│  /artifacts      ConsolidationSvc                   │
│  /ai             LLMService                         │
│  /health         OCRService                         │
│                  LabelingService                    │
│                  STTService (Deepgram)               │
└──────────────────────────┬──────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────┐
│              Infrastructure  (Docker Compose)       │
│  PostgreSQL 16 :5432   Redis 7 :6379                │
│  MinIO :9000 (API)     MinIO :9001 (Console UI)     │
└─────────────────────────────────────────────────────┘
```

---

## Database Design

### Tables

#### `clinics`
Organizational root. Everything is scoped to a clinic.

```
id UUID PK | name VARCHAR | created_at | updated_at
```

#### `users`
Doctor/staff accounts per clinic.

```
id UUID PK | clinic_id FK→clinics | name VARCHAR | role VARCHAR DEFAULT 'doctor'
created_at | updated_at
```

#### `patients`
One row per patient per clinic. Phone number (E.164) is the identity key.

```
id UUID PK
clinic_id FK→clinics
name VARCHAR(255)
phone_e164 VARCHAR(20)         -- normalized to +91XXXXXXXXXX
last_accessed_at TIMESTAMP     -- updated on every patient "open"
created_at | updated_at

UNIQUE (clinic_id, phone_e164) -- one patient per phone per clinic
INDEX  (clinic_id, last_accessed_at DESC)
```

#### `consultations`
One per visit/session. Holds the compiled AI output for the whole visit.

```
id UUID PK
patient_id FK→patients (CASCADE)
clinic_id FK→clinics (CASCADE)
title VARCHAR(500)
notes TEXT
summary_text TEXT              -- AI-generated markdown summary (GPT-4o output)
suggested_questions JSONB      -- ["What is the follow-up plan?", ...]
clinical_manifest JSONB        -- Compiled timeline of all artifacts, used as LLM context
created_at | updated_at

INDEX (patient_id, created_at DESC)
```

#### `artifacts`
Core data table. Every note, audio clip, image, and file is an artifact.

```
id UUID PK
patient_id FK→patients (CASCADE)
consultation_id FK→consultations (SET NULL)  -- optional
parent_id FK→artifacts (CASCADE)             -- artifact hierarchy
clinic_id FK→clinics (CASCADE)

type VARCHAR(50)        -- "note" | "audio" | "image" | "file" | "prescription" | "report"
title VARCHAR(500)      -- AI auto-labeled or user-provided
summary VARCHAR(500)

-- File storage
storage_key VARCHAR(1000)   -- MinIO/S3 path (null for plain notes)
mime_type VARCHAR(200)
size_bytes BIGINT
duration_seconds INT        -- audio only

-- Text content
text_content TEXT           -- plain text for notes; OCR or transcript text
raw_transcript TEXT         -- raw Deepgram output
structured_note JSONB       -- {chief_complaint, diagnosis, treatment_plan, medications, follow_up}
tags JSONB                  -- ["infection", "hypertension", ...]

-- Prescription fields
prescription_ocr_text TEXT  -- raw text extracted by GPT-4o Vision
prescription_summary JSONB  -- {medications:[...], lab_results:[...], patient_metadata:{...}}
doctor_confirmed_at TIMESTAMP

metadata JSONB
created_at | updated_at

INDEX (patient_id, created_at DESC)
INDEX (consultation_id)
```

#### `consultation_messages`
Full chat history per consultation.

```
id UUID PK
consultation_id FK→consultations (CASCADE)
role VARCHAR(50)    -- "user" | "assistant"
content TEXT
created_at | updated_at
```

#### `audit_logs`
Every mutation is logged for compliance.

```
id UUID PK
actor_user_id UUID
action VARCHAR(100)        -- "patient.create" | "artifact.edit" | "artifact.delete"
resource_type VARCHAR(100) -- "patient" | "artifact" | "consultation"
resource_id UUID
metadata JSONB
created_at TIMESTAMP

INDEX (actor_user_id, created_at DESC)
```

### Migration History

| File | What changed |
|------|-------------|
| `0001_initial` | Base structure |
| `0002_core_tables` | clinics, users, patients, artifacts, audit_logs |
| `0005_ai_columns` | raw_transcript, structured_note, tags, prescription_* on artifacts |
| `0006_consultations` | consultations table + FK from artifacts |
| `7de6e73...` | parent_id FK on artifacts (hierarchy) |
| `8fd8901...` | consultation_messages table |
| `b3ccf3b...` | summary_text, suggested_questions, clinical_manifest on consultations |

---

## Features & Implementation Details

### 1. Patient Management

**How it works:**
- Phone numbers are normalized to E.164 on write (`PatientService.normalize_phone`)
- A `UNIQUE (clinic_id, phone_e164)` constraint prevents duplicate patients
- `last_accessed_at` is bumped every time a patient workspace is opened — powers the "recent patients" list
- Search queries name and phone columns with `ILIKE`

---

### 2. Artifact Capture (Notes, Audio, Files)

Three capture paths, all converging into the `artifacts` table:

**Text Note** → `POST /patients/{id}/artifacts/note`
- Saved as `type="note"`, `text_content=<text>`
- Background: `label_note()` → GPT-4o-mini generates a short title (≤60 chars)
- Background: `consolidate_consultation()` triggered if attached to a consultation

**Audio Recording** → `POST /patients/{id}/artifacts/audio`
- Audio blob saved to MinIO → artifact created with `storage_key`
- Background pipeline:
  1. Download audio from MinIO
  2. Deepgram nova-2 → `raw_transcript`
  3. `structure_transcript()` → GPT-4o → `structured_note` + `tags`
  4. `label_audio()` → GPT-4o-mini → `title`
  5. `consolidate_consultation()` triggered

**File / Image Upload** → `POST /patients/{id}/artifacts/upload`
- File saved to MinIO → artifact created
- For images, background OCR pipeline:
  1. Download image from MinIO
  2. GPT-4o Vision → `prescription_ocr_text`
  3. GPT-4o → `prescription_summary` JSON (medications, lab results, patient metadata)
  4. `label_file()` → GPT-4o-mini → `title`
  5. `consolidate_consultation()` triggered

---

### 3. Full Context Injection — The Consolidation Pipeline

This is the core AI architecture. Instead of RAG (retrieving embeddings), Ojas compiles **every artifact** for a consultation into a single JSON timeline and injects it directly into the LLM system prompt.

**Why this approach:**
- Consultations are bounded (1 visit ≈ a few KB of text — fits in context easily)
- Enables the LLM to resolve contradictions because it sees the full timeline
- No retrieval errors — nothing is left out

**Trigger points** (via FastAPI `BackgroundTasks`):
- Artifact created in a consultation
- Artifact `PATCH`ed (doctor edits structured note or prescription JSON)
- Artifact deleted from a consultation

**Pipeline** (`consolidation_service.py`):
1. Fetch all artifacts for the consultation, ordered `created_at ASC`
2. Build `clinical_manifest`:
```json
{
  "consultation_id": "...",
  "patient": {"name": "...", "phone": "..."},
  "snippets": [
    {
      "id": "...",
      "type": "audio",
      "title": "Morning Dictation",
      "created_at": "2026-05-29T09:00:00",
      "content": {
        "transcript": "Patient reports ...",
        "structured_note": { "chief_complaint": "...", "diagnosis": "..." }
      }
    }
  ]
}
```
3. Inject manifest into GPT-4o system prompt
4. GPT-4o returns structured markdown summary + suggested questions array
5. `summary_text` and `suggested_questions` saved to consultation row
6. `clinical_manifest` saved (reused for Q&A without recompiling)

**Prompt engineering highlights:**
- AI is forbidden from suggesting questions whose answers aren't in the manifest
- Contradictions resolved by always prioritizing the latest snippet in the timeline
- Forced `Patient Details` section merges DB fields + any demographics in notes

---

### 4. Editable Structured Data (JSON Editor)

OCR and LLM extractions aren't perfect. A drug name might be misread, a dosage might be wrong.

**How it works:**
- `SnippetDetail.tsx` renders a raw JSON editor for `structured_note` and `prescription_summary`
- Doctor edits directly in the UI
- `PATCH /artifacts/{id}` saves the corrected JSON to the DB
- Background task automatically re-consolidates — the summary and Q&A reflect the correction immediately
- `doctor_confirmed_at` timestamp set via `POST /ai/artifacts/{id}/confirm`

---

### 5. Voice Correction

Doctor speaks a correction ("change the dosage to 500mg") instead of typing.

**How it works:**
1. Audio recorded → Deepgram transcribes correction text
2. `POST /ai/artifacts/{id}/voice-edit` with correction text
3. `llm_service.apply_voice_correction` receives current `structured_note` + correction text
4. LLM returns updated note with only the specified field changed (field-level updates only — no hallucinated additions)
5. Saved → background consolidation triggered

---

### 6. Contextual Q&A (Chat)

Doctors ask questions about the current consultation without leaving the workspace.

**How it works:**
1. `POST /consultations/{id}/ask` with question
2. Backend fetches `clinical_manifest` from consultation row (pre-compiled)
3. Builds: `[system: manifest, ...history, user: question]`
4. GPT-4o responds with answer + source citations as `[Snippet Title](snippet://<artifact_id>)` links
5. Both messages saved to `consultation_messages`
6. Frontend renders markdown, makes `snippet://` links clickable → jumps to artifact in sidebar

**Hallucination prevention:** LLM explicitly instructed to say "I don't have that information" if the fact isn't in the manifest.

---

### 7. Speech-to-Text

Two providers, switchable via `STT_PROVIDER` env var:

**Deepgram nova-2 (default/recommended):**
- Cloud API, ~300ms latency
- Language detection, smart punctuation
- Used for both live partial transcription (`/ai/transcribe-bytes`) and saved artifact transcription

**faster-whisper (local fallback):**
- Runs on CPU, no API key needed
- Configurable model size (`small|medium|large`)
- Slower but fully offline

---

### 8. Auto-Labeling

Every artifact gets a short, descriptive title automatically.

**How it works:**
- `LabelingService` calls GPT-4o-mini (fast + cheap) with artifact content
- `label_audio(transcript)` → e.g. "Morning Dictation — Chest Pain"
- `label_note(text)` → e.g. "Follow-up Instructions — Hypertension"
- `label_file(filename, mime_type)` → e.g. "CBC Report — 29 May" + category tag
- All labeling runs in background tasks — never blocks the API response

---

## API Reference

### Patients
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/patients` | Create patient (normalizes phone to E.164) |
| `GET` | `/patients` | List recent patients or search by `?q=` |
| `GET` | `/patients/{id}` | Get patient details |
| `POST` | `/patients/{id}/open` | Bump last_accessed_at, return artifact count |

### Consultations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/patients/{id}/consultations` | Create consultation |
| `GET` | `/patients/{id}/consultations` | List consultations |
| `GET` | `/consultations/{id}` | Get consultation |
| `PATCH` | `/consultations/{id}` | Update title/notes |
| `DELETE` | `/consultations/{id}` | Delete (orphans artifacts) |
| `GET` | `/consultations/{id}/summary` | Get AI summary + suggested questions |
| `GET` | `/consultations/{id}/messages` | Chat history |
| `POST` | `/consultations/{id}/ask` | Ask a question |
| `DELETE` | `/consultations/{id}/messages/{msg_id}` | Delete message |

### Artifacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/patients/{id}/artifacts` | List artifacts (filter by consultation_id, search) |
| `POST` | `/patients/{id}/artifacts/upload` | Upload file/image |
| `POST` | `/patients/{id}/artifacts/note` | Create text note |
| `POST` | `/patients/{id}/artifacts/audio` | Save audio blob |
| `GET` | `/artifacts/{id}` | Get artifact |
| `PATCH` | `/artifacts/{id}` | Update (title, text, structured_note, prescription_summary) |
| `DELETE` | `/artifacts/{id}` | Delete + remove from storage |
| `GET` | `/artifacts/{id}/download` | Get presigned MinIO download URL |

### AI Services
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ai/transcribe-bytes` | Transcribe audio without saving to DB |
| `POST` | `/ai/artifacts/{id}/transcribe` | Download audio → Deepgram → save transcript |
| `POST` | `/ai/artifacts/{id}/structure` | Structure raw transcript with GPT-4o |
| `POST` | `/ai/artifacts/{id}/ocr` | OCR image → structure prescription |
| `POST` | `/ai/artifacts/{id}/confirm` | Mark artifact as doctor-confirmed |
| `POST` | `/ai/artifacts/{id}/voice-edit` | Apply spoken correction to structured note |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Check DB + Redis connectivity |

---

## Data Flow Walkthroughs

### Recording a Consultation

```
Doctor clicks Record → speaks for 2 minutes
    ↓
Frontend streams partial audio → POST /ai/transcribe-bytes (live preview)
    ↓
Doctor stops → POST /patients/{id}/artifacts/audio (final blob)
    ↓
Backend: saves to MinIO, creates artifact row, returns immediately
    ↓ (background)
1. Download audio from MinIO
2. Deepgram nova-2 → raw_transcript
3. GPT-4o structure_transcript → structured_note + tags
4. GPT-4o-mini label_audio → title
5. consolidate_consultation:
   → fetch all artifacts for consultation
   → build clinical_manifest JSON
   → GPT-4o → summary_text + suggested_questions
   → save to consultation row
    ↓
Frontend polls artifact every 2s until structured_note appears → renders result
```

### Uploading a Prescription Image

```
Doctor uploads prescription photo
    ↓
POST /patients/{id}/artifacts/upload → saved to MinIO, returns immediately
    ↓ (background)
1. GPT-4o Vision OCR → prescription_ocr_text
2. GPT-4o structure_prescription → prescription_summary JSON
   {medications: [{name, dose, frequency}], lab_results: [...]}
3. GPT-4o-mini label_file → title
4. consolidate_consultation triggered
    ↓
Frontend polls until prescription_summary populated
Doctor reviews medications table, edits OCR mistakes in JSON editor
PATCH /artifacts/{id} → saves correction → consolidation re-runs in background
```

### Asking a Question

```
Doctor types "What medications were prescribed?"
    ↓
POST /consultations/{id}/ask
    ↓
Backend fetches consultation.clinical_manifest (pre-compiled JSON)
Builds: [system: manifest context, ...chat_history, user: question]
    ↓
GPT-4o responds:
"Amoxicillin 500mg 3x daily was prescribed. [Prescription Scan](snippet://abc-123)"
    ↓
Both messages saved to consultation_messages
    ↓
Frontend renders markdown + clickable snippet links → jumps to artifact in sidebar
```

---

## Quick Start

### Prerequisites
- Docker (or Colima)
- Python 3.11+ with `uv`
- Node.js 18+ with `pnpm`

### 1. Clone & configure
```bash
git clone https://github.com/your-org/ojas.git && cd ojas
cp .env.example .env
# Add OPENAI_API_KEY and DEEPGRAM_API_KEY to .env
```

### 2. Start infrastructure
```bash
docker compose up -d
```

### 3. Backend setup
```bash
cd apps/api
uv sync
uv run alembic upgrade head
```

### 4. Frontend setup
```bash
cd apps/web
pnpm install
```

### 5. Run everything
```bash
./start.sh
```

Open **http://localhost:5173**

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://ojas:ojas_dev@localhost:5432/ojas` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection |
| `S3_ENDPOINT_URL` | `http://localhost:9000` | MinIO endpoint |
| `S3_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `S3_SECRET_KEY` | `minioadmin` | MinIO secret key |
| `S3_BUCKET` | `ojas-artifacts` | Bucket name |
| `OPENAI_API_KEY` | — | Required for consolidation, OCR, structuring |
| `OPENAI_MODEL` | `gpt-4o` | Model used for consolidation |
| `STT_PROVIDER` | `deepgram` | `deepgram` or `local` |
| `DEEPGRAM_API_KEY` | — | Required if `STT_PROVIDER=deepgram` |
| `STT_MODEL_SIZE` | `small` | For local whisper: `small\|medium\|large` |
| `JWT_SECRET` | `change-me-in-production` | Auth token signing key |
| `ENVIRONMENT` | `dev` | `dev\|staging\|prod` |
| `LOG_LEVEL` | `DEBUG` | Logging verbosity |

---

## Security

**Per-patient scoping:** Every repository query takes `patient_id: UUID` and includes it in the SQL `WHERE` clause. Cross-patient data leakage is structurally impossible at the query level.

**Audit logging:** Every mutation (create/edit/delete) writes to `audit_logs` with actor, action, resource type/id, and metadata.

**Auth:** JWT tokens, bcrypt password hashing, `get_current_user` dependency injected into all protected routes.

---

## Project Structure

```
OjasAI/
├── apps/
│   ├── api/                          # FastAPI backend
│   │   ├── src/ojas/
│   │   │   ├── main.py               # App factory, router registration
│   │   │   ├── config.py             # Pydantic BaseSettings
│   │   │   ├── models/               # SQLAlchemy ORM models
│   │   │   ├── schemas/              # Pydantic request/response models
│   │   │   ├── routes/               # FastAPI routers (thin)
│   │   │   ├── services/             # Business logic & orchestration
│   │   │   ├── repositories/         # Data access layer (SQL)
│   │   │   ├── storage/              # MinIO/S3 abstraction
│   │   │   ├── stt/                  # STT client interfaces
│   │   │   └── core/                 # Deps, errors, audit, logging
│   │   └── alembic/versions/         # DB migrations
│   │
│   └── web/                          # React + Vite frontend
│       └── src/
│           ├── pages/                # Home.tsx, Patient.tsx
│           ├── components/           # PatientWorkspace/* modals
│           ├── hooks/                # useRecorder.ts
│           ├── lib/                  # api.ts, queryClient, utils
│           └── types/                # TypeScript interfaces
│
├── docker-compose.yml
├── .env.example
└── start.sh
```

---

## License

MIT
