import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import MediaManagerPage from "./MediaManagerPage";
import type { MediaAsset, MediaLibrary } from "../types/media";

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/authFetch", () => ({ authFetch: fetchMock }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ admin: { id: "test-staff" } }) }));
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it("makes a sixth video available while its website position is open and earlier videos are still processing", async () => {
  vi.useFakeTimers();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const key = "builtin-carpet-carpet-stairs";
  const clips: MediaAsset[] = Array.from({ length: 6 }, (_, i) => ({
    id: String(i), title: `Sample clip ${i}`, altText: "Test footage", mediaType: "video", status: "processing",
    service: "Carpet", category: "carpet", placement: "gallery-carpet", beforeAfter: "none", pairKey: "", locationLabel: "",
    websiteVisible: false, googleEnabled: false, socialEnabled: false, requestedSlotKey: null, activeSlotKey: null,
    usages: [], imageUrl: null, muxPlaybackId: null, processingError: "", createdAt: "", updatedAt: "",
    filename: `sample-${i}.mp4`, size: 20, contentType: "video/mp4",
  }));
  const library: MediaLibrary = { assets: clips, topics: [], gallerySlots: [], references: [], websiteSlots: [{
    id: "stairs", key, pageLabel: "Carpet", purposeLabel: "Stairs video", description: "", sortOrder: 1, assignments: [],
    usages: [{ key: "stairs-reference", pageKey: key, pageLabel: "Gallery", componentLabel: "Stairs video" }],
  }] };
  fetchMock.mockImplementation(async (url: string, init?: { body?: string }) => {
    if (!init) return library;
    const { action } = JSON.parse(init.body ?? "{}");
    if (action === "history") return { history: [] };
    if (action === "sync" && url.endsWith("&id=5")) return { asset: { ...clips[5], status: "ready", muxPlaybackId: "test-playback" } };
    if (action === "sync") return { status: "processing" };
    throw new Error("Unexpected test request");
  });
  await act(async () => { render(<MediaManagerPage />); });
  fireEvent.change(screen.getByLabelText("Website page"), { target: { value: "Carpet cleaning" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Change video/ })); });
  expect(screen.queryByRole("option", { name: /Sample clip 5/ })).not.toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(24_000); });
  expect(screen.getByRole("option", { name: /Sample clip 5/ })).toBeInTheDocument();
  expect(fetchMock.mock.calls.filter(([, init]) => !init)).toHaveLength(1);
});
