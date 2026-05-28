export interface Patient {
  id: string;
  clinic_id: string;
  name: string;
  phone: string | null;
  age: number | null;
  gender: string | null;
  created_at: string;
}

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

export interface PrescriptionSummary {
  medications: Medication[];
  diagnosis_mentioned: string | null;
  special_instructions: string | null;
}

export interface Session {
  session_id: string;
  patient_id: string;
  clinic_id: string;
  raw_transcript: string | null;
  doctor_notes: string | null;
  structured_note: StructuredNote | null;
  tags: string[] | null;
  prescription_storage_key: string | null;
  prescription_summary: PrescriptionSummary | null;
  created_at: string;
  updated_at: string;
}

export interface SessionListItem {
  session_id: string;
  patient_id: string;
  clinic_id: string;
  created_at: string;
  tags: string[] | null;
  has_transcript: boolean;
  has_note: boolean;
  has_prescription: boolean;
}
