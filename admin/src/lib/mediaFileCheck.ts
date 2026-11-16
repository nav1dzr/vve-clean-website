// Mirrors the server rules in api/_lib/mediaFields.js so the owner is told
// which file is the problem, and why, before any upload record is created.
// The server remains the authority; this only avoids a vague rejection.
const TYPES: Record<string, { kind: "photo" | "video"; extensions: string[] }> = {
  "image/jpeg": { kind: "photo", extensions: ["jpg", "jpeg"] },
  "image/png": { kind: "photo", extensions: ["png"] },
  "image/webp": { kind: "photo", extensions: ["webp"] },
  "image/avif": { kind: "photo", extensions: ["avif"] },
  "image/heic": { kind: "photo", extensions: ["heic"] },
  "image/heif": { kind: "photo", extensions: ["heif"] },
  "video/mp4": { kind: "video", extensions: ["mp4", "m4v"] },
  "video/quicktime": { kind: "video", extensions: ["mov"] },
  "video/webm": { kind: "video", extensions: ["webm"] },
};

export const MAX_PHOTO_BYTES = 40 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const MEDIA_ACCEPT = Object.keys(TYPES).join(",");

export type MediaFileCheck =
  | { ok: true; kind: "photo" | "video"; contentType: string }
  | { ok: false; reason: string };

const extensionOf = (name: string) =>
  name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";

/** Some browsers report no type for HEIC or MOV files; use the extension. */
export function mediaContentType(file: Pick<File, "name" | "type">) {
  const reported = file.type.toLowerCase();
  if (TYPES[reported]) return reported;
  if (reported) return "";
  const extension = extensionOf(file.name);
  return (
    Object.keys(TYPES).find((type) =>
      TYPES[type].extensions.includes(extension),
    ) || ""
  );
}

export function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

export function checkMediaFile(
  file: Pick<File, "name" | "type" | "size">,
): MediaFileCheck {
  const contentType = mediaContentType(file);
  if (!contentType)
    return {
      ok: false,
      reason:
        "This file type is not supported. Use a JPEG, PNG, WebP, AVIF or HEIC photo, or an MP4, MOV or WebM video.",
    };
  const rule = TYPES[contentType];
  if (!rule.extensions.includes(extensionOf(file.name)))
    return {
      ok: false,
      reason: `The file name must end in .${rule.extensions[0]} to match its type. Rename it or export it again.`,
    };
  if (file.name.length > 180)
    return { ok: false, reason: "The file name is too long. Rename it to under 180 characters." };
  if (file.size < 1)
    return { ok: false, reason: "This file is empty. Export it again from your phone or computer." };
  const limit = rule.kind === "photo" ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES;
  if (file.size > limit)
    return {
      ok: false,
      reason: `This ${rule.kind} is ${formatFileSize(file.size)}. The limit is ${formatFileSize(limit)}; export a smaller copy.`,
    };
  return { ok: true, kind: rule.kind, contentType };
}
