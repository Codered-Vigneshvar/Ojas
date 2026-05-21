export interface Patient {
  id: string;
  clinic_id: string;
  name: string;
  phone_e164: string;
  last_accessed_at: string;
  created_at: string;
  artifact_count: number;
}

export type ArtifactType = "report" | "image" | "file" | "note" | "audio" | "prescription";

export interface Artifact {
  id: string;
  patient_id: string;
  type: ArtifactType;
  title: string;
  summary: string | null;
  storage_key: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  text_content: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export type TimeBucket = "Today" | "This week" | "This month" | "Earlier";
