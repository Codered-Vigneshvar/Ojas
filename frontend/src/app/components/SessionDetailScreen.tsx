import { ChevronDown, ChevronRight, Pencil, Check } from "lucide-react";
import { useEffect, useState } from "react";
import BackButton from "./BackButton";
import { getSession, patchSession, structureTranscript } from "@/lib/api";
import type { Session, StructuredNote } from "@/lib/types";

function EditableField({
  label,
  value,
  onSave,
  multiline = true,
}: {
  label: string;
  value: string | null;
  onSave: (v: string) => void;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  const save = () => {
    onSave(draft);
    setEditing(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm text-muted-foreground">{label}</label>
        {editing ? (
          <button onClick={save}>
            <Check className="w-3 h-3 text-primary" />
          </button>
        ) : (
          <button onClick={() => setEditing(true)}>
            <Pencil className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </div>
      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          rows={multiline ? 4 : 2}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      ) : (
        <p className="text-foreground text-sm whitespace-pre-wrap">
          {value || <span className="text-muted-foreground italic">Not recorded</span>}
        </p>
      )}
    </div>
  );
}

function Collapsible({
  title,
  open,
  onToggle,
  children,
  badge,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl mb-4 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-accent/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          <span>{title}</span>
        </div>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {badge}
          </span>
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function SessionDetailScreen({
  sessionId,
  onBack,
}: {
  sessionId: string;
  onBack: () => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [structuring, setStructuring] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(true);
  const [prescriptionOpen, setPrescriptionOpen] = useState(true);

  useEffect(() => {
    getSession(sessionId)
      .then((s) => {
        setSession(s);
        // Auto-open notes section if notes exist
        if (s.doctor_notes) setNotesOpen(true);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  const saveTranscript = async (value: string) => {
    const updated = await patchSession(sessionId, { raw_transcript: value });
    setSession(updated);
  };

  const saveDoctorNotes = async (value: string) => {
    const updated = await patchSession(sessionId, { doctor_notes: value });
    setSession(updated);
  };

  const saveNoteField = async (field: keyof StructuredNote, value: string) => {
    const updated = await patchSession(sessionId, {
      structured_note: { ...(session?.structured_note ?? {}), [field]: value },
    });
    setSession(updated);
  };

  const handleStructure = async () => {
    setStructuring(true);
    try {
      await structureTranscript(sessionId);
      const updated = await getSession(sessionId);
      setSession(updated);
    } finally {
      setStructuring(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Session not found.</p>
      </div>
    );
  }

  const note = session.structured_note;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <BackButton onClick={onBack} />

        <div className="mb-6">
          <h2>Session: {formatDate(session.created_at)}</h2>
          {session.tags && session.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2">
              {session.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Raw Transcript — collapsed by default */}
        <Collapsible
          title="Raw Transcript"
          open={transcriptOpen}
          onToggle={() => setTranscriptOpen(!transcriptOpen)}
        >
          <EditableField
            label=""
            value={session.raw_transcript}
            onSave={saveTranscript}
          />
        </Collapsible>

        {/* Structure button */}
        {!note && session.raw_transcript && (
          <button
            onClick={handleStructure}
            disabled={structuring}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm hover:opacity-90 disabled:opacity-50 transition-opacity mb-4"
          >
            {structuring ? "Structuring with AI..." : "Structure Note with AI"}
          </button>
        )}

        {/* Structured Note */}
        <Collapsible title="Structured Note" open={noteOpen} onToggle={() => setNoteOpen(!noteOpen)}>
          {note ? (
            <div className="space-y-4">
              <EditableField label="Chief Complaint" value={note.chief_complaint} onSave={(v) => saveNoteField("chief_complaint", v)} />
              <EditableField label="Clinical Findings" value={note.clinical_findings} onSave={(v) => saveNoteField("clinical_findings", v)} />
              <EditableField label="Diagnosis" value={note.diagnosis} onSave={(v) => saveNoteField("diagnosis", v)} />
              <EditableField label="Treatment Plan" value={note.treatment_plan} onSave={(v) => saveNoteField("treatment_plan", v)} />
              <EditableField label="Medications Prescribed" value={note.medications_prescribed} onSave={(v) => saveNoteField("medications_prescribed", v)} />
              <EditableField label="Follow-up Instructions" value={note.follow_up_instructions} onSave={(v) => saveNoteField("follow_up_instructions", v)} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              {session.raw_transcript
                ? "Click \"Structure Note with AI\" above to generate the note."
                : "No transcript recorded yet."}
            </p>
          )}
        </Collapsible>

        {/* Doctor's Notes — only shown if notes exist, auto-opened */}
        {(session.doctor_notes || notesOpen) && (
          <Collapsible
            title="Doctor's Notes"
            open={notesOpen}
            onToggle={() => setNotesOpen(!notesOpen)}
            badge={session.doctor_notes ? "Added" : undefined}
          >
            <EditableField
              label=""
              value={session.doctor_notes}
              onSave={saveDoctorNotes}
            />
          </Collapsible>
        )}

        {/* Prescription */}
        <Collapsible
          title="Prescription"
          open={prescriptionOpen}
          onToggle={() => setPrescriptionOpen(!prescriptionOpen)}
        >
          {session.prescription_summary ? (
            <div className="space-y-3">
              {session.prescription_summary.medications.map((med, i) => (
                <div key={i} className="bg-muted/20 rounded-lg p-3 text-sm space-y-1">
                  <p className="font-medium">{med.name}</p>
                  <div className="flex gap-4 text-muted-foreground">
                    {med.dose && <span>{med.dose}</span>}
                    {med.frequency && <span>{med.frequency}</span>}
                    {med.duration && <span>{med.duration}</span>}
                  </div>
                </div>
              ))}
              {session.prescription_summary.diagnosis_mentioned && (
                <p className="text-sm text-muted-foreground">
                  Diagnosis: {session.prescription_summary.diagnosis_mentioned}
                </p>
              )}
              {session.prescription_summary.special_instructions && (
                <p className="text-sm text-muted-foreground">
                  Instructions: {session.prescription_summary.special_instructions}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              No prescription uploaded for this session.
            </p>
          )}
        </Collapsible>
      </div>
    </div>
  );
}
