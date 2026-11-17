import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MediaManagerPage from "./MediaManagerPage";
import type { GallerySlot, MediaAsset, MediaLibrary, WebsiteSlot } from "../types/media";

vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ admin: { id: "media-clarity-owner" } }) }));
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), upload: vi.fn() }));
vi.mock("../lib/authFetch", () => ({ authFetch: mocks.fetch }));
vi.mock("../lib/mediaUpload", () => ({ uploadMediaFile: mocks.upload }));

const usage = { key: "gallery-carpet-ba01", pageKey: "gallery-carpet", pageLabel: "Carpet Gallery", componentLabel: "Before / After 01" };
const asset = (id: string, extra: Partial<MediaAsset> = {}): MediaAsset => ({
  id, mediaType: "image", status: "ready", title: `Title ${id}`, altText: `Description ${id}`,
  service: "Carpet cleaning", category: "carpet", placement: "gallery-carpet",
  beforeAfter: "none", pairKey: "", locationLabel: "", websiteVisible: false,
  googleEnabled: false, socialEnabled: false, requestedSlotKey: null, activeSlotKey: null,
  usages: [], imageUrl: `https://media.example/image/768/${id}.jpg`, muxPlaybackId: null,
  processingError: "", createdAt: "2026-11-10T09:00:00Z", updatedAt: "2026-11-10T09:00:00Z",
  filename: `${id}.jpg`, size: 2 * 1024 * 1024, contentType: "image/jpeg", ...extra,
});
const oldBefore = asset("old-before", { beforeAfter: "before", usages: [usage], websiteVisible: true });
const oldAfter = asset("old-after", { beforeAfter: "after", usages: [usage], websiteVisible: true });
const newBefore = asset("new-before", { beforeAfter: "before" });
const newAfter = asset("new-after", { beforeAfter: "after" });
const sofaVideo = asset("sofa-video", {
  mediaType: "video", category: "sofa-upholstery", imageUrl: null, muxPlaybackId: "play123",
  filename: "sofa.mp4", contentType: "video/mp4", usages: [{ ...usage, key: "gallery-sofa-video01", pageKey: "gallery-sofa", pageLabel: "Sofa Gallery", componentLabel: "Video 01" }],
});
const pairSlot: GallerySlot = {
  id: "slot-pair", topicKey: "carpet", code: "BA01", kind: "before_after", label: "Before / After 01", sortOrder: 1,
  assignments: [{ assetId: oldBefore.id, role: "before" }, { assetId: oldAfter.id, role: "after" }],
  usages: [usage], publishedAt: "2026-11-12T10:30:00Z",
};
const emptySlot: GallerySlot = { id: "slot-empty", topicKey: "carpet", code: "BA02", kind: "before_after", label: "Before / After 02", sortOrder: 2, assignments: [], usages: [] };
const videoSlot: GallerySlot = {
  id: "slot-video", topicKey: "sofa", code: "VIDEO01", kind: "video", label: "Video 01", sortOrder: 6,
  assignments: [{ assetId: sofaVideo.id, role: "primary" }], usages: sofaVideo.usages, publishedAt: "2026-10-01T08:00:00Z",
};
const heroSlot: WebsiteSlot = {
  id: "slot-hero", key: "homepage-hero", pageLabel: "Homepage", purposeLabel: "Homepage Hero", description: "", sortOrder: 1,
  assignments: [], usages: [{ key: "completion-homepage-hero-image", pageKey: "homepage-hero-image", pageLabel: "Homepage", componentLabel: "Homepage Hero" }],
};
const library: MediaLibrary = {
  assets: [oldBefore, oldAfter, newBefore, newAfter],
  assignedAssets: [oldBefore, oldAfter, sofaVideo],
  topics: [], gallerySlots: [pairSlot, emptySlot, videoSlot], websiteSlots: [heroSlot], references: [], nextPage: null,
};

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  mocks.fetch.mockImplementation(async (_url: string, init?: { body: string }) => {
    if (!init) return library;
    const body = JSON.parse(init.body);
    if (body.action === "history") return { history: [] };
    if (body.action === "assign" && body.preview)
      return {
        replacement: true,
        expected: pairSlot.assignments,
        impact: [usage],
        selections: body.assignments,
        assets: [newBefore, newAfter],
      };
    return { id: "11111111-2222-3333-4444-555555555555", uploadUrl: "https://upload.example" };
  });
});

async function ready() {
  render(<MediaManagerPage />);
  await screen.findByRole("heading", { name: "Upload to Carpet" });
}

describe("what is live on the website", () => {
  it("counts live positions and lists them for every service on one screen", async () => {
    await ready();
    expect(screen.getByText(/positions on the website show/)).toHaveTextContent("2 positions on the website show media from your library.");
    fireEvent.click(screen.getByRole("button", { name: "See what is live" }));
    expect(screen.getByRole("heading", { name: "Live on the website now" })).toBeInTheDocument();
    const carpet = within(screen.getByRole("region", { name: "Carpet — live media" }));
    expect(carpet.getByRole("heading", { name: "Carpet (1 live)" })).toBeInTheDocument();
    expect(carpet.getByText(/Live since 12 Nov 2026/)).toBeInTheDocument();
    expect(carpet.getByText("Title old-before")).toBeInTheDocument();
    expect(carpet.getByText("Title old-after")).toBeInTheDocument();
    expect(carpet.queryByText("Before / After 02")).not.toBeInTheDocument();
    const sofa = within(screen.getByRole("region", { name: "Sofa & upholstery — live media" }));
    expect(sofa.getByRole("button", { name: "Replace this video" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "End of tenancy — live media" })).getByText(/built-in photos only/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Other website positions — live media" })).getByText(/built-in photos/)).toBeInTheDocument();
  });

  it("opens the exact live position from its Replace button", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Live on website" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Replace this pair" })));
    expect(screen.getByRole("heading", { name: "Carpet · Before / After 01" })).toBeInTheDocument();
    expect(screen.getByLabelText("before photograph")).toHaveValue(oldBefore.id);
    expect(screen.getByRole("button", { name: "Choose Title old-before (in this position now)" })).toHaveAttribute("aria-pressed", "true");
  });

  it("labels each library item as live or not, and says where it is shown", async () => {
    await ready();
    const live = screen.getByText("old-before.jpg").closest("article")!;
    expect(within(live).getByText("Live on website")).toBeInTheDocument();
    expect(within(live).getByRole("heading", { name: "Shown on" })).toBeInTheDocument();
    expect(within(live).getByText(/Carpet Gallery · Before \/ After 01/)).toBeInTheDocument();
    const spare = screen.getByText("new-before.jpg").closest("article")!;
    expect(within(spare).getByText("Not on website")).toBeInTheDocument();
    expect(within(spare).getByText(/Uploaded 10 Nov 2026 · 2\.0 MB/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "live" } });
    expect(screen.queryByText("new-before.jpg")).not.toBeInTheDocument();
    expect(screen.getByText("old-after.jpg")).toBeInTheDocument();
  });

  it("marks shared positions as live or empty", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Shared gallery positions" }));
    expect(screen.getByText("● Live on website since 12 Nov 2026")).toBeInTheDocument();
    expect(screen.getByText(/Empty — nothing from your library is shown here/)).toBeInTheDocument();
  });
});

describe("choosing and reviewing a replacement", () => {
  it("opens the video position with only ready videos from its service", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Live on website" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Replace this video" })));
    const picker = screen.getByLabelText("Video");
    expect(picker).toHaveValue(sofaVideo.id);
    expect(within(picker).getByRole("option", { name: /sofa\.mp4/ })).toBeInTheDocument();
    expect(within(picker).queryByRole("option", { name: /old-before\.jpg/ })).not.toBeInTheDocument();
    expect(mocks.fetch.mock.calls.some(([url]) => url.includes("category=sofa-upholstery"))).toBe(true);
  });

  it("lets the owner pick by picture and shows old against new before publishing", async () => {
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Live on website" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Replace this pair" })));
    const beforePicker = within(screen.getByRole("group", { name: "before photograph — choose by picture" }));
    expect(beforePicker.queryByRole("button", { name: /Title new-after/ })).not.toBeInTheDocument();
    fireEvent.click(beforePicker.getByRole("button", { name: "Choose Title new-before" }));
    fireEvent.click(within(screen.getByRole("group", { name: "after photograph — choose by picture" })).getByRole("button", { name: "Choose Title new-after" }));
    expect(screen.getByLabelText("before photograph")).toHaveValue(newBefore.id);
    expect(screen.getByLabelText("after photograph")).toHaveValue(newAfter.id);
    fireEvent.click(screen.getByRole("button", { name: "Preview affected pages" }));
    const now = within(await screen.findByRole("region", { name: "On the website now" }));
    expect(now.getByText(/Title old-before/)).toBeInTheDocument();
    expect(now.getByText("old-after.jpg")).toBeInTheDocument();
    const after = within(screen.getByRole("region", { name: "After you publish" }));
    expect(after.getByText(/Title new-before/)).toBeInTheDocument();
    expect(after.getByText("new-after.jpg")).toBeInTheDocument();
    expect(screen.getByText(/removes what is on the website now/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pages that will change" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish to these pages" })).toBeEnabled();
  });
});

describe("file checks before upload", () => {
  it("offers a processing check without uploading or starting another video", async () => {
    const processing = asset("waiting-video", { mediaType: "video", status: "processing", imageUrl: null, filename: "waiting.mp4" });
    mocks.fetch.mockImplementation(async (_url: string, init?: { body: string }) => {
      if (!init) return { ...library, assets: [processing] };
      return { status: "processing", message: "Still processing. Your original is safe." };
    });
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Check processing" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Still processing. Your original is safe.");
    const writes = mocks.fetch.mock.calls.filter(([, init]) => init?.body);
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toContain("id=waiting-video");
    expect(JSON.parse(writes[0][1].body)).toEqual({ action: "sync" });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("explains that the website library is not private customer storage", async () => {
    await ready();
    expect(screen.getByText(/Unpublished files can still be opened/)).toHaveTextContent("Keep private customer evidence in Completion reports.");
  });

  it("names each unsuitable file with its reason and uploads only suitable ones", async () => {
    await ready();
    const good = new File(["photo"], "kitchen.jpg", { type: "image/jpeg" });
    const pdf = new File(["doc"], "quote.pdf", { type: "application/pdf" });
    const big = new File(["x"], "huge.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 41 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText("Photos or videos"), { target: { files: [good, pdf, big] } });
    expect(within(screen.getByRole("list", { name: "Files ready to upload" })).getByText(/kitchen\.jpg — photo/)).toBeInTheDocument();
    const problems = within(screen.getByRole("alert", { name: "Files that cannot be uploaded" }));
    expect(problems.getByText(/2 files cannot be uploaded/)).toBeInTheDocument();
    expect(problems.getByText(/not supported/)).toBeInTheDocument();
    expect(problems.getByText(/The limit is 20 MB/)).toBeInTheDocument();
    mocks.upload.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Upload selected files" }));
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
    expect(mocks.upload.mock.calls[0][1]).toBe(good);
  });

  it("sends the checked type for an iPhone photo the browser left untyped", async () => {
    await ready();
    const heic = new File(["photo"], "IMG_0042.HEIC", { type: "" });
    fireEvent.change(screen.getByLabelText("Photos or videos"), { target: { files: [heic] } });
    mocks.upload.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Upload selected files" }));
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
    const plan = mocks.fetch.mock.calls.find(([, init]) => init && JSON.parse(init.body).filename);
    expect(JSON.parse(plan![1].body)).toMatchObject({ filename: "IMG_0042.HEIC", contentType: "image/heic" });
    expect(mocks.upload.mock.calls[0][4]).toBe("image/heic");
  });
});
