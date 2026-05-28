import type { Patient, Session, SessionListItem } from "./types";

const BASE = "http://localhost:8001";

// ── Token helpers ─────────────────────────────────────────────────────────────

const TOKEN_KEY = "ojas_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("ojas_username");
}

export function getStoredUsername(): string {
  return localStorage.getItem("ojas_username") ?? "";
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(
  username: string,
  password: string,
): Promise<{ access_token: string; clinic_id: string; username: string }> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Incorrect username or password");
  }
  const data = await res.json();
  setToken(data.access_token);
  localStorage.setItem("ojas_username", data.username);
  return data;
}

// ── Patients ──────────────────────────────────────────────────────────────────

export function listPatients(q?: string): Promise<Patient[]> {
  return req(`/patients${q ? `?q=${encodeURIComponent(q)}` : ""}`);
}

export function getPatient(id: string): Promise<Patient> {
  return req(`/patients/${id}`);
}

export function createPatient(data: {
  name: string;
  phone?: string;
  age?: number;
  gender?: string;
}): Promise<Patient> {
  return req("/patients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export function createSession(patientId: string): Promise<{ session_id: string }> {
  return req("/session/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id: patientId }),
  });
}

export function getSession(sessionId: string): Promise<Session> {
  return req(`/session/${sessionId}`);
}

export function patchSession(
  sessionId: string,
  updates: Partial<Pick<Session, "raw_transcript" | "structured_note" | "tags" | "prescription_summary">>,
): Promise<Session> {
  return req(`/session/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export function listPatientSessions(patientId: string): Promise<SessionListItem[]> {
  return req(`/patient/${patientId}/sessions`);
}

// ── Transcription ─────────────────────────────────────────────────────────────

export function transcribeFullAudio(
  sessionId: string,
  audioBlob: Blob,
  mimeType: string,
): Promise<{ session_id: string; raw_transcript: string }> {
  const form = new FormData();
  form.append("session_id", sessionId);
  const ext = mimeType.includes("mp4") ? "mp4" : "webm";
  form.append("audio", audioBlob, `recording.${ext}`);
  return req("/transcribe/full", { method: "POST", body: form });
}

// ── Structuring ───────────────────────────────────────────────────────────────

export function structureTranscript(
  sessionId: string,
): Promise<{ session_id: string; structured_note: Session["structured_note"]; tags: string[] }> {
  return req("/structure/transcript", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export function structurePrescription(
  sessionId: string,
  imageFile: File,
): Promise<{ session_id: string; ocr_text: string; prescription_summary: Session["prescription_summary"] }> {
  const form = new FormData();
  form.append("session_id", sessionId);
  form.append("image", imageFile);
  return req("/structure/prescription", { method: "POST", body: form });
}
