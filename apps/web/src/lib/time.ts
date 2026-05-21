import type { Artifact, TimeBucket } from "@/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatTimelineDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (d.getTime() === startOfToday.getTime()) {
    return `Today, ${date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  }

  return `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function getBucketFor(iso: string): TimeBucket {
  const date = new Date(iso);
  const now = new Date();
  const msSince = now.getTime() - date.getTime();
  const daysSince = msSince / (1000 * 60 * 60 * 24);

  if (daysSince < 1) return "Today";
  if (daysSince < 7) return "This week";
  if (daysSince < 31) return "This month";
  return "Earlier";
}

const BUCKET_ORDER: TimeBucket[] = ["Today", "This week", "This month", "Earlier"];

export function bucketize(artifacts: Artifact[]): Partial<Record<TimeBucket, Artifact[]>> {
  const result: Partial<Record<TimeBucket, Artifact[]>> = {};
  for (const a of artifacts) {
    const bucket = getBucketFor(a.created_at);
    if (!result[bucket]) result[bucket] = [];
    result[bucket]!.push(a);
  }
  return result;
}

export { BUCKET_ORDER };

export function timeAgo(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatTimelineDate(iso);
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
