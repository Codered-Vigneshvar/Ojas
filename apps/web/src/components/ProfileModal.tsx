import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, User, Lock, Check, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { patchMe, type MeOut } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  profile: MeOut;
  onClose: () => void;
}

export default function ProfileModal({ profile, onClose }: Props) {
  const qc = useQueryClient();
  const backdropRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(profile.name);
  const [clinicName, setClinicName] = useState(profile.clinic_name);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState("");

  const [isOAuth, setIsOAuth] = useState<boolean | null>(null);
  supabase.auth.getSession().then(({ data }) => {
    const identities = data.session?.user?.identities ?? [];
    setIsOAuth(identities.some((i) => i.provider !== "email"));
  });

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess(false);
    setProfileLoading(true);
    try {
      await patchMe({
        name: name.trim() || undefined,
        clinic_name: clinicName.trim() || undefined,
      });
      await supabase.auth.updateUser({ data: { full_name: name.trim() } });
      qc.invalidateQueries({ queryKey: ["me"] });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch {
      setProfileError("Failed to save. Please try again.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleSendResetLink() {
    setResetError("");
    setResetSent(false);
    setResetLoading(true);
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user?.email;
    if (!email) {
      setResetError("Could not find your email address.");
      setResetLoading(false);
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setResetError(error.message);
    } else {
      setResetSent(true);
    }
    setResetLoading(false);
  }

  return createPortal(
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    >
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Profile & Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Profile section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <User size={14} className="text-neutral-400" />
              <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Profile</h3>
            </div>
            <form onSubmit={handleProfileSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Display name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Clinic name
                </label>
                <input
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {profileError && <p className="text-xs text-red-600">{profileError}</p>}
              <button
                type="submit"
                disabled={profileLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {profileSuccess ? (
                  <><Check size={14} /> Saved</>
                ) : profileLoading ? "Saving…" : "Save changes"}
              </button>
            </form>
          </section>

          <div className="border-t border-neutral-100 dark:border-neutral-800" />

          {/* Password section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Lock size={14} className="text-neutral-400" />
              <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Password</h3>
            </div>

            {isOAuth === true ? (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 rounded-lg px-3 py-2">
                You're signed in with Google — password changes aren't available for OAuth accounts.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  We'll send a reset link to your email. Click the link to set a new password.
                </p>
                {resetSent ? (
                  <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded-lg px-3 py-2">
                    <Check size={14} />
                    Reset link sent — check your email.
                  </div>
                ) : (
                  <>
                    {resetError && <p className="text-xs text-red-600">{resetError}</p>}
                    <button
                      onClick={handleSendResetLink}
                      disabled={resetLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                    >
                      <Send size={13} />
                      {resetLoading ? "Sending…" : "Send reset link"}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
