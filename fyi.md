# 📖 Ojas FYI: The Big Picture & Concept Guide

## The Big Picture (The Story)
Think of this application like a smart clinic clinic-management desk:

* **The Frontend** is the desk layout and buttons the doctor interacts with (the visual screen).
* **The Backend** is the office manager sitting behind the desk. When a button is clicked, the manager processes the request, checks security, and performs the tasks.
* **The Database** is the highly organized filing cabinet in the back office where the manager keeps all permanent records.

---

### 1. The Frontend (`frontend/`)
**Located in:** [frontend/src/](file:///Users/vigneshvars/Documents/OjasAI/frontend/src)

This folder contains all the code that runs directly inside the doctor's web browser. It is built using React (a framework for building interfaces) and TypeScript (a safe version of JavaScript).

*   **`pages/`**: The Whole Screens. Each file here represents a complete view in the app. For example, `Home.tsx` is the screen showing the list of patients, and `Patient.tsx` is the patient profile screen showing their timeline, uploaded files, and notes.
*   **`components/`**: Reusable Visual Widgets. Instead of rewriting visual elements multiple times, they are broken down into small, reusable widgets. For example, a specialized `AudioPlayer.tsx` widget is used to play recorded consultations, and modal pop-ups are defined here.
*   **`api_client/`**: The Delivery Boy. This code acts as the messenger. When a doctor clicks "Save Note", the API client package packages the note data and sends it over the internet to the backend server.
*   **`device_hooks/`**: Hardware Hooks. Special code that lets the web browser talk to native computer hardware, such as the microphone (so the doctor can record audio directly from the web page).
*   **`types/`**: The Dictionaries. Files defining what database objects should look like in code. For example, a type definition ensures that any variable representing a "Patient" always has a name, ID, and phone number, preventing spelling errors in the code.
*   **`styles/`**: The Paint & Theme. Contains all the style sheets and styling configurations (Tailwind CSS) that define the app's colors, fonts, margins, and dark mode theme.

---

### 2. The Backend (`backend/`)
**Located in:** [backend/src/ojas/](file:///Users/vigneshvars/Documents/OjasAI/backend/src/ojas)

This is the Python web server (built with FastAPI). It receives instructions from the frontend, verifies who is requesting them, processes files, and writes records.

*   **`main.py`**: The Main Gate. When the backend server starts up, this script runs first. It opens the doors, initializes connections to the database, and begins listening for network requests.
*   **`config.py`**: The App Manager. Reads external configurations (like database passwords, S3 storage keys, or port numbers) from your hidden `.env` file and makes them available to the code.
*   **`endpoints/`**: The Customer Service Desks (API Routes). This contains folders and files that correspond to URLs the frontend can talk to.
    *   `/patients` desk: Handles requests to add, edit, or list patients.
    *   `/artifacts` desk: Handles uploads of notes, files, and audio.
    *   `/health` desk: Periodically checks if the database and storage are working fine.
*   **`business_logic/`**: The Brain. This is where the actual rules of the app live. For example, when a note is uploaded, the business logic orchestrates the action: it double-checks that the doctor is authorized to view this patient, writes a security log, and then directs the database to save it.
*   **`file_storage/`**: The Warehouse Manager. Contains the code that connects the backend to MinIO/S3 to upload and retrieve large files like PDFs and raw recorded audio recordings.
*   **`security_and_auth/`**: The Bouncer. Handles cryptography. It validates passwords, generates secret authentication tokens (JWT tokens) when a doctor logs in, and ensures that Doctor A cannot see Doctor B's patient files.
*   **`schemas/`**: The Inspectors. Before the server processes any request, schemas check the incoming data format. If the frontend tries to save a patient record but forgets to supply a phone number, the schema immediately rejects the request with a clear error message.

---

### 3. The Database Subsystem (`backend/src/ojas/database/`)
**Located in:** [database/](file:///Users/vigneshvars/Documents/OjasAI/backend/src/ojas/database)

This folder handles all communications with the PostgreSQL database.

*   **`blueprints/` (Models)**: The Cabinet Layouts. Defines what tables exist in PostgreSQL (e.g. patients, users, artifacts) and what columns each table contains.
*   **`queries/` (Repositories)**: The File Clerks. Contains custom SQL search scripts. Instead of writing raw SQL database queries everywhere, we use these functions (e.g., `get_patient_by_id()`) to retrieve and update records safely.
*   **`connections/` (DB)**: The Plumbing. Establishes and maintains the active connection pipe (session pool) between Python and PostgreSQL.
*   **`migrations/` (Alembic)**: The Database History Log. If you decide to change your database structure in the future (like adding a `birth_date` column to the patients table), migration files act like version control commits for database tables so updates can be tracked and rolled back.
*   **`seed_data/`**: The Initial Population Script. A test script that inserts a fake clinic, two fake doctors, and three fake patients with historical notes into the database so you don't have to start testing with a completely empty app.

---

## 🗃️ Appendix: Detailed Service & Redis Analogies

For reference, here are the detailed metaphors we used to explain how PostgreSQL, Redis, and MinIO handle heavy data workloads and background queues:

### 1. The Starbucks Analogy (Redis vs. PostgreSQL) ☕
Every Starbucks has three key parts:
1. **The Cashier:** Takes your order, swipes your card, and hands you a receipt. This takes **10 seconds** (Web Server / FastAPI).
2. **The Counter (The Queue / Redis):** The metal rack where the cashier clips the order tickets in a line.
3. **The Barista (Background Worker):** The person in the back grinding coffee and steaming milk (takes **3 minutes**).

*   **WITHOUT Redis:** The Cashier has to walk to the machine and make the latte themselves. The register line freezes for 3 minutes.
*   **WITH Redis:** The Cashier clips the ticket to the counter (Redis) and serves the next client. The Barista pulls tickets from the counter one-by-one.

### 2. The Restaurant Metaphor (Who Does What?) 🍽️
* **The Customer** $\rightarrow$ **Doctor** (using browser).
* **The Waiter** $\rightarrow$ **FastAPI** (receives orders).
* **The Order Book** $\rightarrow$ **PostgreSQL** (permanent financial records).
* **The Bulk Warehouse** $\rightarrow$ **MinIO** (stores large ingredients/PDFs).
* **The Ticket Queue** $\rightarrow$ **Redis** (holds active tickets).
* **The Chef** $\rightarrow$ **Background Worker** (does slow, complex cooking).

### 3. The "Phone Call" (Sync) vs. "Drop-off Inbox" (Async) 📞
* **Phone Call (Sync):** The browser calls the server and waits on the line for 45 seconds while an audio file is transcribed. The call times out and crashes.
* **Drop-off Inbox (Async / Redis):** The browser drops the file off, the server returns an instant receipt ("Processing task #123"), hangs up, and does the work in the background. The doctor can keep clicking around while the worker updates the database when finished.
