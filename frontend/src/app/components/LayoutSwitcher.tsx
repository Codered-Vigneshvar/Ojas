import { Monitor, Smartphone } from "lucide-react";

export default function LayoutSwitcher({
  isDesktop,
  onToggle
}: {
  isDesktop: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="fixed bottom-6 right-6 bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg hover:opacity-90 transition-opacity flex items-center gap-2 z-50"
    >
      {isDesktop ? (
        <>
          <Smartphone className="w-5 h-5" />
          <span className="text-sm">Switch to Mobile</span>
        </>
      ) : (
        <>
          <Monitor className="w-5 h-5" />
          <span className="text-sm">Switch to Desktop</span>
        </>
      )}
    </button>
  );
}
