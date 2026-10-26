import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MediaManagerPage from "./MediaManagerPage";
import type { GallerySlot, MediaAsset, MediaLibrary } from "../types/media";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), upload: vi.fn() }));
vi.mock("../lib/authFetch", () => ({ authFetch: mocks.fetch }));
vi.mock("../lib/mediaUpload", () => ({ uploadMediaFile: mocks.upload }));
const library = {
  assets: [],
  assignedAssets: [],
  topics: [],
  gallerySlots: [],
  websiteSlots: [],
  references: [],
  nextPage: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(false);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  mocks.fetch.mockImplementation(async (_url, init) =>
    init
      ? {
          id: "11111111-2222-3333-4444-555555555555",
          uploadUrl: "https://upload.example",
        }
      : library,
  );
});
describe("media manager recovery", () => {
  it("replaces stale caption feedback with specific archive and restore confirmations", async () => {
    let status: MediaAsset["status"] = "ready";
    mocks.fetch.mockImplementation(async (_url, init) => {
      if (!init) return { ...library, assets: [{ ...readyAsset, title: "Saved photo", altText: "Saved description", status }] };
      const { action } = JSON.parse(init.body);
      if (action === "archive") status = "archived";
      if (action === "restore") status = "ready";
      return {};
    });
    render(<MediaManagerPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit caption & details" }));
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Caption and details saved.");
    fireEvent.click(screen.getByRole("button", { name: "Archive unused item" }));
    expect(await screen.findByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Media archived.");
    expect(screen.queryByText("Caption and details saved.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await screen.findByRole("button", { name: "Archive unused item" });
    expect(screen.getByRole("status")).toHaveTextContent("Media restored. It is ready to use again.");
  });

  it("clears an earlier success notice when restoring fails", async () => {
    let status: MediaAsset["status"] = "ready";
    mocks.fetch.mockImplementation(async (_url, init) => {
      if (!init) return { ...library, assets: [{ ...readyAsset, title: "Saved photo", altText: "Saved description", status }] };
      const { action } = JSON.parse(init.body);
      if (action === "restore") throw new Error("Restore failed. Please retry.");
      if (action === "archive") status = "archived";
      return {};
    });
    render(<MediaManagerPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Archive unused item" }));
    await screen.findByRole("button", { name: "Restore" });
    expect(screen.getByRole("status")).toHaveTextContent("Media archived.");
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Restore failed. Please retry.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("ignores a previous service response that arrives after the current service", async () => {
    let resolveCarpet!: (value: MediaLibrary) => void;
    const carpetResponse = new Promise<MediaLibrary>((resolve) => { resolveCarpet = resolve; });
    mocks.fetch.mockImplementation((url) => String(url).includes("category=carpet")
      ? carpetResponse
      : Promise.resolve({ ...library, assets: [{ ...readyAsset, title: "Current sofa photo", category: "sofa-upholstery" }] }));
    render(<MediaManagerPage />);
    fireEvent.change(screen.getByLabelText("Service"), { target: { value: "sofa-upholstery" } });
    expect(await screen.findByText("Current sofa photo")).toBeInTheDocument();
    await act(async () => resolveCarpet({ ...library, assets: [{ ...readyAsset, title: "Old carpet photo" }] }));
    expect(screen.getByText("Current sofa photo")).toBeInTheDocument();
    expect(screen.queryByText("Old carpet photo")).not.toBeInTheDocument();
  });

  it("clears the previous service library while its replacement is loading", async () => {
    mocks.fetch.mockImplementation((url) => String(url).includes("category=carpet")
      ? Promise.resolve({ ...library, assets: [{ ...readyAsset, title: "Old carpet photo" }] })
      : new Promise(() => {}));
    render(<MediaManagerPage />);
    await screen.findByText("Old carpet photo");
    fireEvent.change(screen.getByLabelText("Service"), { target: { value: "sofa-upholstery" } });
    expect(screen.queryByText("Old carpet photo")).not.toBeInTheDocument();
    expect(screen.getByText("Loading your media…")).toBeInTheDocument();
  });

  it("ignores an obsolete service load error after the next service succeeds", async () => {
    let rejectCarpet!: (error: Error) => void;
    const carpetResponse = new Promise((_, reject) => { rejectCarpet = reject; });
    mocks.fetch.mockImplementation((url) => String(url).includes("category=carpet")
      ? carpetResponse
      : Promise.resolve({ ...library, assets: [{ ...readyAsset, title: "Current sofa photo", category: "sofa-upholstery" }] }));
    render(<MediaManagerPage />);
    fireEvent.change(screen.getByLabelText("Service"), { target: { value: "sofa-upholstery" } });
    await screen.findByText("Current sofa photo");
    await act(async () => rejectCarpet(new Error("Old category request failed")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Current sofa photo")).toBeInTheDocument();
  });

  it("retains a useful upload failure after refreshing the library", async () => {
    mocks.upload.mockRejectedValue(
      new Error("Connection interrupted. Retry this file."),
    );
    render(<MediaManagerPage />);
    await screen.findByRole("heading", { name: "Upload to Carpet" });
    fireEvent.change(screen.getByLabelText("Photos or videos"), {
      target: {
        files: [new File(["photo"], "carpet.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Upload selected files" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connection interrupted",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Upload selected files" }),
      ).toBeEnabled(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Retry this file");
    expect(mocks.fetch).toHaveBeenCalledWith(
      expect.stringContaining("&id="),
      expect.objectContaining({ body: JSON.stringify({ action: "fail" }) }),
    );
  });
});

const readyAsset: MediaAsset = {
  id: "11111111-2222-3333-4444-555555555555",
  mediaType: "image", status: "ready", title: "", altText: "",
  service: "Carpet cleaning", category: "carpet", placement: "gallery-carpet",
  beforeAfter: "before", pairKey: "", locationLabel: "",
  websiteVisible: false, googleEnabled: false, socialEnabled: false,
  requestedSlotKey: null, activeSlotKey: null, usages: [], imageUrl: null,
  muxPlaybackId: null, processingError: "", createdAt: "2026-09-14T12:00:00Z",
  updatedAt: "2026-09-14T12:00:00Z", filename: "carpet.jpg", size: 100,
  contentType: "image/jpeg",
};

describe("media position guidance", () => {
  const websiteSlot = {
    id: "22222222-2222-3333-4444-555555555555", key: "about-team-photo",
    pageLabel: "About", purposeLabel: "Team photograph", description: "", sortOrder: 1,
    assignments: [{ assetId: readyAsset.id, role: "primary" as const }], usages: [{ key: "website-about-team-photo", pageKey: "about-team-photo", pageLabel: "About", componentLabel: "Team photograph" }],
  };

  it("ignores a late preview after switching to another position", async () => {
    let resolvePreview!: (value: unknown) => void;
    const pending = new Promise((resolve) => { resolvePreview = resolve; });
    const slots: GallerySlot[] = [1, 2].map((number) => ({ id: `photo-${number}`, topicKey: "carpet", code: `PHOTO0${number}`, kind: "photo", label: `Work photo ${number}`, sortOrder: number, assignments: [], usages: [] }));
    mocks.fetch.mockImplementation(async (_url, init) => !init
      ? { ...library, assets: [{ ...readyAsset, title: "Saved photo", altText: "Saved description" }], gallerySlots: slots }
      : JSON.parse(init.body).action === "assign" ? pending : { history: [] });
    render(<MediaManagerPage />);
    await screen.findByRole("heading", { name: "Upload to Carpet" });
    fireEvent.click(screen.getByRole("button", { name: "Shared gallery positions" }));
    fireEvent.click(screen.getByRole("button", { name: "Work photos (2)" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Choose / replace media" })[0]);
    fireEvent.change(screen.getByLabelText("Photograph"), { target: { value: readyAsset.id } });
    fireEvent.click(screen.getByRole("button", { name: "Preview affected pages" }));
    fireEvent.click(screen.getByRole("button", { name: "Shared gallery positions" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Choose / replace media" })[1]);
    await act(async () => resolvePreview({ expected: [], selections: [{ assetId: readyAsset.id, role: "primary" }], impact: [], assets: [readyAsset] }));
    expect(screen.getByRole("heading", { name: "Carpet · Work photo 2" })).toBeInTheDocument();
    expect(screen.getByLabelText("Photograph")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Publish to these pages" })).not.toBeInTheDocument();
  });

  it("ignores a late preview when its selected photograph changes", async () => {
    let resolvePreview!: (value: unknown) => void;
    const pending = new Promise((resolve) => { resolvePreview = resolve; });
    const otherPhoto = { ...readyAsset, id: "33333333-2222-3333-4444-555555555555", title: "New choice", altText: "New photo" };
    const slot = { ...websiteSlot, key: "homepage-hero", usages: [{ key: "hero", pageKey: "homepage-hero-image", pageLabel: "Homepage", componentLabel: "Hero photograph" }] };
    mocks.fetch.mockImplementation(async (_url, init) => !init
      ? { ...library, assets: [{ ...readyAsset, title: "Saved photo", altText: "Saved description" }, otherPhoto], websiteSlots: [slot] }
      : JSON.parse(init.body).action === "assign" ? pending : { history: [] });
    render(<MediaManagerPage />);
    await screen.findByRole("heading", { name: "Upload to Carpet" });
    fireEvent.click(screen.getByRole("button", { name: "Other website positions" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Choose / replace media" })));
    fireEvent.click(screen.getByRole("button", { name: "Preview affected pages" }));
    fireEvent.change(screen.getByLabelText("Photograph"), { target: { value: otherPhoto.id } });
    await act(async () => resolvePreview({ expected: slot.assignments, selections: slot.assignments, impact: slot.usages, assets: [readyAsset] }));
    expect(screen.getByLabelText("Photograph")).toHaveValue(otherPhoto.id);
    expect(screen.queryByRole("button", { name: "Publish to these pages" })).not.toBeInTheDocument();
  });

  it("ignores history returned for a previously selected position", async () => {
    let resolveHistory!: (value: unknown) => void;
    const pending = new Promise((resolve) => { resolveHistory = resolve; });
    const slots: GallerySlot[] = [1, 2].map((number) => ({ id: `photo-${number}`, topicKey: "carpet", code: `PHOTO0${number}`, kind: "photo", label: `Work photo ${number}`, sortOrder: number, assignments: [{ assetId: readyAsset.id, role: "primary" }], usages: [] }));
    mocks.fetch.mockImplementation(async (_url, init) => !init
      ? { ...library, assets: [{ ...readyAsset, title: "Saved photo", altText: "Saved description" }], gallerySlots: slots }
      : JSON.parse(init.body).targetId === "photo-1" ? pending : { history: [] });
    render(<MediaManagerPage />);
    await screen.findByRole("heading", { name: "Upload to Carpet" });
    fireEvent.click(screen.getByRole("button", { name: "Shared gallery positions" }));
    fireEvent.click(screen.getByRole("button", { name: "Work photos (2)" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Choose / replace media" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Shared gallery positions" }));
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Choose / replace media" })[1]));
    await act(async () => resolveHistory({ history: [{ id: "old-history", previous_assignments: slots[0].assignments, created_at: "2026-10-15T10:00:00Z" }] }));
    expect(screen.getByRole("heading", { name: "Carpet · Work photo 2" })).toBeInTheDocument();
    expect(screen.queryByText("Previous versions")).not.toBeInTheDocument();
  });

  it("keeps a new position open when a previously reviewed publication finishes", async () => {
    let resolvePublish!: (value: unknown) => void;
    const pending = new Promise((resolve) => { resolvePublish = resolve; });
    const slots: GallerySlot[] = [1, 2].map((number) => ({ id: `photo-${number}`, topicKey: "carpet", code: `PHOTO0${number}`, kind: "photo", label: `Work photo ${number}`, sortOrder: number, assignments: [], usages: [] }));
    mocks.fetch.mockImplementation(async (_url, init) => {
      if (!init) return { ...library, assets: [{ ...readyAsset, title: "Saved photo", altText: "Saved description" }], gallerySlots: slots };
      const body = JSON.parse(init.body);
      if (body.confirm) return pending;
      return { expected: [], selections: body.assignments, impact: [], assets: [readyAsset] };
    });
    render(<MediaManagerPage />);
    await screen.findByRole("heading", { name: "Upload to Carpet" });
    fireEvent.click(screen.getByRole("button", { name: "Shared gallery positions" }));
    fireEvent.click(screen.getByRole("button", { name: "Work photos (2)" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Choose / replace media" })[0]);
    fireEvent.change(screen.getByLabelText("Photograph"), { target: { value: readyAsset.id } });
    fireEvent.click(screen.getByRole("button", { name: "Preview affected pages" }));
    fireEvent.click(await screen.findByRole("button", { name: "Publish to these pages" }));
    fireEvent.click(screen.getByRole("button", { name: "Shared gallery positions" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Choose / replace media" })[1]);
    await act(async () => resolvePublish({ published: true }));
    expect(screen.getByRole("heading", { name: "Carpet · Work photo 2" })).toBeInTheDocument();
    expect(screen.getByLabelText("Photograph")).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("Carpet · Work photo 1 published.");
    const publication = mocks.fetch.mock.calls.find(([, init]) => init && JSON.parse(init.body).confirm);
    expect(JSON.parse(publication![1].body).targetId).toBe("photo-1");
  });

  it("shows one position type at a time while keeping every position reachable", async () => {
    const slots: GallerySlot[] = [
      { id: "pair", topicKey: "carpet", code: "BA01", kind: "before_after", label: "Before / after set 1", sortOrder: 1, assignments: [], usages: [] },
      { id: "photo1", topicKey: "carpet", code: "PHOTO01", kind: "photo", label: "Work photo 1", sortOrder: 2, assignments: [], usages: [] },
      { id: "photo2", topicKey: "carpet", code: "PHOTO02", kind: "photo", label: "Work photo 2", sortOrder: 3, assignments: [], usages: [] },
      { id: "video", topicKey: "carpet", code: "VIDEO01", kind: "video", label: "Video 1", sortOrder: 4, assignments: [], usages: [] },
    ];
    mocks.fetch.mockImplementation(async (_url, init) => init ? { history: [] } : { ...library, gallerySlots: slots });
    render(<MediaManagerPage />);
    await screen.findByRole("heading", { name: "Upload to Carpet" });
    fireEvent.click(screen.getByRole("button", { name: "Shared gallery positions" }));
    const filters = within(screen.getByRole("group", { name: "Position type" }));
    expect(filters.getByRole("button", { name: "Before / after (1)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Before / after set 1" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Work photo 1" })).not.toBeInTheDocument();
    fireEvent.click(filters.getByRole("button", { name: "Work photos (2)" }));
    expect(filters.getByRole("button", { name: "Work photos (2)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Work photo 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Work photo 2" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Before / after set 1" })).not.toBeInTheDocument();
    fireEvent.click(filters.getByRole("button", { name: "Videos (1)" }));
    expect(screen.getByRole("heading", { name: "Video 1" })).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Choose / replace media" })));
    expect(screen.getByRole("heading", { name: "Carpet · Video 1" })).toBeInTheDocument();
    expect(mocks.fetch.mock.calls.filter(([, init]) => init).every(([, init]) => JSON.parse(init.body).action === "history")).toBe(true);
  });

  it("groups repeated page aliases without hiding different sections", async () => {
    const usages = [
      { key: "carpet-canonical", pageKey: "carpet-cleaning-london", pageLabel: "Carpet cleaning", componentLabel: "Featured comparison" },
      { key: "carpet-alias", pageKey: "carpet-cleaning", pageLabel: "Carpet cleaning", componentLabel: "Featured comparison" },
      { key: "carpet-other", pageKey: "carpet-cleaning-london", pageLabel: "Carpet cleaning", componentLabel: "Work photos" },
    ];
    mocks.fetch.mockImplementation(async () => ({ ...library, websiteSlots: [{ ...websiteSlot, usages }] }));
    render(<MediaManagerPage />);
    await screen.findByRole("heading", { name: "Upload to Carpet" });
    fireEvent.click(screen.getByRole("button", { name: "Other website positions" }));
    fireEvent.click(screen.getByLabelText("Show unconnected positions (not publishable)"));
    expect(screen.getAllByText("Carpet cleaning · Featured comparison")).toHaveLength(1);
    expect(screen.getByText("Carpet cleaning · Work photos")).toBeInTheDocument();
  });

  it("keeps an unconnected position and its history viewable without offering publication", async () => {
    mocks.fetch.mockImplementation(async (_url, init) => init
      ? { history: [{ id: "history-one", previous_assignments: websiteSlot.assignments, created_at: "2026-10-15T10:00:00Z" }] }
      : { ...library, assets: [{ ...readyAsset, title: "Saved photo", altText: "Saved description" }], websiteSlots: [websiteSlot] });
    render(<MediaManagerPage />);
    await screen.findByRole("heading", { name: "Upload to Carpet" });
    fireEvent.click(screen.getByRole("button", { name: "Other website positions" }));
    expect(screen.queryByText(/Not connected to a website page yet/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Show unconnected positions (not publishable)"));
    expect(screen.getByText(/Not connected to a website page yet/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Planned placement" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Used on" })).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "View position" })));
    expect(screen.getByRole("heading", { name: "Planned placement" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Used on" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Photo or video")).toBeDisabled();
    expect(screen.getByLabelText("Photo or video")).toHaveValue(readyAsset.id);
    expect(screen.getByRole("button", { name: "Preview affected pages" })).toBeDisabled();
    expect(await screen.findByText("Previous versions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Preview version before/, hidden: true })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Go to shared gallery positions" }));
    expect(screen.getByRole("heading", { name: "Choose a shared position" })).toBeInTheDocument();
    expect(mocks.fetch.mock.calls.filter(([, init]) => init).every(([, init]) => JSON.parse(init.body).action === "history")).toBe(true);
  });

  it("keeps a connected photo position usable and excludes gallery videos from its choices", async () => {
    const slot = { ...websiteSlot, key: "homepage-hero", pageLabel: "Homepage", purposeLabel: "Hero photograph", usages: [{ key: "completion-homepage-hero-image", pageKey: "homepage-hero-image", pageLabel: "Homepage", componentLabel: "Hero photograph" }] };
    const photo = { ...readyAsset, title: "Current photo", altText: "Current description" };
    const video = { ...readyAsset, id: "33333333-2222-3333-4444-555555555555", mediaType: "video", title: "Gallery video", muxPlaybackId: "synthetic-video" };
    mocks.fetch.mockImplementation(async (_url, init) => init ? { history: [] } : { ...library, assets: [photo, video], websiteSlots: [slot] });
    render(<MediaManagerPage />);
    await screen.findByRole("heading", { name: "Upload to Carpet" });
    fireEvent.click(screen.getByRole("button", { name: "Other website positions" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Choose / replace media" })));
    const selection = screen.getByLabelText("Photograph");
    expect(screen.getByRole("heading", { name: "Used on" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Planned placement" })).not.toBeInTheDocument();
    expect(selection).toBeEnabled();
    expect(selection).toHaveValue(photo.id);
    expect(within(selection).getByRole("option", { name: /Current photo/ })).toBeInTheDocument();
    expect(within(selection).queryByRole("option", { name: /Gallery video/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview affected pages" })).toBeEnabled();
    expect(screen.getByText(/Removing a published position without a replacement is not available yet/)).toBeInTheDocument();
  });
});

async function openCaptionEditor(asset: MediaAsset = readyAsset) {
  mocks.fetch.mockImplementation(async (_url, init) => init ? {} : { ...library, assets: [asset] });
  render(<MediaManagerPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Edit caption & details" }));
  return within(screen.getByRole("form", { name: "Media caption and details" }));
}

describe("media manager guidance and caption suggestions", () => {
  it("keeps changed details on close, tab or service switch until discard is confirmed", async () => {
    const editor = await openCaptionEditor({ ...readyAsset, title: "Saved title", altText: "Saved description" });
    fireEvent.change(editor.getByLabelText("Title shown on the website"), { target: { value: "My unsaved title" } });
    fireEvent.click(editor.getByRole("button", { name: "Close editor" }));
    expect(editor.getByLabelText("Title shown on the website")).toHaveValue("My unsaved title");
    fireEvent.click(screen.getByRole("button", { name: "Shared gallery positions" }));
    expect(editor.getByLabelText("Title shown on the website")).toHaveValue("My unsaved title");
    fireEvent.change(screen.getAllByLabelText("Service")[0], { target: { value: "sofa-upholstery" } });
    expect(screen.getAllByLabelText("Service")[0]).toHaveValue("carpet");
    expect(mocks.fetch.mock.calls.every(([, init]) => !init)).toBe(true);
    vi.mocked(window.confirm).mockReturnValue(true);
    fireEvent.click(editor.getByRole("button", { name: "Close editor" }));
    expect(screen.queryByRole("form", { name: "Media caption and details" })).not.toBeInTheDocument();
    expect(mocks.fetch.mock.calls.every(([, init]) => !init)).toBe(true);
  });

  it("warns before reload only while media details are changed", async () => {
    const editor = await openCaptionEditor({ ...readyAsset, title: "Saved title" });
    const cleanReload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanReload);
    expect(cleanReload.defaultPrevented).toBe(false);
    fireEvent.change(editor.getByLabelText("Title shown on the website"), { target: { value: "Unsaved title" } });
    const dirtyReload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirtyReload);
    expect(dirtyReload.defaultPrevented).toBe(true);
    fireEvent.change(editor.getByLabelText("Title shown on the website"), { target: { value: "Saved title" } });
    fireEvent.click(editor.getByRole("button", { name: "Close editor" }));
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("does not replace an unsaved editor with another photo without confirmation", async () => {
    mocks.fetch.mockResolvedValue({ ...library, assets: [{ ...readyAsset, title: "First" }, { ...readyAsset, id: "second", title: "Second" }] });
    render(<MediaManagerPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Edit caption & details" }))[0]);
    fireEvent.change(screen.getByLabelText("Title shown on the website"), { target: { value: "First edit" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Edit caption & details" })[1]);
    expect(screen.getByLabelText("Title shown on the website")).toHaveValue("First edit");
    vi.mocked(window.confirm).mockReturnValue(true);
    fireEvent.click(screen.getAllByRole("button", { name: "Edit caption & details" })[1]);
    expect(screen.getByLabelText("Title shown on the website")).toHaveValue("Second");
  });
  it("starts with uploads and explains all three publishing steps", async () => {
    render(<MediaManagerPage />);
    await screen.findByRole("heading", { name: "Upload to Carpet" });
    const steps = within(screen.getByRole("list", { name: "How to publish your media" }));
    expect(steps.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Upload & library" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Shared gallery positions" }));
    expect(screen.getByRole("heading", { name: "Choose a shared position" })).toBeInTheDocument();
    expect(mocks.fetch.mock.calls.every(([, init]) => !init)).toBe(true);
  });

  it("saves a ready-to-use suggestion through the existing metadata endpoint", async () => {
    const editor = await openCaptionEditor();
    expect(editor.getByRole("heading", { name: "Describe this media" })).toHaveFocus();
    fireEvent.click(editor.getByRole("button", { name: "Use this wording" }));
    expect(editor.getByLabelText("Title shown on the website")).toHaveValue("Carpet before cleaning");
    expect(editor.getByLabelText(/Photo or video description/)).toHaveValue("Before-cleaning photo from our carpet cleaning work.");
    expect(mocks.fetch.mock.calls.every(([, init]) => !init)).toBe(true);
    fireEvent.click(editor.getByRole("button", { name: "Save details" }));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`&id=${readyAsset.id}`),
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({
        title: "Carpet before cleaning", altText: "Before-cleaning photo from our carpet cleaning work.",
        category: "carpet", beforeAfter: "before", locationLabel: "", pairKey: "", updatedAt: readyAsset.updatedAt,
      }) }),
    ));
  });

  it("keeps custom wording when browsing styles or changing service and stage", async () => {
    const asset = { ...readyAsset, title: "My own title", altText: "My own description" };
    const editor = await openCaptionEditor(asset);
    fireEvent.change(editor.getByLabelText("Wording style"), { target: { value: "service" } });
    fireEvent.change(editor.getByLabelText("Service"), { target: { value: "sofa-upholstery" } });
    fireEvent.change(editor.getByLabelText("Cleaning stage"), { target: { value: "after" } });
    expect(editor.getByLabelText("Title shown on the website")).toHaveValue(asset.title);
    expect(editor.getByLabelText(/Photo or video description/)).toHaveValue(asset.altText);
    fireEvent.click(editor.getByRole("button", { name: "Use this wording" }));
    expect(editor.getByRole("group", { name: "Replace your current wording" })).toBeInTheDocument();
    fireEvent.click(editor.getByRole("button", { name: "Keep my wording" }));
    expect(editor.getByLabelText("Title shown on the website")).toHaveValue(asset.title);
    expect(editor.getByLabelText(/Photo or video description/)).toHaveValue(asset.altText);
    expect(mocks.fetch.mock.calls.every(([, init]) => !init)).toBe(true);
  });

  it("replaces only after the owner's choice and keeps the suggestion editable", async () => {
    const editor = await openCaptionEditor({ ...readyAsset, title: "My existing title", altText: "" });
    fireEvent.click(editor.getByRole("button", { name: "Use this wording" }));
    expect(editor.getByLabelText("Title shown on the website")).toHaveValue("My existing title");
    fireEvent.click(editor.getByRole("button", { name: "Replace title & description" }));
    fireEvent.change(editor.getByLabelText("Title shown on the website"), { target: { value: "My edited caption" } });
    fireEvent.change(editor.getByLabelText(/Photo or video description/), { target: { value: "A specific description I wrote." } });
    fireEvent.change(editor.getByLabelText("Wording style"), { target: { value: "stage" } });
    expect(editor.getByLabelText("Title shown on the website")).toHaveValue("My edited caption");
    expect(editor.getByLabelText(/Photo or video description/)).toHaveValue("A specific description I wrote.");
    expect(editor.queryByRole("group", { name: "Replace your current wording" })).not.toBeInTheDocument();
  });

  it("clears an obsolete replacement choice when the cleaning stage changes", async () => {
    const editor = await openCaptionEditor({ ...readyAsset, title: "Keep this title", altText: "Keep this description" });
    fireEvent.click(editor.getByRole("button", { name: "Use this wording" }));
    fireEvent.change(editor.getByLabelText("Cleaning stage"), { target: { value: "after" } });
    expect(editor.queryByRole("button", { name: "Replace title & description" })).not.toBeInTheDocument();
    expect(editor.getByLabelText("Title shown on the website")).toHaveValue("Keep this title");
    fireEvent.click(editor.getByRole("button", { name: "Use this wording" }));
    fireEvent.click(editor.getByRole("button", { name: "Replace title & description" }));
    expect(editor.getByLabelText("Title shown on the website")).toHaveValue("Carpet after cleaning");
  });
});


describe("visual publication guidance", () => {
  it("distinguishes the current service page from its older stored reference", async () => {
    const usages = [
      { key: "old", pageKey: "carpet-page", pageLabel: "Carpet Service", componentLabel: "Results" },
      { key: "current", pageKey: "carpet-main-results", pageLabel: "Carpet Service", componentLabel: "Results" },
    ];
    mocks.fetch.mockResolvedValue({ ...library, gallerySlots: [{ id: "pair", topicKey: "carpet", code: "BA01", kind: "before_after", label: "Pair 1", sortOrder: 1, assignments: [], usages }] });
    render(<MediaManagerPage />);
    await screen.findByRole("heading", { name: "Upload to Carpet" });
    fireEvent.click(screen.getByRole("button", { name: "Shared gallery positions" }));
    const filter = screen.getByLabelText("Show positions used on");
    expect(within(filter).getByRole("option", { name: "Carpet cleaning page" })).toHaveValue("carpet-main-results");
    expect(within(filter).getByRole("option", { name: "Carpet — older page reference" })).toHaveValue("carpet-page");
    fireEvent.change(filter, { target: { value: "carpet-main-results" } });
    expect(screen.getByRole("heading", { name: "Pair 1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View on website" })).toHaveAttribute("href", "https://www.vveclean.co.uk/carpet-cleaning-london#results");
  });
  it("shows the built-in homepage image until a managed image is assigned", async () => {
    mocks.fetch.mockResolvedValue({ ...library, websiteSlots: [{ id:"home-slot",key:"homepage-hero",pageLabel:"Homepage",purposeLabel:"First carousel photo",description:"",sortOrder:1, assignments: [], usages: [{key:"home", pageKey:"homepage-hero-image",pageLabel:"Homepage",componentLabel:"First carousel photo"}] }] });
    render(<MediaManagerPage />);
    await screen.findByRole("heading", { name: "Upload to Carpet" });
    fireEvent.click(screen.getByRole("button", { name: "Other website positions" }));
    expect(screen.getByRole("img", { name: "Carpet extraction in progress" })).toHaveAttribute("src", "https://www.vveclean.co.uk/images/carpet-cleaning-hero.webp");
    expect(screen.getByRole("link", { name: "View on website" })).toHaveAttribute("href", "https://www.vveclean.co.uk/");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Choose / replace media" })));
    expect(screen.getByRole("heading", { name: "Current published selection" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your proposed replacement or addition" })).toBeInTheDocument();
    expect(mocks.fetch.mock.calls.filter(([,init])=>init).every(([,init])=>JSON.parse(init.body).action === "history")).toBe(true);
  });
  it("loads the video player only after Play video, without publishing", async () => {
    mocks.fetch.mockResolvedValue({ ...library, assets: [{ ...readyAsset, mediaType:"video",muxPlaybackId:"test-video",title:"Test clip" }] });
    render(<MediaManagerPage />);
    await screen.findByRole("heading", { name: "Upload to Carpet" });
    expect(screen.queryByTitle(/Video preview/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Play video"}));
    expect(screen.getByTitle("Video preview: Test clip")).toHaveAttribute("src","https://player.mux.com/test-video");
    expect(mocks.fetch.mock.calls.every(([,init])=>!init)).toBe(true);
  });
});
