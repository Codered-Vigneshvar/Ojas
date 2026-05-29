import axios, { AxiosError } from "axios";
import type { Artifact, Patient, StructuredNote, PrescriptionSummary, Consultation } from "@/types";

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

// ── Consultations ─────────────────────────────────────────────────────────────

export async function createConsultation(patientId: string, title?: string): Promise<Consultation> {
  const { data } = await api.post<Consultation>(`/patients/${patientId}/consultations`, { title });
  return data;
}

export async function listConsultations(patientId: string): Promise<Consultation[]> {
  const { data } = await api.get<Consultation[]>(`/patients/${patientId}/consultations`);
  return data;
}

export async function getConsultation(consultationId: string): Promise<Consultation> {
  const { data } = await api.get<Consultation>(`/consultations/${consultationId}`);
  return data;
}

export async function patchConsultation(
  consultationId: string,
  payload: { title?: string; notes?: string },
): Promise<Consultation> {
  const { data } = await api.patch<Consultation>(`/consultations/${consultationId}`, payload);
  return data;
}

export async function deleteConsultation(consultationId: string): Promise<void> {
  await api.delete(`/consultations/${consultationId}`);
}

export interface ConsultationSummaryOut {
  summary_text: string | null;
  suggested_questions: string[] | null;
  snippet_count: number;
}

export async function getConsultationSummary(consultationId: string): Promise<ConsultationSummaryOut> {
  const { data } = await api.get<ConsultationSummaryOut>(`/consultations/${consultationId}/summary`);
  return data;
}

export interface AskResponse {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
}

export async function askConsultation(consultationId: string, question: string, signal?: AbortSignal): Promise<AskResponse> {
  const { data } = await api.post<AskResponse>(`/consultations/${consultationId}/ask`, { question }, { signal });
  return data;
}

export async function getConsultationMessages(consultationId: string): Promise<ChatMessage[]> {
  const { data } = await api.get<ChatMessage[]>(`/consultations/${consultationId}/messages`);
  return data;
}

export async function deleteConsultationMessage(consultationId: string, messageId: string): Promise<void> {
  await api.delete(`/consultations/${consultationId}/messages/${messageId}`);
}

// ── Artifacts ─────────────────────────────────────────────────────────────────

export async function listArtifacts(
  patientId: string,
  consultationId?: string,
  q?: string,
): Promise<Artifact[]> {
  const params: Record<string, string> = {};
  if (consultationId) params.consultation_id = consultationId;
  if (q) params.q = q;
  const { data } = await api.get<Artifact[]>(`/patients/${patientId}/artifacts`, { params });
  return data;
}

export async function getArtifact(artifactId: string): Promise<Artifact> {
  const { data } = await api.get<Artifact>(`/artifacts/${artifactId}`);
  return data;
}

export async function uploadFile(
  patientId: string,
  file: File,
  consultationId?: string,
): Promise<Artifact> {
  const form = new FormData();
  form.append("file", file);
  if (consultationId) form.append("consultation_id", consultationId);
  const { data } = await api.post<Artifact>(`/patients/${patientId}/artifacts/upload`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function createNote(
  patientId: string,
  text: string,
  consultationId?: string,
  parentId?: string,
): Promise<Artifact> {
  const params: Record<string, string> = {};
  if (consultationId) params.consultation_id = consultationId;
  if (parentId) params.parent_id = parentId;
  const { data } = await api.post<Artifact>(`/patients/${patientId}/artifacts/note`, { text }, { params });
  return data;
}

export async function saveAudioArtifact(
  patientId: string,
  audioBlob: Blob,
  durationSeconds: number,
  consultationId?: string,
  parentId?: string,
): Promise<Artifact> {
  const form = new FormData();
  const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm";
  form.append("audio", audioBlob, `recording.${ext}`);
  form.append("duration_seconds", String(Math.round(durationSeconds)));
  if (consultationId) form.append("consultation_id", consultationId);
  if (parentId) form.append("parent_id", parentId);
  const { data } = await api.post<Artifact>(`/patients/${patientId}/artifacts/audio`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function patchArtifact(
  artifactId: string,
  payload: {
    title?: string;
    summary?: string;
    raw_transcript?: string | null;
    text_content?: string | null;
    structured_note?: Partial<StructuredNote> | null;
    prescription_summary?: Partial<PrescriptionSummary> | null;
    tags?: string[] | null;
  },
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

// ── AI endpoints ──────────────────────────────────────────────────────────────

export interface QuickTranscribeResponse {
  transcript: string;
}

export interface TranscribeAIResponse {
  artifact_id: string;
  raw_transcript: string;
  structured_note: StructuredNote | null;
}

export interface StructureResponse {
  artifact_id: string;
  structured_note: StructuredNote;
  tags: string[];
}

export interface PrescriptionOCRResponse {
  artifact_id: string;
  prescription_ocr_text: string;
  prescription_summary: PrescriptionSummary;
}

export interface ConfirmResponse {
  artifact_id: string;
  doctor_confirmed_at: string;
}

export interface VoiceEditResponse {
  artifact_id: string;
  structured_note: StructuredNote;
  correction_transcript: string;
}

export async function transcribeAudioBytes(audioBlob: Blob): Promise<QuickTranscribeResponse> {
  const form = new FormData();
  const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm";
  form.append("audio", audioBlob, `partial.${ext}`);
  const { data } = await api.post<QuickTranscribeResponse>("/ai/transcribe-bytes", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function transcribeArtifact(artifactId: string): Promise<TranscribeAIResponse> {
  const { data } = await api.post<TranscribeAIResponse>(`/ai/artifacts/${artifactId}/transcribe`);
  return data;
}

export async function structureArtifact(artifactId: string): Promise<StructureResponse> {
  const { data } = await api.post<StructureResponse>(`/ai/artifacts/${artifactId}/structure`);
  return data;
}

export async function ocrPrescription(artifactId: string): Promise<PrescriptionOCRResponse> {
  const { data } = await api.post<PrescriptionOCRResponse>(`/ai/artifacts/${artifactId}/ocr`);
  return data;
}

export async function confirmArtifact(artifactId: string): Promise<ConfirmResponse> {
  const { data } = await api.post<ConfirmResponse>(`/ai/artifacts/${artifactId}/confirm`);
  return data;
}

export async function voiceEditArtifact(
  artifactId: string,
  audioBlob: Blob,
): Promise<VoiceEditResponse> {
  const form = new FormData();
  const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm";
  form.append("audio", audioBlob, `correction.${ext}`);
  const { data } = await api.post<VoiceEditResponse>(
    `/ai/artifacts/${artifactId}/voice-edit`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}
