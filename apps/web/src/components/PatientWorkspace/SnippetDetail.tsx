import { useState, useCallback, useEffect } from "react";
import { X, Sparkles, Loader2, CheckCircle2, Trash2, Save, Download, Maximize2, FileText, Mic, StickyNote, Plus, Pen, Copy } from "lucide-react";
import type { Artifact, StructuredNote } from "@/types";
import { patchArtifact, deleteArtifact, getDownloadUrl } from "@/lib/api";
import AudioPlayer from "@/components/AudioPlayer";

interface Props {
  snippet: Artifact;
  onClose: () => void;
  onUpdate: () => void;
  childArtifacts?: Artifact[];
  onAddChildNote?: () => void;
  onAddChildAudio?: () => void;
}

const NOTE_FIELDS: { key: keyof StructuredNote; label: string; multiline?: boolean }[] = [
  { key: "chief_complaint", label: "Chief Complaint" },
  { key: "clinical_findings", label: "Clinical Findings", multiline: true },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "treatment_plan", label: "Treatment Plan", multiline: true },
  { key: "medications_prescribed", label: "Medications Prescribed", multiline: true },
  { key: "follow_up_instructions", label: "Follow-up Instructions" },
];

export default function SnippetDetail({ snippet, onClose, onUpdate, childArtifacts = [], onAddChildNote, onAddChildAudio }: Props) {
  const [editedNote, setEditedNote] = useState<Partial<StructuredNote>>({});
  const [editedTitle, setEditedTitle] = useState<string | null>(null);
  const [editedTextContent, setEditedTextContent] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editingChildText, setEditingChildText] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Structured Data Editing
  const [isEditingStructuredData, setIsEditingStructuredData] = useState(false);
  const [structuredDataJson, setStructuredDataJson] = useState<string>("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const startEditingStructuredData = () => {
    setStructuredDataJson(JSON.stringify(snippet.prescription_summary || {}, null, 2));
    setJsonError(null);
    setIsEditingStructuredData(true);
  };

  const handleSaveJson = async () => {
    try {
      const parsed = JSON.parse(structuredDataJson);
      setJsonError(null);
      setIsSaving(true);
      await patchArtifact(snippet.id, { prescription_summary: parsed });
      setIsEditingStructuredData(false);
      onUpdate();
    } catch (e: any) {
      setJsonError(e.message || "Invalid JSON syntax");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = useCallback(() => {
    if (snippet.prescription_ocr_text) {
      navigator.clipboard.writeText(snippet.prescription_ocr_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [snippet.prescription_ocr_text]);

  useEffect(() => {
    if (snippet.storage_key) {
      getDownloadUrl(snippet.id)
        .then((url) => setFileUrl(url))
        .catch((err) => console.error("Error getting file download URL:", err));
    } else {
      setFileUrl(null);
    }
  }, [snippet.id, snippet.storage_key]);

  useEffect(() => {
    setEditedNote({});
    setEditedTitle(null);
    setEditedTextContent(null);
    setIsSaved(false);
  }, [snippet.id]);

  const displayNote = snippet.structured_note ? { ...snippet.structured_note, ...editedNote } : null;
  const isDirty = Object.keys(editedNote).length > 0 || editedTitle !== null || editedTextContent !== null;

  const handleFieldChange = useCallback((key: keyof StructuredNote, value: string) => {
    setEditedNote((prev) => ({ ...prev, [key]: value || null }));
    setIsSaved(false);
  }, []);

  const handleSave = async () => {
    if (!isDirty) return;
    setIsSaving(true);
    try {
      const payload: any = {};
      if (editedTitle !== null) payload.title = editedTitle;
      if (editedTextContent !== null) {
        payload.text_content = editedTextContent;
        payload.raw_transcript = editedTextContent;
      }
      if (Object.keys(editedNote).length > 0) {
        payload.structured_note = editedNote;
      }
      await patchArtifact(snippet.id, payload);
      setIsSaved(true);
      onUpdate();
    } catch {
      // fail silently
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this snippet?")) return;
    setIsDeleting(true);
    try {
      await deleteArtifact(snippet.id);
      onUpdate(); // refreshes list
      onClose();  // closes panel
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden animate-slide-up flex flex-col transition-all duration-500 ease-out w-full max-w-5xl h-[90vh] md:h-[85vh]">
      {/* Header */}
      <div className="h-14 border-b border-neutral-100 flex items-center justify-between px-5 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-500">
            {snippet.type}
          </span>
          <h2 className="font-semibold text-sm text-neutral-900 truncate">
            {snippet.title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-50"
              title="Save Changes"
            >
              {isSaving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : isSaved ? (
                <CheckCircle2 size={13} className="text-emerald-400" />
              ) : (
                <Save size={13} />
              )}
              {isSaving ? "Saving..." : isSaved ? "Saved" : "Save Changes"}
            </button>
          )}
          <div className="flex items-center gap-1">
            {fileUrl && (
              <a
                href={fileUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-colors"
                title="Download Document"
              >
                <Download size={18} />
              </a>
            )}
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete Snippet"
            >
              {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-colors"
              title="Close Panel"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          
          {/* Audio Player if applicable */}
          {snippet.type === "audio" && snippet.storage_key && fileUrl && (
            <div className="p-5 bg-neutral-50 border border-neutral-200 rounded-2xl">
              <AudioPlayer
                src={fileUrl}
                durationSeconds={snippet.duration_seconds || 0}
              />
            </div>
          )}

          {/* Document Preview (For Image/Prescription files) */}
          {snippet.storage_key && fileUrl && (snippet.type === "image" || snippet.type === "prescription" || snippet.mime_type?.startsWith("image/")) && (
            <div className="space-y-3 animate-fade-in">
              <h4 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block ml-1">
                Document Preview (Click to view full screen)
              </h4>
              <div className="relative group rounded-2xl border border-neutral-200 overflow-hidden bg-neutral-50 hover:border-neutral-300 transition-all flex items-center justify-center p-3 max-h-[360px] cursor-zoom-in">
                <img
                  src={fileUrl}
                  alt={snippet.title}
                  onClick={() => setIsLightboxOpen(true)}
                  className="max-h-[330px] rounded-xl object-contain shadow-sm transition-transform duration-300 group-hover:scale-[1.01]"
                />
                
                {/* Visual indicator overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center pointer-events-none">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white text-xs font-semibold px-3 py-2 rounded-xl backdrop-blur-xs flex items-center gap-1.5 shadow-md">
                    <Maximize2 size={13} />
                    View Full Screen
                  </span>
                </div>
              </div>
            </div>
          )}



          {/* Editable Note content for note type */}
          {snippet.type === "note" && (
            <div className="space-y-5">
              {/* Snippet Title / Label */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide block ml-1">
                  Snippet Label / Title
                </label>
                <input
                  type="text"
                  value={editedTitle !== null ? editedTitle : snippet.title}
                  onChange={(e) => {
                    setEditedTitle(e.target.value);
                    setIsSaved(false);
                  }}
                  placeholder="Note Title"
                  className="w-full text-sm text-neutral-800 bg-white border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 transition-all shadow-sm hover:shadow"
                />
              </div>

              {/* Note Content */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide block ml-1">
                  Note Content
                </label>
                <textarea
                  value={editedTextContent !== null ? editedTextContent : (snippet.text_content || "")}
                  onChange={(e) => {
                    setEditedTextContent(e.target.value);
                    setIsSaved(false);
                  }}
                  rows={12}
                  placeholder="Type note content here..."
                  className="w-full text-sm leading-relaxed text-neutral-800 bg-white border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 resize-y transition-all shadow-sm font-sans"
                />
              </div>
            </div>
          )}

          {snippet.raw_transcript && (
            <div>
              <h3 className="text-sm font-semibold text-neutral-800 mb-3">Raw Transcript</h3>
              <div className="p-4 bg-neutral-50 border border-neutral-100 rounded-xl text-sm leading-relaxed text-neutral-600 whitespace-pre-wrap font-mono">
                {snippet.raw_transcript}
              </div>
            </div>
          )}

          {/* Structured Note Content for Audio */}
          {snippet.structured_note && displayNote && (
            <div className="pt-4 border-t border-neutral-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-600" />
                  Structured Note
                </h3>
                {snippet.tags && snippet.tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {snippet.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 font-mono">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {NOTE_FIELDS.map(({ key, label, multiline }) => {
                  const val = (displayNote[key] as string | null) ?? "";
                  return (
                    <div key={key}>
                      <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide block mb-1.5 ml-1">
                        {label}
                      </label>
                      {multiline ? (
                        <textarea
                          value={val}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          rows={3}
                          placeholder="—"
                          className="w-full text-sm text-neutral-800 bg-white border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 resize-none leading-relaxed transition-all shadow-sm hover:shadow"
                        />
                      ) : (
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          placeholder="—"
                          className="w-full text-sm text-neutral-800 bg-white border border-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-400 focus:ring-4 focus:ring-neutral-100 transition-all shadow-sm hover:shadow"
                        />
                      )}
                    </div>
                  );
                })}

                {/* Save button moved to the header to prevent bottom action bar overlap */}
              </div>
            </div>
          )}



          {/* Structured Retrieved Prescription/Document Information */}
          {(snippet.prescription_summary || snippet.prescription_ocr_text) && (
            <div className="pt-4 border-t border-neutral-100 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between ml-1">
                <h4 className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles size={14} className="text-indigo-600 animate-pulse" />
                  Structured Retrieved Information
                </h4>
                {snippet.prescription_summary && !isEditingStructuredData && (
                  <button
                    onClick={startEditingStructuredData}
                    className="flex items-center gap-1 text-[10px] font-medium text-neutral-500 hover:text-indigo-600 transition-colors px-2 py-1 bg-neutral-50 hover:bg-neutral-100 rounded border border-neutral-200"
                  >
                    <Pen size={12} /> Edit Data
                  </button>
                )}
              </div>
              
              <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
                {isEditingStructuredData ? (
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-500">
                      Edit the raw JSON data that powers the tables below. Be careful to maintain valid JSON syntax.
                    </p>
                    {jsonError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-mono">
                        Error: {jsonError}
                      </div>
                    )}
                    <textarea
                      value={structuredDataJson}
                      onChange={(e) => setStructuredDataJson(e.target.value)}
                      rows={20}
                      className="w-full font-mono text-xs leading-relaxed text-neutral-800 bg-neutral-900 text-neutral-100 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y shadow-inner"
                      spellCheck={false}
                    />
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setIsEditingStructuredData(false)}
                        disabled={isSaving}
                        className="px-4 py-2 text-xs font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveJson}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                      >
                        {isSaving && <Loader2 size={13} className="animate-spin" />}
                        {isSaving ? "Saving..." : "Save JSON"}
                      </button>
                    </div>
                  </div>
                ) : snippet.prescription_summary && (
                  snippet.prescription_summary.diagnosis_mentioned || 
                  (snippet.prescription_summary.medications && snippet.prescription_summary.medications.length > 0) || 
                  (snippet.prescription_summary.lab_results && snippet.prescription_summary.lab_results.length > 0) || 
                  (snippet.prescription_summary.patient_metadata && Object.values(snippet.prescription_summary.patient_metadata).some(v => v !== null)) ||
                  snippet.prescription_summary.interpretation_notes ||
                  (snippet.prescription_summary.reference_tables && snippet.prescription_summary.reference_tables.length > 0) ||
                  snippet.prescription_summary.special_instructions
                ) ? (
                  <div className="space-y-5">
                    {/* Patient & Report Metadata Grid */}
                    {snippet.prescription_summary.patient_metadata && Object.values(snippet.prescription_summary.patient_metadata).some(v => v !== null) && (
                      <div className="bg-neutral-50/60 rounded-xl p-4 border border-neutral-150 space-y-3">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block">Patient & Report Metadata</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-xs">
                          {snippet.prescription_summary.patient_metadata.name && (
                            <div>
                              <span className="text-neutral-400 font-medium block">Patient Name</span>
                              <span className="font-semibold text-neutral-800">{snippet.prescription_summary.patient_metadata.name}</span>
                            </div>
                          )}
                          {(snippet.prescription_summary.patient_metadata.age || snippet.prescription_summary.patient_metadata.gender) && (
                            <div>
                              <span className="text-neutral-400 font-medium block">Age / Gender</span>
                              <span className="font-semibold text-neutral-800">
                                {[snippet.prescription_summary.patient_metadata.age, snippet.prescription_summary.patient_metadata.gender].filter(Boolean).join(" / ")}
                              </span>
                            </div>
                          )}
                          {snippet.prescription_summary.patient_metadata.patient_id && (
                            <div>
                              <span className="text-neutral-400 font-medium block">Patient ID</span>
                              <span className="font-semibold text-neutral-700">{snippet.prescription_summary.patient_metadata.patient_id}</span>
                            </div>
                          )}
                          {snippet.prescription_summary.patient_metadata.report_id && (
                            <div>
                              <span className="text-neutral-400 font-medium block">Report ID</span>
                              <span className="font-semibold text-neutral-700">{snippet.prescription_summary.patient_metadata.report_id}</span>
                            </div>
                          )}
                          {snippet.prescription_summary.patient_metadata.date && (
                            <div>
                              <span className="text-neutral-400 font-medium block">Report Date</span>
                              <span className="font-semibold text-neutral-700">{snippet.prescription_summary.patient_metadata.date}</span>
                            </div>
                          )}
                          {snippet.prescription_summary.patient_metadata.referred_by && (
                            <div>
                              <span className="text-neutral-400 font-medium block">Referred By</span>
                              <span className="font-semibold text-neutral-700">{snippet.prescription_summary.patient_metadata.referred_by}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Diagnosis */}
                    {snippet.prescription_summary.diagnosis_mentioned && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Diagnosis Mentioned</span>
                        <p className="text-sm font-semibold text-neutral-800">{snippet.prescription_summary.diagnosis_mentioned}</p>
                      </div>
                    )}

                    {/* Medications Table */}
                    {snippet.prescription_summary.medications && snippet.prescription_summary.medications.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block">Extracted Medications</span>
                        <div className="border border-neutral-150 rounded-lg overflow-hidden">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-150">
                                <th className="px-4 py-2.5">Medication Name</th>
                                <th className="px-4 py-2.5">Dose</th>
                                <th className="px-4 py-2.5">Frequency</th>
                                <th className="px-4 py-2.5">Duration</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 text-neutral-700">
                              {snippet.prescription_summary.medications.map((med: any, idx: number) => (
                                <tr key={idx} className="hover:bg-neutral-50/50">
                                  <td className="px-4 py-2.5 font-semibold text-neutral-800">{med.name || "—"}</td>
                                  <td className="px-4 py-2.5">{med.dose || "—"}</td>
                                  <td className="px-4 py-2.5">{med.frequency || "—"}</td>
                                  <td className="px-4 py-2.5">{med.duration || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Lab Results Table */}
                    {snippet.prescription_summary.lab_results && snippet.prescription_summary.lab_results.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block">Extracted Lab Results</span>
                        <div className="border border-neutral-150 rounded-lg overflow-hidden shadow-sm bg-neutral-50/20">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-150">
                                <th className="px-4 py-2.5">Test Name</th>
                                <th className="px-4 py-2.5">Result</th>
                                <th className="px-4 py-2.5">Reference Range</th>
                                <th className="px-4 py-2.5">Unit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 text-neutral-700 bg-white">
                              {snippet.prescription_summary.lab_results.map((res: any, idx: number) => (
                                <tr key={idx} className="hover:bg-neutral-50/50 transition-colors">
                                  <td className="px-4 py-2.5 font-semibold text-neutral-800">{res.test_name || "—"}</td>
                                  <td className="px-4 py-2.5 text-neutral-900 font-bold">{res.result_value || "—"}</td>
                                  <td className="px-4 py-2.5 text-neutral-500">{res.reference_range || "—"}</td>
                                  <td className="px-4 py-2.5 text-neutral-600 font-mono text-[10px]">{res.unit || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Reference Interpretations Table */}
                    {snippet.prescription_summary.reference_tables && snippet.prescription_summary.reference_tables.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block">Reference Interpretations</span>
                        <div className="border border-neutral-150 rounded-lg overflow-hidden max-w-md shadow-sm">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-150">
                                <th className="px-4 py-2.5">Condition / Range</th>
                                <th className="px-4 py-2.5">Reference Values</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 text-neutral-700 bg-white">
                              {snippet.prescription_summary.reference_tables.map((row: any, idx: number) => (
                                <tr key={idx} className="hover:bg-neutral-50/30">
                                  <td className="px-4 py-2 font-medium text-neutral-800">{row.key}</td>
                                  <td className="px-4 py-2 font-mono text-neutral-600">{row.value}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Interpretation & Explanations */}
                    {snippet.prescription_summary.interpretation_notes && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block">Clinical Interpretation</span>
                        <div className="text-xs text-neutral-600 leading-relaxed bg-indigo-50/40 p-4 rounded-xl border border-indigo-100 flex items-start gap-2.5">
                          <FileText size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                          <p>{snippet.prescription_summary.interpretation_notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Special Instructions */}
                    {snippet.prescription_summary.special_instructions && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Special Instructions</span>
                        <p className="text-xs text-neutral-600 leading-relaxed bg-neutral-50 p-3 rounded-lg border border-neutral-150">{snippet.prescription_summary.special_instructions}</p>
                      </div>
                    )}
                  </div>
                ) : snippet.prescription_ocr_text ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wide px-1">
                      <span className="flex items-center gap-1.5">
                        <FileText size={10} className="text-neutral-400" />
                        Preserved Document Layout
                      </span>
                      <button
                        onClick={handleCopy}
                        className="hover:text-indigo-600 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer bg-neutral-50 hover:bg-neutral-100/80 px-2 py-1 rounded-md border border-neutral-200 text-[10px]"
                      >
                        {copied ? (
                          <>
                            <CheckCircle2 size={10} className="text-green-600 animate-pulse" />
                            <span className="text-green-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={10} />
                            <span>Copy Layout</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="text-xs text-neutral-800 bg-neutral-50/50 p-4 rounded-xl border border-neutral-150 font-mono leading-relaxed overflow-x-auto whitespace-pre scrollbar-thin shadow-inner max-h-[400px] select-text">
                      {snippet.prescription_ocr_text}
                    </pre>
                  </div>
                ) : (
                  <div className="text-sm text-neutral-500 italic text-center py-2">
                    AI was not able to extract structured information from this document.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Processing State */}
          {((snippet.type === "audio" && !snippet.structured_note) || 
            (snippet.mime_type?.startsWith("image/") && snippet.prescription_ocr_text === null)) && (
            Date.now() - new Date(snippet.created_at).getTime() < 120000 ? (
              <div className="p-8 mt-4 text-center bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col items-center gap-4">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={24} className="animate-spin text-indigo-500" />
                  <p className="text-sm font-medium text-indigo-700">
                    {snippet.type === "audio" ? "AI is analyzing and structuring this audio..." : "AI is extracting and analyzing this document..."}
                  </p>
                </div>
                <p className="text-xs text-indigo-500/80 max-w-sm">
                  This can sometimes take up to 15-30 seconds depending on the file complexity. You can close this window and continue working—it will update automatically in the background.
                </p>
              </div>
            ) : (
              <div className="p-8 mt-4 text-center bg-red-50/50 rounded-2xl border border-red-100 flex flex-col items-center gap-2">
                <p className="text-sm font-medium text-red-700">AI processing timed out or failed.</p>
                <p className="text-xs text-red-500/80">The document was uploaded successfully, but the AI was unable to extract or structure the text within the expected time limit.</p>
              </div>
            )
          )}

          {/* Fallback for other files without preview or text content */}
          {!snippet.text_content && !snippet.raw_transcript && !snippet.structured_note && !snippet.prescription_ocr_text && snippet.type !== "audio" && !(snippet.type === "image" || snippet.type === "prescription" || snippet.mime_type?.startsWith("image/")) && (
            <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-neutral-200">
              <p className="text-sm text-neutral-500">File uploaded and available for preview / download.</p>
            </div>
          )}
          {/* Doctor's Notes (Child Artifacts) */}
          <div className="pt-8 mt-8 border-t border-neutral-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                <StickyNote size={16} className="text-amber-500" />
                Doctor's Notes
              </h3>
              <div className="flex items-center gap-2">
                {onAddChildNote && (
                  <button
                    onClick={onAddChildNote}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                  >
                    <Plus size={13} />
                    Add Note
                  </button>
                )}
                {onAddChildAudio && (
                  <button
                    onClick={onAddChildAudio}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-sm"
                  >
                    <Mic size={13} />
                    Record Audio
                  </button>
                )}
              </div>
            </div>

            {childArtifacts.length > 0 ? (
              <div className="space-y-2 pl-1">
                {childArtifacts.map((child) => (
                  <div key={child.id} className="group relative flex gap-3 py-1">
                    <div className="mt-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-neutral-800"></div>
                    </div>
                    <div className="flex-1">
                      {editingChildId === child.id ? (
                        <div className="flex flex-col gap-2 w-full mt-1">
                          <textarea
                            value={editingChildText}
                            onChange={(e) => setEditingChildText(e.target.value)}
                            className="w-full text-sm text-neutral-800 bg-white border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-y shadow-sm"
                            rows={3}
                          />
                          <div className="flex justify-end gap-2 mt-1">
                            <button
                              onClick={() => { setEditingChildId(null); setEditingChildText(""); }}
                              className="px-3 py-1.5 text-xs font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={async () => {
                                await patchArtifact(child.id, {
                                  text_content: editingChildText,
                                  raw_transcript: editingChildText,
                                  structured_note: child.type === "audio" && child.structured_note 
                                    ? { ...child.structured_note, clinical_findings: editingChildText } 
                                    : undefined
                                });
                                setEditingChildId(null);
                                onUpdate();
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-sm"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 group-hover:bg-neutral-50/50 -mx-2 px-2 py-1 rounded transition-colors">
                          <div className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap flex-1 pt-0.5">
                            {child.type === "audio" 
                              ? (child.structured_note?.clinical_findings || child.structured_note?.chief_complaint || child.raw_transcript || (
                                  <span className="flex items-center gap-1.5 text-xs text-indigo-600">
                                    <Loader2 size={12} className="animate-spin" /> AI is processing audio...
                                  </span>
                                ))
                              : child.text_content
                            }
                          </div>
                          
                          <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity mt-1 sm:mt-0 pt-0.5">
                            <button
                              onClick={() => {
                                setEditingChildId(child.id);
                                setEditingChildText(
                                  child.type === "audio" 
                                    ? (child.structured_note?.clinical_findings || child.structured_note?.chief_complaint || child.raw_transcript || "")
                                    : (child.text_content || "")
                                );
                              }}
                              className="flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-indigo-600 transition-colors"
                            >
                              <Pen size={12} /> Edit
                            </button>
                            <button
                              onClick={async () => {
                                if (window.confirm("Delete this note?")) {
                                  await deleteArtifact(child.id);
                                  onUpdate();
                                }
                              }}
                              className="flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                            {child.type === "audio" && (
                              <span className="text-[10px] text-teal-600 font-medium flex items-center gap-1 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                                <Mic size={10} /> Audio note
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 border-2 border-dashed border-neutral-200 rounded-xl bg-neutral-50/50">
                <p className="text-sm text-neutral-500 font-medium">No notes added yet</p>
                <p className="text-xs text-neutral-400 mt-1">Add a text note or record an audio note to attach it directly.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox / Fullscreen View */}
      {isLightboxOpen && fileUrl && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-5 right-5 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Close Full Screen"
          >
            <X size={24} />
          </button>
          
          <img
            src={fileUrl}
            alt={snippet.title}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-zoom-in"
            onClick={(e) => e.stopPropagation()} // stop close on image click
          />
        </div>
      )}
    </div>
    </div>
  );
}
