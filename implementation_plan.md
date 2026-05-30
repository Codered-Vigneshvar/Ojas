# Integrate Anne's AI Features into the Start-Files Codebase

Anne's backend has 4 AI-powered features that the current `start-files` codebase lacks. The current code only stores raw artifacts (files, audio, notes) without any intelligence. This plan adds AI capabilities on top of the existing artifact system.

## Summary of What Anne Has (that we don't)

| Feature | Anne's Approach | Our Current Approach |
|---|---|---|
| **Speech-to-Text** | Deepgram API → raw transcript | Audio saved to MinIO as a blob — no transcription |
| **Transcript Structuring** | GPT-4o → structured JSON (chief complaint, diagnosis, medications, etc.) | N/A |
| **Prescription OCR** | GPT-4o Vision reads prescription images → structured JSON (medications, doses) | Images saved as artifacts — no OCR |
| **Auth (JWT login)** | Full JWT auth with bcrypt password hashing | Stub auth (always returns "Dr Sreekanth") |

## Open Questions

> [!IMPORTANT]
> **Auth question**: Anne has full JWT login (`/auth/login` with username/password). The current codebase uses a stub auth (auto-login as Dr Sreekanth). Should I:
> - Keep the stub auth for now and only add the AI features? **(Recommended — simpler, AI features are the priority)**
> - Also integrate the full JWT login system from Anne?

> [!IMPORTANT]  
> **Data model question**: Anne uses a `ConsultationSession` model (with `raw_transcript`, `structured_note`, `tags`, `prescription_summary` etc.) which is a completely different concept from our `Artifact` model. Should I:
> - **Add the AI fields directly to our Artifact model** — when audio is transcribed, the transcript and structured note are stored on the artifact itself. This keeps the existing architecture intact. **(Recommended)**
> - Port Anne's `ConsultationSession` model into our codebase as a parallel concept alongside Artifacts.

---

## Proposed Changes

### Backend — New AI Service Modules

#### [NEW] [stt_deepgram.py](file:///Users/vigneshvars/Documents/OjasAI/apps/api/src/ojas/services/stt_deepgram.py)
Deepgram speech-to-text service. Sends audio bytes to `https://api.deepgram.com/v1/listen` using the `nova-2` model with auto language detection. Returns plain transcript text. Adapted from [anne's stt.py](file:///Users/vigneshvars/Documents/OjasAI/anne/backend/services/stt.py).

#### [NEW] [llm_service.py](file:///Users/vigneshvars/Documents/OjasAI/apps/api/src/ojas/services/llm_service.py)
OpenAI GPT-4o service for:
1. **Transcript structuring** — takes raw transcript → returns structured JSON with `chief_complaint`, `diagnosis`, `treatment_plan`, `medications_prescribed`, `follow_up_instructions`, `tags`.
2. **Prescription structuring** — takes OCR text → returns structured JSON with `medications[]`, `diagnosis_mentioned`, `special_instructions`.

Adapted from [anne's llm.py](file:///Users/vigneshvars/Documents/OjasAI/anne/backend/services/llm.py).

#### [NEW] [ocr_service.py](file:///Users/vigneshvars/Documents/OjasAI/apps/api/src/ojas/services/ocr_service.py)
GPT-4o Vision OCR service. Takes prescription image bytes → extracts raw text. Adapted from [anne's ocr.py](file:///Users/vigneshvars/Documents/OjasAI/anne/backend/services/ocr.py).

---

### Backend — Config Changes

#### [MODIFY] [config.py](file:///Users/vigneshvars/Documents/OjasAI/apps/api/src/ojas/config.py)
Add new environment variables:
- `openai_api_key: str`
- `openai_model: str` (default: `gpt-4o`)
- `deepgram_api_key: str`
- `uploads_dir: str` (default: `./uploads`)

---

### Backend — Database Changes

#### [MODIFY] [artifact.py](file:///Users/vigneshvars/Documents/OjasAI/apps/api/src/ojas/models/artifact.py) (model)
Add AI result columns to the existing Artifact model:
- `raw_transcript: Text` — Deepgram transcription output
- `structured_note: JSONB` — GPT-4o structured clinical note
- `tags: JSONB` — AI-generated topic tags
- `prescription_ocr_text: Text` — raw OCR text from prescription
- `prescription_summary: JSONB` — GPT-4o structured prescription data

#### [NEW] Alembic migration `0005_ai_columns.py`
Migration to add the new AI columns to the `artifacts` table.

---

### Backend — New API Routes

#### [NEW] [ai.py](file:///Users/vigneshvars/Documents/OjasAI/apps/api/src/ojas/routes/ai.py)
Three new API endpoints:

1. **`POST /artifacts/{artifact_id}/transcribe`**  
   - Takes an audio artifact ID → downloads audio from MinIO → sends to Deepgram → saves transcript → kicks off background GPT-4o structuring → returns transcript immediately.

2. **`POST /artifacts/{artifact_id}/structure`**  
   - Takes an artifact with a saved transcript → sends to GPT-4o → saves structured note + tags.

3. **`POST /artifacts/{artifact_id}/ocr-prescription`**  
   - Takes an image/report artifact ID → downloads from MinIO → sends to GPT-4o Vision for OCR → structures with GPT-4o → saves results.

#### [MODIFY] [artifacts.py](file:///Users/vigneshvars/Documents/OjasAI/apps/api/src/ojas/routes/artifacts.py)
Register the new AI router in the existing artifacts module.

#### [MODIFY] [main.py](file:///Users/vigneshvars/Documents/OjasAI/apps/api/src/ojas/main.py)
Include the new AI router and create uploads directory on startup.

---

### Backend — Schema Changes

#### [MODIFY] [artifact.py](file:///Users/vigneshvars/Documents/OjasAI/apps/api/src/ojas/schemas/artifact.py) (schema)
Add AI fields to `ArtifactOut`:
- `raw_transcript`, `structured_note`, `tags`, `prescription_ocr_text`, `prescription_summary`

---

### Backend — Dependencies

#### [MODIFY] [pyproject.toml](file:///Users/vigneshvars/Documents/OjasAI/apps/api/pyproject.toml)
Add `openai>=1.0.0` to dependencies (httpx is already present for Deepgram calls).

---

### Backend — Environment

#### [MODIFY] [.env](file:///Users/vigneshvars/Documents/OjasAI/apps/api/.env)
Add your API keys:
```
OPENAI_API_KEY=sk-proj-2zO9ZmFi...
OPENAI_MODEL=gpt-4o
DEEPGRAM_API_KEY=732d7b96563f60652e5718b4055be5c1bd556eb0
UPLOADS_DIR=./uploads
```

---

### Frontend — API Client

#### [MODIFY] [api.ts](file:///Users/vigneshvars/Documents/OjasAI/apps/web/src/lib/api.ts)
Add 3 new API functions:
- `transcribeArtifact(artifactId)` — triggers transcription
- `structureArtifact(artifactId)` — triggers AI structuring
- `ocrPrescription(artifactId)` — triggers prescription OCR

---

### Frontend — Type Changes

#### [MODIFY] [index.ts](file:///Users/vigneshvars/Documents/OjasAI/apps/web/src/types/index.ts)
Add AI-related fields to the `Artifact` type and add `StructuredNote` and `PrescriptionSummary` interfaces.

---

### Frontend — UI Changes

#### [MODIFY] [ArtifactDetailModal.tsx](file:///Users/vigneshvars/Documents/OjasAI/apps/web/src/components/PatientWorkspace/ArtifactDetailModal.tsx)
When viewing an audio artifact:
- Show a **"Transcribe"** button that calls the transcription API
- Display the raw transcript when available
- Show a **"Structure with AI"** button that calls the structuring API  
- Display the structured clinical note (chief complaint, diagnosis, etc.)

When viewing an image/report artifact:
- Show a **"Read Prescription"** button that calls the OCR API
- Display the prescription summary (medications, doses, instructions)

#### [MODIFY] [RecordModal.tsx](file:///Users/vigneshvars/Documents/OjasAI/apps/web/src/components/PatientWorkspace/RecordModal.tsx)
After saving an audio recording, optionally auto-trigger transcription.

#### [MODIFY] [Patient.tsx](file:///Users/vigneshvars/Documents/OjasAI/apps/web/src/pages/Patient.tsx)
Replace the "AI Extension Point" placeholder with actual AI status indicators.

---

### Cleanup

#### [DELETE] `anne/` folder
Remove the entire `anne/` directory after all features are integrated and verified working.

---

## Verification Plan

### Automated Tests
1. Start the backend: `cd apps/api && uv run uvicorn ojas.main:app --port 8000`
2. Hit `/health` to verify the server starts
3. Verify the new migration runs: `uv run alembic upgrade head`
4. Start the frontend: `cd apps/web && pnpm dev`

### Manual Verification
1. Open `http://localhost:5173`
2. Open a patient workspace
3. Record audio → Save → Click "Transcribe" → Verify Deepgram transcript appears
4. Click "Structure" → Verify GPT-4o structured note appears
5. Upload a prescription image → Click "Read Prescription" → Verify OCR + structured output
6. Verify existing features (upload, note, delete) still work
