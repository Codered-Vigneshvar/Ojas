import { useEffect, useRef, useState } from "react";
import { LogOut, User, Sun, Moon, Monitor } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { getMe } from "@/lib/api";
import ProfileModal from "@/components/ProfileModal";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export default function AvatarMenu() {
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    staleTime: 60_000,
  });

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = profile?.name ?? "Doctor";
  const badge = initials(label);

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-8 h-8 rounded-full bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center text-white dark:text-neutral-900 text-xs font-semibold select-none hover:opacity-80 transition-opacity"
          aria-label="Account menu"
        >
          {badge}
        </button>

        {open && (
          <div className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg py-1 animate-scale-in">
            {/* Name + clinic */}
            <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800">
              <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">Dr {label}</p>
              {profile?.clinic_name && (
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">{profile.clinic_name}</p>
              )}
            </div>

            {/* Profile */}
            <button
              onClick={() => { setOpen(false); setShowProfile(true); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <User size={14} className="text-neutral-400" />
              Profile & settings
            </button>

            {/* Display / theme */}
            <div className="px-3 py-2">
              <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 mb-1.5 uppercase tracking-wide">Display</p>
              <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                {(["light", "system", "dark"] as const).map((t) => {
                  const Icon = t === "light" ? Sun : t === "dark" ? Moon : Monitor;
                  const active =
                    t === "system"
                      ? false
                      : theme === t;
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        if (t === "system") {
                          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                          setTheme(prefersDark ? "dark" : "light");
                        } else {
                          setTheme(t);
                        }
                      }}
                      className={`flex-1 flex items-center justify-center py-1.5 transition-colors ${
                        active
                          ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                          : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                      }`}
                      title={t.charAt(0).toUpperCase() + t.slice(1)}
                    >
                      <Icon size={13} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-neutral-100 dark:border-neutral-800 mt-1" />

            {/* Logout */}
            <button
              onClick={() => { setOpen(false); signOut(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>

      {showProfile && profile && (
        <ProfileModal profile={profile} onClose={() => setShowProfile(false)} />
      )}
    </>
  );
}
