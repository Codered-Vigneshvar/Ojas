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

The core architectural decision is **Full Context Injection** instead of RAG. When a consultation has 5 artifacts, all 5 are compiled into a single JSON manifest and injected into the LLM's context window. The LLM sees everything — raw transcripts, OCR text, and AI-structured JSON — and can resolve contradictions, track medication changes across recordings, and generate a cited summary without retrieval errors.

---

## Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Backend** | FastAPI · Python 3.11 | Async, typed, `uv`-managed |
| **ORM** | SQLAlchemy 2.0 (async) + Alembic | `AsyncSession`, typed `Mapped[]` columns |
| **Frontend** | React 18 · TypeScript · Vite | `strict` TypeScript, path aliases |
| **Styling** | TailwindCSS | No component library, dark mode via CSS variables |
| **Server State** | TanStack React Query | Cache, polling, mutations |
| **Database** | Supabase Postgres (direct connection port 5432) | Hosted PostgreSQL, no local DB needed |
| **Auth** | Supabase Auth (JWKS/ES256 JWT) | Google OAuth + email/password; auto-provisions Clinic + User on first login |
| **Object Storage** | Supabase Storage (S3-compatible) | boto3 against Supabase S3 endpoint |
| **Cache** | Redis 7 | Session data, future task queues |
| **Primary LLM** | Google Gemini 2.5 Flash / Pro | Via OpenAI-compatible API |
| **LLM Fallback** | Groq Llama-3.3-70b | Automatic on rate limit |
| **Legacy LLM** | OpenAI GPT-4o | Used if no Gemini key set; also used for Vision OCR |
| **STT** | Deepgram nova-2 | Cloud, ~300ms; fallback: faster-whisper |
| **Logging** | structlog | Structured JSON, per-request context |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Frontend (React + Vite :5173)               │
│                                                              │
│  pages/Login.tsx             pages/Dashboard.tsx             │
│  pages/ResetPassword.tsx     └── AppointmentCalendar         │
│                                  BookAppointmentModal         │
│  pages/Home.tsx (patient list + search)                      │
│                                                              │
│  pages/Patient.tsx                                           │
│  ├── ConsultationHistory (left: list + right: synopsis panel)│
│  ├── ConsultationScribe  (center: summary + chat)            │
│  └── SnippetSidebar      (right: artifact timeline)          │
│      ├── RecordModal  (live audio dictation)                 │
│      ├── NoteModal    (text note)                            │
│      ├── UploadModal  (file/image)                           │
│      └── SnippetDetail (view/edit JSON)                      │
│                                                              │
│  components/AvatarMenu.tsx   (initials, dropdown, dark mode) │
│  components/ProfileModal.tsx (name, clinic, password reset)  │
└──────────────────────────────┬───────────────────────────────┘
                               │ REST / JSON  +  Bearer JWT
┌──────────────────────────────┴───────────────────────────────┐
│                  Backend (FastAPI :8000)                     │
│                                                              │
│  routes/            services/              repositories/     │
│  ├── users.py       ├── patient_service    ├── patient_repo  │
│  ├── patients.py    ├── artifact_service   └── artifact_repo │
│  ├── appointments   ├── consolidation_svc                    │
│  ├── consultations  ├── llm_service                          │
│  ├── artifacts.py   ├── ocr_service                          │
│  ├── ai.py          ├── labeling_service                     │
│  └── health.py      └── stt_deepgram                         │
│                                                              │
│  core/auth.py  ← JWKS verification of Supabase JWT          │
│  core/deps.py  ← get_current_user (auto-provision on login)  │
│  utils/llm_client.py  ← Gemini → Groq fallback chain        │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────┴───────────────────────────────┐
│                      Supabase Cloud                          │
│                                                              │
│  Auth (JWKS/ES256)    Postgres :5432    Storage (S3 API)     │
│                                                              │
│  Redis 7 :6379  (local or managed)                           │
└──────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
Ojas/
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
│   │   │   │   └── appointment.py             # Appointment — calendar/scheduling
│   │   │   │
│   │   │   ├── schemas/                       # Pydantic I/O models (request/response)
│   │   │   │   ├── patient.py
│   │   │   │   ├── consultation.py            # ConsultationOut includes synopsis
│   │   │   │   ├── artifact.py
│   │   │   │   └── appointment.py
│   │   │   │
│   │   │   ├── routes/                        # FastAPI routers — thin HTTP layer only
│   │   │   │   ├── users.py                   # GET/PATCH /users/me
│   │   │   │   ├── patients.py                # Patient CRUD + artifact sub-routes
│   │   │   │   ├── consultations.py           # Consultation CRUD + /ask + messages
│   │   │   │   ├── artifacts.py               # Artifact GET/PATCH/DELETE + download
│   │   │   │   ├── appointments.py            # Appointment CRUD + /today + /start
│   │   │   │   ├── ai.py                      # STT, structure, OCR, confirm, voice-edit
│   │   │   │   └── health.py                  # GET /health (DB + Redis check)
│   │   │   │
│   │   │   ├── services/                      # Business logic & AI orchestration
│   │   │   │   ├── patient_service.py
│   │   │   │   ├── artifact_service.py
│   │   │   │   ├── consolidation_service.py   # Manifest build + LLM summary + synopsis + Q&A
│   │   │   │   ├── llm_service.py
│   │   │   │   ├── ocr_service.py
│   │   │   │   ├── labeling_service.py
│   │   │   │   └── stt_deepgram.py
│   │   │   │
│   │   │   ├── repositories/
│   │   │   │   ├── patient_repository.py
│   │   │   │   └── artifact_repository.py
│   │   │   │
│   │   │   ├── storage/
│   │   │   │   └── base.py                    # ObjectStorage ABC + S3Storage (Supabase Storage)
│   │   │   │
│   │   │   ├── core/
│   │   │   │   ├── auth.py                    # JWKS client + verify_supabase_token()
│   │   │   │   ├── deps.py                    # get_current_user (auto-provisions Clinic+User)
│   │   │   │   ├── errors.py
│   │   │   │   └── logging.py
│   │   │   │
│   │   │   └── utils/
│   │   │       ├── llm_client.py              # generate_chat_completion() — Gemini→Groq fallback
│   │   │       └── json_helper.py
│   │   │
│   │   ├── alembic/versions/                  # Sequential DB migrations
│   │   ├── scripts/
│   │   │   └── backfill_synopsis.py           # One-time: generate synopsis for existing consultations
│   │   └── pyproject.toml
│   │
│   └── web/                                   # React + Vite frontend
│       └── src/
│           ├── pages/
│           │   ├── Login.tsx                  # Email/password + Google OAuth + signup
│           │   ├── ResetPassword.tsx          # Set new password from email reset link
│           │   ├── Home.tsx                   # Patient list, search, create
│           │   ├── Patient.tsx                # Full patient workspace
│           │   └── Dashboard.tsx              # Appointment calendar + today's list
│           │
│           ├── components/
│           │   ├── AvatarMenu.tsx             # Doctor initials, dropdown, dark/light toggle
│           │   ├── ProfileModal.tsx           # Edit name/clinic, send password reset link
│           │   ├── CreatePatientModal.tsx
│           │   ├── EditPatientModal.tsx
│           │   ├── DeletePatientModal.tsx
│           │   ├── PatientRow.tsx
│           │   ├── AudioPlayer.tsx
│           │   │
│           │   ├── Dashboard/
│           │   │   ├── AppointmentCard.tsx
│           │   │   ├── BookAppointmentModal.tsx
│           │   │   ├── CalendarModal.tsx
│           │   │   └── DayPicker.tsx
│           │   │
│           │   └── PatientWorkspace/
│           │       ├── ConsultationHistory.tsx  # Left: consultation list + Right: synopsis timeline
│           │       ├── ConsultationScribe.tsx
│           │       ├── SnippetSidebar.tsx
│           │       ├── SnippetDetail.tsx
│           │       ├── RecordModal.tsx
│           │       ├── NoteModal.tsx
│           │       └── UploadModal.tsx
│           │
│           ├── lib/
│           │   ├── api.ts                     # All API calls (axios + Bearer JWT injection)
│           │   ├── auth.tsx                   # AuthProvider, useAuth, passwordRecovery state
│           │   ├── supabase.ts                # Supabase client
│           │   ├── theme.tsx                  # ThemeProvider, useTheme, dark/light/system
│           │   ├── queryClient.ts
│           │   ├── phone.ts
│           │   ├── time.ts
│           │   └── utils.ts
│           │
│           └── types/index.ts                 # All TypeScript interfaces
│
├── .env.example                               # Root-level index of all required keys
└── start.sh                                   # Dev startup script
```

---

## Database Design

### Base Model

Every table inherits from `BaseModel` which provides:
```
id UUID PK DEFAULT gen_random_uuid()
created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
```

### `clinics`
Organizational root. Every row in every other table has a `clinic_id` FK. Auto-created on first login.

```sql
id    UUID         PRIMARY KEY
name  VARCHAR(255) NOT NULL
```

### `users`
Doctor/staff accounts. Keyed by Supabase `auth.users.id`. Auto-created on first authenticated API call.

```sql
id           UUID         PRIMARY KEY   -- matches Supabase auth.users.id
clinic_id    UUID         NOT NULL REFERENCES clinics(id) ON DELETE CASCADE
name         VARCHAR(255) NOT NULL
role         VARCHAR(50)  NOT NULL DEFAULT 'doctor'
```

### `patients`
Phone number in E.164 format is the identity key.

```sql
id               UUID         PRIMARY KEY
clinic_id        UUID         NOT NULL REFERENCES clinics(id) ON DELETE CASCADE
name             VARCHAR(255) NOT NULL
phone_e164       VARCHAR(20)  NOT NULL
last_accessed_at TIMESTAMPTZ  NOT NULL DEFAULT now()

UNIQUE (clinic_id, phone_e164)
```

### `consultations`
One per visit. Stores full AI output: manifest, summary, synopsis, and suggested questions.

```sql
id                   UUID          PRIMARY KEY
patient_id           UUID          NOT NULL REFERENCES patients(id) ON DELETE CASCADE
clinic_id            UUID          NOT NULL REFERENCES clinics(id) ON DELETE CASCADE
title                VARCHAR(500)  NOT NULL
notes                TEXT
summary_text         TEXT          -- full AI-generated markdown (re-generated on each consolidation)
synopsis             TEXT          -- 2-sentence plain text: why patient came + what doctor did
                                   -- regenerated on consolidation (i.e. when content changes)
suggested_questions  JSONB         -- string[]
clinical_manifest    JSONB         -- compiled full-context artifact timeline

INDEX (patient_id, created_at DESC)
```

### `consultation_messages`
Persistent multi-turn chat history per consultation.

```sql
id               UUID        PRIMARY KEY
consultation_id  UUID        NOT NULL REFERENCES consultations(id) ON DELETE CASCADE
role             VARCHAR(50) NOT NULL   -- "user" | "assistant"
content          TEXT        NOT NULL

INDEX (consultation_id, created_at ASC)
```

### `artifacts`
Core content table. Every note, audio recording, image, and file is one row.

```sql
id               UUID          PRIMARY KEY
patient_id       UUID          NOT NULL REFERENCES patients(id) ON DELETE CASCADE
consultation_id  UUID                   REFERENCES consultations(id) ON DELETE SET NULL
parent_id        UUID                   REFERENCES artifacts(id) ON DELETE CASCADE
clinic_id        UUID          NOT NULL REFERENCES clinics(id) ON DELETE CASCADE

type    VARCHAR(50)   NOT NULL   -- "note" | "audio" | "image" | "prescription" | "report" | "file"
title   VARCHAR(500)  NOT NULL
summary VARCHAR(500)

-- File storage (null for plain notes)
storage_key      VARCHAR(1000)   -- Supabase Storage object key
mime_type        VARCHAR(200)
size_bytes       BIGINT
duration_seconds INT

-- Text content
text_content      TEXT   -- note body
raw_transcript    TEXT   -- verbatim Deepgram output (audio only)
structured_note   JSONB  -- {sections:[{heading, points:[]}], tags:[]}
tags              JSONB  -- string[]

-- Prescription / document fields
prescription_ocr_text  TEXT   -- raw GPT Vision OCR output
prescription_summary   JSONB  -- {document_type, patient_metadata, medications[], lab_results[],
                               --  special_instructions, interpretation_notes, diagnosis_mentioned}
doctor_confirmed_at    TIMESTAMPTZ

artifact_metadata  JSONB  NOT NULL DEFAULT '{}'
```

### `appointments`

```sql
id                  UUID         PRIMARY KEY
clinic_id           UUID         NOT NULL REFERENCES clinics(id) ON DELETE CASCADE
patient_id          UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE
consultation_id     UUID                  REFERENCES consultations(id) ON DELETE SET NULL
scheduled_time      TIMESTAMPTZ  NOT NULL
actual_arrival_time TIMESTAMPTZ
duration_minutes    INT          NOT NULL DEFAULT 15
status              VARCHAR(50)  NOT NULL DEFAULT 'scheduled'
notes               TEXT
```

### Migration History

| File | Changes |
|------|---------|
| `0001_initial.py` | Empty baseline |
| `0002_core_tables.py` | clinics, users, patients, artifacts |
| `0003_v02_ai_tables.py` | Early AI experiment tables |
| `0004_strip_ai.py` | Removed experiment tables |
| `0005_ai_columns.py` | raw_transcript, structured_note, tags, prescription_* on artifacts |
| `0006_consultations.py` | consultations table + FK from artifacts |
| `7de6e7320caa` | parent_id FK on artifacts |
| `8fd8901a9607` | consultation_messages table |
| `985e3c8567e6` | appointments table |
| `b3ccf3b475bd` | summary_text, suggested_questions, clinical_manifest on consultations |
| `c1a2b3d4e5f6` | synopsis column on consultations |

---

## Features & Implementation Details

### 1. Authentication & User Management

**Files:** `core/auth.py` · `core/deps.py` · `routes/users.py`
**Frontend:** `pages/Login.tsx` · `pages/ResetPassword.tsx` · `lib/auth.tsx` · `components/AvatarMenu.tsx` · `components/ProfileModal.tsx`

**Auth flow:**
- Supabase Auth handles signup (email/password or Google OAuth), login, and JWT issuance
- All JWTs are ES256-signed; backend verifies via JWKS: `GET {SUPABASE_URL}/auth/v1/.well-known/jwks.json`
- `get_current_user` dependency extracts `sub` from JWT → looks up or auto-creates `clinics` + `users` row on first call
- Frontend injects `Authorization: Bearer <token>` on every API request via axios interceptor

**Password reset flow:**
- Doctor clicks "Send reset link" in Profile modal → `supabase.auth.resetPasswordForEmail()` → email sent
- User clicks email link → Supabase fires `PASSWORD_RECOVERY` auth event
- `AuthProvider` intercepts this event, sets `passwordRecovery: true`
- Both `ProtectedRoutes` and `LoginRoute` check this flag and render `<ResetPassword />` instead of dashboard
- After setting new password: `supabase.auth.signOut()` → redirect to `/login`

**Profile editing** (`GET/PATCH /users/me`):
- Returns `{name, clinic_name}` for the authenticated doctor
- PATCH updates `users.name` and/or `clinics.name`
- Frontend reflects changes in `AvatarMenu` (initials, dropdown header)

**Dark mode:**
- `ThemeProvider` toggles `.dark` class on `<html>`, persists to localStorage
- Respects `prefers-color-scheme` on first load
- Light / System / Dark toggle in `AvatarMenu` dropdown

---

### 2. Patient Management

**Search** (`GET /patients?q=`): `ILIKE` on name + phone_e164. No `q` → recent by `last_accessed_at DESC`.

**Open patient** (`POST /patients/{id}/open`): Bumps `last_accessed_at = now()`.

---

### 3. Consultation History + Synopsis Panel

**Files:** `components/PatientWorkspace/ConsultationHistory.tsx`

The consultation history page has two panels:
- **Left:** list of all consultations with actions (start, finish, edit title, delete)
- **Right:** scrollable patient history timeline — one entry per consultation that has a `synopsis`, ordered by session date (created_at), newest at top. Each entry is clickable to open that consultation directly.

**Synopsis generation** (in `consolidation_service.py`):
- Generated as part of every consolidation run (triggered when content changes)
- 2 plain-text sentences: why the patient came + what the doctor did/recommended
- Separate from `summary_text` (which is the full markdown summary)

**Backfill for existing data:**
```bash
cd apps/api
PYTHONPATH=src uv run python scripts/backfill_synopsis.py
```

---

### 4. Full Context Injection — Consolidation Pipeline

**File:** `services/consolidation_service.py`

Runs after any artifact create/patch/delete. Builds a manifest with **all available raw content** per artifact — no truncation, no information loss:

```json
{
  "patient_name": "Priya Sharma",
  "patient_phone": "+919876543210",
  "snippet_count": 3,
  "timeline": [
    {
      "id": "uuid",
      "type": "audio",
      "title": "Morning Dictation",
      "content": {
        "transcript": "...full verbatim transcript, no character limit...",
        "structured": {"sections": [{"heading": "Chief Complaint", "points": ["Chest tightness"]}]}
      }
    },
    {
      "id": "uuid",
      "type": "prescription",
      "title": "Prescription — Dr. Kumar",
      "content": {
        "prescription_structured": {"medications": [{"name": "Amoxicillin 500mg"}]},
        "prescription_ocr_raw": "...full raw OCR text from GPT Vision..."
      }
    }
  ]
}
```

Each artifact's `content` object includes every available field:
- `transcript` — full verbatim audio transcript (no truncation)
- `structured` — AI-extracted structured note JSON
- `prescription_structured` — AI-extracted prescription JSON
- `prescription_ocr_raw` — raw OCR text alongside structured output
- `text` — typed note content

The LLM is instructed to search ALL content fields before concluding information is absent.

**Single LLM call returns:**
```json
{
  "summary": "### 👤 Patient Details\n...(full markdown)...",
  "synopsis": "Patient presented with chest pain for 3 days. ECG ordered and nitrates prescribed.",
  "questions": ["What medications were prescribed?", "When is the follow-up?"]
}
```

---

### 5. Contextual Q&A (Chat)

**File:** `services/consolidation_service.py:ask_consultation()`

```
POST /consultations/{id}/ask  body: {question}
  1. Load pre-compiled clinical_manifest from DB (no rebuild needed)
  2. Save user message to consultation_messages
  3. Build messages:
     - system: anti-hallucination rules + "search ALL content fields"
     - system: full manifest JSON
     - history: all prior messages
     - user: current question
  4. generate_chat_completion() → answer with snippet citations
  5. Save assistant message
  6. Return {user_message, assistant_message}
```

Frontend renders `[Snippet Title](snippet://uuid)` links as clickable elements that scroll to the artifact in the sidebar.

---

### 6. Audio Processing Pipeline

```
POST /patients/{id}/artifacts/audio
  → Upload to Supabase Storage → save Artifact row → return immediately
  → BackgroundTask: _process_audio_background()

Step 1: Read storage_key from DB
Step 2: Download audio from Supabase Storage
Step 3: Deepgram nova-2 → raw transcript
Step 4: Save raw_transcript + text_content
Step 5: structure_transcript() → Gemini → structured_note + tags
Step 6: Save structured_note + tags
Step 7: label_audio() → Gemini → title
Step 8: Save title → consolidate_consultation()
```

---

### 7. Image OCR Pipeline

```
POST /patients/{id}/artifacts/upload  (image file)
  → Upload to Supabase Storage → save Artifact → return immediately
  → BackgroundTasks: _label_file_background() + _auto_ocr_background()

_auto_ocr_background():
  Phase 1: Read storage_key
  Phase 2: Download → GPT Vision OCR → structure_prescription() → label_file()
  Phase 3: Save prescription_ocr_text, prescription_summary, title, type
         → consolidate_consultation()
```

---

### 8. Editable Structured Data

Doctor edits medication dosage in the JSON editor:
```
PATCH /artifacts/{id}  body: {prescription_summary: {...corrected...}}
  → Save to DB
  → BackgroundTask: consolidate_consultation()
  → summary_text and synopsis reflect corrected value within seconds
```

---

## LLM Stack & Fallback Chain

**File:** `utils/llm_client.py`

```
Primary: Gemini (if GEMINI_API_KEY set) → else OpenAI GPT-4o
On RateLimitError: → Groq Llama-3.3-70b (if GROQ_API_KEY set) → else re-raise
```

| Operation | Model |
|-----------|-------|
| Consolidation summary + synopsis | Gemini Pro / GPT-4o |
| Q&A answer | Gemini Pro / GPT-4o |
| Voice correction | Gemini Pro / GPT-4o |
| Transcript structuring | Gemini Flash / GPT-4o |
| Prescription structuring | Gemini Flash / GPT-4o |
| Image OCR extraction | GPT-4o Vision (always) |
| Auto-labeling | Gemini Flash / GPT-4o |

---

## Background Task Pipelines

| Trigger | Tasks Queued |
|---------|-------------|
| Audio upload | `_process_audio_background` (download → STT → structure → label → consolidate) |
| Image upload | `_label_file_background` + `_auto_ocr_background` (parallel) |
| Note create | `_label_note_background` (label + structure + consolidate) |
| Artifact PATCH | `_trigger_consolidation` |
| Artifact DELETE | `_trigger_consolidation` |

All tasks use separate `async_session_factory()` sessions per step. Errors are logged and swallowed — never crash the HTTP response.

---

## API Reference

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users/me` | Returns `{id, name, clinic_name, email}` for authenticated doctor |
| `PATCH` | `/users/me` | Update `name` and/or `clinic_name` |

### Patients
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/patients` | Create patient. Phone normalized to E.164. 409 on duplicate. |
| `GET` | `/patients` | `?q=` → search. No `q` → recent by last_accessed_at. |
| `GET` | `/patients/{id}` | Get patient. |
| `POST` | `/patients/{id}/open` | Bump last_accessed_at. |
| `PATCH` | `/patients/{id}` | Update name/phone. |
| `DELETE` | `/patients/{id}` | Delete + cascade. |

### Patient Artifacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/patients/{id}/artifacts` | List. Filter: `?consultation_id=` `?q=`. |
| `POST` | `/patients/{id}/artifacts/note` | Create note. |
| `POST` | `/patients/{id}/artifacts/audio` | Multipart audio upload. |
| `POST` | `/patients/{id}/artifacts/upload` | Multipart file/image upload. |

### Consultations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/patients/{id}/consultations` | Create. Auto-titled if no title provided. |
| `GET` | `/patients/{id}/consultations` | List with artifact counts + synopsis. |
| `GET` | `/consultations/{id}` | Get single. |
| `PATCH` | `/consultations/{id}` | Update title/notes. |
| `DELETE` | `/consultations/{id}` | Delete + orphan artifacts + delete linked appointment. |
| `GET` | `/consultations/{id}/summary` | Returns `{summary_text, suggested_questions, snippet_count}`. |
| `GET` | `/consultations/{id}/messages` | Chat history ordered by created_at ASC. |
| `POST` | `/consultations/{id}/ask` | Body: `{question}`. Returns `{user_message, assistant_message}`. |
| `DELETE` | `/consultations/{id}/messages/{msg_id}` | Delete a chat message. |

### Artifacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/artifacts/{id}` | Get artifact. |
| `PATCH` | `/artifacts/{id}` | Update `title`, `text_content`, `structured_note`, `prescription_summary`, `raw_transcript`. Triggers reconsolidation. |
| `DELETE` | `/artifacts/{id}` | Delete row + Supabase Storage object. Triggers reconsolidation. |
| `GET` | `/artifacts/{id}/download` | Returns presigned URL for file download. |

### Appointments
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/appointments` | Create. |
| `GET` | `/appointments/today` | Today's appointments with patient names. |
| `GET` | `/appointments?date=YYYY-MM-DD` | By date. |
| `PATCH` | `/appointments/{id}` | Partial update. |
| `DELETE` | `/appointments/{id}` | Delete + orphan artifacts + delete consultation. |
| `POST` | `/appointments/{id}/start` | Creates consultation, sets status → in_consultation. Returns `{consultation_id}`. |

### AI Services
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ai/transcribe-bytes` | Multipart audio → `{transcript}`. No DB save. For live preview. |
| `POST` | `/ai/artifacts/{id}/transcribe` | Download from storage → Deepgram → save raw_transcript. |
| `POST` | `/ai/artifacts/{id}/structure` | Re-run LLM structuring on saved transcript. |
| `POST` | `/ai/artifacts/{id}/ocr` | Download image → GPT Vision → save prescription_summary. |
| `POST` | `/ai/artifacts/{id}/confirm` | Set doctor_confirmed_at = now(). |
| `POST` | `/ai/artifacts/{id}/voice-edit` | Multipart audio correction → patch structured_note. |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | DB + Redis connectivity check. 200 or 503. |

---

## Data Flow Walkthroughs

### Walkthrough 1: Recording a Consultation

```
Doctor clicks Record → useRecorder.ts starts MediaRecorder (WebM/Opus)
  ↓ every ~3s
POST /ai/transcribe-bytes → Deepgram → live transcript preview in UI

Doctor stops recording
  ↓
POST /patients/{id}/artifacts/audio
  → Upload to Supabase Storage → Artifact row created → return immediately
  → BackgroundTask: Deepgram → structure → label → consolidate
  → Frontend polls every 2s until structured_note populated
  → ConsultationScribe shows typewriter-animated summary when ready
```

### Walkthrough 2: Uploading a Prescription

```
POST /patients/{id}/artifacts/upload (image)
  → Supabase Storage → Artifact(type="image") → return
  → BackgroundTasks (parallel):
     _label_file_background: label_file() → "Medical Document"
     _auto_ocr_background:
       GPT Vision → OCR text
       structure_prescription() → {medications, lab_results, ...}
       label_file(ocr_text) → "Prescription — Dr. Kumar", category="prescription"
       Save all → consolidate_consultation()

Doctor spots error in medications JSON → edits in UI
PATCH /artifacts/{id} {prescription_summary: {...corrected...}}
  → Save → background consolidate → summary updated with corrected dosage
```

### Walkthrough 3: Contextual Q&A

```
Doctor asks: "What was the blood pressure reading?"
  ↓
POST /consultations/{id}/ask
  Backend:
    - Load pre-compiled clinical_manifest (no rebuild)
    - Inject full manifest + chat history into Gemini
    - Gemini searches all content fields (transcript, OCR, structured JSON)
    - Returns: "BP was **130/80 mmHg** per [Morning Dictation](snippet://abc-123)"
  Frontend: renders [Morning Dictation] as link → click → scrolls to artifact
```

---

## Quick Start

### Prerequisites
- Python 3.11+ with `uv` (`pip install uv`)
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- Redis (local or managed)

### 1. Clone & Configure

```bash
git clone https://github.com/your-org/ojas.git && cd ojas
```

Copy and fill in the env files:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

**`apps/api/.env`** — fill in:
- `DATABASE_URL` — Supabase direct connection string (Settings → Database → Connection string → URI, port 5432)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — from Settings → API
- `S3_ENDPOINT_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` — from Settings → Storage → S3 Access
- `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`

**`apps/web/.env`** — fill in:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### 2. Run the DB Migration

In **Supabase Dashboard → SQL Editor**, run:
```sql
-- Run once to add synopsis column if migrating from an older version
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS synopsis TEXT;
```

Then run Alembic to apply all migrations:
```bash
cd apps/api
PYTHONPATH=src uv run alembic upgrade head
```

### 3. Backend

```bash
cd apps/api
uv sync
PYTHONPATH=src uv run uvicorn ojas.main:app --reload --port 8000
```

### 4. Frontend

```bash
cd apps/web
npm install
npm run dev
```

Open **http://localhost:5173** — sign up with email or Google.

### 5. Backfill Synopsis (existing data only)

If you have existing consultations without a synopsis:
```bash
cd apps/api
PYTHONPATH=src uv run python scripts/backfill_synopsis.py
```

---

## Configuration Reference

All settings loaded via Pydantic `BaseSettings` from `apps/api/.env`.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase direct Postgres: `postgresql+asyncpg://postgres:<pw>@db.<ref>.supabase.co:5432/postgres` |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | Public anon key (safe to expose in frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret service role key — never expose |
| `S3_ENDPOINT_URL` | `https://<ref>.storage.supabase.co/storage/v1/s3` |
| `S3_ACCESS_KEY` | Supabase Storage S3 access key |
| `S3_SECRET_KEY` | Supabase Storage S3 secret key |
| `S3_BUCKET` | `ojas-artifacts` |
| `S3_REGION` | e.g. `ap-southeast-2` (match your Supabase project region) |
| `REDIS_URL` | `redis://localhost:6379/0` |
| `ENVIRONMENT` | `dev` \| `staging` \| `prod` |
| `LOG_LEVEL` | `DEBUG` \| `INFO` |
| `GEMINI_API_KEY` | Primary LLM. If set, Gemini is used for all text tasks. |
| `GEMINI_MODEL_FLASH` | e.g. `gemini-2.0-flash` — labeling + structuring |
| `GEMINI_MODEL_PRO` | e.g. `gemini-2.5-pro-preview-06-05` — consolidation + Q&A |
| `OPENAI_API_KEY` | Fallback primary LLM; always used for Vision OCR |
| `OPENAI_MODEL` | `gpt-4o` |
| `GROQ_API_KEY` | Enables automatic rate-limit fallback |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| `DEEPGRAM_API_KEY` | Cloud speech-to-text (recommended) |
| `STT_PROVIDER` | `deepgram` \| `local` (faster-whisper CPU) |

---

## Security Model

### Auth
- All JWTs are issued by Supabase Auth and verified via JWKS (ES256/RS256)
- `get_current_user` FastAPI dependency verifies the token on every request and resolves `clinic_id`
- Google OAuth and email/password both supported
- Password reset uses Supabase's email link flow; `PASSWORD_RECOVERY` event is intercepted on the frontend to force password reset before dashboard access

### Per-Clinic Scoping
Every table row has `clinic_id`. All queries include `WHERE clinic_id = user.clinic_id`. Cross-clinic data access is prevented at the query layer.

### Per-Patient Scoping
All artifact queries include `WHERE patient_id = <patient_id>` validated against the clinic.

### Production Checklist
- [ ] Supabase project on a paid plan for production workloads
- [ ] Enable Supabase RLS (Row Level Security) for defense in depth
- [ ] Set `ENVIRONMENT=prod`
- [ ] Configure `GEMINI_API_KEY` + `GROQ_API_KEY` for LLM redundancy
- [ ] Use managed Redis (Upstash or similar) instead of local
- [ ] Enable Supabase PITR (Point-in-Time Recovery) for DB backups

---

## License

MIT
