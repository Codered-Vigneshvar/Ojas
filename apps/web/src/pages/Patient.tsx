import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Upload, Mic, StickyNote } from "lucide-react";
import {
  getPatient,
  listArtifacts,
  uploadFile,
  createNote,
  saveAudioArtifact,
  listConsultations,
  getConsultation,
  createAppointment,
  startConsultation,
  patchArtifact,
  listAppointments,
  patchAppointment,
  patchConsultation,
  deleteConsultation,
  deleteAppointment,
} from "@/lib/api";
import NoteModal from "@/components/PatientWorkspace/NoteModal";
import RecordModal from "@/components/PatientWorkspace/RecordModal";
import UploadModal from "@/components/PatientWorkspace/UploadModal";
import SnippetSidebar from "@/components/PatientWorkspace/SnippetSidebar";
import SnippetDetail from "@/components/PatientWorkspace/SnippetDetail";
import ConsultationHistory from "@/components/PatientWorkspace/ConsultationHistory";
import ConsultationScribe from "@/components/PatientWorkspace/ConsultationScribe";
import BookAppointmentModal from "@/components/Dashboard/BookAppointmentModal";
import type { Consultation, Appointment } from "@/types";

type Modal = "note" | "record" | "upload" | null;

export default function PatientPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const [activeModal, setActiveModal] = useState<Modal>(null);
  const [activeConsultation, setActiveConsultation] = useState<Consultation | null>(null);
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeParentIdForModal, setActiveParentIdForModal] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => getPatient(patientId!),
    enabled: !!patientId,
  });

  const { data: consultations = [] } = useQuery({
    queryKey: ["consultations", patientId],
    queryFn: () => listConsultations(patientId!),
    enabled: !!patientId,
  });

  const { data: artifacts = [] } = useQuery({
    queryKey: ["artifacts", patientId, activeConsultation?.id, searchQuery],
    queryFn: () => listArtifacts(patientId!, activeConsultation?.id, searchQuery),
    enabled: !!patientId && !!activeConsultation,
    refetchInterval: (query) => {
      // Poll every 2 seconds if audio lacks a structured note, or if files still have extensions in title (being labeled/OCRed in background)
      const data = query.state?.data as any[] | undefined;
      const needsPolling = data?.some(a =>
        (a.type === "audio" && !a.structured_note) ||
        (a.title && a.title.includes(".") && (a.type === "file" || a.type === "image" || a.type === "prescription" || a.type === "report")) ||
        (a.mime_type?.startsWith("image/") && a.prescription_ocr_text === null)
      );
      return needsPolling ? 2000 : false;
    }
  });

  const { data: allAppointments = [] } = useQuery({
    queryKey: ["appointments", "all"],
    queryFn: () => listAppointments(),
  });

  const patientAppointments = allAppointments.filter(a => a.patient_id === patientId);
  const activeAppointment = patientAppointments.find(a => a.consultation_id === activeConsultation?.id);

  const handleStartCheck = () => {
    const globalActiveAppt = allAppointments.find(a => a.status === "in_consultation");
    if (globalActiveAppt) {
      alert(`You are currently seeing ${globalActiveAppt.patient_name || "another patient"}. If you want to consult another patient, please click on 'Finish Consultation' on that patient and come back here.`);
      return false;
    }
    return true;
  };

  const topLevelArtifacts = artifacts.filter(a => !a.parent_id);
  const activeSnippet = artifacts.find(a => a.id === activeSnippetId) || null;

  const [readSnippets, setReadSnippets] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`readSnippets_${patientId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markSnippetRead = useCallback((id: string) => {
    setReadSnippets(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem(`readSnippets_${patientId}`, JSON.stringify([...next]));
      return next;
    });
  }, [patientId]);

  useEffect(() => {
    if (activeSnippetId && activeSnippet) {
      const isProcessing = 
        activeSnippet.type === "audio" 
          ? (!activeSnippet.structured_note && !activeSnippet.raw_transcript)
          : (!activeSnippet.text_content && !activeSnippet.prescription_ocr_text && !activeSnippet.summary && !activeSnippet.structured_note);
        
      if (!isProcessing) {
        markSnippetRead(activeSnippetId);
      }
    }
  }, [activeSnippetId, activeSnippet, markSnippetRead]);

  const initialConsultationId = location.state?.activeConsultationId;
  useEffect(() => {
    if (initialConsultationId && consultations.length > 0 && !activeConsultation) {
      const match = consultations.find(c => c.id === initialConsultationId);
      if (match) {
        setActiveConsultation(match);
        // Clear state so refreshing doesn't force re-open if user closed it
        navigate(".", { replace: true, state: {} });
      }
    }
  }, [initialConsultationId, consultations, activeConsultation, navigate]);

  const handleSelectSnippet = useCallback((id: string | null) => {
    setActiveSnippetId(id);
    if (id) {
      markSnippetRead(id);
    }
  }, [markSnippetRead]);

  const invalidateData = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["artifacts", patientId] });
    qc.invalidateQueries({ queryKey: ["consultations", patientId] });
  }, [qc, patientId]);

  const consultationMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const appt = await createAppointment({
        patient_id: patientId!,
        scheduled_time: now.toISOString(),
        duration_minutes: 15,
        notes: "Walk-in Consultation"
      });
      const { consultation_id } = await startConsultation(appt.id);
      return await getConsultation(consultation_id);
    },
    onSuccess: (newConsultation) => {
      invalidateData();
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setActiveConsultation(newConsultation);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadFile(patientId!, file, activeConsultation?.id),
    onSuccess: (data) => {
      invalidateData();
      setActiveModal(null);
      if (data?.id) {
        setActiveSnippetId(data.id);
      }
    },
  });

  const noteMutation = useMutation({
    mutationFn: async ({ text, description, parentId }: { text: string; description?: string; parentId?: string }) => {
      const artifact = await createNote(patientId!, text, activeConsultation?.id, parentId);
      if (description?.trim()) {
        await patchArtifact(artifact.id, { title: description.trim() });
      }
      return artifact;
    },
    onSuccess: (data) => {
      invalidateData();
      setActiveModal(null);
      setActiveParentIdForModal(null);
      if (data?.id && !activeParentIdForModal) {
        setActiveSnippetId(data.id);
      }
    },
  });

  const audioMutation = useMutation({
    mutationFn: ({ blob, duration, parentId }: { blob: Blob; duration: number; parentId?: string }) =>
      saveAudioArtifact(patientId!, blob, duration, activeConsultation?.id, parentId),
    onSuccess: (data) => {
      invalidateData();
      setActiveModal(null);
      setActiveParentIdForModal(null);
      if (data?.id && !activeParentIdForModal) {
        setActiveSnippetId(data.id);
      }
    },
  });

  // Warn before navigating away while recording is active
  useEffect(() => {
    if (activeModal !== "record") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [activeModal]);


  if (patientLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="w-8 h-8 rounded-full border-2 border-neutral-200 border-t-neutral-600 animate-spin" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <p className="text-neutral-600">Patient not found.</p>
        <button onClick={() => navigate("/")} className="text-sm underline text-neutral-500">
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-50 overflow-hidden relative">
      {/* top bar */}
      <header className="flex-shrink-0 border-b border-neutral-200 bg-white/85 backdrop-blur-md z-10 shadow-xs">
        <div className="h-14 flex items-center px-4">
          <button
            onClick={() => {
              if (activeConsultation) {
                setActiveConsultation(null);
                setActiveSnippetId(null);
              } else {
                navigate("/patients");
              }
            }}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors mr-3"
            aria-label={activeConsultation ? "Back to consultations" : "Back to directory"}
          >
            <ArrowLeft size={18} />
          </button>
          <button onClick={() => navigate("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="font-bold text-neutral-900 text-base tracking-tight">Ojas</span>
          </button>

          {/* Active Patient & Consultation context */}
          <div className="mx-6 h-6 w-px bg-neutral-200" />
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-800">{patient.name}</span>
            {activeConsultation && (
              <>
                <span className="text-neutral-400">/</span>
                <span className="text-sm text-neutral-600 font-medium bg-neutral-100 px-2 py-0.5 rounded-md">
                  {activeConsultation.title}
                </span>
                <button
                  onClick={() => {
                    setActiveConsultation(null);
                    setActiveSnippetId(null);
                  }}
                  className="text-[10px] uppercase font-bold text-teal-600 hover:text-teal-700 ml-2"
                >
                  Change
                </button>
              </>
            )}
          </div>

          <div className="flex-1" />
          
          {activeConsultation && activeAppointment && activeAppointment.status === "in_consultation" && (
            <>
              {artifacts.length === 0 && (
                <button
                  onClick={async () => {
                    await patchAppointment(activeAppointment.id, { status: "scheduled", actual_arrival_time: null, consultation_id: null });
                    qc.invalidateQueries({ queryKey: ["appointments"] });
                    qc.invalidateQueries({ queryKey: ["consultations"] });
                    setActiveConsultation(null);
                  }}
                  className="mr-2 px-4 py-1.5 bg-red-50 text-red-600 text-[13px] font-bold rounded-xl hover:bg-red-100 transition-colors shadow-sm active:scale-95"
                >
                  Reset Start
                </button>
              )}
              <button
                onClick={async () => {
                  await patchAppointment(activeAppointment.id, { status: "completed" });
                  qc.invalidateQueries({ queryKey: ["appointments"] });
                }}
                className="mr-4 px-4 py-1.5 bg-neutral-900 text-white text-[13px] font-bold rounded-xl hover:bg-neutral-800 transition-colors shadow-sm active:scale-95"
              >
                Finish Consultation
              </button>
            </>
          )}

          {activeConsultation && activeAppointment && activeAppointment.status === "completed" && (
            <button
              onClick={async () => {
                if (!handleStartCheck()) return;
                await patchAppointment(activeAppointment.id, { status: "in_consultation" });
                qc.invalidateQueries({ queryKey: ["appointments"] });
              }}
              className="mr-4 px-4 py-1.5 bg-white border border-neutral-300 text-neutral-700 text-[13px] font-bold rounded-xl hover:bg-neutral-50 transition-colors shadow-sm active:scale-95"
            >
              Resume Consultation
            </button>
          )}

          <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center text-white text-xs font-semibold select-none">
            DR
          </div>
        </div>
      </header>

      {/* workspace body */}
      <div className="flex-1 flex overflow-hidden">
        {!activeConsultation ? (
          <ConsultationHistory
            consultations={consultations}
            appointments={patientAppointments}
            onSelect={setActiveConsultation}
            onCreateNew={() => {
              if (handleStartCheck()) consultationMutation.mutate();
            }}
            onStartScheduled={async (appt) => {
              if (!handleStartCheck()) return;
              const { consultation_id } = await startConsultation(appt.id);
              const consultation = await getConsultation(consultation_id);
              invalidateData();
              qc.invalidateQueries({ queryKey: ["appointments"] });
              setActiveConsultation(consultation);
            }}
            onUpdateStatus={async (apptId, status) => {
              if (status === "in_consultation" && !handleStartCheck()) return;
              await patchAppointment(apptId, { status });
              qc.invalidateQueries({ queryKey: ["appointments"] });
            }}
            onResetStart={async (apptId) => {
              await patchAppointment(apptId, { status: "scheduled", actual_arrival_time: null, consultation_id: null });
              qc.invalidateQueries({ queryKey: ["appointments"] });
              qc.invalidateQueries({ queryKey: ["consultations"] });
              setActiveConsultation(null);
            }}
            onEditTitle={async (consultationId, title) => {
              await patchConsultation(consultationId, { title });
              qc.invalidateQueries({ queryKey: ["consultations"] });
            }}
            onDeleteConsultation={async (consultationId) => {
              await deleteConsultation(consultationId);
              qc.invalidateQueries({ queryKey: ["consultations"] });
              qc.invalidateQueries({ queryKey: ["appointments"] });
            }}
            onEditAppointment={(appt) => setEditingAppointment(appt)}
            onDeleteAppointment={async (appointmentId) => {
              await deleteAppointment(appointmentId);
              qc.invalidateQueries({ queryKey: ["appointments"] });
            }}
            onClose={() => { }} // Could be used to go back to patient list in future
          />
        ) : (
          <>
            {/* left rail — snippet sidebar */}
            <SnippetSidebar
              snippets={topLevelArtifacts}
              activeSnippetId={activeSnippetId}
              onSelectSnippet={handleSelectSnippet}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              readSnippets={readSnippets}
            />

            <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
              <ConsultationScribe
                consultationId={activeConsultation.id}
                patientName={patient.name}
                onSelectSnippet={handleSelectSnippet}
                isProcessingSnippets={artifacts.some(a => 
                  a.type === "audio" 
                    ? (!a.structured_note && !a.raw_transcript)
                    : (!a.text_content && !a.prescription_ocr_text && !a.summary && !a.structured_note)
                )}
                actionBar={
                  <div className="flex items-center gap-2 p-1 bg-white border border-neutral-200 rounded-xl shadow-sm animate-fade-in pointer-events-auto">
                    <button
                      onClick={() => setActiveModal("upload")}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
                    >
                      <Upload size={14} />
                      Upload
                    </button>
                    <div className="w-px h-4 bg-neutral-200" />
                    <button
                      onClick={() => setActiveModal("note")}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
                    >
                      <StickyNote size={14} />
                      Write Note
                    </button>
                    <div className="w-px h-4 bg-neutral-200" />
                    <button
                      onClick={() => setActiveModal("record")}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-semibold text-white bg-neutral-900 hover:bg-neutral-800 shadow-sm transition-all active:scale-95"
                    >
                      <Mic size={14} />
                      Record Audio
                    </button>
                  </div>
                }
              />
            </div>

            {/* Modals & Overlays */}
            {activeSnippet && (
              <SnippetDetail
                snippet={activeSnippet}
                childArtifacts={artifacts.filter(a => a.parent_id === activeSnippet.id)}
                onClose={() => setActiveSnippetId(null)}
                onUpdate={invalidateData}
                onAddChildNote={() => {
                  setActiveParentIdForModal(activeSnippet.id);
                  setActiveModal("note");
                }}
                onAddChildAudio={() => {
                  setActiveParentIdForModal(activeSnippet.id);
                  setActiveModal("record");
                }}
              />
            )}
          </>
        )}
      </div>

      {/* modals */}
      {activeModal === "note" && (
        <NoteModal
          onClose={() => {
            setActiveModal(null);
            setActiveParentIdForModal(null);
          }}
          isSaving={noteMutation.isPending}
          onSave={async (text, description) => {
            await noteMutation.mutateAsync({ text, description, parentId: activeParentIdForModal || undefined });
          }}
        />
      )}
      {activeModal === "record" && (
        <RecordModal
          onClose={() => {
            setActiveModal(null);
            setActiveParentIdForModal(null);
          }}
          onSave={async (blob, duration) => {
            return await audioMutation.mutateAsync({ blob, duration, parentId: activeParentIdForModal || undefined });
          }}
        />
      )}
      {activeModal === "upload" && (
        <UploadModal
          onClose={() => setActiveModal(null)}
          isSaving={uploadMutation.isPending}
          onSave={async (file) => {
            await uploadMutation.mutateAsync(file);
          }}
        />
      )}
      {editingAppointment && (
        <BookAppointmentModal
          selectedDate={new Date(editingAppointment.scheduled_time)}
          editAppointment={editingAppointment}
          onClose={() => setEditingAppointment(null)}
          onSuccess={() => {
            setEditingAppointment(null);
            qc.invalidateQueries({ queryKey: ["appointments"] });
          }}
        />
      )}
    </div>
  );
}
