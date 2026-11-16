import type { MediaAsset } from "../types/media";

export type MediaStatusTone = "live" | "ready" | "waiting" | "problem" | "muted";

export interface MediaStatusSummary {
  label: string;
  tone: MediaStatusTone;
  help: string;
}

/** One plain-English answer to "is this on the website?" for a library item. */
export function mediaStatusSummary(
  asset: Pick<MediaAsset, "status" | "usages" | "mediaType" | "title" | "altText">,
): MediaStatusSummary {
  const noun = asset.mediaType === "video" ? "video" : "photo";
  if (asset.status === "ready" && asset.usages.length)
    return {
      label: "Live on website",
      tone: "live",
      help: `Visitors can see this ${noun} now.`,
    };
  if (asset.status === "ready")
    return asset.title && asset.altText
      ? {
          label: "Not on website",
          tone: "ready",
          help: "Ready to use. Choose a position to publish it.",
        }
      : {
          label: "Not on website",
          tone: "ready",
          help: "Add a caption and description before it can be published.",
        };
  if (asset.status === "processing")
    return {
      label: "Processing video",
      tone: "waiting",
      help: "Usually a few minutes. Keep this page open; it updates by itself.",
    };
  if (asset.status === "uploading")
    return {
      label: "Upload not finished",
      tone: "problem",
      help: "Choose Retry file and select the same file again.",
    };
  if (asset.status === "failed")
    return {
      label: "Needs attention",
      tone: "problem",
      help: "This did not finish. Use Retry file or Retry processing below.",
    };
  return {
    label: "Archived",
    tone: "muted",
    help: "Hidden from your choices. Restore it to use it again.",
  };
}

export const MEDIA_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "live", label: "Live on website" },
  { value: "unassigned", label: "Not on website" },
  { value: "ready", label: "Ready to use" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Needs attention" },
  { value: "archived", label: "Archived" },
];

export function matchesMediaFilter(asset: MediaAsset, filter: string) {
  if (filter === "all") return true;
  if (filter === "live") return asset.status === "ready" && asset.usages.length > 0;
  if (filter === "unassigned") return !asset.usages.length && asset.status !== "archived";
  if (filter === "failed") return asset.status === "failed" || asset.status === "uploading";
  return asset.status === filter;
}

export function formatMediaDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
