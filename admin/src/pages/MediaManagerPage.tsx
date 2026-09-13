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

const explain = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The request could not be completed. Please retry.";

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
  const [library, setLibrary] = useState<MediaLibrary | null>(null);

  const [tab, setTab] = useState("gallery");

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

  const fileInput = useRef<HTMLInputElement>(null);

  const controller = useRef<AbortController | null>(null);

  const libraryRef = useRef<MediaLibrary | null>(null);

  const inFlight = useRef(false);
  const editing = useRef(false);
  editing.current = Boolean(target || editor);
  const retryIds = useRef(new Map<string, string>());

  const topicRef = useRef(topic);

  topicRef.current = topic;

  const load = useCallback(async (more = false) => {
    const page = more ? libraryRef.current?.nextPage : 0;

    if (more && page == null) return;

    const result = await authFetch<MediaLibrary>(
      `${api}&category=${topicRef.current}&page=${page || 0}`,
    );

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
  }, [load, topic]);

  useEffect(() => () => controller.current?.abort(), []);

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

  function chooseTarget(next: Target) {
    setTarget(next);
    setSelection([]);
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
        .then((result) => setHistory(result.history))
        .catch((err) => setError(explain(err)));
  }

  async function preview(historyId?: string) {
    await run(async () => {
      if (!target) return;

      const anchor = selection[0]?.assetId || target.assignments[0]?.assetId;

      if (!anchor)
        throw new Error("Choose media for every part of this position.");

      const result = await authFetch<Review>(`${api}&id=${anchor}`, {
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

      setTarget(null);
      setReview(null);
      setNotice(
        "Position published. All listed pages now read the same selection. The previous version remains in position history.",
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
          Upload once. Choose a service and position. Preview the affected
          pages, then publish one update everywhere.
        </p>
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
          ["gallery", "Shared gallery positions"],
          ["website", "Other website positions"],
          ["uploads", "Upload & library"],
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
            setTopic(event.target.value as MediaCategory);
            setTarget(null);
            setReview(null);
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
                Five complete comparison sets, four videos and twenty work
                photos per service. Positions 1–3 also feed the service page
                where shown below.
              </p>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {gallerySlots.map((slot) => (
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
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {library.websiteSlots.map((slot) => (
                  <WebsiteCard
                    key={slot.id}
                    slot={slot}
                    asset={byId.get(slot.assignments[0]?.assetId)}
                    onChoose={() =>
                      chooseTarget({
                        type: "website",
                        id: slot.id,
                        label: `${slot.pageLabel} · ${slot.purposeLabel}`,
                        kind: "website",
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
                  <UsageList usages={target.usages} />

                  {(target.kind === "before_after"
                    ? ["before", "after"]
                    : ["primary"]
                  ).map((role) => (
                    <label
                      key={role}
                      className="mt-4 block font-semibold capitalize text-navy-950"
                    >
                      {role === "primary"
                        ? "Photo or video"
                        : `${role} photograph`}
                      <select
                        className={field}
                        value={
                          selection.find((item) => item.role === role)
                            ?.assetId || ""
                        }
                        onChange={(event) => {
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
                      disabled={busy}
                      className={primary}
                      onClick={() => void preview()}
                    >
                      Preview affected pages
                    </button>
                    <button
                      className={button}
                      onClick={() => {
                        setTarget(null);
                        setReview(null);
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
                      <UsageList usages={review.impact} />
                      <p className="my-3 text-sm text-navy-700">
                        Previous media stays in your library. Other staff
                        changes are checked before this version is saved.
                      </p>
                      <button
                        disabled={busy}
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
                                disabled={busy}
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
                  Photos up to 40 MB; videos up to 500 MB. Uploads remain
                  private until assigned. Interrupted files can be retried from
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
  const src =
    asset?.imageUrl ||
    (asset?.muxPlaybackId
      ? `https://image.mux.com/${asset.muxPlaybackId}/thumbnail.jpg?time=1&width=480`
      : null);

  return (
    <figure className="relative aspect-video bg-silver-100">
      {src ? (
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
      <figcaption className="absolute bottom-2 left-2 rounded bg-navy-950 px-2 py-1 text-xs capitalize text-white">
        {label}
      </figcaption>
    </figure>
  );
}

function UsageList({ usages }: { usages: MediaUsage[] }) {
  return (
    <div className="mt-3">
      <h3 className="text-sm font-semibold text-navy-950">Used on</h3>
      {usages.length ? (
        <ul className="mt-1 list-disc pl-5 text-sm text-navy-700">
          {usages.map((usage) => (
            <li key={usage.key}>
              {usage.pageLabel} · {usage.componentLabel}
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
        <p className="text-xs text-navy-700">{slot.code}</p>
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
      <Preview asset={asset} label={slot.purposeLabel} />
      <div className="p-4">
        <UsageList usages={slot.usages} />
        <button className={`${button} mt-4`} onClick={onChoose}>
          Choose / replace media
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

  useEffect(
    () =>
      setValues({
        title: asset.title,
        altText: asset.altText,
        category: asset.category,
        beforeAfter: asset.beforeAfter,
        locationLabel: asset.locationLabel,
        pairKey: asset.pairKey,
      }),
    [asset],
  );

  return (
    <form
      className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(values);
      }}
    >
      <h2 className="text-xl font-semibold text-navy-950">
        Describe this media
      </h2>
      <p className="mt-2 text-sm text-navy-700">
        Describe only what the media shows. Add an area only when known and
        approved for publication. Caption edits update its published uses.
      </p>
      {[
        ["title", "Visible caption", 120],
        ["altText", "Accessibility description", 300],
        ["locationLabel", "Known area (optional)", 100],
        ["pairKey", "Job / pair name (optional)", 64],
      ].map(([key, label, max]) => (
        <label key={key} className="mt-3 block font-semibold text-navy-950">
          {label}
          <input
            className={field}
            required={key === "title" || key === "altText"}
            maxLength={Number(max)}
            value={values[key as keyof typeof values]}
            onChange={(event) =>
              setValues((previous) => ({
                ...previous,
                [key]: event.target.value,
              }))
            }
          />
        </label>
      ))}
      <label className="mt-3 block font-semibold text-navy-950">
        Service
        <select
          className={field}
          value={values.category}
          onChange={(event) =>
            setValues((previous) => ({
              ...previous,
              category: event.target.value as MediaCategory,
            }))
          }
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
          onChange={(event) =>
            setValues((previous) => ({
              ...previous,
              beforeAfter: event.target.value as BeforeAfter,
            }))
          }
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
