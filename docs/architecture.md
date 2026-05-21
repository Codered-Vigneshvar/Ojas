# Ojas — Architecture Overview

## What it is

Ojas is a clinical patient workspace starter kit. A doctor opens a patient profile, uploads documents (PDFs, images, audio recordings, prescriptions), writes notes, and records consultations. The system stores, organizes, and retrieves patient information.

This starter kit provides the **data layer and UI** — it's designed for developers to add AI capabilities on top.

## Layers

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  Routes  (apps/api/src/ojas/routes/)                │
│  · Thin: parse input, call service, return response │
│  · No business logic, no SQL                        │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  Services  (apps/api/src/ojas/services/)            │
│  · Business logic, orchestration                    │
│  · Audit log on every patient data access           │
│  · Uses STTClient, ObjectStorage via DI             │
│  · 🔌 Add LLMClient, EmbeddingClient here          │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  Repositories  (apps/api/src/ojas/repositories/)    │
│  · All SQL lives here                               │
│  · Per-patient scoping in WHERE clause              │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  Models  (apps/api/src/ojas/models/)                │
│  · SQLAlchemy ORM, async                            │
│  · Alembic migrations — one concern per migration   │
└─────────────────────────────────────────────────────┘
```

## Data Flow (current)

```
Doctor uploads file / writes note / records audio
    │
    ▼
POST /artifacts/*  →  S3/MinIO (raw bytes for files/audio)
    │
    ▼
Artifact row created in PostgreSQL
    │
    ▼
Available immediately in timeline UI
```

## AI Extension Flow (when you add it)

```
Doctor uploads file
    │
    ▼
POST /artifacts  →  S3/MinIO (raw bytes)
    │
    ▼
🔌 Arq job enqueued → Redis queue
    │
    ▼  (worker)
🔌 Extract text  (PDF, image OCR, audio STT)
    │
    ▼
🔌 LLM extraction  (medications, diagnoses, vitals → structured rows)
    │
    ▼
🔌 Embed chunks  (vector embeddings → pgvector rows)
    │
    ▼
Artifact status updated → "indexed"
```

## Per-patient scoping rule

Every repository method accepts `patient_id: UUID` and includes it in the SQL `WHERE` clause. The scoping is enforced at the database query level. This makes accidental cross-patient leakage structurally impossible.

## Interfaces

All external dependencies are behind abstract interfaces:
- `stt.base.STTClient` — wraps faster-whisper, swappable
- `storage.base.ObjectStorage` — wraps MinIO/S3, S3-compatible

**Extension interfaces to add:**
- `llm.base.LLMClient` — wraps local/cloud LLMs
- `embeddings.base.EmbeddingClient` — wraps embedding models

Service code only imports these interfaces, never concrete implementations directly.
