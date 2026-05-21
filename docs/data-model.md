# Ojas — Data Model

All tables have `id UUID PK`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`. Migrations live in `apps/api/alembic/versions/`.

---

## `clinics`

Multi-tenant root. Every entity belongs to a clinic.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | TEXT | Clinic display name |

---

## `users`

Doctors and staff. Belong to a clinic.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| clinic_id | UUID FK → clinics | |
| name | TEXT | |
| role | TEXT | `doctor` \| `nurse` \| `admin` |

---

## `patients`

Core entity. Phone number is unique per clinic.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| clinic_id | UUID FK → clinics | |
| name | TEXT | |
| phone_e164 | TEXT | E.164 format |
| last_accessed_at | TIMESTAMPTZ | Updated on patient open |

---

## `artifacts`

Raw uploads — documents, notes, audio recordings.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| patient_id | UUID FK → patients | INDEX(patient_id, created_at) |
| clinic_id | UUID FK → clinics | |
| type | TEXT | `report` \| `image` \| `file` \| `note` \| `audio` |
| title | TEXT | Filename or first line of note |
| summary | TEXT NULL | Human-readable summary (e.g. "PDF · 1.2 MB") |
| storage_key | TEXT NULL | S3/MinIO object key (NULL for notes) |
| mime_type | TEXT NULL | |
| size_bytes | BIGINT NULL | |
| text_content | TEXT NULL | Note text or transcript |
| duration_seconds | INT NULL | Audio duration |
| metadata | JSONB | Extensible key-value store |

---

## `audit_logs`

Immutable append-only log. Every patient data access is recorded.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| actor_id | UUID | User who triggered the action |
| action | TEXT | e.g. `artifact.create`, `artifact.delete`, `patient.open` |
| resource_type | TEXT | e.g. `patient`, `artifact` |
| resource_id | UUID | |
| metadata | JSONB | Non-PHI metadata about the action |
| created_at | TIMESTAMPTZ | No `updated_at` — audit rows are never updated |

---

## 🔌 Tables to Add for AI Extension

When you add AI capabilities, consider adding these tables:

### `embeddings` (for RAG/vector search)

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| artifact_id | UUID FK → artifacts | Source traceability |
| patient_id | UUID FK → patients | **Always filter here first** |
| chunk_index | INT | Position in document |
| chunk_text | TEXT | The raw text that was embedded |
| vector | vector(1024) | pgvector column — HNSW index |

### `artifact_facts` (for structured extraction)

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| artifact_id | UUID FK → artifacts | |
| patient_id | UUID FK → patients | |
| kind | TEXT | `medication` \| `diagnosis` \| `lab_result` \| etc. |
| name | TEXT | Fact label |
| value | TEXT NULL | Extracted value |
| unit | TEXT NULL | |
| recorded_at | DATE NULL | |

### AI columns on `artifacts`

| Column | Type | Notes |
|---|---|---|
| label | TEXT NULL | AI-generated label |
| category | TEXT NULL | AI-classified category |
| summary_ai | TEXT NULL | AI-generated summary |
| structured_note | TEXT NULL | AI-structured clinical note |
| processing_status | TEXT | `pending` \| `processing` \| `done` \| `failed` |
