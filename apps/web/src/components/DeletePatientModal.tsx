import { X, AlertTriangle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deletePatient } from "@/lib/api";
import type { Patient } from "@/types";

interface Props {
  patient: Patient;
  onClose: () => void;
}

export default function DeletePatientModal({ patient, onClose }: Props) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      await deletePatient(patient.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      onClose();
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || "Failed to delete patient");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-neutral-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            <h2 className="font-semibold text-neutral-900">Delete Patient</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
            Are you sure you want to delete <strong>{patient.name}</strong>? This will permanently remove their profile and all associated consultations, artifacts, and appointments.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-xl hover:bg-neutral-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all active:scale-95 shadow-sm"
            >
              {mutation.isPending ? "Deleting..." : "Delete Permanently"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
