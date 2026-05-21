import type { Artifact } from "@/types";
import { bucketize, BUCKET_ORDER } from "@/lib/time";
import ArtifactCard from "./ArtifactCard";

interface Props {
  artifacts: Artifact[];
  onArtifactClick: (artifact: Artifact) => void;
}

export default function ArtifactTimeline({ artifacts, onArtifactClick }: Props) {
  const buckets = bucketize(artifacts);

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-3">
          <span className="text-2xl">📋</span>
        </div>
        <p className="text-sm font-medium text-neutral-700">No artifacts yet</p>
        <p className="text-xs text-neutral-400 mt-1">
          Upload a report, record a consultation, or add a note below
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {BUCKET_ORDER.map((bucket) => {
        const items = buckets[bucket];
        if (!items?.length) return null;
        return (
          <div key={bucket}>
            <p className="text-xs font-mono text-neutral-400 uppercase tracking-wider mb-2 px-1">
              {bucket}
            </p>
            <div className="space-y-2">
              {items.map((a) => (
                <ArtifactCard key={a.id} artifact={a} onClick={onArtifactClick} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
