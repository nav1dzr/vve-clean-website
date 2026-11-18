import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { authFetch } from "../lib/authFetch";
import { useAuth } from "../auth/useAuth";
import BulkMediaEditor from "../components/BulkMediaEditor";
import MediaNavigationGuard from "../components/MediaNavigationGuard";
import { clearMediaDetailsDraft, readMediaDetailsDraft, saveMediaDetailsDraft, type MediaDetails } from "../lib/mediaDraftRecovery";

import { uploadMediaFile } from "../lib/mediaUpload";
import { checkMediaFile, formatFileSize, MEDIA_ACCEPT } from "../lib/mediaFileCheck";
import { formatMediaDate, matchesMediaFilter, MEDIA_FILTERS, mediaStatusSummary } from "../lib/mediaStatus";
import { MediaPreview as Preview, MediaStatusBadge } from "../components/media/MediaPreview";
import MediaThumbnailPicker from "../components/media/MediaThumbnailPicker";
import ReplacementComparison from "../components/media/ReplacementComparison";
import LiveNowPanel from "../components/media/LiveNowPanel";
import { mediaCaptionPresets, type MediaCaptionPreset } from "../lib/mediaCaptionPresets";
import { InventoryMedia } from "../components/media/WebsitePhotoInventory";
import { serviceOpeningPhoto } from "../lib/websiteMediaInventory";
import { findWebsiteMediaPosition } from "../../shared/mediaWebsitePositions.js";

import type {
  BeforeAfter,
  GallerySlot,
  MediaAsset,
  MediaAssignment,
  MediaCategory,
  MediaLibrary,
  MediaUsage,
  WebsiteSlot,
} from "../types/media";

const PUBLIC_SITE = "https://www.vveclean.co.uk";
const PAGE_PATHS: Record<string, string> = {
  "homepage-hero-image": "/", "homepage-equipment-image": "/",
  "carpet-main-results": "/carpet-cleaning-london#results",
  "carpet-process-results": "/how-we-clean-carpets#results",
  "sofa-main-results": "/sofa-cleaning-london",
  "end-of-tenancy-main-results": "/end-of-tenancy-cleaning-london",
  "gallery-carpet": "/gallery?category=carpet",
  "gallery-sofa": "/gallery?category=sofa-upholstery",
  "gallery-end-of-tenancy": "/gallery?category=end-of-tenancy",
};

// Older reference keys remain in publication history. Name them explicitly
// instead of presenting two indistinguishable destinations to the owner.
const POSITION_PAGE_LABELS: Record<string, string> = {
  "carpet-main-results": "Carpet cleaning page",
  "sofa-main-results": "Sofa & upholstery page",
  "end-of-tenancy-main-results": "End of tenancy page",
  "carpet-page": "Carpet — older page reference",
  "sofa-page": "Sofa — older page reference",
  "end-of-tenancy-page": "End of tenancy — older page reference",
};
const positionPageLabel = (usage: MediaUsage) => POSITION_PAGE_LABELS[usage.pageKey] || usage.pageLabel;

const api = "/api/search?resource=media";

const field =
  "mt-1 min-h-11 w-full rounded-lg border border-silver-300 bg-white px-3 py-2 text-base text-navy-950 focus:ring-2 focus:ring-sky-500";

const button =
  "min-h-11 rounded-lg border border-silver-300 bg-white px-4 py-2 text-sm font-semibold text-navy-950 hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50";

const primary = `${button} !bg-navy-950 !text-white`;

const categories: { value: MediaCategory; label: string }[] = [
  { value: "carpet", label: "Carpet" },
  { value: "sofa-upholstery", label: "Sofa & upholstery" },
  { value: "end-of-tenancy", label: "End of tenancy" },
  { value: "property-services", label: "Property services" },
];

const positionTypes: { value: GallerySlot["kind"]; label: string }[] = [
  { value: "before_after", label: "Before / after" },
  { value: "photo", label: "Work photos" },
  { value: "video", label: "Videos" },
];

const explain = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The request could not be completed. Please retry.";

const registeredPosition = (usages: MediaUsage[]) => usages.map(usage => findWebsiteMediaPosition(usage.pageKey)).find(Boolean);
const connectedWebsite = (usages: MediaUsage[]) => registeredPosition(usages)?.targetType === "website";

type Target = {
  type: "gallery" | "website";
  id: string;
  label: string;
  kind: string;
  category?: string;
  assignments: MediaAssignment[];
  usages: MediaUsage[];
};

type Review = {
  expected: MediaAssignment[];
  impact: MediaUsage[];
  selections: MediaAssignment[];
  replacement: boolean;
  assets: MediaAsset[];
};
type History = {
  id: string;
  previous_assignments: MediaAssignment[];
  created_at: string;
};

type Progress = { name: string; percent: number; stage: string };

export default function MediaManagerPage() {
  const { admin } = useAuth();
  return <MediaManagerContent key={admin?.id || 'signed-out'} ownerId={admin?.id || ''} />;
}

function MediaManagerContent({ ownerId }: { ownerId: string }) {
  const [savedDraft, setSavedDraft] = useState(() => readMediaDetailsDraft(ownerId));
  const [positionPage, setPositionPage] = useState("all");
  const [showUnconnected, setShowUnconnected] = useState(false);
  const [library, setLibrary] = useState<MediaLibrary | null>(null);

  const [tab, setTab] = useState("live");
  const [bulkIds, setBulkIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDirty, setBulkDirty] = useState(false);

  const [topic, setTopic] = useState<MediaCategory>("carpet");

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [busy, setBusy] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [rejected, setRejected] = useState<{ name: string; reason: string }[]>([]);
  const [uploadIssues, setUploadIssues] = useState<{ file: File; reason: string }[]>([]);

  const [stage, setStage] = useState<BeforeAfter>("none");

  const [progress, setProgress] = useState<Progress | null>(null);

  const [target, setTarget] = useState<Target | null>(null);

  const [selection, setSelection] = useState<MediaAssignment[]>([]);

  const [review, setReview] = useState<Review | null>(null);

  const [history, setHistory] = useState<History[]>([]);
  const [removal, setRemoval] = useState<{ expected: MediaAssignment[]; impact: MediaUsage[] } | null>(null);

  const [editor, setEditor] = useState<MediaAsset | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);

  const [filter, setFilter] = useState("all");

  const [positionType, setPositionType] = useState<GallerySlot["kind"]>("before_after");

  const fileInput = useRef<HTMLInputElement>(null);
  const editorContainer = useRef<HTMLDivElement>(null);

  const controller = useRef<AbortController | null>(null);
  const cancelRequested = useRef(false);
  const uploadingBatch = useRef(false);

  const libraryRef = useRef<MediaLibrary | null>(null);
  const loadVersion = useRef(0);
  const targetVersion = useRef(0);
  const targetOrigin = useRef("live");
  const selectionVersion = useRef(0);

  const inFlight = useRef(false);
  const retryIds = useRef(new Map<string, string>());

  const topicRef = useRef(topic);

  topicRef.current = topic;

  const load = useCallback(async (more = false) => {
    const page = more ? libraryRef.current?.nextPage : 0;

    if (more && page == null) return;

    const category = topicRef.current;
    const version = ++loadVersion.current;
    let result: MediaLibrary;
    try {
      result = await authFetch<MediaLibrary>(
        `${api}&category=${category}&page=${page || 0}`,
      );
    } catch (err) {
      if (version !== loadVersion.current || category !== topicRef.current) return;
      throw err;
    }
    if (version !== loadVersion.current || category !== topicRef.current) return;

    setLibrary((previous) => {
      const next = {
        ...result,
        assets: more
          ? [
              ...new Map(
                [...(previous?.assets || []), ...result.assets].map((asset) => [
                  asset.id,
                  asset,
                ]),
              ).values(),
            ]
          : result.assets,
      };

      libraryRef.current = next;

      return next;
    });
  }, []);

  useEffect(() => {
    void load().catch((err) => setError(explain(err)));
    return () => { loadVersion.current += 1; };
  }, [load, topic]);

  useEffect(() => () => {
    cancelRequested.current = true;
    controller.current?.abort();
    targetVersion.current += 1;
    selectionVersion.current += 1;
  }, []);
  useEffect(() => {
    if (!editor) return;
    editorContainer.current?.querySelector<HTMLHeadingElement>("h2")?.focus({ preventScroll: true });
    editorContainer.current?.scrollIntoView?.({ block: "start" });
  }, [editor]);


  function leaveEditor(action: () => void) {
    if ((editor && busy) || uploadingBatch.current || controller.current) return;
    if (editorDirty && !window.confirm("Discard your unsaved media details? Choose Cancel to keep editing, or OK to discard them.")) return;
    if (editor) clearMediaDetailsDraft(ownerId, editor.id);
    setSavedDraft(readMediaDetailsDraft(ownerId));
    setEditorDirty(false);
    setEditor(null);
    action();
  }

  useEffect(() => {
    let running = false;
    let active = true;
    let pass = 0;
    const checked = new Map<string, number>();
    const timer = setInterval(async () => {
      if (running || inFlight.current || document.hidden) return;
      const pending = (libraryRef.current?.assets ?? []).filter(asset => asset.mediaType === "video" && asset.status === "processing");
      if (!pending.length) return;
      // Let later uploads progress even if the first few clips take longer.
      const batch = pending.sort((a, b) => (checked.get(a.id) ?? 0) - (checked.get(b.id) ?? 0)).slice(0, 5);
      running = true;
      pass++;
      try {
        const results = await Promise.allSettled(batch.map(async asset => {
          checked.set(asset.id, pass);
          const url = `${api}&id=${asset.id}`;
          const post = (action: string) => authFetch<{ asset?: MediaAsset }>(url, { method: "POST", body: JSON.stringify({ action }) });
          try {
            return (await post("sync")).asset;
          } catch {
            // The provider may have finished via its callback during this check.
            return (await post("details")).asset;
          }
        }));
        if (!active) return;
        const changes = new Map(results.flatMap(result => result.status === "fulfilled" && result.value ? [[result.value.id, result.value] as const] : []));
        if (!changes.size) return;
        setLibrary(previous => {
          if (!previous) return previous;
          // Only merge processing fields. Keep loaded pages, captions and the active selection.
          const assets = previous.assets.map(asset => {
            const update = changes.get(asset.id);
            if (!update || asset.status !== "processing") return asset;
            return { ...asset, status: update.status, processingError: update.processingError, muxPlaybackId: update.muxPlaybackId, updatedAt: update.updatedAt };
          });
          const next = { ...previous, assets };
          libraryRef.current = next;
          return next;
        });
      } finally {
        running = false;
      }
    }, 12_000);
    return () => { active = false; clearInterval(timer); };
  }, [topic]);

  const allAssets = useMemo(
    () => [
      ...new Map(
        [...(library?.assignedAssets || []), ...(library?.assets || [])].map(
          (asset) => [asset.id, asset],
        ),
      ).values(),
    ],
    [library],
  );

  const byId = useMemo(
    () => new Map(allAssets.map((asset) => [asset.id, asset])),
    [allAssets],
  );

  const gallerySlots =
    library?.gallerySlots.filter(
      (slot) => !slot.code.startsWith("BUILTIN_") &&
        slot.topicKey === (topic === "sofa-upholstery" ? "sofa" : topic),
    ) || [];

  const targetUnavailable = target?.type === "website" && !connectedWebsite(target.usages);

  const visible = (library?.assets || []).filter((asset) =>
    matchesMediaFilter(asset, filter),
  );

  async function run(work: () => Promise<void>) {
    if (inFlight.current) return;

    inFlight.current = true;
    cancelRequested.current = false;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await work();
    } catch (err) {
      setError(explain(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function transfer(file: File, existing?: MediaAsset) {
    const key = JSON.stringify([topic, stage, file.name, file.size, file.lastModified]);

    const oldId = existing?.id || retryIds.current.get(key);

    const check = checkMediaFile(file);
    if (!check.ok) throw new Error(`${file.name}: ${check.reason}`);
    const contentType = check.contentType;

    if (
      existing &&
      (existing.filename !== file.name ||
        Number(existing.size) !== file.size ||
        existing.contentType !== contentType)
    )
      throw new Error(
        "Select the same original file, name, type and size. Upload a different file as a new item.",
      );

    setProgress({ name: file.name, percent: 0, stage: "Preparing upload" });

    const control = new AbortController();
    controller.current = control;
    let originalStored = false;
    let plannedId: string | undefined;

    try {
      const plan = await authFetch<{
        id: string;
        uploadUrl: string;
        alreadyStored?: boolean;
      }>(oldId ? `${api}&id=${oldId}` : api, {
        method: "POST",
        body: JSON.stringify(
          oldId
            ? { action: "retry-upload" }
            : {
                filename: file.name,
                size: file.size,
                contentType,
                category: topic,
                beforeAfter: stage,
              },
        ),
      });
      retryIds.current.set(key, plan.id);
      plannedId = plan.id;
      originalStored = Boolean(plan.alreadyStored);
      if (control.signal.aborted) throw new Error("Upload cancelled. This file remains selected for retry.");
      if (!plan.alreadyStored)
        await uploadMediaFile(
          plan.uploadUrl,
          file,
          (percent) =>
            setProgress({ name: file.name, percent, stage: "Uploading" }),
          control.signal,
          contentType,
        );
      originalStored = true;
      setProgress({
        name: file.name,
        percent: 100,
        stage: "Checking the stored original",
      });

      await authFetch(`${api}&id=${plan.id}`, {
        method: "POST",
        body: JSON.stringify({ action: "complete" }),
      });

      retryIds.current.delete(key);
    } catch (err) {
      // Verification may fail after storage accepted the original. Keep its
      // recovery state, and let retry-upload/complete check the same record.
      if (plannedId && !originalStored) await authFetch(`${api}&id=${plannedId}`, {
        method: "POST",
        body: JSON.stringify({ action: "fail" }),
      }).catch(() => undefined);
      if (originalStored && !control.signal.aborted)
        throw new Error(`The transfer finished, but the final check did not complete. ${explain(err)}`);
      throw err;
    } finally {
      controller.current = null;
    }
  }

  async function upload(event: FormEvent) {
    event.preventDefault();

    await run(async () => {
      if (!files.length) throw new Error("Choose a photo or video first.");
      const selected = [...files];
      const issues: { file: File; reason: string }[] = [];
      let stored = 0;
      setUploadIssues([]);
      uploadingBatch.current = true;
      try {
        for (const file of selected) {
          if (cancelRequested.current) break;
          try {
            await transfer(file);
            stored += 1;
            setFiles((previous) => previous.filter((item) => item !== file));
          } catch (err) {
            if (!cancelRequested.current) {
              issues.push({ file, reason: explain(err) });
              setUploadIssues([...issues]);
            }
          }
        }
        const remaining = selected.length - stored;
        if (!remaining) {
          if (fileInput.current) fileInput.current.value = "";
          setRejected([]);
        }
        setNotice(
          `${stored} ${stored === 1 ? "file" : "files"} uploaded and checked. ${cancelRequested.current ? "Upload stopped. " : ""}${remaining ? `${remaining} ${remaining === 1 ? "file remains" : "files remain"} selected; retry when ready. ` : ""}${stored ? "Add captions in the library, then choose a position to publish. Videos may still be processing." : ""}`,
        );
      } finally {
        uploadingBatch.current = false;
        setProgress(null);
        await load();
      }
    });
  }

  function clearTarget() {
    targetVersion.current += 1;
    selectionVersion.current += 1;
    setTarget(null);
    setReview(null);
    setRemoval(null);
    setHistory([]);
  }

  function chooseTarget(next: Target) {
    if (uploadingBatch.current || controller.current) return;
    if (files.length && next.category && next.category !== topic) {
      setError("Finish or remove your queued files in Upload & library before opening a different service.");
      return;
    }
    if (selectionDirty && !window.confirm("Discard this unpublished position selection?")) return;
    const version = ++targetVersion.current;
    selectionVersion.current += 1;
    if (tab !== "uploads") targetOrigin.current = tab;
    setTarget(next);
    setRemoval(null);
    setSelection(next.assignments.map((assignment) => ({ ...assignment })));
    setReview(null);
    setHistory([]);
    setTab("uploads");

    if (next.category) setTopic(next.category as MediaCategory);

    window.scrollTo({ top: 0, behavior: "smooth" });

    const anchorId = next.id;

    void authFetch<{ history: History[] }>(`${api}&id=${anchorId}`, {
        method: "POST",
        body: JSON.stringify({
          action: "history",
          targetType: next.type,
          targetId: next.id,
        }),
      })
        .then((result) => {
          if (version === targetVersion.current) {
            if (Array.isArray(result.history)) setHistory(result.history);
            else setError("Position history could not be loaded. Retry this position before restoring an earlier version.");
          }
        })
        .catch((err) => {
          if (version === targetVersion.current) setError(explain(err));
        });
  }

  async function preview(historyId?: string) {
    await run(async () => {
      if (!target) return;
      const version = selectionVersion.current;

      const anchor = selection[0]?.assetId || target.assignments[0]?.assetId
        || (historyId ? target.id : undefined);

      if (!anchor)
        throw new Error("Choose media for every part of this position.");

      let result: Review;
      try {
        result = await authFetch<Review>(`${api}&id=${anchor}`, {
          method: "POST",
          body: JSON.stringify({
            action: "assign",
            targetType: target.type,
            targetId: target.id,
            assignments: selection,
            historyId,
            preview: true,
          }),
        });
      } catch (err) {
        if (version !== selectionVersion.current) return;
        throw err;
      }
      if (version !== selectionVersion.current) return;
      setLibrary((previous) =>
        previous
          ? {
              ...previous,
              assignedAssets: [
                ...new Map(
                  [...(previous.assignedAssets || []), ...result.assets].map(
                    (asset) => [asset.id, asset],
                  ),
                ).values(),
              ],
            }
          : previous,
      );
      setSelection(result.selections);
      setReview(result);
    });
  }

  async function reviewRemoval() {
    await run(async () => {
      if (!target) return;
      const version = targetVersion.current;
      const result = await authFetch<{ expected: MediaAssignment[]; impact: MediaUsage[] }>(api + '&id=' + target.id, {
        method: 'POST', body: JSON.stringify({ action: 'unpublish', targetType: target.type, targetId: target.id, preview: true }),
      });
      if (version === targetVersion.current) { setReview(null); setRemoval(result); }
    });
  }

  async function removePublication() {
    await run(async () => {
      if (!target || !removal) return;
      await authFetch(api + '&id=' + target.id, {
        method: 'POST', body: JSON.stringify({ action: 'unpublish', targetType: target.type, targetId: target.id,
          expected: removal.expected, confirm: true }),
      });
      clearTarget();
      setNotice("Position removed from publication. Previous media is available in position history.");
      await load();
    });
  }

  async function publish() {
    await run(async () => {
      if (!target || !review) return;
      const version = targetVersion.current;

      await authFetch(`${api}&id=${review.selections[0].assetId}`, {
        method: "POST",
        body: JSON.stringify({
          action: "assign",
          targetType: target.type,
          targetId: target.id,
          assignments: review.selections,
          expected: review.expected,
          confirm: true,
        }),
      });

      if (version === targetVersion.current) clearTarget();
      setNotice(
        `${target.label} published. All listed pages now read the same selection. The previous version remains in position history.`,
      );
      await load();
    });
  }

  function chooseMedia(role: MediaAssignment["role"], assetId: string) {
    selectionVersion.current += 1;
    setSelection((previous) => [
      ...previous.filter((item) => item.role !== role),
      { role, assetId },
    ]);
    setReview(null);
    setRemoval(null);
  }

  // Ready media that fits this position: same service, right file type and,
  // for a pair, the matching before/after stage.
  const choicesFor = (role: string) =>
    target
      ? allAssets.filter(
          (asset) =>
            asset.status === "ready" &&
            (!target.category || asset.category === target.category) &&
            (target.kind === "video"
              ? asset.mediaType === "video"
              : target.kind === "website" || asset.mediaType === "image") &&
            (target.kind !== "before_after" || asset.beforeAfter === role),
        )
      : [];

  const selectionDirty = target !== null && JSON.stringify([...selection].sort((a,b) => a.role.localeCompare(b.role)))
    !== JSON.stringify([...target.assignments].sort((a,b) => a.role.localeCompare(b.role)));
  const unsaved = editorDirty || selectionDirty || files.length > 0 || bulkDirty || removal !== null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <MediaNavigationGuard dirty={unsaved} busy={busy} />
      {bulkOpen && <BulkMediaEditor assets={allAssets.filter((asset) => bulkIds.includes(asset.id))}
        onDirtyChange={setBulkDirty} onBusyChange={setBusy} onClose={() => {
          setBulkOpen(false); setBulkDirty(false); setBulkIds([]);
          void load().catch((err) => setError(explain(err)));
        }} />}
      {savedDraft && !editor && <section className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-navy-900">
        <h2 className="font-semibold">Unsaved media details on this browser</h2>
        <p className="mt-1">Open the saved item to review and restore your wording.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button className={button} disabled={busy} onClick={() => void run(async () => {
            const result = await authFetch<{ asset: MediaAsset }>(api + '&id=' + savedDraft.assetId, {
              method: 'POST', body: JSON.stringify({ action: 'details' }),
            });
            setTab('uploads');
            setEditor(result.asset);
          })}>Review saved details</button>
          <button className={button} disabled={busy} onClick={() => {
            clearMediaDetailsDraft(ownerId, savedDraft.assetId);
            setSavedDraft(null);
          }}>Discard saved details</button>
        </div>
      </section>}
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-navy-950 sm:text-3xl">Photos & videos</h1>
        <p className="mt-2 text-sm text-navy-700">See what is on your website, or add something new.</p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900"
        >
          {error}
          <button className={`${button} ml-3`} onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <p
          role="status"
          className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"
        >
          {notice}
        </p>
      )}

      <nav aria-label="Media sections" className="mb-3 grid max-w-xl grid-cols-2 gap-1 rounded-2xl border border-silver-200 bg-silver-100 p-1">
        {[
          ["live", "Website media"],
          ["uploads", "Upload & library"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-current={tab === key ? "page" : undefined}
            className={`min-h-12 rounded-xl px-3 py-3 text-sm font-semibold leading-5 focus-visible:ring-2 focus-visible:ring-sky-500 ${tab === key ? "bg-white text-navy-950 shadow-sm" : "text-navy-700 hover:bg-white/60"}`}
            onClick={() => { if (key !== tab) leaveEditor(() => setTab(key)); }}
          >
            {label}
          </button>
        ))}
      </nav>

      <details className="mb-6 text-sm text-navy-700" open={tab === "gallery" || tab === "website" ? true : undefined}>
        <summary className="w-fit cursor-pointer rounded py-2 font-medium focus-visible:ring-2 focus-visible:ring-sky-500">More media tools</summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {[["gallery", "Shared gallery positions"], ["website", "Other website positions"]].map(([key, label]) => <button key={key} type="button" aria-current={tab === key ? "page" : undefined} className={tab === key ? primary : button} onClick={() => { if (key !== tab) leaveEditor(() => setTab(key)); }}>{label}</button>)}
        </div>
        <details className="mt-3"><summary className="w-fit cursor-pointer py-1">How publishing works</summary><ol aria-label="How to publish your media" className="mt-2 list-inside list-decimal space-y-1 leading-6"><li>Upload a file to your library.</li><li>Add a caption, using a suggestion or your own words.</li><li>Choose where it goes, preview the change, then publish.</li></ol></details>
      </details>

      <label className={`mb-6 max-w-sm font-semibold text-navy-950 ${tab === "live" ? "hidden" : "block"}`}>
        Service
        <select
          value={topic}
          disabled={busy || files.length > 0}
          title={files.length ? "Finish or remove queued files before changing service." : undefined}
          aria-describedby={files.length ? "queued-service-note" : undefined}
          onChange={(event) => {
            const category = event.target.value as MediaCategory;
            if (selectionDirty && !window.confirm("Discard this unpublished position selection?")) return;
            leaveEditor(() => {
            topicRef.current = category;
            loadVersion.current += 1;
            libraryRef.current = null;
            setLibrary(null);
            setError("");
            setTopic(category);
            setBulkIds([]);
            setPositionPage("all");
            clearTarget();
            });
          }}
          className={field}
        >
          {categories.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {files.length > 0 && <p id="queued-service-note" className={`-mt-4 mb-6 text-xs text-navy-700 ${tab === "live" ? "hidden" : ""}`}>Upload or remove your queued files before changing service.</p>}

      {!library ? (
        <p role="status">Loading your media…</p>
      ) : (
        <>
          {tab === "live" && (
            <LiveNowPanel
              library={library}
              assets={byId}
              isConnected={connectedWebsite}
              renderUsages={(usages) => <UsageList usages={usages} heading="Shown on" />}
              onReplaceGallery={(slot, serviceLabel) =>
                chooseTarget({
                  type: "gallery",
                  id: slot.id,
                  label: `${serviceLabel} · ${slot.label}`,
                  kind: slot.kind,
                  category: slot.topicKey === "sofa" ? "sofa-upholstery" : slot.topicKey,
                  assignments: slot.assignments,
                  usages: slot.usages,
                })
              }
              onReplaceWebsite={(slot) =>
                chooseTarget({
                  type: "website",
                  id: slot.id,
                  label: `${slot.pageLabel} · ${slot.purposeLabel}`,
                  kind: registeredPosition(slot.usages)?.kind ?? "website",
                  category: registeredPosition(slot.usages)?.category,
                  assignments: slot.assignments,
                  usages: slot.usages,
                })
              }
            />
          )}

          {tab === "gallery" && (
            <section>
              <h2 className="text-xl font-semibold text-navy-950">
                Choose a shared position
              </h2>
              <p className="mb-5 mt-2 text-navy-700">
                Choose a page, then a position. New gallery positions add media ahead of the existing website gallery; they do not remove its built-in photos. Replacing an occupied position updates all its connected pages.
              </p>
              <label className="mb-5 block max-w-sm font-semibold">Show positions used on
                <select className={field} value={positionPage} onChange={(e) => setPositionPage(e.target.value)}>
                  <option value="all">All connected pages</option>
                  {[...new Map(gallerySlots.flatMap(slot => slot.usages).map(usage => [usage.pageKey, positionPageLabel(usage)])).entries()].map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <details className="mb-5 rounded-xl border border-silver-300 bg-white p-4">
                <summary className="cursor-pointer font-semibold">How this changes the existing website photos</summary>
                <p className="my-3 text-sm text-navy-700">The first published service result can also supply its opening photo. Sofa and end-of-tenancy opening photos are reused in the homepage carousel. A video is not used as a still hero photo. Built-in gallery items remain separate: these positions add to the gallery, rather than replacing a similarly numbered built-in item.</p>
                <p className="mb-3 text-sm">Use Live on website to find the original for each position.</p>
              </details>
              <div role="group" aria-label="Position type" className="mb-5 flex flex-wrap gap-2">
                {positionTypes.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={positionType === value}
                    className={positionType === value ? primary : button}
                    onClick={() => setPositionType(value)}
                  >
                    {label} ({gallerySlots.filter((slot) => slot.kind === value).length})
                  </button>
                ))}
              </div>
              {!gallerySlots.some((slot) => slot.kind === positionType) && (
                <p className="text-sm text-navy-700">No positions of this type are set up for this service yet.</p>
              )}
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {gallerySlots.filter((slot) => slot.kind === positionType && (positionPage === "all" || slot.usages.some(usage => usage.pageKey === positionPage))).map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    assets={byId}
                    onChoose={() =>
                      chooseTarget({
                        type: "gallery",
                        id: slot.id,
                        label: `${categories.find((c) => c.value === topic)?.label} · ${slot.label}`,
                        kind: slot.kind,
                        category: topic,
                        assignments: slot.assignments,
                        usages: slot.usages,
                      })
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {tab === "website" && (
            <section>
              <h2 className="mb-5 text-xl font-semibold text-navy-950">
                Standalone website positions
              </h2>
              <p className="mb-4 text-navy-700">Compare the current website photo with your replacement. Built-in defaults stay in use until you publish.</p>
              <label className="mb-5 flex items-center gap-2"><input type="checkbox" checked={showUnconnected} onChange={e => setShowUnconnected(e.target.checked)} />Show unconnected positions (not publishable)</label>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {library.websiteSlots.filter(slot => showUnconnected || connectedWebsite(slot.usages)).map((slot) => (
                  <WebsiteCard
                    key={slot.id}
                    slot={slot}
                    asset={byId.get(slot.assignments[0]?.assetId)}
                    library={library} assets={byId}
                    onChoose={() =>
                      chooseTarget({
                        type: "website",
                        id: slot.id,
                        label: `${slot.pageLabel} · ${slot.purposeLabel}`,
                        kind: registeredPosition(slot.usages)?.kind ?? "website",
                        category: registeredPosition(slot.usages)?.category,
                        assignments: slot.assignments,
                        usages: slot.usages,
                      })
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {tab === "uploads" && (
            <div className="space-y-6">
              {target && (
                <section className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-5">
                  <h2 className="text-xl font-semibold text-navy-950">
                    {target.label}
                  </h2>
                  <p className="mt-2 text-navy-800">
                    {target.kind === "before_after"
                      ? "Choose both photographs from the same job. Both change together after publication."
                      : "Choose one ready item, then preview where it will appear."}
                  </p>
                  <details className="mt-3 text-sm text-navy-700"><summary className="w-fit cursor-pointer py-1 font-semibold">Where this is shown</summary><UsageList usages={target.usages} heading={targetUnavailable ? "Planned placement" : "Used on"} /></details>
                  {targetUnavailable && (
                    <div className="mt-4 rounded-xl border border-amber-300 bg-white p-4 text-sm text-navy-800">
                      <p className="font-semibold">This position is not connected to a website page yet.</p>
                      <p className="mt-1">Your saved selection and history are kept here. Choose a shared gallery position to show your work on the website.</p>
                      <button className={`${button} mt-3`} onClick={() => { clearTarget(); setTab("gallery"); }}>Go to shared gallery positions</button>
                    </div>
                  )}
                  {target.assignments.length > 0 && !targetUnavailable && (
                    <div className="mt-4 text-sm leading-6 text-navy-700">
                      <p>Replace the selection below or preview an earlier version from position history.</p>
                      {library?.unpublishEnabled && <button className={button + ' mt-2'} disabled={busy}
                        onClick={() => void reviewRemoval()}>{registeredPosition(target.usages)?.defaultMedia ? "Restore website default" : "Remove this position from the website"}</button>}
                    </div>
                  )}

                  <div className="mt-5 rounded-xl border border-silver-300 bg-white p-4">
                    <h3 className="mb-3 font-semibold">Current published selection</h3>
                    {target.assignments.length ? <div className="grid gap-3 sm:grid-cols-2">{target.assignments.map(assignment => <Preview key={assignment.role} asset={byId.get(assignment.assetId)} label={assignment.role} />)}</div> : target.type === "website" || registeredPosition(target.usages) ? <DefaultPhoto usages={target.usages} library={library} assets={byId} /> : <p className="text-sm text-navy-700">This is an additional gallery position. Existing built-in gallery photos remain. Publishing may also change the leading service photo; review every connected page below.</p>}

                  </div>
                  {removal && <section aria-label="Remove published position" className="mt-4 rounded-xl border border-amber-300 bg-white p-4">
                    <h3 className="font-semibold">Review removal</h3>
                    <UsageList usages={removal.impact} heading="Affected pages" />
                    <p className="mt-2 text-sm leading-6">This CRM position will stop appearing. Pages may use another published result or a built-in photo. Gallery photos supplied with the website remain visible. The files stay in your library, and you can restore the previous selection from history.</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button className={button} disabled={busy} onClick={() => setRemoval(null)}>Keep published</button>
                      <button className={primary} disabled={busy} onClick={() => void removePublication()}>Confirm removal</button>
                    </div>
                  </section>}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-x-3">
                    <h3 className="font-semibold">Choose your replacement</h3>
                    <button type="button" className="min-h-11 text-sm font-semibold text-sky-800 underline underline-offset-4" onClick={() => { fileInput.current?.scrollIntoView?.({ block: "center" }); fileInput.current?.focus({ preventScroll: true }); }}>Upload a new file</button>
                  </div>
                  {(target.kind === "before_after"
                    ? ["before", "after"]
                    : ["primary"]
                  ).map((role) => (
                    <div key={role}>
                    <label
                      className="mt-4 block font-semibold capitalize text-navy-950"
                    >
                      {role === "primary"
                        ? target.kind === "photo" ? "Photograph" : target.kind === "video" ? "Video" : "Photo or video"
                        : `${role} photograph`}
                      <select
                        aria-label={role === "primary" ? target.kind === "photo" ? "Photograph" : target.kind === "video" ? "Video" : "Photo or video" : `${role} photograph`}
                        disabled={targetUnavailable}
                        className={field}
                        value={
                          selection.find((item) => item.role === role)
                            ?.assetId || ""
                        }
                        onChange={(event) => chooseMedia(role as MediaAssignment["role"], event.target.value)}
                      >
                        <option value="">Choose ready media…</option>
                        {choicesFor(role)
                          .map((asset) => (
                            <option key={asset.id} value={asset.id}>
                              {asset.title || "Add a caption first"} —{" "}
                              {asset.filename}
                            </option>
                          ))}
                      </select>
                    </label>
                    <MediaThumbnailPicker
                      label={role === "primary" ? target.kind === "photo" ? "Photograph" : target.kind === "video" ? "Video" : "Photo or video" : `${role} photograph`}
                      assets={choicesFor(role)}
                      selectedId={selection.find((item) => item.role === role)?.assetId || ""}
                      currentId={target.assignments.find((item) => item.role === role)?.assetId}
                      disabled={targetUnavailable}
                      onSelect={(assetId) => chooseMedia(role as MediaAssignment["role"], assetId)}
                    />
                    </div>
                  ))}

                  {library.nextPage != null && <button className={button + " mt-4"} disabled={busy} onClick={() => void run(() => load(true))}>Load more library files</button>}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      disabled={busy || targetUnavailable}
                      className={primary}
                      onClick={() => void preview()}
                    >
                      Preview affected pages
                    </button>
                    <button
                      className={button}
                      onClick={() => {
                        if (!selectionDirty || window.confirm("Discard this unpublished position selection?")) { clearTarget(); setTab(targetOrigin.current); }
                      }}
                    >
                      Close position
                    </button>
                  </div>

                  {review && (
                    <div className="mt-5 rounded-xl border border-amber-300 bg-white p-4">
                      <h3 className="font-semibold text-navy-950">
                        Ready to publish this complete position
                      </h3>
                      <div className="mt-3">
                        <ReplacementComparison
                          current={review.expected}
                          next={review.selections}
                          assets={byId}
                          whenEmpty={target.type === "website" || registeredPosition(target.usages)
                            ? <DefaultPhoto usages={target.usages} library={library} assets={byId} />
                            : "No library media here yet. The built-in gallery photos stay as they are; this is added ahead of them."}
                        />
                      </div>
                      <UsageList usages={review.impact} heading="Pages that will change" />
                      <p className="my-3 text-sm text-navy-700">
                        Previous media stays in your library. Other staff
                        changes are checked before this version is saved.
                      </p>
                      <button
                        disabled={busy || targetUnavailable}
                        className={primary}
                        onClick={() => void publish()}
                      >
                        {busy ? "Publishing…" : "Publish to these pages"}
                      </button>
                    </div>
                  )}

                  {history.some((item) => item.previous_assignments.length) && (
                    <details className="mt-5">
                      <summary className="cursor-pointer font-semibold text-navy-950">
                        Previous versions
                      </summary>
                      <ul className="mt-3 space-y-2">
                        {history
                          .filter((item) => item.previous_assignments.length)
                          .map((item) => (
                            <li key={item.id}>
                              <button
                                className={button}
                                disabled={busy || targetUnavailable}
                                onClick={() => void preview(item.id)}
                              >
                                Preview version before{" "}
                                {new Date(item.created_at).toLocaleString(
                                  "en-GB",
                                )}
                              </button>
                            </li>
                          ))}
                      </ul>
                    </details>
                  )}
                </section>
              )}

              <form
                onSubmit={(event) => void upload(event)}
                className="rounded-2xl border border-silver-300 bg-white p-5"
              >
                <h2 className="text-xl font-semibold text-navy-950">
                  Upload to{" "}
                  {categories.find((item) => item.value === topic)?.label}
                </h2>
                <p className="mt-2 text-sm text-navy-700">
                  Photos up to 20 MB; videos up to 500 MB. Files appear on
                  website pages only after you choose a position and publish. Interrupted files can be retried from
                  the library after refresh.
                </p>
                <p className="mt-2 text-sm text-navy-700">
                  On a phone, keep this page open until the upload and final check finish.
                  If a cloud-library file cannot be read, download it to your device before trying again.
                </p>
                <p className="mt-2 text-sm text-navy-700">
                  Use this library for photos and videos you have permission to share publicly.
                  Unpublished files can still be opened by someone with their media link.
                  Keep private customer evidence in Completion reports.
                </p>
                <label className="mt-4 block font-semibold text-navy-950">
                  {topic === "property-services" ? "Work stage" : "Cleaning stage"}
                  <select
                    className={field}
                    value={stage}
                    disabled={busy}
                    onChange={(event) =>
                      setStage(event.target.value as BeforeAfter)
                    }
                  >
                    <option value="none">General work photo / video</option>
                    <option value="before">Before {topic === "property-services" ? "work" : "cleaning"}</option>
                    <option value="after">After {topic === "property-services" ? "work" : "cleaning"}</option>
                    <option value="during">During {topic === "property-services" ? "work" : "cleaning"}</option>
                  </select>
                </label>
                <label className="mt-4 block font-semibold text-navy-950">
                  Photos or videos
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    disabled={busy}
                    className={field}
                    accept={MEDIA_ACCEPT}
                    onChange={(event) => {
                      const chosen = Array.from(event.target.files || []);
                      const valid = chosen.filter((file) => checkMediaFile(file).ok);
                      setFiles((previous) => {
                        const queued = new Map(previous.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]));
                        for (const file of valid) {
                          const key = `${file.name}:${file.size}:${file.lastModified}`;
                          // Keep the original File object so its retry message
                          // and saved upload ID still refer to the same entry.
                          if (!queued.has(key)) queued.set(key, file);
                        }
                        return [...queued.values()];
                      });
                      setRejected(chosen.flatMap((file) => {
                        const check = checkMediaFile(file);
                        return check.ok ? [] : [{ name: file.name, reason: check.reason }];
                      }));
                    }}
                  />
                </label>

                {files.length > 0 && (
                  <div className="mt-3 text-sm">
                    <p className="font-semibold text-navy-950">
                      {files.length === 1 ? "1 file ready to upload" : `${files.length} files ready to upload`}
                    </p>
                    <p className="mt-1 text-navy-700">Choose more files to add to this queue.</p>
                    <ul aria-label="Files ready to upload" className="mt-1 list-disc pl-5 text-navy-700">
                      {files.map((file) => {
                        const check = checkMediaFile(file);
                        return (
                          <li key={`${file.name}:${file.size}:${file.lastModified}`} className="break-words">
                            {file.name} — {check.ok ? check.kind : "file"}, {formatFileSize(file.size)}
                            <button
                              type="button"
                              disabled={busy}
                              className="ml-2 rounded px-2 py-1 font-semibold text-navy-900 underline disabled:opacity-50"
                              aria-label={`Remove ${file.name} from upload queue`}
                              onClick={() => {
                                setFiles((previous) => previous.filter((item) => item !== file));
                                setUploadIssues((previous) => previous.filter((item) => item.file !== file));
                                if (fileInput.current) fileInput.current.value = "";
                              }}
                            >
                              Remove
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {rejected.length > 0 && (
                  <div role="alert" aria-label="Files that cannot be uploaded" className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                    <p className="font-semibold">
                      {rejected.length === 1 ? "1 file cannot be uploaded" : `${rejected.length} files cannot be uploaded`}
                    </p>
                    <ul className="mt-1 list-disc pl-5">
                      {rejected.map((item) => (
                        <li key={item.name} className="break-words">
                          <span className="font-semibold">{item.name}:</span> {item.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {uploadIssues.length > 0 && (
                  <div role="alert" aria-label="Files to retry" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-navy-950">
                    <p className="font-semibold">Some files need another try</p>
                    <p className="mt-1">Other files continued uploading. Only the remaining files will be retried.</p>
                    <ul className="mt-2 space-y-2">
                      {uploadIssues.map(({ file, reason }) => (
                        <li key={`${file.name}:${file.size}:${file.lastModified}`} className="break-words">
                          <span className="font-semibold">{file.name}:</span> {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {progress && (
                  <div role="status" className="mt-4">
                    <p className="text-sm">
                      {progress.name}: {progress.stage} — {progress.percent}%
                    </p>
                    <progress
                      className="mt-2 h-3 w-full"
                      value={progress.percent}
                      max={100}
                      aria-label="Upload progress"
                    />
                    <button
                      type="button"
                      className={button}
                      onClick={() => {
                        cancelRequested.current = true;
                        controller.current?.abort();
                      }}
                    >
                      Cancel transfer
                    </button>
                  </div>
                )}

                <button
                  disabled={busy || !files.length}
                  className={`${primary} mt-4`}
                  type="submit"
                >
                  {busy ? "Working…" : uploadIssues.length ? "Retry remaining files" : "Upload selected files"}
                </button>
              </form>

              {editor && (
                <div ref={editorContainer} className="scroll-mt-6">
                <MetadataEditor
                  key={editor.id}
                  asset={editor}
                  ownerId={ownerId}
                  busy={busy}
                  onDirtyChange={setEditorDirty}
                  onClose={() => leaveEditor(() => {})}
                  onSave={(values) =>
                    void run(async () => {
                      await authFetch(`${api}&id=${editor.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({
                          ...values,
                          updatedAt: editor.updatedAt,
                        }),
                      });
                      clearMediaDetailsDraft(ownerId, editor.id);
                      setSavedDraft(null);
                      setEditorDirty(false);
                      setEditor(null);
                      setNotice("Caption and details saved.");
                      await load();
                    })
                  }
                />
                </div>
              )}

              <section>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                  <h2 className="text-xl font-semibold text-navy-950">
                    Your media library
                  </h2>
                  <button className={button} disabled={busy || !bulkIds.length} onClick={() => leaveEditor(() => setBulkOpen(true))}>
                    Edit selected details ({bulkIds.length}/10)
                  </button>
                  <label className="text-sm font-semibold">
                    Show
                    <select
                      className={field}
                      value={filter}
                      onChange={(event) => setFilter(event.target.value)}
                    >
                      {MEDIA_FILTERS.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visible.map((asset) => (
                    <article
                      key={asset.id}
                      className="overflow-hidden rounded-xl border border-silver-300 bg-white"
                    >
                      <Preview
                        asset={asset}
                        label={
                          asset.beforeAfter === "none"
                            ? asset.mediaType
                            : asset.beforeAfter
                        }
                      />
                      <div className="p-4">
                        {asset.status === "ready" && <label className="mb-3 flex min-h-11 items-center gap-2 text-sm font-semibold">
                          <input type="checkbox" checked={bulkIds.includes(asset.id)}
                            disabled={busy || (!bulkIds.includes(asset.id) && bulkIds.length >= 10)}
                            onChange={(event) => setBulkIds((current) => event.target.checked
                              ? [...current, asset.id] : current.filter((id) => id !== asset.id))} />
                          Select {asset.filename} for editing
                        </label>}
                        <h3 className="font-semibold text-navy-950">
                          {asset.title || "Caption needed"}
                        </h3>
                        <p className="mt-1 break-words text-xs text-navy-700">
                          {asset.filename}
                        </p>
                        <p className="mt-1 text-xs text-navy-700">
                          Uploaded {formatMediaDate(asset.createdAt)} · {formatFileSize(Number(asset.size))}
                        </p>
                        <p className="mt-2"><MediaStatusBadge asset={asset} /></p>
                        <p className="mt-1 text-sm text-navy-700">{mediaStatusSummary(asset).help}</p>
                        {asset.usages.length > 0 && <UsageList usages={asset.usages} heading="Shown on" />}
                        {asset.processingError && (
                          <p className="mt-2 text-sm text-red-800">
                            {asset.processingError}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() => { if (asset.id !== editor?.id) leaveEditor(() => setEditor(asset)); }}
                          >
                            Edit caption & details
                          </button>
                          {["uploading", "failed"].includes(asset.status) && (
                            <>
                              <label className={`${button} cursor-pointer`}>
                                Retry file
                                <input
                                  type="file"
                                  className="sr-only"
                                  accept={MEDIA_ACCEPT}
                                  disabled={busy}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file)
                                      void run(async () => {
                                        try {
                                          await transfer(file, asset);
                                        } finally {
                                          setProgress(null);
                                          await load();
                                        }
                                      });
                                  }}
                                />
                              </label>
                              <button
                                className={button}
                                disabled={busy}
                                onClick={() =>
                                  void run(async () => {
                                    await authFetch(`${api}&id=${asset.id}`, {
                                      method: "POST",
                                      body: JSON.stringify({
                                        action: "complete",
                                      }),
                                    });
                                    await load();
                                  })
                                }
                              >
                                Retry processing
                              </button>
                            </>
                          )}
                          {asset.status === "processing" && (
                            <button
                              className={button}
                              disabled={busy}
                              onClick={() => void run(async () => {
                                const result = await authFetch<{ status?: string; message?: string }>(`${api}&id=${asset.id}`, {
                                  method: "POST",
                                  body: JSON.stringify({ action: "sync" }),
                                });
                                await load();
                                setNotice(result.message || (result.status === "ready"
                                  ? "Your video is ready. You can now choose a position."
                                  : "Processing checked. This does not upload your file again. If it still needs attention, check the message on the video."));
                              })}
                            >
                              Check processing
                            </button>
                          )}
                          {["ready", "archived"].includes(asset.status) &&
                            !asset.usages.length && (
                              <button
                                disabled={busy}
                                className={button}
                                onClick={() =>
                                  void run(async () => {
                                    await authFetch(`${api}&id=${asset.id}`, {
                                      method: "POST",
                                      body: JSON.stringify({
                                        action:
                                          asset.status === "archived"
                                            ? "restore"
                                            : "archive",
                                      }),
                                    });
                                    await load();
                                    setNotice(asset.status === "archived"
                                      ? "Media restored. It is ready to use again."
                                      : "Media archived. You can restore it from the Archived filter.");
                                  })
                                }
                              >
                                {asset.status === "archived"
                                  ? "Restore"
                                  : "Archive unused item"}
                              </button>
                            )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {!visible.length && (
                  <p className="mt-4 text-navy-700">
                    No matching media in these loaded items.
                  </p>
                )}
                {library.nextPage != null && (
                  <button
                    className={`${button} mt-5`}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await load(true);
                      })
                    }
                  >
                    Load 30 more items
                  </button>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DefaultPhoto({ usages, library, assets }: { usages: MediaUsage[]; library?: MediaLibrary; assets?: Map<string, MediaAsset> }) {
  const position = registeredPosition(usages);
  const inherited = position?.fallbackService && library && assets ? serviceOpeningPhoto(library, assets, position.fallbackService) : null;
  const item = inherited || position?.defaultMedia;
  if (!item) return <p className="p-4 text-sm text-navy-700">{position ? "This position is waiting for its first upload." : "No CRM media assigned."}</p>;
  return <div className="max-w-sm overflow-hidden rounded-lg bg-silver-100 p-3"><InventoryMedia item={item} /><p className="mt-2 text-sm text-navy-700">{inherited ? "From the first published service result." : "Original website media."}</p></div>;
}

function UsageList({ usages, heading = "Used on" }: { usages: MediaUsage[]; heading?: string }) {
  const destinations = usages.flatMap(usage => {
    const entry = findWebsiteMediaPosition(usage.pageKey);
    return entry ? entry.pages : [{ path: PAGE_PATHS[usage.pageKey], label: positionPageLabel(usage), section: usage.componentLabel }];
  });
  const visibleUsages = [...new Map(destinations.map(page => [JSON.stringify(page), page])).values()];
  return (
    <div className="mt-3">
      <h3 className="text-sm font-semibold text-navy-950">{heading}</h3>
      {usages.length ? (
        <ul className="mt-1 list-disc pl-5 text-sm text-navy-700">
          {visibleUsages.map((page) => (
            <li key={JSON.stringify(page)}>
              {page.label} · {page.section}
              {page.path && <a className="ml-2 inline-block underline" href={`${PUBLIC_SITE}${page.path}`} target="_blank" rel="noopener noreferrer">View on website</a>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-navy-700">No public placement yet.</p>
      )}
    </div>
  );
}

function SlotCard({
  slot,
  assets,
  onChoose,
}: {
  slot: GallerySlot;
  assets: Map<string, MediaAsset>;
  onChoose: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-silver-300 bg-white">
      <div className="p-4">
        <h3 className="font-semibold text-navy-950">{slot.label}</h3>
        <p className="text-xs text-navy-700">{slot.code} · {slot.assignments.length ? "Replace published media" : "Add to gallery"}</p>
        <p className={`mt-2 text-xs font-semibold ${slot.assignments.length ? "text-emerald-800" : "text-navy-700"}`}>
          {slot.assignments.length
            ? `● Live on website${formatMediaDate(slot.publishedAt) ? ` since ${formatMediaDate(slot.publishedAt)}` : ""}`
            : "○ Empty — nothing from your library is shown here"}
        </p>
      </div>
      <div
        className={slot.kind === "before_after" ? "grid grid-cols-2" : "block"}
      >
        {(slot.kind === "before_after" ? ["before", "after"] : ["primary"]).map(
          (role) => (
            <Preview
              key={role}
              label={role === "primary" ? slot.kind : role}
              asset={assets.get(
                slot.assignments.find((row) => row.role === role)?.assetId ||
                  "",
              )}
            />
          ),
        )}
      </div>
      <div className="p-4">
        <p className="text-sm text-navy-700">{slot.assignments.length ? "Replacing this selection updates every connected page." : "Additional position: existing built-in gallery photos stay on the website."}</p>
        <UsageList usages={slot.usages} />
        <button className={`${button} mt-4`} onClick={onChoose}>
          {slot.kind === "before_after"
            ? "Choose / replace complete pair"
            : "Choose / replace media"}
        </button>
      </div>
    </article>
  );
}

function WebsiteCard({
  slot,
  asset,
  library,
  assets,
  onChoose,
}: {
  slot: WebsiteSlot;
  asset?: MediaAsset;
  library: MediaLibrary;
  assets: Map<string, MediaAsset>;
  onChoose: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-silver-300 bg-white">
      <div className="p-4">
        <p className="text-sm text-sky-700">{slot.pageLabel}</p>
        <h3 className="font-semibold text-navy-950">{slot.purposeLabel}</h3>
      </div>
      {asset ? <Preview asset={asset} label="Current selection" /> : <DefaultPhoto usages={slot.usages} library={library} assets={assets} />}
      <div className="p-4">
        <UsageList usages={slot.usages} heading={connectedWebsite(slot.usages) ? "Used on" : "Planned placement"} />
        {!connectedWebsite(slot.usages) && <p className="mt-3 text-sm font-medium text-amber-900">Not connected to a website page yet. You can view the saved selection, but publishing is unavailable.</p>}
        {connectedWebsite(slot.usages) && <p className="mt-3 text-sm text-navy-700">{registeredPosition(slot.usages)?.kind === "video" ? "Choose a video for this position." : "This position displays photographs only."}</p>}
        <button className={`${button} mt-4`} onClick={onChoose}>
          {connectedWebsite(slot.usages) ? "Choose / replace media" : "View position"}
        </button>
      </div>
    </article>
  );
}

function MetadataEditor({
  asset,
  ownerId,
  busy,
  onClose,
  onSave,
  onDirtyChange,
}: {
  asset: MediaAsset;
  ownerId: string;
  busy: boolean;
  onClose: () => void;
  onSave: (values: MediaDetails) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [recovery, setRecovery] = useState(() => {
    const draft = readMediaDetailsDraft(ownerId);
    return draft?.assetId === asset.id ? draft : null;
  });
  const [storageFailed, setStorageFailed] = useState(false);
  const [values, setValues] = useState<MediaDetails>({
    title: asset.title,
    altText: asset.altText,
    category: asset.category,
    beforeAfter: asset.beforeAfter,
    locationLabel: asset.locationLabel,
    pairKey: asset.pairKey,
  });
  const [presetId, setPresetId] = useState<MediaCaptionPreset["id"]>("simple");
  const [replacement, setReplacement] = useState<MediaCaptionPreset | null>(null);
  const [captionNotice, setCaptionNotice] = useState("");
  const suggestions = mediaCaptionPresets(values.category, values.beforeAfter, asset.mediaType);
  const suggestion = suggestions.find((item) => item.id === presetId) || suggestions[0];
  const dirty = Object.entries(values).some(([key, value]) => value !== asset[key as keyof typeof values]);
  useEffect(() => {
    onDirtyChange(dirty);
    if (dirty) setStorageFailed(!saveMediaDetailsDraft(ownerId, { assetId: asset.id, baseVersion: asset.updatedAt, values }));
  }, [dirty, onDirtyChange, ownerId, asset.id, asset.updatedAt, values]);

  useEffect(() => {
    setValues({
      title: asset.title,
      altText: asset.altText,
      category: asset.category,
      beforeAfter: asset.beforeAfter,
      locationLabel: asset.locationLabel,
      pairKey: asset.pairKey,
    });
    setPresetId("simple");
    setReplacement(null);
    setCaptionNotice("");
  }, [asset]);

  function applySuggestion(preset: MediaCaptionPreset) {
    setValues((previous) => ({ ...previous, title: preset.title, altText: preset.altText }));
    setReplacement(null);
    setCaptionNotice("Suggested wording added. You can edit it before saving.");
  }

  return (
    <form
      aria-label="Media caption and details"
      className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(values);
      }}
    >
      <h2 tabIndex={-1} className="text-xl font-semibold text-navy-950">
        Describe this media
      </h2>
      {recovery && <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
        <p>{recovery.baseVersion === asset.updatedAt
          ? 'Your unsaved wording is available to restore.'
          : 'This media changed since your draft. Restore your wording for review and compare it with the current media before saving.'}</p>
        <button type="button" className={button + ' mt-2'} disabled={busy} onClick={() => {
          setValues(recovery.values); setRecovery(null);
        }}>Restore wording for review</button>
        <button type="button" className={button + ' ml-2 mt-2'} disabled={busy} onClick={() => {
          clearMediaDetailsDraft(ownerId, asset.id); setRecovery(null);
        }}>Keep current details</button>
      </div>}
      {storageFailed && <p role="alert" className="mt-3 text-sm text-amber-950">This browser could not keep a recovery copy. Save your details before leaving.</p>}
      <p className="mt-2 text-sm text-navy-700">
        Describe only what the media shows. Add an area only when known and
        approved for publication. Caption edits update its published uses.
      </p>
      <div className="mt-4 max-w-sm overflow-hidden rounded-xl">
        <Preview asset={asset} label={asset.mediaType === "video" ? "Your video" : "Your photo"} />
      </div>
      <label className="mt-3 block font-semibold text-navy-950">
        Service
        <select
          className={field}
          value={values.category}
          onChange={(event) => {
            setValues((previous) => ({
              ...previous,
              category: event.target.value as MediaCategory,
            }));
            setReplacement(null);
            setCaptionNotice("");
          }}
        >
          {categories.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block font-semibold text-navy-950">
        {values.category === "property-services" ? "Work stage" : "Cleaning stage"}
        <select
          className={field}
          value={values.beforeAfter}
          onChange={(event) => {
            setValues((previous) => ({
              ...previous,
              beforeAfter: event.target.value as BeforeAfter,
            }));
            setReplacement(null);
            setCaptionNotice("");
          }}
        >
          {[
            ["none", "General work photo / video"],
            ["before", `Before ${values.category === "property-services" ? "work" : "cleaning"}`],
            ["after", `After ${values.category === "property-services" ? "work" : "cleaning"}`],
            ["during", `During ${values.category === "property-services" ? "work" : "cleaning"}`],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <section aria-label="Suggested wording" className="mt-5 rounded-xl border border-sky-200 bg-white p-4">
        <h3 className="font-semibold text-navy-950">Start with a suggestion</h3>
        <p className="mt-1 text-sm leading-6 text-navy-700">
          These use your chosen service, stage and file type. Check they match
          this media, then add your own detail if you want. You can also write
          directly in the fields below.
        </p>
        <label className="mt-3 block text-sm font-semibold text-navy-950">
          Wording style
          <select className={field} value={presetId} onChange={(event) => {
            setPresetId(event.target.value as MediaCaptionPreset["id"]);
            setReplacement(null);
            setCaptionNotice("");
          }}>
            {suggestions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <div className="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-navy-800">
          <p className="font-semibold">{suggestion.title}</p>
          <p className="mt-1">{suggestion.altText}</p>
        </div>
        <button type="button" disabled={busy} className={`${button} mt-3`} onClick={() => {
          if (values.title.trim() || values.altText.trim()) setReplacement(suggestion);
          else applySuggestion(suggestion);
        }}>
          Use this wording
        </button>
        {replacement && (
          <div role="group" aria-label="Replace your current wording" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm text-navy-950">You already have a caption or description. Replace both with this suggestion, or keep your wording.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} className={button} onClick={() => { setReplacement(null); setCaptionNotice("Your wording has been kept."); }}>Keep my wording</button>
              <button type="button" disabled={busy} className={button} onClick={() => applySuggestion(replacement)}>Replace title & description</button>
            </div>
          </div>
        )}
        {captionNotice && <p role="status" className="mt-3 text-sm text-navy-700">{captionNotice}</p>}
      </section>
      <label className="mt-4 block font-semibold text-navy-950">
        Title shown on the website
        <input className={field} required maxLength={120} value={values.title} onChange={(event) => {
          setValues((previous) => ({ ...previous, title: event.target.value }));
          setReplacement(null);
          setCaptionNotice("");
        }} />
      </label>
      <label className="mt-3 block font-semibold text-navy-950">
        Photo or video description
        <textarea className={`${field} min-h-24`} required maxLength={300} value={values.altText} onChange={(event) => {
          setValues((previous) => ({ ...previous, altText: event.target.value }));
          setReplacement(null);
          setCaptionNotice("");
        }} />
        <span className="mt-1 block text-sm font-normal text-navy-700">Describes the photo or video for people using screen readers. Add any visible details you want to include.</span>
      </label>
      <details className="mt-4">
        <summary className="cursor-pointer font-semibold text-navy-950">More details (optional)</summary>
        {[
          ["locationLabel", "Known area (optional)", 100],
          ["pairKey", "Job / pair name (optional)", 64],
        ].map(([key, label, max]) => (
          <label key={key} className="mt-3 block font-semibold text-navy-950">
            {label}
            <input className={field} maxLength={Number(max)} value={values[key as keyof typeof values]} onChange={(event) =>
              setValues((previous) => ({ ...previous, [key]: event.target.value }))
            } />
          </label>
        ))}
      </details>
      <div className="mt-4 flex gap-3">
        <button disabled={busy} className={primary}>
          Save details
        </button>
        <button type="button" disabled={busy} className={button} onClick={onClose}>
          Close editor
        </button>
      </div>
    </form>
  );
}
