import axios, { AxiosError } from "axios";
import type { Artifact, Patient } from "@/types";

export interface ApiError {
  detail: string;
  error_type?: string;
}

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;

// ── Patients ──────────────────────────────────────────────────────────────────

export async function createPatient(name: string, phone: string): Promise<Patient> {
  const { data } = await api.post<Patient>("/patients", { name, phone });
  return data;
}

export async function listPatients(q?: string): Promise<Patient[]> {
  const { data } = await api.get<Patient[]>("/patients", { params: q ? { q } : {} });
  return data;
}

export async function getPatient(id: string): Promise<Patient> {
  const { data } = await api.get<Patient>(`/patients/${id}`);
  return data;
}

export async function openPatient(id: string): Promise<Patient> {
  const { data } = await api.post<Patient>(`/patients/${id}/open`);
  return data;
}

// ── Artifacts ─────────────────────────────────────────────────────────────────

export async function listArtifacts(patientId: string): Promise<Artifact[]> {
  const { data } = await api.get<Artifact[]>(`/patients/${patientId}/artifacts`);
  return data;
}

export async function getArtifact(artifactId: string): Promise<Artifact> {
  const { data } = await api.get<Artifact>(`/artifacts/${artifactId}`);
  return data;
}

export async function uploadFile(patientId: string, file: File): Promise<Artifact> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<Artifact>(`/patients/${patientId}/artifacts/upload`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function createNote(patientId: string, text: string): Promise<Artifact> {
  const { data } = await api.post<Artifact>(`/patients/${patientId}/artifacts/note`, { text });
  return data;
}


export async function saveAudioArtifact(
  patientId: string,
  audioBlob: Blob,
  durationSeconds: number,
): Promise<Artifact> {
  const form = new FormData();
  const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm";
  form.append("audio", audioBlob, `recording.${ext}`);
  form.append("duration_seconds", String(Math.round(durationSeconds)));
  const { data } = await api.post<Artifact>(`/patients/${patientId}/artifacts/audio`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function patchArtifact(
  artifactId: string,
  payload: { title?: string; summary?: string },
): Promise<Artifact> {
  const { data } = await api.patch<Artifact>(`/artifacts/${artifactId}`, payload);
  return data;
}

export async function deleteArtifact(artifactId: string): Promise<void> {
  await api.delete(`/artifacts/${artifactId}`);
}

export async function getDownloadUrl(artifactId: string): Promise<string> {
  const { data } = await api.get<{ url: string }>(`/artifacts/${artifactId}/download`);
  return data.url;
}
