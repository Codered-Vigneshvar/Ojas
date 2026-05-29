# Ojas — AI-Powered Clinical Workspace

> **Ojas** (Sanskrit: ओजस् — "vitality, life force") is a full-stack patient management system for doctors. Capture consultation data through notes, audio, and documents — Ojas automatically structures, consolidates, and answers questions about it using AI.

---

## What It Does

Instead of manual data entry across disconnected screens, Ojas lets doctors:

1. **Capture** — record audio, upload prescriptions/reports, type notes
2. **Structure** — AI automatically extracts diagnoses, medications, lab results
3. **Consolidate** — a single AI-generated summary updates automatically as data changes
4. **Query** — ask natural-language questions, get answers cited back to source artifacts

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 · TypeScript · Vite · TailwindCSS · TanStack Query |
| Backend | Python 3.11 · FastAPI · SQLAlchemy 2.0 (async) · Alembic |
| Database | PostgreSQL 16 (pgvector enabled) |
| Object Storage | MinIO (S3-compatible) |
| Cache | Redis 7 |
| AI / LLM | OpenAI GPT-4o · GPT-4o-mini · GPT-4o Vision |
| Speech-to-Text | Deepgram nova-2 (cloud) · faster-whisper (local fallback) |
| Logging | structlog (structured JSON) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (React · Vite)                │
│  Home.tsx           Patient.tsx           Modals        │
│  └─ Patient list    ├─ ConsultationHistory              │
│                     ├─ ConsultationScribe (chat+summary)│
│                     ├─ SnippetSidebar (artifact list)   │
│                     └─ SnippetDetail (edit/view)        │
└────────────────────────┬────────────────────────────────┘
                         │ REST / JSON
┌────────────────────────┴────────────────────────────────┐
│               Backend (FastAPI · Python)                │
│                                                         │
│  Routes          Services              Repositories     │
│  ├─ patients     ├─ patient_service    ├─ patient_repo  │
│  ├─ artifacts    ├─ artifact_service   └─ artifact_repo │
│  ├─ consults     ├─ consolidation_svc                   │
│  └─ ai           ├─ llm_service                         │
│                  ├─ ocr_service                         │
│                  ├─ labeling_service                    │
│                  └─ stt_deepgram                        │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│               Infrastructure (Docker Compose)           │
│  PostgreSQL 16 :5432   Redis 7 :6379   MinIO :9000      │
└─────────────────────────────────────────────────────────┘
```

---

## Database Design

### Schema Overview

```
clinics
  └── users (FK: clinic_id)
  └── patients (FK: clinic_id, UNIQUE phone_e164 per clinic)
        └── consultations (FK: patient_id, clinic_id)
              ├── artifacts (FK: consultation_id, parent_id self-ref)
              └── consultation_messages (FK: consultation_id)

audit_logs (append-only, every mutation)
```

### Table Definitions

**`clinics`** — root organizational unit
```sql
id             UUID  PK
name           VARCHAR(255)
created_at     TIMESTAMP
updated_at     TIMESTAMP
```

**`users`** — doctor/staff accounts
```sql
id             UUID  PK
clinic_id      UUID  FK → clinics
name           VARCHAR(255)
role           VARCHAR(50)  DEFAULT 'doctor'
```

**`patients`** — one row per patient per clinic
```sql
id               UUID  PK
clinic_id        UUID  FK → clinics
name             VARCHAR(255)
phone_e164       VARCHAR(20)        -- normalized +91XXXXXXXXXX
last_accessed_at TIMESTAMP
-- UNIQUE (clinic_id, phone_e164)   prevents duplicate phone per clinic
-- INDEX  (clinic_id, last_accessed_at DESC) for "recent patients" query
```

**`consultations`** — one row per patient visit/session
```sql
id                   UUID  PK
patient_id           UUID  FK → patients  CASCADE
clinic_id            UUID  FK → clinics   CASCADE
title                VARCHAR(500)
notes                TEXT
summary_text         TEXT       -- AI-generated markdown overview
suggested_questions  JSONB      -- ["What is the diagnosis?", ...]
clinical_manifest    JSONB      -- compiled timeline of all artifacts
-- INDEX (patient_id, created_at DESC)
```

**`artifacts`** — files, notes, audio, prescriptions, reports
```sql
id                    UUID   PK
patient_id            UUID   FK → patients      CASCADE
consultation_id       UUID   FK → consultations SET NULL
parent_id             UUID   FK → artifacts     CASCADE  -- hierarchy
clinic_id             UUID   FK → clinics       CASCADE
type                  VARCHAR(50)   -- note | audio | image | file | prescription | report
title                 VARCHAR(500)  -- AI-labeled or user-provided
summary               VARCHAR(500)
storage_key           VARCHAR(1000) -- MinIO object path (null for notes)
mime_type             VARCHAR(200)
size_bytes            BIGINT
text_content          TEXT          -- notes or transcripts
duration_seconds      INT           -- audio only
raw_transcript        TEXT          -- Deepgram output
structured_note       JSONB         -- {chief_complaint, diagnosis, treatment_plan, medications, follow_up}
tags                  JSONB         -- ["infection", "follow_up", ...]
prescription_ocr_text TEXT          -- raw GPT-4o Vision OCR
prescription_summary  JSONB         -- {medications:[...], lab_results:[...], patient_meta:{...}}
doctor_confirmed_at   TIMESTAMP     -- when doctor verified extraction
metadata              JSONB
-- INDEX (patient_id, created_at DESC)
-- INDEX (consultation_id)
```

**`consultation_messages`** — persistent chat history
```sql
id                UUID  PK
consultation_id   UUID  FK → consultations  CASCADE
role              VARCHAR(50)  -- user | assistant
content           TEXT
```

**`audit_logs`** — append-only compliance trail
```sql
id               UUID  PK
actor_user_id    UUID  (nullable)
action           VARCHAR(100)   -- patient.create | artifact.edit | artifact.delete
resource_type    VARCHAR(100)
resource_id      UUID
metadata         JSONB
created_at       TIMESTAMP  (no updated_at — never mutated)
```

### Migration History

| File | What Changed |
|---|---|
| `0001_initial.py` | Base structure |
| `0002_core_tables.py` | clinics, users, patients, artifacts, audit_logs |
| `0005_ai_columns.py` | raw_transcript, structured_note, tags, prescription_* on artifacts |
| `0006_consultations.py` | consultations table + FK from artifacts |
| `7de6e73_add_parent_id_to_artifacts.py` | parent_id self-FK for artifact hierarchy |
| `8fd8901_add_consultation_messages_table.py` | consultation_messages for chat history |
| `b3ccf3b_add_summary_text_suggested_questions_.py` | summary_text, suggested_questions, clinical_manifest on consultations |

---

## Features — How Each One Works

### 1. Patient Management

**Phone as identity key.** Patients are looked up and deduplicated by phone number. On creation, the backend normalizes any Indian phone format to E.164 (`+91XXXXXXXXXX`) using `patient_service.normalize_phone()`. The `UNIQUE (clinic_id, phone_e164)` constraint enforces no duplicates at the DB level.

`GET /patients?q=...` runs a search against both name and phone. `POST /patients/{id}/open` touches `last_accessed_at` so the home screen can show recently-opened patients.

---

### 2. Consultation Workspaces

Each patient visit is a **Consultation** — an isolated workspace that owns a set of artifacts, a summary, a chat history, and a compiled `clinical_manifest`. Consultations are listed newest-first; clicking one opens the full workspace with all its artifacts and AI summary.

---

### 3. Artifact Capture (Notes, Audio, Files)

Three capture paths feed into the same `artifacts` table:

**Text Notes** → `POST /patients/{id}/artifacts/note`
- Saves `text_content`, queues background labeling
- `labeling_service.label_note(text)` calls gpt-4o-mini → sets `title` (≤60 chars)

**Audio Recording** → `POST /patients/{id}/artifacts/audio`
- Frontend uses `MediaRecorder` API (`useRecorder.ts`) to capture mic audio as a blob
- Blob POSTed to backend → saved to MinIO → `type="audio"` artifact created
- Background task: download from MinIO → Deepgram nova-2 STT → save `raw_transcript`
- Then: `llm_service.structure_transcript(transcript)` via GPT-4o → save `structured_note` + `tags`
- Then: `labeling_service.label_audio(transcript)` → update `title`
- Then: trigger consolidation

**File / Image Upload** → `POST /patients/{id}/artifacts/upload`
- Saved to MinIO, artifact created with `mime_type` + `size_bytes`
- Background label: `labeling_service.label_file(filename, mime_type)` → `title` + category
- If image: `ocr_service.extract_text_from_image(bytes)` via GPT-4o Vision → `prescription_ocr_text`
- Then: `llm_service.structure_prescription(ocr_text)` → `prescription_summary` JSON
- Then: trigger consolidation

---

### 4. AI Structuring

**Transcript → Structured Note**
```
raw_transcript (Deepgram text)
       ↓
  GPT-4o prompt: extract clinical fields
       ↓
structured_note: {
  chief_complaint, diagnosis, treatment_plan,
  medications: [{name, dosage, frequency}],
  follow_up_instructions
}
tags: ["hypertension", "follow_up_required"]
```

**Prescription Image → Summary**
```
image bytes
    ↓
GPT-4o Vision (OCR) → prescription_ocr_text
    ↓
GPT-4o (structuring) → prescription_summary: {
  medications: [{name, dosage, frequency, duration}],
  lab_results: [{test, value, unit, reference_range}],
  patient_meta: {age, weight, ...}
}
```

Doctors can open **SnippetDetail** in the frontend to edit the raw JSON directly if the AI made a mistake (e.g., "500mg" read as "50mg"). Saving triggers background re-consolidation.

---

### 5. AI Consolidation — Full Context Injection

Ojas deliberately avoids RAG. Instead it uses **Full Context Injection**:

```
All artifacts for consultation (chronological)
         ↓
Build clinical_manifest (JSON timeline)
         ↓
Inject entire manifest into GPT-4o system prompt
         ↓
One API call → summary_text (markdown) + suggested_questions (array)
         ↓
Save to consultation row
```

**Why not RAG?** Consultations typically have 3–15 artifacts — small enough to fit in a single context window. Full injection means the LLM sees all contradictions (e.g., a changed appointment date) and the prompt explicitly instructs it to prioritize the latest snippet.

**Background auto-trigger:** Every artifact `PATCH` or `DELETE` queues `_trigger_consolidation` via FastAPI `BackgroundTasks`. The summary is always current without any manual "regenerate" button.

**Contradiction resolution in the prompt:**
> "If snippets contain contradictory information (e.g. appointment dates), ALWAYS prioritize the LATEST snippet in the timeline."

**Hallucination guard on suggested questions:**
> "CRITICAL: You are FORBIDDEN from suggesting a question if the answer is not explicitly present in the snippets."

---

### 6. Intelligent Q&A (Chat)

`POST /consultations/{id}/ask` — accepts a question + uses existing message history as context.

```
consultation.clinical_manifest (pre-compiled)
  + chat history (consultation_messages)
  + new question
       ↓
GPT-4o with strict system prompt:
  "Answer ONLY using facts in the manifest.
   Cite sources as [Snippet Title](snippet://<id>)"
       ↓
assistant response saved to consultation_messages
       ↓
Frontend renders markdown with clickable snippet links
```

Source citations are rendered as clickable links in the frontend. Clicking `[snippet://uuid]` opens that artifact in SnippetDetail.

---

### 7. Voice Corrections

`POST /ai/artifacts/{id}/voice-edit`

Doctor speaks a correction ("change the dosage to 500mg") while viewing a structured note. The frontend sends the voice correction text + the current `structured_note` JSON to the backend.

```
current structured_note (JSON) + voice correction (text)
        ↓
GPT-4o: apply correction, update only the mentioned fields
        ↓
updated structured_note saved
        ↓
background: trigger consolidation
```

Only fields explicitly mentioned in the correction are modified. All other fields are preserved exactly.

---

### 8. Auto-Labeling

Every artifact gets a short, human-readable title auto-generated by `gpt-4o-mini` (cheap + fast):

- Audio → `label_audio(transcript)` → e.g. "Follow-up: chest pain & ECG"
- Note → `label_note(text)` → e.g. "BP medication adjustment"
- File → `label_file(filename, mime_type)` → e.g. "CBC Report - May 2026"

Max 60 characters. Runs as a background task so the artifact is available in the UI immediately.

---

## API Reference

### Patients
```
POST   /patients                          Create patient (name, phone)
GET    /patients?q=<search>               List recent / search
GET    /patients/{id}                     Get patient
POST   /patients/{id}/open                Touch last_accessed_at
```

### Consultations
```
POST   /patients/{id}/consultations       Create consultation
GET    /patients/{id}/consultations       List consultations
GET    /consultations/{id}                Get consultation + summary
PATCH  /consultations/{id}                Update title/notes
DELETE /consultations/{id}                Delete
GET    /consultations/{id}/summary        AI summary + suggested questions
GET    /consultations/{id}/messages       Chat history
POST   /consultations/{id}/ask            Ask a question
DELETE /consultations/{id}/messages/{id}  Delete a message
```

### Artifacts
```
GET    /patients/{id}/artifacts           List (filter: consultation_id, q)
POST   /patients/{id}/artifacts/upload    Upload file/image
POST   /patients/{id}/artifacts/note      Create text note
POST   /patients/{id}/artifacts/audio     Save audio blob
GET    /artifacts/{id}                    Get artifact
PATCH  /artifacts/{id}                    Update (title, text, structured_note, etc.)
DELETE /artifacts/{id}                    Delete + remove from storage
GET    /artifacts/{id}/download           Presigned S3 download URL
```

### AI
```
POST   /ai/transcribe-bytes               Transcribe audio without saving (live preview)
POST   /ai/artifacts/{id}/transcribe      Download audio → Deepgram → save transcript
POST   /ai/artifacts/{id}/structure       Structure transcript with GPT-4o
POST   /ai/artifacts/{id}/ocr             OCR image → structure prescription
POST   /ai/artifacts/{id}/confirm         Mark artifact as doctor-confirmed
POST   /ai/artifacts/{id}/voice-edit      Apply voice correction to structured note
```

### Health
```
GET    /health                            DB + Redis connectivity check
```

---

## Data Flow: Audio Recording End-to-End

```
1. Doctor clicks "Record" in RecordModal.tsx
   └─ useRecorder.ts starts MediaRecorder (Web Audio API)

2. While speaking, frontend periodically POSTs partial audio chunks to:
   POST /ai/transcribe-bytes  →  Deepgram  →  live transcript shown in UI

3. Doctor clicks "Stop"
   └─ Final audio blob POSTed to POST /patients/{id}/artifacts/audio

4. Backend (synchronous, fast):
   └─ Save blob → MinIO
   └─ Create artifact row (type="audio", storage_key set)
   └─ Return artifact to frontend immediately

5. Backend (background task):
   ├─ Download audio from MinIO
   ├─ Deepgram nova-2 → raw_transcript saved
   ├─ GPT-4o structure_transcript → structured_note + tags saved
   ├─ gpt-4o-mini label_audio → title saved
   └─ consolidate_consultation:
       ├─ Fetch all artifacts for consultation
       ├─ Build clinical_manifest JSON
       ├─ GPT-4o → summary_text + suggested_questions
       └─ Save to consultation row

6. Frontend polls artifact every 2s until structured_note is populated
   └─ Shows structured note in SnippetDetail when ready
```

---

## Data Flow: Prescription Image Upload

```
1. Doctor uploads prescription photo via UploadModal.tsx
   └─ POST /patients/{id}/artifacts/upload

2. Backend (sync):
   └─ Save to MinIO → create artifact (type="image") → return

3. Background:
   ├─ gpt-4o-mini label_file(filename, mime) → title
   ├─ GPT-4o Vision extract_text_from_image → prescription_ocr_text
   ├─ GPT-4o structure_prescription(ocr_text) →
   │    prescription_summary: {
   │      medications: [{name, dosage, frequency, duration}],
   │      lab_results:  [{test, value, unit, ref_range}],
   │      patient_meta: {age, weight, ...}
   │    }
   └─ consolidate_consultation → updated summary_text

4. Frontend polls until prescription_summary populated
   └─ Shows medications table + lab results in SnippetDetail
   └─ Doctor can edit the JSON directly to fix any OCR errors
   └─ On save → PATCH /artifacts/{id} → background re-consolidation
```

---

## Project Structure

```
OjasAI/
├── apps/
│   ├── api/
│   │   ├── alembic/versions/          # DB migrations (one concern per file)
│   │   └── src/ojas/
│   │       ├── main.py                # App factory, router registration, CORS
│   │       ├── config.py              # Pydantic BaseSettings (all env vars)
│   │       ├── models/                # SQLAlchemy ORM models
│   │       ├── schemas/               # Pydantic request/response models
│   │       ├── routes/                # FastAPI routers (thin layer, no logic)
│   │       ├── services/              # Business logic + AI orchestration
│   │       ├── repositories/          # All SQL queries (per-patient scoped)
│   │       ├── storage/               # S3/MinIO abstraction
│   │       ├── stt/                   # STT client interface + impls
│   │       └── core/                  # deps, errors, audit, logging
│   └── web/
│       └── src/
│           ├── pages/                 # Home.tsx, Patient.tsx
│           ├── components/PatientWorkspace/
│           ├── hooks/useRecorder.ts   # Web Audio + MediaRecorder
│           ├── lib/api.ts             # All API calls (Axios)
│           └── types/index.ts         # TypeScript interfaces
├── docker-compose.yml                 # PostgreSQL, Redis, MinIO
└── .env.example
```

---

## Quick Start

### Prerequisites
- Docker (or Colima)
- Python 3.11+ with `uv`
- Node.js 18+ with `pnpm`

### 1. Configure
```bash
cp .env.example .env
# Add OPENAI_API_KEY and DEEPGRAM_API_KEY
```

### 2. Start Infrastructure
```bash
docker compose up -d
```

### 3. Backend
```bash
cd apps/api
uv sync
uv run alembic upgrade head
uv run uvicorn src.ojas.main:app --reload --port 8000
```

### 4. Frontend
```bash
cd apps/web
pnpm install
pnpm dev
```

Open **http://localhost:5173**

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://ojas:ojas_dev@localhost:5432/ojas

# Redis
REDIS_URL=redis://localhost:6379/0

# Object Storage (MinIO)
S3_ENDPOINT_URL=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=ojas-artifacts

# AI
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o

# Speech-to-Text
STT_PROVIDER=deepgram          # or "local" for faster-whisper
DEEPGRAM_API_KEY=...

# App
ENVIRONMENT=dev
LOG_LEVEL=DEBUG
JWT_SECRET=change-me-in-production
```

---

## Security

**Per-patient data scoping** — every repository method accepts `patient_id: UUID` and includes it in the SQL `WHERE` clause. Cross-patient data access is structurally impossible at the query level.

**Audit logging** — every create/update/delete writes an `audit_log` row with actor, action, resource, and timestamp. Append-only (no `updated_at`).

**JWT auth** — bcrypt password hashing, 24h token expiry, `get_current_user` FastAPI dependency on all protected routes.

---

## License
MIT
