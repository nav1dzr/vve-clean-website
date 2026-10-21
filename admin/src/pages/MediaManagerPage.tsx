import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { authFetch } from "../lib/authFetch";

import { uploadMediaFile } from "../lib/mediaUpload";
import { mediaCaptionPresets, type MediaCaptionPreset } from "../lib/mediaCaptionPresets";
import { WEBSITE_PHOTO_PAGE_KEYS } from "../../shared/mediaWebsitePositions.js";

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
const DEFAULT_PHOTOS: Record<string, { src: string; alt: string }> = {
  "homepage-hero-image": { src: "/images/carpet-cleaning-hero.webp", alt: "Carpet extraction in progress" },
  "carpet-main-results": { src: "/images/carpet-cleaning-hero.webp", alt: "Carpet extraction in progress" },
  "sofa-main-results": { src: "/sofa_upholstery/web/gallery/sofa-gallery-01.webp", alt: "Upholstery cleaning in progress" },
  "end-of-tenancy-main-results": { src: "/end_of_tenancy/before-after/kitchen1_after.jpg", alt: "Kitchen hob after cleaning" },
  "homepage-equipment-image": { src: "/gallery/van-equipment.webp", alt: "VVE Clean van and cleaning equipment" },
};
const PAGE_PATHS: Record<string, string> = {
  "homepage-hero-image": "/", "homepage-equipment-image": "/",
  "carpet-main-results": "/carpet-cleaning-london#results",
  "sofa-main-results": "/sofa-cleaning-london",
  "end-of-tenancy-main-results": "/end-of-tenancy-cleaning-london",
  "gallery-carpet": "/gallery?category=carpet",
  "gallery-sofa": "/gallery?category=sofa-upholstery",
  "gallery-end-of-tenancy": "/gallery?category=end-of-tenancy",
};

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

const usesPhotographsOnly = (usages: MediaUsage[]) => usages.some((usage) =>
  WEBSITE_PHOTO_PAGE_KEYS.includes(usage.pageKey),
);

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
  const [positionPage, setPositionPage] = useState("all");
  const [showUnconnected, setShowUnconnected] = useState(false);
  const [library, setLibrary] = useState<MediaLibrary | null>(null);

  const [tab, setTab] = useState("uploads");

  const [topic, setTopic] = useState<MediaCategory>("carpet");

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [busy, setBusy] = useState(false);

  const [files, setFiles] = useState<File[]>([]);

  const [stage, setStage] = useState<BeforeAfter>("none");

  const [progress, setProgress] = useState<Progress | null>(null);

  const [target, setTarget] = useState<Target | null>(null);

  const [selection, setSelection] = useState<MediaAssignment[]>([]);

  const [review, setReview] = useState<Review | null>(null);

  const [history, setHistory] = useState<History[]>([]);

  const [editor, setEditor] = useState<MediaAsset | null>(null);

  const [filter, setFilter] = useState("all");

  const [positionType, setPositionType] = useState<GallerySlot["kind"]>("before_after");

  const fileInput = useRef<HTMLInputElement>(null);
  const editorContainer = useRef<HTMLDivElement>(null);

  const controller = useRef<AbortController | null>(null);

  const libraryRef = useRef<MediaLibrary | null>(null);
  const loadVersion = useRef(0);
  const targetVersion = useRef(0);
  const selectionVersion = useRef(0);

  const inFlight = useRef(false);
  const editing = useRef(false);
  editing.current = Boolean(target || editor);
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
    controller.current?.abort();
    targetVersion.current += 1;
    selectionVersion.current += 1;
  }, []);
  useEffect(() => {
    if (!editor) return;
    editorContainer.current?.querySelector<HTMLHeadingElement>("h2")?.focus({ preventScroll: true });
    editorContainer.current?.scrollIntoView?.({ block: "start" });
  }, [editor]);

  useEffect(() => {
    let running = false;

    const timer = setInterval(async () => {
      if (running || inFlight.current || editing.current || document.hidden)
        return;
      const processing =
        libraryRef.current?.assets.filter(
          (asset) => asset.status === "processing",
        ) || [];

      if (!processing.length) return;

      running = true;

      try {
        const results = await Promise.allSettled(
          processing
            .slice(0, 5)
            .map((asset) =>
              authFetch(`${api}&id=${asset.id}`, {
                method: "POST",
                body: JSON.stringify({ action: "sync" }),
              }),
            ),
        );

        const failure = results.find((result) => result.status === "rejected");

        if (failure?.status === "rejected") setError(explain(failure.reason));

        await load();
      } catch (err) {
        setError(explain(err));
      } finally {
        running = false;
      }
    }, 12_000);

    return () => clearInterval(timer);
  }, [load]);

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
      (slot) =>
        slot.topicKey === (topic === "sofa-upholstery" ? "sofa" : topic),
    ) || [];

  const targetUnavailable = target?.type === "website" && !usesPhotographsOnly(target.usages);

  const visible = (library?.assets || []).filter(
    (asset) =>
      filter === "all" ||
      (filter === "unassigned"
        ? !asset.usages.length && asset.status !== "archived"
        : asset.status === filter),
  );

  async function run(work: () => Promise<void>) {
    if (inFlight.current) return;

    inFlight.current = true;
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
    const key = `${file.name}:${file.size}:${file.lastModified}`;

    const oldId = existing?.id || retryIds.current.get(key);

    if (
      existing &&
      (existing.filename !== file.name ||
        Number(existing.size) !== file.size ||
        existing.contentType !== file.type)
    )
      throw new Error(
        "Select the same original file, name, type and size. Upload a different file as a new item.",
      );

    setProgress({ name: file.name, percent: 0, stage: "Preparing upload" });

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
              contentType: file.type,
              category: topic,
              beforeAfter: stage,
            },
      ),
    });
    retryIds.current.set(key, plan.id);

    controller.current = new AbortController();

    try {
      if (!plan.alreadyStored)
        await uploadMediaFile(
          plan.uploadUrl,
          file,
          (percent) =>
            setProgress({ name: file.name, percent, stage: "Uploading" }),
          controller.current.signal,
        );
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
      await authFetch(`${api}&id=${plan.id}`, {
        method: "POST",
        body: JSON.stringify({ action: "fail" }),
      }).catch(() => undefined);

      throw err;
    } finally {
      controller.current = null;
    }
  }

  async function upload(event: FormEvent) {
    event.preventDefault();

    await run(async () => {
      if (!files.length) throw new Error("Choose a photo or video first.");

      try {
        for (const file of files) {
          await transfer(file);

          setFiles((previous) => previous.filter((item) => item !== file));
        }

        if (fileInput.current) fileInput.current.value = "";

        setNotice(
          "Files stored. Add a caption and description, then choose a position. Videos finish processing automatically while this page is open.",
        );
      } finally {
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
    setHistory([]);
  }

  function chooseTarget(next: Target) {
    const version = ++targetVersion.current;
    selectionVersion.current += 1;
    setTarget(next);
    setSelection(next.assignments.map((assignment) => ({ ...assignment })));
    setReview(null);
    setHistory([]);
    setTab("uploads");

    if (next.category) setTopic(next.category as MediaCategory);

    window.scrollTo({ top: 0, behavior: "smooth" });

    const anchorId = next.assignments[0]?.assetId;

    if (anchorId)
      void authFetch<{ history: History[] }>(`${api}&id=${anchorId}`, {
        method: "POST",
        body: JSON.stringify({
          action: "history",
          targetType: next.type,
          targetId: next.id,
        }),
      })
        .then((result) => {
          if (version === targetVersion.current) setHistory(result.history);
        })
        .catch((err) => {
          if (version === targetVersion.current) setError(explain(err));
        });
  }

  async function preview(historyId?: string) {
    await run(async () => {
      if (!target) return;
      const version = selectionVersion.current;

      const anchor = selection[0]?.assetId || target.assignments[0]?.assetId;

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <p className="text-sm font-semibold text-sky-700">
          Your shared photo and video library
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-navy-950">
          Gallery & website media
        </h1>
        <p className="mt-2 max-w-3xl text-navy-700">
          Add your photos or videos, give them a caption, then choose where
          they appear on the website.
        </p>
        <ol aria-label="How to publish your media" className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["1", "Upload", "Choose a service and cleaning stage, then add your files below."],
            ["2", "Describe", "Open Edit caption & details. Use a suggestion or write your own."],
            ["3", "Preview & publish", "Choose a shared gallery position, review the affected pages, then publish."],
          ].map(([number, title, description]) => (
            <li key={number} className="rounded-xl border border-silver-300 bg-white p-4">
              <p className="flex items-center gap-2 font-semibold text-navy-950">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm text-sky-800">{number}</span>
                {title}
              </p>
              <p className="mt-2 text-sm leading-6 text-navy-700">{description}</p>
            </li>
          ))}
        </ol>
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

      <nav aria-label="Media sections" className="mb-5 flex flex-wrap gap-2">
        {[
          ["uploads", "Upload & library"],
          ["gallery", "Shared gallery positions"],
          ["website", "Other website positions"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-current={tab === key ? "page" : undefined}
            className={tab === key ? primary : button}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <label className="mb-6 block max-w-sm font-semibold text-navy-950">
        Service
        <select
          value={topic}
          onChange={(event) => {
            const category = event.target.value as MediaCategory;
            topicRef.current = category;
            loadVersion.current += 1;
            libraryRef.current = null;
            setLibrary(null);
            setError("");
            setTopic(category);
            setPositionPage("all");
            clearTarget();
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

      {!library ? (
        <p role="status">Loading your media…</p>
      ) : (
        <>
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
                  {[...new Map(gallerySlots.flatMap(slot => slot.usages).map(usage => [usage.pageKey, usage.pageLabel])).entries()].map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <details className="mb-5 rounded-xl border border-silver-300 bg-white p-4">
                <summary className="cursor-pointer font-semibold">How this changes the existing website photos</summary>
                <p className="my-3 text-sm text-navy-700">The first published service result can also supply its opening photo. Sofa and end-of-tenancy opening photos are reused in the homepage carousel. A video is not used as a still hero photo. Built-in gallery items remain separate: these positions add to the gallery, rather than replacing a similarly numbered built-in item.</p>
                <p className="mb-3 text-sm font-semibold">Built-in service opening photo (used when no suitable managed result is available)</p>
                <div className="max-w-sm"><DefaultPhoto usages={[{key:"service-default",pageKey:topic === "carpet" ? "carpet-main-results" : topic === "sofa-upholstery" ? "sofa-main-results" : "end-of-tenancy-main-results",pageLabel:"Service page",componentLabel:"Opening photo"}]} /></div>
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
                {library.websiteSlots.filter(slot => showUnconnected || usesPhotographsOnly(slot.usages)).map((slot) => (
                  <WebsiteCard
                    key={slot.id}
                    slot={slot}
                    asset={byId.get(slot.assignments[0]?.assetId)}
                    onChoose={() =>
                      chooseTarget({
                        type: "website",
                        id: slot.id,
                        label: `${slot.pageLabel} · ${slot.purposeLabel}`,
                        kind: usesPhotographsOnly(slot.usages) ? "photo" : "website",
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
                  <UsageList usages={target.usages} heading={targetUnavailable ? "Planned placement" : "Used on"} />
                  {targetUnavailable && (
                    <div className="mt-4 rounded-xl border border-amber-300 bg-white p-4 text-sm text-navy-800">
                      <p className="font-semibold">This position is not connected to a website page yet.</p>
                      <p className="mt-1">Your saved selection and history are kept here. Choose a shared gallery position to show your work on the website.</p>
                      <button className={`${button} mt-3`} onClick={() => { clearTarget(); setTab("gallery"); }}>Go to shared gallery positions</button>
                    </div>
                  )}
                  {target.assignments.length > 0 && !targetUnavailable && (
                    <p className="mt-4 text-sm leading-6 text-navy-700">To change what appears, replace the selection below or use a previous version when available. Removing a published position without a replacement is not available yet.</p>
                  )}

                  <div className="mt-5 rounded-xl border border-silver-300 bg-white p-4">
                    <h3 className="mb-3 font-semibold">Current published selection</h3>
                    {target.assignments.length ? <div className="grid gap-3 sm:grid-cols-2">{target.assignments.map(assignment => <Preview key={assignment.role} asset={byId.get(assignment.assetId)} label={assignment.role} />)}</div> : target.type === "website" ? <DefaultPhoto usages={target.usages} /> : <p className="text-sm text-navy-700">This is an additional gallery position. Existing built-in gallery photos remain. Publishing may also change the leading service photo; review every connected page below.</p>}
                    <UsageList usages={target.usages} heading="Check these pages" />
                  </div>
                  <h3 className="mt-5 font-semibold">Your proposed replacement or addition</h3>
                  {(target.kind === "before_after"
                    ? ["before", "after"]
                    : ["primary"]
                  ).map((role) => (
                    <label
                      key={role}
                      className="mt-4 block font-semibold capitalize text-navy-950"
                    >
                      {role === "primary"
                        ? target.kind === "photo" ? "Photograph" : "Photo or video"
                        : `${role} photograph`}
                      <select
                        aria-label={role === "primary" ? target.kind === "photo" ? "Photograph" : "Photo or video" : `${role} photograph`}
                        disabled={targetUnavailable}
                        className={field}
                        value={
                          selection.find((item) => item.role === role)
                            ?.assetId || ""
                        }
                        onChange={(event) => {
                          selectionVersion.current += 1;
                          setSelection((previous) => [
                            ...previous.filter((item) => item.role !== role),
                            {
                              role: role as MediaAssignment["role"],
                              assetId: event.target.value,
                            },
                          ]);
                          setReview(null);
                        }}
                      >
                        <option value="">Choose ready media…</option>
                        {allAssets
                          .filter(
                            (asset) =>
                              asset.status === "ready" &&
                              (!target.category ||
                                asset.category === target.category) &&
                              (target.kind === "video"
                                ? asset.mediaType === "video"
                                : target.kind === "website" ||
                                  asset.mediaType === "image") &&
                              (target.kind !== "before_after" ||
                                asset.beforeAfter === role),
                          )
                          .map((asset) => (
                            <option key={asset.id} value={asset.id}>
                              {asset.title || "Add a caption first"} —{" "}
                              {asset.filename}
                            </option>
                          ))}
                      </select>
                      {selection.find((item) => item.role === role)
                        ?.assetId && (
                        <div className="mt-3 max-w-sm">
                          <Preview
                            asset={byId.get(
                              selection.find((item) => item.role === role)
                                ?.assetId || "",
                            )}
                            label={role}
                          />
                        </div>
                      )}
                    </label>
                  ))}

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
                      onClick={clearTarget}
                    >
                      Close position
                    </button>
                  </div>

                  {review && (
                    <div className="mt-5 rounded-xl border border-amber-300 bg-white p-4">
                      <h3 className="font-semibold text-navy-950">
                        Ready to publish this complete position
                      </h3>
                      <UsageList usages={review.impact} />
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
                  Photos up to 40 MB; videos up to 500 MB. Files appear on
                  website pages only after you choose a position and publish. Interrupted files can be retried from
                  the library after refresh.
                </p>
                <label className="mt-4 block font-semibold text-navy-950">
                  Cleaning stage
                  <select
                    className={field}
                    value={stage}
                    onChange={(event) =>
                      setStage(event.target.value as BeforeAfter)
                    }
                  >
                    <option value="none">General work photo / video</option>
                    <option value="before">Before cleaning</option>
                    <option value="after">After cleaning</option>
                    <option value="during">During cleaning</option>
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
                    accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
                    onChange={(event) =>
                      setFiles(Array.from(event.target.files || []))
                    }
                  />
                </label>

                {files.length > 0 && (
                  <p className="mt-2 text-sm">{files.length} files waiting.</p>
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
                      onClick={() => controller.current?.abort()}
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
                  {busy ? "Working…" : "Upload selected files"}
                </button>
              </form>

              {editor && (
                <div ref={editorContainer} className="scroll-mt-6">
                <MetadataEditor
                  asset={editor}
                  busy={busy}
                  onClose={() => setEditor(null)}
                  onSave={(values) =>
                    void run(async () => {
                      await authFetch(`${api}&id=${editor.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({
                          ...values,
                          updatedAt: editor.updatedAt,
                        }),
                      });
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
                  <label className="text-sm font-semibold">
                    Show
                    <select
                      className={field}
                      value={filter}
                      onChange={(event) => setFilter(event.target.value)}
                    >
                      {[
                        "all",
                        "unassigned",
                        "ready",
                        "processing",
                        "failed",
                        "archived",
                      ].map((value) => (
                        <option key={value}>{value}</option>
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
                        <h3 className="font-semibold text-navy-950">
                          {asset.title || "Caption needed"}
                        </h3>
                        <p className="mt-1 break-words text-xs text-navy-700">
                          {asset.filename}
                        </p>
                        <p className="mt-2 text-sm font-semibold">
                          {asset.status}
                          {asset.usages.length
                            ? ` · Used in ${asset.usages.length} places`
                            : " · Unassigned"}
                        </p>
                        {asset.processingError && (
                          <p className="mt-2 text-sm text-red-800">
                            {asset.processingError}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() => setEditor(asset)}
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

function Preview({ asset, label }: { asset?: MediaAsset; label: string }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playing = Boolean(asset?.id && playingId === asset.id);
  const src =
    asset?.imageUrl ||
    (asset?.muxPlaybackId
      ? `https://image.mux.com/${asset.muxPlaybackId}/thumbnail.jpg?time=1&width=480`
      : null);

  return (
    <figure className="relative aspect-video bg-silver-100">
      {playing && asset?.muxPlaybackId ? <iframe className="h-full w-full" src={`https://player.mux.com/${encodeURIComponent(asset.muxPlaybackId)}`} title={`Video preview: ${asset.title || label}`} allow="fullscreen" allowFullScreen /> : src ? (
        <img
          src={src}
          alt={asset?.altText || ""}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full items-center justify-center p-4 text-center text-sm text-navy-700">
          {asset ? asset.status : "No media assigned"}
        </div>
      )}
      {asset?.muxPlaybackId && !playing && <button type="button" className="absolute inset-x-8 top-1/3 rounded-lg bg-white p-3 font-semibold text-navy-950 shadow" onClick={() => setPlayingId(asset.id)}>Play video</button>}
      {!playing && <figcaption className="absolute bottom-2 left-2 rounded bg-navy-950 px-2 py-1 text-xs capitalize text-white">
        {label}
      </figcaption>}
    </figure>
  );
}

function DefaultPhoto({ usages }: { usages: MediaUsage[] }) {
  const photo = usages.map(usage => DEFAULT_PHOTOS[usage.pageKey]).find(Boolean);
  return photo ? <figure className="bg-silver-100 p-3"><img src={`${PUBLIC_SITE}${photo.src}`} alt={photo.alt} className="aspect-video w-full object-contain" /><figcaption className="mt-2 text-sm text-navy-700">Built-in website photo — used when no CRM photo is published. Open the website to check its current appearance.</figcaption></figure> : <p className="p-4 text-sm text-navy-700">No CRM media assigned. Check the linked page for existing built-in content.</p>;
}

function UsageList({ usages, heading = "Used on" }: { usages: MediaUsage[]; heading?: string }) {
  const visibleUsages = [...new Map(usages.map((usage) => [
    JSON.stringify([usage.pageLabel, usage.componentLabel]), usage,
  ])).values()];
  return (
    <div className="mt-3">
      <h3 className="text-sm font-semibold text-navy-950">{heading}</h3>
      {usages.length ? (
        <ul className="mt-1 list-disc pl-5 text-sm text-navy-700">
          {visibleUsages.map((usage) => (
            <li key={usage.key}>
              {usage.pageLabel} · {usage.componentLabel}
              {PAGE_PATHS[usage.pageKey] && <a className="ml-2 inline-block underline" href={`${PUBLIC_SITE}${PAGE_PATHS[usage.pageKey]}`} target="_blank" rel="noopener noreferrer">View on website</a>}
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
  onChoose,
}: {
  slot: WebsiteSlot;
  asset?: MediaAsset;
  onChoose: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-silver-300 bg-white">
      <div className="p-4">
        <p className="text-sm text-sky-700">{slot.pageLabel}</p>
        <h3 className="font-semibold text-navy-950">{slot.purposeLabel}</h3>
      </div>
      {asset ? <Preview asset={asset} label="Current published photo" /> : <DefaultPhoto usages={slot.usages} />}
      <div className="p-4">
        <UsageList usages={slot.usages} heading={usesPhotographsOnly(slot.usages) ? "Used on" : "Planned placement"} />
        {!usesPhotographsOnly(slot.usages) && <p className="mt-3 text-sm font-medium text-amber-900">Not connected to a website page yet. You can view the saved selection, but publishing is unavailable.</p>}
        {usesPhotographsOnly(slot.usages) && <p className="mt-3 text-sm text-navy-700">This position displays photographs only.</p>}
        <button className={`${button} mt-4`} onClick={onChoose}>
          {usesPhotographsOnly(slot.usages) ? "Choose / replace media" : "View position"}
        </button>
      </div>
    </article>
  );
}

function MetadataEditor({
  asset,
  busy,
  onClose,
  onSave,
}: {
  asset: MediaAsset;
  busy: boolean;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState({
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
        Cleaning stage
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
            ["before", "Before cleaning"],
            ["after", "After cleaning"],
            ["during", "During cleaning"],
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
        <button type="button" className={button} onClick={onClose}>
          Close editor
        </button>
      </div>
    </form>
  );
}
