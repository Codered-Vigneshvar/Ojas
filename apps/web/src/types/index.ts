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

export interface StructuredNote {
  chief_complaint: string | null;
  clinical_findings: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  medications_prescribed: string | null;
  follow_up_instructions: string | null;
}

export interface Medication {
  name: string;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
}

export interface LabResult {
  test_name: string;
  result_value: string;
  reference_range: string | null;
  unit: string | null;
}

export interface PatientMetadata {
  name: string | null;
  age: string | null;
  gender: string | null;
  patient_id: string | null;
  report_id: string | null;
  date: string | null;
  referred_by: string | null;
}

export interface ReferenceTableEntry {
  key: string;
  value: string;
}

export interface PrescriptionSummary {
  document_type: "prescription" | "lab_report" | "clinical_note" | "other" | null;
  patient_metadata: PatientMetadata | null;
  medications: Medication[];
  lab_results: LabResult[] | null;
  special_instructions: string | null;
  interpretation_notes: string | null;
  reference_tables: ReferenceTableEntry[] | null;
  diagnosis_mentioned: string | null;
}

export interface Consultation {
  id: string;
  patient_id: string;
  title: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  artifact_count: number;
  summary_text: string | null;
  suggested_questions: string[] | null;
}

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  created_at: string;
}

export interface Artifact {
  id: string;
  patient_id: string;
  consultation_id: string | null;
  parent_id: string | null;
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
  // AI fields — null until processed
  raw_transcript: string | null;
  structured_note: StructuredNote | null;
  tags: string[] | null;
  prescription_ocr_text: string | null;
  prescription_summary: PrescriptionSummary | null;
  doctor_confirmed_at: string | null;
}

export type TimeBucket = "Today" | "This week" | "This month" | "Earlier";

export type AppointmentStatus = "scheduled" | "arrived" | "in_consultation" | "completed";

export interface Appointment {
  id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  consultation_id: string | null;
  scheduled_time: string;
  actual_arrival_time: string | null;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
