# Ojas — Clinical Patient Management Workspace

> **Ojas** (Sanskrit: ओजस् — "vitality, life force") is a full-stack, AI-powered patient management workspace for doctors. Capture consultation data through voice dictation, typed notes, and uploaded documents — Ojas automatically structures, consolidates, and answers questions about it using a cascading LLM stack.

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Project Structure](#project-structure)
5. [Database Design](#database-design)
6. [Features & Implementation Details](#features--implementation-details)
7. [LLM Stack & Fallback Chain](#llm-stack--fallback-chain)
8. [Background Task Pipelines](#background-task-pipelines)
9. [API Reference](#api-reference)
10. [Data Flow Walkthroughs](#data-flow-walkthroughs)
11. [Quick Start](#quick-start)
12. [Configuration Reference](#configuration-reference)
13. [Security Model](#security-model)

---

## What It Does

Traditional clinic software forces doctors into rigid forms and manual data entry. Ojas flips this: doctors capture raw clinical data in any form (speak it, type it, photograph it), and the system does the structuring.

The core architectural decision is **Full Context Injection** instead of RAG. When a consultation has 5 artifacts, all 5 are compiled into a single JSON manifest and injected into the LLM's context window. The LLM sees everything and can resolve contradictions, track medication changes across recordings, and generate a cited summary — without retrieval errors.

---

## Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Backend** | FastAPI · Python 3.11 | Async, typed, `uv`-managed |
| **ORM** | SQLAlchemy 2.0 (async) + Alembic | `AsyncSession`, typed `Mapped[]` columns |
| **Frontend** | React 18 · TypeScript · Vite | `strict` TypeScript, path aliases |
| **Styling** | TailwindCSS | No component library |
| **Server State** | TanStack React Query | Cache, polling, mutations |
| **Database** | PostgreSQL 16 + pgvector | pgvector for future RAG extension |
| **Cache** | Redis 7 | Session data, future task queues |
| **Object Storage** | MinIO (S3-compatible) | All files, audio blobs |
| **Primary LLM** | Google Gemini 2.5 Flash | Via OpenAI-compatible API |
| **LLM Fallback** | Groq Llama-3.3-70b | Automatic on rate limit |
| **Legacy LLM** | OpenAI GPT-4o | Used if no Gemini key set |
| **STT** | Deepgram nova-2 | Cloud, ~300ms; fallback: faster-whisper |
| **Auth** | JWT (HS256) + bcrypt | 24-hour tokens |
| **Logging** | structlog | Structured JSON, per-request context |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Frontend (React + Vite :5173)               │
│                                                              │
│  pages/Home.tsx              pages/Dashboard.tsx             │
│  └── PatientList             └── AppointmentCalendar         │
│      CreatePatientModal          BookAppointmentModal         │
│                                  AppointmentCard             │
│                                                              │
│  pages/Patient.tsx                                           │
│  ├── ConsultationHistory (left sidebar)                      │
│  ├── ConsultationScribe  (center: summary + chat)            │
│  └── SnippetSidebar      (right: artifact timeline)          │
│      ├── RecordModal  (live audio dictation)                 │
│      ├── NoteModal    (text note)                            │
│      ├── UploadModal  (file/image)                           │
│      └── SnippetDetail (view/edit JSON)                      │
└──────────────────────────────┬───────────────────────────────┘
                               │ REST / JSON
┌──────────────────────────────┴───────────────────────────────┐
│                  Backend (FastAPI :8000)                     │
│                                                              │
│  routes/            services/              repositories/     │
│  ├── patients.py    ├── patient_service    ├── patient_repo  │
│  ├── appointments   ├── artifact_service   └── artifact_repo │
│  ├── consultations  ├── consolidation_svc                    │
│  ├── artifacts.py   ├── llm_service                          │
│  ├── ai.py          ├── ocr_service                          │
│  └── health.py      ├── labeling_service                     │
│                     └── stt_deepgram                         │
│                                                              │
│  utils/llm_client.py  ← Gemini → Groq fallback chain        │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────┴───────────────────────────────┐
│              Infrastructure (Docker Compose)                 │
│                                                              │
│  PostgreSQL 16+pgvector :5432   Redis 7 :6379                │
│  MinIO API :9000                MinIO Console UI :9001        │
└──────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
OjasAI/
├── apps/
│   ├── api/                                   # FastAPI backend
│   │   ├── src/ojas/
│   │   │   ├── main.py                        # App factory, CORS, router registration
│   │   │   ├── config.py                      # Pydantic BaseSettings (all env vars)
│   │   │   │
│   │   │   ├── models/                        # SQLAlchemy ORM (source of truth for schema)
│   │   │   │   ├── clinic.py                  # Clinic — organizational root
│   │   │   │   ├── user.py                    # User — doctor/staff per clinic
│   │   │   │   ├── patient.py                 # Patient — phone E.164 identity key
│   │   │   │   ├── consultation.py            # Consultation + ConsultationMessage
│   │   │   │   ├── artifact.py                # Artifact — notes/audio/images/files
│   │   │   │   ├── appointment.py             # Appointment — calendar/scheduling
│   │   │   │   └── audit_log.py               # AuditLog — immutable action trail
│   │   │   │
│   │   │   ├── schemas/                       # Pydantic I/O models (request/response)
│   │   │   │   ├── patient.py                 # PatientCreate, PatientOut, PatientUpdate
│   │   │   │   ├── consultation.py            # ConsultationCreate/Out/Patch, AskRequest/Response
│   │   │   │   ├── artifact.py                # ArtifactOut, ArtifactPatch, NoteCreate, + AI responses
│   │   │   │   └── appointment.py             # AppointmentCreate, AppointmentOut, AppointmentPatch
│   │   │   │
│   │   │   ├── routes/                        # FastAPI routers — thin HTTP layer only
│   │   │   │   ├── patients.py                # Patient CRUD + artifact sub-routes
│   │   │   │   ├── consultations.py           # Consultation CRUD + /ask + messages
│   │   │   │   ├── artifacts.py               # Artifact GET/PATCH/DELETE + download
│   │   │   │   ├── appointments.py            # Appointment CRUD + /today + /start
│   │   │   │   ├── ai.py                      # STT, structure, OCR, confirm, voice-edit
│   │   │   │   └── health.py                  # GET /health (DB + Redis check)
│   │   │   │
│   │   │   ├── services/                      # Business logic & AI orchestration
│   │   │   │   ├── patient_service.py         # Phone normalization, CRUD, open/touch
│   │   │   │   ├── artifact_service.py        # Upload, note create, audio save, patch, delete
│   │   │   │   ├── consolidation_service.py   # Manifest build + LLM summary + Q&A
│   │   │   │   ├── llm_service.py             # Transcript/prescription structuring, voice correction
│   │   │   │   ├── ocr_service.py             # GPT-4o Vision image text extraction
│   │   │   │   ├── labeling_service.py        # Auto-title generation for all artifact types
│   │   │   │   └── stt_deepgram.py            # Deepgram nova-2 transcription
│   │   │   │
│   │   │   ├── repositories/                  # Data access (all queries here, not in routes)
│   │   │   │   ├── patient_repository.py      # Patient queries, search, recent, open
│   │   │   │   └── artifact_repository.py     # Artifact CRUD, per-patient scoping
│   │   │   │
│   │   │   ├── storage/
│   │   │   │   └── base.py                    # ObjectStorage ABC + S3Storage + get_storage()
│   │   │   │
│   │   │   ├── stt/                           # STT client abstraction
│   │   │   │   ├── base.py                    # STTClient ABC + STTResult dataclass
│   │   │   │   ├── local_client.py            # faster-whisper (CPU inference)
│   │   │   │   └── stub_client.py             # Returns fixed text for testing
│   │   │   │
│   │   │   ├── utils/
│   │   │   │   ├── llm_client.py              # generate_chat_completion() — Gemini→Groq fallback
│   │   │   │   └── json_helper.py             # clean_json() — strips markdown fences from LLM output
│   │   │   │
│   │   │   └── core/
│   │   │       ├── deps.py                    # get_current_user, get_db FastAPI deps
│   │   │       ├── errors.py                  # NotFoundError, ConflictError, ValidationError
│   │   │       ├── audit.py                   # audit_log() helper
│   │   │       └── logging.py                 # structlog configuration
│   │   │
│   │   ├── alembic/versions/                  # Sequential DB migrations
│   │   └── pyproject.toml                     # uv deps, strict mypy, ruff linting
│   │
│   └── web/                                   # React + Vite frontend
│       └── src/
│           ├── pages/
│           │   ├── Home.tsx                   # Patient list, search, create
│           │   ├── Patient.tsx                # Full patient workspace
│           │   └── Dashboard.tsx              # Appointment calendar + today's list
│           │
│           ├── components/
│           │   ├── CreatePatientModal.tsx      # New patient form (name + phone)
│           │   ├── EditPatientModal.tsx        # Edit name/phone
│           │   ├── DeletePatientModal.tsx      # Confirm delete
│           │   ├── PatientRow.tsx              # Row in patient list
│           │   ├── AudioPlayer.tsx             # Web Audio playback
│           │   ├── Heartbeat.tsx               # Polling indicator
│           │   │
│           │   ├── Dashboard/
│           │   │   ├── AppointmentCard.tsx     # Individual appointment with actions
│           │   │   ├── BookAppointmentModal.tsx # Create/edit appointment form
│           │   │   ├── CalendarModal.tsx        # Weekly/monthly calendar grid
│           │   │   └── DayPicker.tsx            # Date navigation widget
│           │   │
│           │   └── PatientWorkspace/
│           │       ├── ConsultationHistory.tsx  # Left panel: list of consultations
│           │       ├── ConsultationScribe.tsx   # Center: summary + chat UI
│           │       ├── SnippetSidebar.tsx        # Right: artifact timeline
│           │       ├── SnippetCard.tsx           # Artifact card in sidebar
│           │       ├── SnippetDetail.tsx         # Full artifact view + JSON editor
│           │       ├── ArtifactCard.tsx          # Compact artifact display
│           │       ├── RecordModal.tsx            # Live audio recording + transcription
│           │       ├── NoteModal.tsx              # Typed note creation
│           │       └── UploadModal.tsx            # File/image upload
│           │
│           ├── hooks/
│           │   └── useRecorder.ts             # Web Audio + MediaRecorder API wrapper
│           │
│           ├── lib/
│           │   ├── api.ts                     # All API calls (axios wrapper + typed functions)
│           │   ├── queryClient.ts             # TanStack Query config + default options
│           │   ├── phone.ts                   # Phone number display formatting
│           │   ├── time.ts                    # Greeting text, time bucket helpers
│           │   ├── avatar.ts                  # Deterministic avatar color from name
│           │   └── utils.ts                   # General helpers (cn, etc.)
│           │
│           └── types/index.ts                 # All TypeScript interfaces (Patient, Artifact, etc.)
│
├── docker-compose.yml                         # PostgreSQL, Redis, MinIO + init job
├── .env.example                               # All env var keys with defaults
└── start.sh                                   # Dev startup: uvicorn + vite in parallel
```

---

## Database Design

### Base Model

Every table except `audit_logs` inherits from `BaseModel` (`apps/api/src/ojas/db/base.py`), which provides:
```
id UUID PK DEFAULT gen_random_uuid()
created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()  -- updated via SQLAlchemy onupdate
```

### `clinics`
Organizational root. Every row in every other table has a `clinic_id` FK.

```sql
id          UUID         PRIMARY KEY
name        VARCHAR(255) NOT NULL
created_at  TIMESTAMPTZ  DEFAULT now()
updated_at  TIMESTAMPTZ
```

### `users`
Doctor/staff accounts. JWT tokens are signed with their `id`.

```sql
id          UUID         PRIMARY KEY
clinic_id   UUID         NOT NULL REFERENCES clinics(id) ON DELETE CASCADE
name        VARCHAR(255) NOT NULL
role        VARCHAR(50)  NOT NULL DEFAULT 'doctor'
created_at  TIMESTAMPTZ  DEFAULT now()
updated_at  TIMESTAMPTZ
```

### `patients`
One row per patient per clinic. Phone number in E.164 format is the identity key (not name, which may have duplicates).

```sql
id               UUID         PRIMARY KEY
clinic_id        UUID         NOT NULL REFERENCES clinics(id) ON DELETE CASCADE
name             VARCHAR(255) NOT NULL
phone_e164       VARCHAR(20)  NOT NULL           -- always +91XXXXXXXXXX or full international
last_accessed_at TIMESTAMPTZ  NOT NULL DEFAULT now()  -- bumped on every patient workspace open
created_at       TIMESTAMPTZ  DEFAULT now()
updated_at       TIMESTAMPTZ

CONSTRAINT uq_patient_clinic_phone UNIQUE (clinic_id, phone_e164)
INDEX (clinic_id, last_accessed_at DESC)          -- powers "recent patients" list
```

**Why phone as identity?** In Indian clinical settings, the same patient may have name spelling variations across visits. Phone number is authoritative and unique per clinic.

### `consultations`
One per visit/session. Stores the full AI output: pre-compiled manifest, generated summary, and suggested questions.

```sql
id                   UUID          PRIMARY KEY
patient_id           UUID          NOT NULL REFERENCES patients(id) ON DELETE CASCADE
clinic_id            UUID          NOT NULL REFERENCES clinics(id) ON DELETE CASCADE
title                VARCHAR(500)  NOT NULL           -- auto-titled "Consultation — 29 May 2026, 09:00 AM"
notes                TEXT                             -- free-form doctor notes
summary_text         TEXT                             -- AI-generated markdown (GPT/Gemini output)
suggested_questions  JSONB                            -- string[]  e.g. ["What meds?", "Follow up?"]
clinical_manifest    JSONB                            -- compiled timeline (reused for /ask without rebuild)
created_at           TIMESTAMPTZ   DEFAULT now()
updated_at           TIMESTAMPTZ

INDEX (patient_id, created_at DESC)
```

### `consultation_messages`
Persistent chat history per consultation. Used to build the message array for multi-turn Q&A.

```sql
id               UUID        PRIMARY KEY
consultation_id  UUID        NOT NULL REFERENCES consultations(id) ON DELETE CASCADE
role             VARCHAR(50) NOT NULL   -- "user" | "assistant"
content          TEXT        NOT NULL
created_at       TIMESTAMPTZ DEFAULT now()
updated_at       TIMESTAMPTZ

INDEX (consultation_id, created_at ASC)  -- fetched in order for history injection
```

### `artifacts`
Core content table. Every note, audio recording, image, and file is one row. Sparse columns — only the relevant fields are populated per type.

```sql
id               UUID          PRIMARY KEY
patient_id       UUID          NOT NULL REFERENCES patients(id) ON DELETE CASCADE
consultation_id  UUID                   REFERENCES consultations(id) ON DELETE SET NULL
parent_id        UUID                   REFERENCES artifacts(id) ON DELETE CASCADE  -- hierarchy
clinic_id        UUID          NOT NULL REFERENCES clinics(id) ON DELETE CASCADE

-- Classification
type    VARCHAR(50)   NOT NULL   -- "note" | "audio" | "image" | "prescription" | "report" | "file"
title   VARCHAR(500)  NOT NULL   -- AI-auto-labeled or user-provided
summary VARCHAR(500)             -- one-line description

-- File storage (null for plain notes)
storage_key  VARCHAR(1000)   -- MinIO object key e.g. "artifacts/{clinic_id}/{uuid}.webm"
mime_type    VARCHAR(200)    -- e.g. "audio/webm", "image/jpeg", "application/pdf"
size_bytes   BIGINT
duration_seconds INT          -- audio only

-- Text content
text_content      TEXT   -- note body; also mirrors transcript for audio
raw_transcript    TEXT   -- raw Deepgram output (audio only, before structuring)
structured_note   JSONB  -- {sections: [{heading, points:[]}], tags:[]} after LLM structuring
tags              JSONB  -- string[] extracted by LLM for categorization

-- Prescription / document fields (populated after OCR pipeline)
prescription_ocr_text  TEXT   -- raw text from GPT Vision
prescription_summary   JSONB  -- {document_type, patient_metadata, medications:[],
                               --  lab_results:[], special_instructions, interpretation_notes,
                               --  reference_tables:[], diagnosis_mentioned}
doctor_confirmed_at    TIMESTAMPTZ   -- set when doctor clicks "Confirm" in UI

-- Flexible overflow
artifact_metadata  JSONB  NOT NULL DEFAULT '{}'

created_at  TIMESTAMPTZ  DEFAULT now()
updated_at  TIMESTAMPTZ

INDEX (patient_id, created_at DESC)
INDEX (consultation_id)
```

**Artifact type decision tree:**
- `note` → `text_content` populated; no storage
- `audio` → `storage_key` + `raw_transcript` + `structured_note`
- `image` → `storage_key` + `prescription_ocr_text` + `prescription_summary`
- `prescription` → same as image, but re-categorized after OCR confirms it's a prescription
- `report` → same as image, re-categorized as lab report
- `file` → `storage_key` only; label from filename

### `appointments`
Calendar-based scheduling. Linked to a `Consultation` once the doctor starts the session.

```sql
id                  UUID         PRIMARY KEY
clinic_id           UUID         NOT NULL REFERENCES clinics(id) ON DELETE CASCADE
patient_id          UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE
consultation_id     UUID                  REFERENCES consultations(id) ON DELETE SET NULL

scheduled_time      TIMESTAMPTZ  NOT NULL
actual_arrival_time TIMESTAMPTZ            -- set when doctor clicks "Start Consultation"
duration_minutes    INT          NOT NULL DEFAULT 15

status  VARCHAR(50)  NOT NULL DEFAULT 'scheduled'
        -- "scheduled" | "in_consultation" | "completed" | "cancelled" | "no_show"
notes   TEXT

created_at  TIMESTAMPTZ  DEFAULT now()
updated_at  TIMESTAMPTZ
```

### `audit_logs`
Append-only compliance trail. Written for every create/edit/delete action.

```sql
id             UUID         PRIMARY KEY
actor_user_id  UUID                      -- null for system actions
action         VARCHAR(100) NOT NULL     -- "patient.create" | "artifact.ai.transcribe" | etc.
resource_type  VARCHAR(100) NOT NULL     -- "patient" | "artifact" | "consultation"
resource_id    UUID
audit_metadata JSONB        NOT NULL DEFAULT '{}'   -- context-specific payload
created_at     TIMESTAMPTZ  DEFAULT now()

INDEX (actor_user_id, created_at DESC)
```

### Migration History

| File | Changes |
|------|---------|
| `0001_initial.py` | Empty baseline |
| `0002_core_tables.py` | clinics, users, patients, artifacts, audit_logs |
| `0003_v02_ai_tables.py` | Early AI experiment tables |
| `0004_strip_ai.py` | Removed experiment tables |
| `0005_ai_columns.py` | raw_transcript, structured_note, tags, prescription_* on artifacts |
| `0006_consultations.py` | consultations table + FK from artifacts |
| `7de6e7320caa...` | parent_id FK on artifacts (hierarchy support) |
| `8fd8901a9607...` | consultation_messages table |
| `985e3c8567e6...` | appointments table |
| `b3ccf3b475bd...` | summary_text, suggested_questions, clinical_manifest on consultations |

---

## Features & Implementation Details

### 1. Patient Management

**Files:** `routes/patients.py` · `services/patient_service.py` · `repositories/patient_repository.py`  
**Frontend:** `pages/Home.tsx` · `CreatePatientModal.tsx` · `EditPatientModal.tsx` · `DeletePatientModal.tsx`

**Create patient** (`POST /patients`):
- `PatientService.normalize_phone()` converts raw input to E.164 (`+91XXXXXXXXXX` for Indian numbers)
- `UNIQUE (clinic_id, phone_e164)` constraint prevents duplicates — returns HTTP 409 on conflict
- Audit log written: `patient.create`

**Search** (`GET /patients?q=`):
- `q` present → `ILIKE` on both `name` and `phone_e164` columns
- `q` absent → ordered by `last_accessed_at DESC` (recent patients list)

**Open patient** (`POST /patients/{id}/open`):
- Bumps `last_accessed_at = now()` in a single UPDATE
- Returns artifact count via subquery
- Called every time a doctor navigates to a patient's workspace

**Update/Delete** (`PATCH /patients/{id}`, `DELETE /patients/{id}`):
- Update re-normalizes phone to E.164
- Delete cascades to all artifacts and consultations (via FK ON DELETE CASCADE)

---

### 2. Appointment Scheduling & Calendar

**Files:** `routes/appointments.py` · `models/appointment.py` · `schemas/appointment.py`  
**Frontend:** `pages/Dashboard.tsx` · `Dashboard/CalendarModal.tsx` · `Dashboard/BookAppointmentModal.tsx` · `Dashboard/AppointmentCard.tsx`

**Endpoints:**
- `POST /appointments` — create; validates patient belongs to clinic
- `GET /appointments/today` — UTC date range query, joined with Patient for name
- `GET /appointments?date=YYYY-MM-DD` — filter by date via `func.date(scheduled_time)`
- `PATCH /appointments/{id}` — partial update; special logic for `status` and `consultation_id`
- `DELETE /appointments/{id}` — deletes appointment; orphans linked artifacts (sets `consultation_id=NULL`) and deletes the linked consultation
- `POST /appointments/{id}/start` — **key endpoint** (details below)

**Start Consultation flow** (`POST /appointments/{id}/start`):
```
1. Load appointment + patient name
2. Create new Consultation row with auto-title ("Consultation — 29 May 2026, 09:00 AM")
3. session.flush() to get consultation.id (before commit)
4. Set appointment.actual_arrival_time = now() (if not already set)
5. Set appointment.status = "in_consultation"
6. Set appointment.consultation_id = consultation.id
7. Commit
8. Return {appointment, consultation_id} — frontend navigates to consultation workspace
```

**Status transitions:**
- `scheduled` → `in_consultation` (via /start)
- `in_consultation` → `completed` (via PATCH; also touches patient.last_accessed_at)
- Any → `cancelled` | `no_show` (via PATCH)

When `consultation_id` is cleared via PATCH (e.g. doctor cancels mid-session), the route orphans all artifacts from that consultation (sets `consultation_id=NULL`) and deletes the consultation row.

---

### 3. Artifact Capture — Three Paths

**Files:** `routes/patients.py` (upload/note/audio sub-routes) · `services/artifact_service.py`  
**Frontend:** `RecordModal.tsx` · `NoteModal.tsx` · `UploadModal.tsx`

All three paths return immediately after saving to DB/MinIO. All AI processing happens in FastAPI `BackgroundTasks`.

#### Path A: Text Note (`POST /patients/{id}/artifacts/note`)
```
1. ArtifactService.create_note() → saves Artifact(type="note", text_content=text)
2. If consultation_id provided → link artifact to consultation
3. BackgroundTask: _label_note_background(artifact_id, text)
   a. label_note(text) → LLM → title (≤60 chars)
   b. structure_transcript(text) → LLM → structured_note + tags
   c. Save title, structured_note, tags to artifact
   d. If consultation attached → consolidate_consultation()
```

#### Path B: Audio Recording (`POST /patients/{id}/artifacts/audio`)
```
1. Read audio bytes from multipart upload
2. ArtifactService.save_audio_artifact() → upload to MinIO → save Artifact(type="audio")
3. If consultation_id provided → link
4. BackgroundTask: _process_audio_background(artifact_id)  [7-step pipeline — see below]
```

#### Path C: File / Image Upload (`POST /patients/{id}/artifacts/upload`)
```
1. ArtifactService.upload_file() → upload to MinIO → save Artifact (type from MIME)
2. If consultation_id provided → link
3. BackgroundTask: _label_file_background(artifact_id, filename, mime_type)
4. If image/* MIME: BackgroundTask: _auto_ocr_background(artifact_id)
```

---

### 4. Audio Processing Pipeline (7-Step Background Task)

**File:** `routes/patients.py:_process_audio_background()` + `services/stt_deepgram.py` + `services/llm_service.py` + `services/labeling_service.py`

The pipeline uses **separate DB sessions per step** — this prevents long-lived transactions from blocking the DB while slow I/O operations (downloads, LLM calls) complete.

```
Step 1: Open session → read storage_key and mime_type → close session
Step 2: Download audio bytes from MinIO (outside session)
Step 3: get_stt_client().transcribe(audio_bytes) → STTResult.text  (Deepgram or whisper)
Step 4: Open session → save raw_transcript + text_content → close session
Step 5: structure_transcript(transcript) → LLM → {sections:[{heading, points}]} + tags[]
Step 6: Open session → save structured_note + tags → close session
Step 7: label_audio(transcript[:500]) → LLM → title (≤60 chars)
Step 8: Open session → save title → if consultation: consolidate_consultation() → close session
```

If any step fails, the exception is caught, `structured_note` is set to `{"error": "processing_failed", "details": "..."}`, and processing stops. The frontend shows this error state.

---

### 5. Image OCR Pipeline (3-Phase Background Task)

**File:** `routes/patients.py:_auto_ocr_background()` + `services/ocr_service.py` + `services/llm_service.py`

Also uses separate sessions per phase to avoid blocking:

```
Phase 1: Open session → read storage_key, mime_type, title → close session

Phase 2: (all outside session)
  a. Download image bytes from MinIO
  b. extract_text_from_image(image_bytes, mime_type)
     → base64-encode → GPT Vision prompt → raw OCR text
  c. structure_prescription(ocr_text)
     → LLM → {document_type, patient_metadata, medications:[], lab_results:[],
               special_instructions, interpretation_notes, reference_tables[], diagnosis_mentioned}
  d. label_file(title, mime_type, ocr_text[:500])
     → LLM → {title, category}  (category re-classifies: "prescription" | "report" | "image" | "file")

Phase 3: Open session → save prescription_ocr_text, prescription_summary, title, type → close session
  → if consultation: consolidate_consultation()
```

If OCR returns empty text, `prescription_ocr_text` is set to `""` (empty string, not null), signaling to the frontend that OCR completed but found no text.

---

### 6. Full Context Injection — Consolidation Pipeline

**File:** `services/consolidation_service.py:consolidate_consultation()`

This is the heart of the AI architecture. Runs after any artifact create/patch/delete event.

**Manifest structure:**
```json
{
  "patient_name": "Priya Sharma",
  "patient_phone": "+919876543210",
  "snippet_count": 3,
  "timeline": [
    {
      "id": "uuid",
      "type": "audio",
      "title": "Morning Dictation — Chest Pain",
      "summary": "{\"sections\": [{\"heading\": \"Chief Complaint\", \"points\": [\"Chest tightness since 2 days\"]}]}"
    },
    {
      "id": "uuid",
      "type": "prescription",
      "title": "Prescription — Dr. Kumar",
      "summary": "{\"medications\": [{\"name\": \"Amoxicillin 500mg\", \"frequency\": \"TID\"}]}"
    }
  ]
}
```

Content priority for each artifact's `summary` field:
1. `structured_note` (null values stripped)
2. `prescription_summary` (null values stripped)
3. `raw_transcript` (truncated to 4000 chars)
4. `text_content` (truncated to 4000 chars)
5. `summary` column

**LLM call:**
- Single call using `generate_chat_completion(..., is_pro=True)` → uses Gemini 2.5 Flash (or GPT-4o if no Gemini key)
- `response_format={"type": "json_object"}` forces valid JSON
- Returns `{"summary": "markdown...", "questions": ["q1", "q2", ...]}`
- Strips markdown code fences if LLM wraps output in ` ```json ` blocks

**System prompt key rules** (from `_CONSOLIDATION_SYSTEM`):
- Cite every fact: `[Snippet Title](snippet://<id>)` — no citation = no inclusion
- Prioritize latest snippet for contradictions
- FORBIDDEN from suggesting questions whose answers aren't explicitly in the manifest
- Includes `⚠️ Possible Data Mismatch` section only if documents belong to a different patient
- Sections: Patient Details, Presenting Complaint, Clinical Findings, Allergies, History, Medications, Plan

**Error handling:**
- `RateLimitError` → saves a specific warning message to `summary_text` rather than crashing
- Any other exception → saves `"### ⚠️ Consolidation Failed"` to `summary_text`

---

### 7. Contextual Q&A (Chat)

**File:** `services/consolidation_service.py:ask_consultation()` · `routes/consultations.py` (POST `/consultations/{id}/ask`)  
**Frontend:** `ConsultationScribe.tsx`

```
1. Fetch consultation_messages ordered by created_at ASC
2. Save user message to consultation_messages (committed before LLM call)
3. Build message array:
   [
     {role: "system", content: _ASK_SYSTEM},        ← strict anti-hallucination rules
     {role: "system", content: f"Manifest:\n{json.dumps(manifest)}"},  ← pre-compiled context
     ...history_messages,                            ← full chat history
     {role: "user", content: question}
   ]
4. generate_chat_completion(..., is_pro=True) → answer string
5. Save assistant message to consultation_messages
6. Return {user_message: {...}, assistant_message: {...}}
```

**System prompt** (`_ASK_SYSTEM`):
```
You are a clinical assistant. Answer the doctor's question using ONLY the provided
consultation manifest. Cite every fact using [Snippet Title](snippet://<id>).
If the answer is not in the manifest, say "This information is not available in the
current consultation." NEVER infer, diagnose, or add information not present.
```

Frontend renders `[Snippet Title](snippet://uuid)` links as clickable elements that scroll to and highlight the artifact in the `SnippetSidebar`.

On `asyncio.CancelledError` (client disconnect), the error is re-raised so FastAPI can clean up properly. Messages saved before the LLM call remain in history.

---

### 8. Editable Structured Data + Auto-Consolidation on Edit

**File:** `routes/artifacts.py:patch_artifact()` + `_trigger_consolidation()`  
**Frontend:** `SnippetDetail.tsx`

When a doctor patches an artifact:
```
PATCH /artifacts/{id}  body: {structured_note: {...}} or {prescription_summary: {...}}
  1. Load original artifact
  2. If type="note" and text_content changed and title not explicitly provided:
     → label_note(new_text) inline (synchronous, not background) to update title immediately
  3. Apply all patches to artifact row
  4. Commit
  5. If artifact.consultation_id is set:
     BackgroundTask: _trigger_consolidation(consultation_id)
       → opens fresh async_session_factory() session
       → calls consolidate_consultation()
       → errors are logged but swallowed (never crash the PATCH response)
```

This means: editing a medication dosage in the JSON editor → PATCH → background consolidation runs → summary_text reflects the corrected value within seconds.

---

### 9. Voice Correction

**File:** `routes/ai.py:voice_edit_artifact()` · `services/llm_service.py:apply_voice_correction()`

Doctor speaks a correction into a microphone instead of typing JSON edits:

```
POST /ai/artifacts/{id}/voice-edit  (multipart: audio file)
  1. Validate: artifact must exist and have structured_note
  2. transcribe_audio_deepgram(audio_bytes) → correction_transcript
  3. apply_voice_correction(current_note, correction_transcript)
     System prompt enforces:
       - ONLY modify fields explicitly mentioned in the correction
       - Return ALL original fields preserved (unchanged ones intact)
       - If unclear correction → return note unchanged
  4. Save updated structured_note
  5. Audit log: "artifact.ai.voice_edit"
  6. Return {structured_note, correction_transcript}
```

**System prompt** (`_VOICE_CORRECTION_SYSTEM`): Strictly prohibits adding or inferring fields not mentioned. A correction of "change amoxicillin to 250mg" will not touch chief_complaint, diagnosis, or any other field.

---

### 10. Auto-Labeling

**File:** `services/labeling_service.py`

Three label functions, all use `generate_chat_completion()` with `max_tokens=100` for speed:

| Function | Input | LLM Prompt Rules | Output |
|----------|-------|-----------------|--------|
| `label_audio(transcript)` | First 500 chars of transcript | "max 60 chars, describe what the consultation is about" | `"Knee Pain Follow-Up"` |
| `label_note(text)` | First 500 chars of note | "max 60 chars, describe what kind of info this note contains" | `"Post-Op Care Instructions"` |
| `label_file(filename, mime, ocr_text)` | Filename + MIME + first 500 chars OCR | "max 60 chars + category from [image/prescription/report/file]" | `("CBC Report — 29 May", "report")` |

Category classification rules (from `_FILE_LABEL_SYSTEM`):
- X-ray, MRI, CT → `"image"`
- Prescription doc → `"prescription"`
- Lab report, blood work → `"report"`
- Unknown → `"file"`

Invalid category from LLM is caught and defaulted to `"file"`.

---

### 11. Doctor Confirmation

**File:** `routes/ai.py:confirm_artifact()`

```
POST /ai/artifacts/{id}/confirm
  1. Load artifact
  2. Set doctor_confirmed_at = datetime.now(UTC)
  3. Audit log: "artifact.ai.confirm"
  4. Return {artifact_id, doctor_confirmed_at}
```

The UI uses `doctor_confirmed_at` to toggle a glow indicator from "pending review" to "confirmed". Once confirmed, the artifact is considered medically reviewed.

---

## LLM Stack & Fallback Chain

**File:** `utils/llm_client.py`

```python
def generate_chat_completion(messages, max_tokens, response_format=None, is_pro=False) -> str:
    primary = get_primary_client()           # Gemini if GEMINI_API_KEY set, else OpenAI
    model = gemini_model_pro if is_pro else gemini_model_flash
    if not gemini_api_key:
        model = openai_model                 # falls back to gpt-4o
    try:
        response = await primary.chat.completions.create(...)
        return response.choices[0].message.content
    except RateLimitError:
        if groq_api_key:
            groq = get_groq_client()         # Groq via OpenAI-compatible endpoint
            kwargs["model"] = groq_model     # llama-3.3-70b-versatile
            response = await groq.chat.completions.create(...)
            return response.choices[0].message.content
        else:
            raise                            # re-raise if no fallback configured
```

**Model usage by operation:**

| Operation | `is_pro` | Model (with Gemini) | Model (OpenAI fallback) |
|-----------|---------|---------------------|------------------------|
| Consolidation summary | `True` | gemini-2.5-flash | gpt-4o |
| Q&A answer | `True` | gemini-2.5-flash | gpt-4o |
| Voice correction | `True` | gemini-2.5-flash | gpt-4o |
| Transcript structuring | `False` | gemini-2.5-flash | gpt-4o |
| Prescription structuring | `False` | gemini-2.5-flash | gpt-4o |
| Audio labeling | `False` | gemini-2.5-flash | gpt-4o |
| Note labeling | `False` | gemini-2.5-flash | gpt-4o |
| File labeling | `False` | gemini-2.5-flash | gpt-4o |

Groq (`llama-3.3-70b-versatile`) activates automatically on any `RateLimitError` from the primary provider.

---

## Background Task Pipelines

FastAPI's `BackgroundTasks` are fire-and-forget: the HTTP response is returned immediately, and the task runs after response delivery.

**Session management pattern:** Each background task opens its own `async_session_factory()` sessions. I/O operations (MinIO downloads, LLM calls) happen outside any session to avoid long-lived transactions.

| Trigger | Background Tasks Queued |
|---------|------------------------|
| Audio upload | `_process_audio_background` (7-step: download → STT → structure → label → consolidate) |
| Image upload | `_label_file_background` + `_auto_ocr_background` (parallel) |
| Note create | `_label_note_background` (label + structure + consolidate) |
| Artifact PATCH | `_trigger_consolidation` (if artifact has consultation_id) |
| Artifact DELETE | `_trigger_consolidation` (if artifact had consultation_id) |

All background tasks swallow errors with `logger.warning(...)` — processing failure never crashes the API response.

---

## API Reference

### Patients

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/patients` | Create patient. Phone normalized to E.164. Returns 409 on duplicate. |
| `GET` | `/patients` | `?q=` → ILIKE search on name+phone. No `q` → recent list by last_accessed_at. |
| `GET` | `/patients/{id}` | Get single patient. |
| `POST` | `/patients/{id}/open` | Bump last_accessed_at, return with artifact_count. |
| `PATCH` | `/patients/{id}` | Update name and/or phone (phone re-normalized). |
| `DELETE` | `/patients/{id}` | Delete patient + all cascaded data. |

### Patient Artifacts (sub-routes)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/patients/{id}/artifacts` | List artifacts. Filter: `?consultation_id=` and/or `?q=` (ILIKE title+content). |
| `POST` | `/patients/{id}/artifacts/note` | Create text note. Body: `{text}`. Query params: `?consultation_id=` `?parent_id=`. |
| `POST` | `/patients/{id}/artifacts/audio` | Multipart: `audio` file + `duration_seconds` form field. Optional: `consultation_id`, `parent_id`. |
| `POST` | `/patients/{id}/artifacts/upload` | Multipart: `file` + optional `consultation_id` form field. |

### Consultations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/patients/{id}/consultations` | Create consultation. Body: `{title?}` — auto-titled if omitted. |
| `GET` | `/patients/{id}/consultations` | List consultations with artifact counts (via subquery join). |
| `GET` | `/consultations/{id}` | Get single consultation with artifact count. |
| `PATCH` | `/consultations/{id}` | Update title and/or notes. |
| `DELETE` | `/consultations/{id}` | Delete. Orphans artifacts (sets consultation_id=NULL). Deletes linked appointment. |
| `GET` | `/consultations/{id}/summary` | Returns `{summary_text, suggested_questions, snippet_count}`. |
| `GET` | `/consultations/{id}/messages` | All chat messages ordered by created_at ASC. |
| `POST` | `/consultations/{id}/ask` | Body: `{question}`. Saves both messages, returns `{user_message, assistant_message}`. |
| `DELETE` | `/consultations/{id}/messages/{msg_id}` | Delete a specific message from chat history. |

### Artifacts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/artifacts/{id}` | Get artifact by ID. |
| `PATCH` | `/artifacts/{id}` | Partial update. Patchable fields: `title`, `text_content`, `structured_note`, `prescription_summary`, `summary`. Triggers background consolidation. |
| `DELETE` | `/artifacts/{id}` | Delete row + MinIO object. Triggers background consolidation. |
| `GET` | `/artifacts/{id}/download` | Returns `{url}` — presigned MinIO URL for direct file download. |

### Appointments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/appointments` | Create appointment. Body: `{patient_id, scheduled_time, duration_minutes?, notes?}`. |
| `GET` | `/appointments/today` | Today's appointments (UTC day range), joined with patient name. |
| `GET` | `/appointments?date=YYYY-MM-DD` | Appointments for a specific date. |
| `PATCH` | `/appointments/{id}` | Partial update. Setting status=completed touches patient.last_accessed_at. |
| `DELETE` | `/appointments/{id}` | Delete + orphan artifacts + delete linked consultation. |
| `POST` | `/appointments/{id}/start` | Creates consultation, sets actual_arrival_time, status → in_consultation. Returns `{appointment, consultation_id}`. |

### AI Services

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ai/transcribe-bytes` | Multipart: `audio` file. Transcribes without saving to DB. Returns `{transcript}`. Used for live partial transcription. |
| `POST` | `/ai/artifacts/{id}/transcribe` | Downloads audio from MinIO → Deepgram → saves raw_transcript. Kicks off background structuring. Returns immediately with `{raw_transcript}`. |
| `POST` | `/ai/artifacts/{id}/structure` | (Re-)runs GPT structuring on saved raw_transcript. Returns `{structured_note, tags}`. |
| `POST` | `/ai/artifacts/{id}/ocr` | Downloads image → GPT Vision OCR → structures prescription. Returns `{prescription_ocr_text, prescription_summary}`. |
| `POST` | `/ai/artifacts/{id}/confirm` | Sets doctor_confirmed_at = now(). Returns `{doctor_confirmed_at}`. |
| `POST` | `/ai/artifacts/{id}/voice-edit` | Multipart: `audio` correction. Transcribes → patches structured_note. Returns `{structured_note, correction_transcript}`. |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Tests DB connectivity (SELECT 1) and Redis ping. Returns 200 or 503. |

---

## Data Flow Walkthroughs

### Walkthrough 1: Recording a Consultation

```
Doctor opens Patient workspace → clicks consultation → clicks Record

useRecorder.ts: MediaRecorder API starts recording WebM/Opus audio
  ↓ (every ~3 seconds on pause/resume)
POST /ai/transcribe-bytes  (partial audio blob)
  Backend: Deepgram nova-2 → returns transcript text
  Frontend: Shows live transcript preview below microphone UI

Doctor stops recording (2 minutes of audio)
  ↓
POST /patients/{id}/artifacts/audio
  Body: multipart (audio blob, duration_seconds=120, consultation_id)
  Backend:
    1. Read audio bytes
    2. artifact_service.save_audio_artifact() → upload to MinIO → Artifact row created
    3. Link consultation_id
    4. Return ArtifactOut immediately (type="audio", title="Consultation Recording")
    5. Queue _process_audio_background(artifact.id)
  Frontend: Closes RecordModal, shows artifact card with spinner

Background (_process_audio_background):
  Step 1: Open session → read storage_key → close
  Step 2: MinIO download → audio_bytes
  Step 3: Deepgram nova-2 → raw transcript text
  Step 4: Open session → save raw_transcript + text_content → close
  Step 5: structure_transcript(transcript) → Gemini → {sections:[{heading, points:[]}], tags:[]}
  Step 6: Open session → save structured_note + tags → close
  Step 7: label_audio(transcript[:500]) → Gemini → "Knee Pain Follow-Up"
  Step 8: Open session → save title → consolidate_consultation() → close

consolidate_consultation():
  → Fetch all artifacts for consultation
  → Build manifest JSON (patient name, phone, timeline)
  → Gemini with _CONSOLIDATION_SYSTEM prompt
  → Parse JSON → save summary_text + suggested_questions + clinical_manifest
  → Commit

Frontend: polls GET /artifacts/{id} every 2s
  → When structured_note populated: renders structured sections in SnippetCard
Frontend: polls GET /consultations/{id}/summary every few seconds
  → When summary_text populated: renders markdown in ConsultationScribe
```

### Walkthrough 2: Uploading a Prescription Image

```
Doctor uploads photo of handwritten prescription

POST /patients/{id}/artifacts/upload
  Body: multipart (image file, consultation_id)
  Backend:
    1. Upload to MinIO → storage_key
    2. Artifact row: type="image", title="Uploaded Image"
    3. Link consultation_id
    4. Return ArtifactOut immediately
    5. Queue _label_file_background() + _auto_ocr_background() in parallel

_label_file_background(artifact_id, filename, mime_type):
  → label_file(filename, "image/jpeg", ocr_text=None)
  → Gemini → {title: "Medical Document", category: "image"}
  → Save title + type to artifact

_auto_ocr_background(artifact_id):
  Phase 1: Read storage_key from DB
  Phase 2 (outside session):
    a. MinIO download → image_bytes
    b. extract_text_from_image(image_bytes, "image/jpeg")
       → base64 encode → GPT Vision → raw OCR text with tables, handwriting, etc.
    c. structure_prescription(ocr_text)
       → Gemini → {document_type: "prescription", patient_metadata: {name, age, ...},
                   medications: [{name, dose, frequency, duration}],
                   lab_results: [], special_instructions: "...", ...}
    d. label_file(title, mime, ocr_text[:500])
       → Gemini → {title: "Prescription — Dr. Kumar", category: "prescription"}
  Phase 3: Open session → save prescription_ocr_text, prescription_summary, title, type
    → consolidate_consultation()

Frontend: polls until prescription_summary populated
  → SnippetDetail.tsx renders medications table
  → Doctor notices "Amoxicillin 500g" — should be "500mg"
  → Clicks into JSON editor, edits the value

PATCH /artifacts/{id}  body: {prescription_summary: {...corrected...}}
  Backend: saves corrected JSON → BackgroundTask: _trigger_consolidation()

_trigger_consolidation():
  → consolidate_consultation() runs again
  → Summary now reflects correct 500mg dosage with citation
```

### Walkthrough 3: Contextual Q&A

```
Doctor reads the AI summary, wants to know a specific detail

ConsultationScribe.tsx: doctor types "What was the blood pressure reading?"
  ↓
POST /consultations/{id}/ask  body: {question: "What was the blood pressure reading?"}
  Backend:
    1. Load consultation_messages ordered by created_at ASC
    2. Save user message: {role: "user", content: "What was the blood pressure reading?"}
    3. Build messages array:
       - {role: "system", content: _ASK_SYSTEM}  ← anti-hallucination rules
       - {role: "system", content: "Manifest:\n{...clinical_manifest...}"}
       - [...previous chat messages...]
       - {role: "user", content: "What was the blood pressure reading?"}
    4. generate_chat_completion() → Gemini
    5. Response: "The blood pressure was **130/80 mmHg**, recorded in [Morning Dictation](snippet://abc-123)."
    6. Save assistant message
    7. Return {user_message: {...}, assistant_message: {...}}

Frontend: renders markdown
  → "**130/80 mmHg**" rendered bold
  → "[Morning Dictation](snippet://abc-123)" rendered as clickable link
  → Click → SnippetSidebar scrolls to and highlights artifact "Morning Dictation"
```

---

## Quick Start

### Prerequisites
- Docker Desktop (or Colima on macOS)
- Python 3.11+ with `uv` (`pip install uv`)
- Node.js 18+ with `pnpm` (`npm i -g pnpm`)

### 1. Clone & Configure
```bash
git clone https://github.com/your-org/ojas.git && cd ojas
cp .env.example .env
# Edit .env:
# GEMINI_API_KEY=your-key        (recommended)
# DEEPGRAM_API_KEY=your-key      (for cloud STT)
# or OPENAI_API_KEY=your-key     (if no Gemini)
```

### 2. Start Infrastructure
```bash
docker compose up -d
# Starts: PostgreSQL 16, Redis 7, MinIO (creates ojas-artifacts bucket automatically)
```

### 3. Backend Setup
```bash
cd apps/api
uv sync
uv run alembic upgrade head
# DB is now fully migrated
```

### 4. Frontend Setup
```bash
cd apps/web
pnpm install
```

### 5. Run Everything
```bash
./start.sh
# Starts uvicorn on :8000 and Vite on :5173 concurrently
```

Open **http://localhost:5173**

### MinIO Console
Open **http://localhost:9001** — login `minioadmin` / `minioadmin` to browse uploaded files.

---

## Configuration Reference

All settings are loaded via Pydantic `BaseSettings` from `.env` (`apps/api/src/ojas/config.py`).

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `dev` | `dev` \| `staging` \| `prod` |
| `LOG_LEVEL` | `DEBUG` | structlog level |
| `DATABASE_URL` | `postgresql+asyncpg://ojas:ojas_dev@localhost:5432/ojas` | Async PostgreSQL URL |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection |
| `S3_ENDPOINT_URL` | `http://localhost:9000` | MinIO or S3 endpoint |
| `S3_ACCESS_KEY` | `minioadmin` | MinIO/S3 access key |
| `S3_SECRET_KEY` | `minioadmin` | MinIO/S3 secret key |
| `S3_BUCKET` | `ojas-artifacts` | Bucket name (auto-created by docker-compose) |
| `GEMINI_API_KEY` | _(empty)_ | Google Gemini key. If set, Gemini is primary LLM. |
| `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/` | Gemini OpenAI-compat endpoint |
| `GEMINI_MODEL_FLASH` | `gemini-2.5-flash` | Model for labeling + structuring |
| `GEMINI_MODEL_PRO` | `gemini-2.5-flash` | Model for consolidation + Q&A |
| `OPENAI_API_KEY` | _(empty)_ | Used as primary if no Gemini key. Also used for Vision OCR. |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model |
| `GROQ_API_KEY` | _(empty)_ | Groq key. Enables automatic rate-limit fallback. |
| `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` | Groq endpoint |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq text model |
| `STT_PROVIDER` | `local` | `deepgram` (cloud) or `local` (faster-whisper CPU) |
| `DEEPGRAM_API_KEY` | _(empty)_ | Required if `STT_PROVIDER=deepgram` |
| `STT_MODEL_SIZE` | `small` | faster-whisper: `tiny` \| `small` \| `medium` \| `large` |
| `STT_COMPUTE_TYPE` | `int8` | faster-whisper quantization |
| `STT_DEVICE` | `cpu` | `cpu` or `cuda` |
| `STT_CPU_THREADS` | `4` | Threads for CPU inference |
| `STT_LANGUAGE` | `en` | Default transcription language |
| `STT_INITIAL_PROMPT` | Clinical terminology hint | Biases Whisper toward medical vocabulary |
| `JWT_SECRET` | `change-me-in-production` | **Change this in prod** |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `JWT_EXPIRE_MINUTES` | `1440` | 24-hour token expiry |

---

## Security Model

### Per-Clinic Scoping
Every table row has `clinic_id`. Every route uses `get_current_user` (JWT dependency) which resolves the user and their `clinic_id`. All queries include `WHERE clinic_id = user.clinic_id`. Cross-clinic data access is prevented at the query layer.

### Per-Patient Scoping
All artifact queries include `WHERE patient_id = <patient_id>`. The patient_id comes from the URL path, which is validated against the clinic. Cross-patient data leakage within a clinic is structurally prevented.

### Audit Trail
Every mutating action writes to `audit_logs`:

| Action | Trigger |
|--------|---------|
| `patient.create` | Patient created |
| `artifact.ai.transcribe` | Audio transcribed |
| `artifact.ai.structure` | Transcript structured |
| `artifact.ai.ocr` | Image OCR run |
| `artifact.ai.confirm` | Doctor confirmed artifact |
| `artifact.ai.voice_edit` | Voice correction applied |
| `consultation.create` | Consultation created |
| `consultation.edit` | Consultation patched |
| `consultation.delete` | Consultation deleted |

### JWT Authentication
- `get_current_user` dependency injected into every route except `/health`
- Tokens: HS256, 24-hour expiry
- Passwords: bcrypt hashed (for user creation, when implemented)

### Production Checklist
- [ ] Set `JWT_SECRET` to a cryptographically random 32+ byte string
- [ ] Replace MinIO with AWS S3 or Cloudflare R2 (`S3_ENDPOINT_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`)
- [ ] Use managed PostgreSQL (RDS, Supabase, Neon)
- [ ] Set `ENVIRONMENT=prod` (disables debug logging)
- [ ] Configure `GEMINI_API_KEY` + `GROQ_API_KEY` for production LLM stack
- [ ] Set `DEEPGRAM_API_KEY` for cloud STT (or configure local GPU Whisper)

---

## License

MIT
