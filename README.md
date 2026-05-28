# Ojas — AI Clinical Documentation Demo

**Ojas** (Sanskrit: ओजस् — "vitality") is an AI-powered clinical documentation tool for doctors. Speak during a consultation, and Ojas transcribes, structures, and summarises the session automatically.

---

## What it does

- **Voice recording** → Deepgram transcribes speech to text (supports Indian languages)
- **AI structuring** → GPT-4o turns the transcript into a structured clinical note (chief complaint, diagnosis, treatment plan, medications, follow-up)
- **Prescription OCR** → Upload a photo of a prescription; GPT-4o reads and structures it
- **Doctor's notes** → Freeform text notes saved separately from the transcript
- **Patient records** → Create and search patients, full session history per patient
- **Auth** → Login with credentials stored in the database (JWT-based)

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.11+ | `python3.11 --version` |
| Node.js | 18+ | `node --version` |
| PostgreSQL | 14+ | Must be running locally |
| npm | Any recent | Comes with Node |

**API Keys needed** (all free tiers available):
- **OpenAI** — for transcript structuring + prescription OCR → [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Deepgram** — for speech-to-text → [console.deepgram.com](https://console.deepgram.com) (free tier: 200h/month)

---

## Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd Ojas
```

### 2. Create the PostgreSQL database

```bash
psql postgres -c "CREATE USER ojas WITH PASSWORD 'ojas_dev';"
psql postgres -c "CREATE DATABASE ojas_demo OWNER ojas;"
psql ojas_demo -c "GRANT ALL ON SCHEMA public TO ojas;"
```

### 3. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in:

```env
DATABASE_URL=postgresql+asyncpg://ojas:ojas_dev@localhost:5432/ojas_demo
DEEPGRAM_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
SECRET_KEY=any-long-random-string
UPLOADS_DIR=./uploads
OPENAI_MODEL=gpt-4o
```

### 4. Run

**Mac / Linux:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```
Double-click start.bat
```

The script will:
- Create a Python virtual environment
- Install all backend and frontend dependencies
- Create database tables
- Create the login user
- Start both servers

Then open **http://localhost:5173**

---

## Login

```
Username: chaithanya
Password: ojas123
```

---

## How to use

1. **Login** with the credentials above
2. **Create a patient** — tap "New Session" → search or add a patient
3. **Record a consultation** — tap the mic button, speak, tap Stop
   - Transcription runs automatically (takes ~5–10 seconds)
   - While it processes, you can switch to the Notes or Rx Upload tab
4. **Save & Close** — the AI structures the note in the background
5. **Open the session later** — you'll see:
   - **Structured Note** — chief complaint, diagnosis, treatment plan etc.
   - **Doctor's Notes** — anything you typed manually (separate from transcript)
   - **Prescription** — if you uploaded one
   - **Raw Transcript** — collapsed by default, tap to expand

---

## Project structure

```
Ojas/
├── backend/               # FastAPI Python backend (port 8001)
│   ├── main.py            # App entry point
│   ├── models.py          # SQLAlchemy models (patients, sessions, users)
│   ├── config.py          # Settings from .env
│   ├── database.py        # Async DB engine
│   ├── init_db.py         # Creates tables
│   ├── seed_users.py      # Creates the login user
│   ├── routes/
│   │   ├── auth.py        # POST /auth/login
│   │   ├── patients.py    # GET/POST /patients
│   │   ├── sessions.py    # CRUD /session/*
│   │   ├── transcribe.py  # POST /transcribe/full
│   │   └── structure.py   # POST /structure/transcript, /structure/prescription
│   └── services/
│       ├── auth.py        # JWT + bcrypt
│       ├── stt.py         # Deepgram speech-to-text
│       ├── ocr.py         # GPT-4o Vision prescription OCR
│       └── llm.py         # GPT-4o transcript + prescription structuring
│
├── frontend/              # React + Vite frontend (port 5173)
│   └── src/
│       ├── app/
│       │   ├── App.tsx
│       │   └── components/
│       │       ├── LoginScreen.tsx
│       │       ├── HomeScreen.tsx
│       │       ├── PatientSearchScreen.tsx
│       │       ├── ActiveSessionScreen.tsx  # Record / Notes / Rx tabs
│       │       ├── PatientDetailScreen.tsx
│       │       └── SessionDetailScreen.tsx  # View structured session
│       └── lib/
│           ├── api.ts     # All API calls
│           └── types.ts   # TypeScript types
│
├── start.sh               # Mac/Linux one-command startup
├── start.bat              # Windows one-command startup
└── backend/.env.example   # Environment template
```

---

## API overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Login → returns JWT |
| `GET` | `/patients` | List patients (scoped to your clinic) |
| `POST` | `/patients` | Create patient |
| `POST` | `/session/create` | Start a new session |
| `GET` | `/session/:id` | Get session details |
| `PATCH` | `/session/:id` | Update session fields |
| `GET` | `/patient/:id/sessions` | List sessions for a patient |
| `POST` | `/transcribe/full` | Upload audio → transcribe → structure in background |
| `POST` | `/structure/transcript` | Manually trigger AI structuring |
| `POST` | `/structure/prescription` | Upload prescription image → OCR + structure |
| `GET` | `/health` | Health check |

All endpoints except `/auth/login` and `/health` require `Authorization: Bearer <token>`.

---

## Troubleshooting

**`relation "patients" does not exist`**
→ Run `python init_db.py` from the `backend/` folder with the venv active.

**`permission denied for schema public`** (PostgreSQL 15+)
```bash
psql ojas_demo -c "GRANT ALL ON SCHEMA public TO ojas;"
```

**`400 Bad Request` from Deepgram**
→ Check `DEEPGRAM_API_KEY` in `backend/.env`. Make sure it's the actual key, not the placeholder.

**Transcription returns empty**
→ Make sure your browser allowed microphone access. Check the backend logs for errors.

**`doctor_notes` column missing** (if you set up the DB before this column was added)
```bash
psql ojas_demo -c "ALTER TABLE consultation_sessions ADD COLUMN IF NOT EXISTS doctor_notes TEXT;"
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 · FastAPI · SQLAlchemy 2.0 · asyncpg |
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS |
| Database | PostgreSQL (local) |
| Auth | JWT (python-jose) · bcrypt |
| Speech-to-Text | Deepgram nova-2 |
| AI / OCR | OpenAI GPT-4o |
