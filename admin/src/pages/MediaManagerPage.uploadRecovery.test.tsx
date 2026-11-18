import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MediaManagerPage from "./MediaManagerPage";
import type { MediaLibrary } from "../types/media";

vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ admin: { id: "upload-recovery-owner" } }) }));
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), upload: vi.fn() }));
vi.mock("../lib/authFetch", () => ({ authFetch: mocks.fetch }));
vi.mock("../lib/mediaUpload", () => ({ uploadMediaFile: mocks.upload }));

const library: MediaLibrary = { assets: [], assignedAssets: [], topics: [], gallerySlots: [], websiteSlots: [], references: [], nextPage: null };
const first = new File(["first"], "first.jpg", { type: "image/jpeg", lastModified: 1 });
const second = new File(["second"], "second.jpg", { type: "image/jpeg", lastModified: 2 });
const third = new File(["third"], "third.jpg", { type: "image/jpeg", lastModified: 3 });
type Request = { body: string };
const bodyOf = (request?: Request) => request ? JSON.parse(request.body) : {};
const requests = (action: string) => mocks.fetch.mock.calls.filter(([, request]) => bodyOf(request).action === action);

beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  mocks.upload.mockResolvedValue(undefined);
  mocks.fetch.mockImplementation(async (url: string, request?: Request) => {
    if (!request) return library;
    const body = bodyOf(request);
    if (body.action === "complete") return { status: "ready" };
    if (body.action === "retry-upload") return { id: new URL(url, "https://crm.example").searchParams.get("id"), uploadUrl: "https://storage.example/retry" };
    return { id: body.filename, uploadUrl: `https://storage.example/${body.filename}` };
  });
});

async function select(files: File[]) {
  const view = render(<MediaManagerPage />);
  fireEvent.click(screen.getByRole("button", { name: "Upload & library" }));
  await screen.findByRole("heading", { name: "Upload to Carpet" });
  fireEvent.change(screen.getByLabelText("Photos or videos"), { target: { files } });
  fireEvent.click(screen.getByRole("button", { name: "Upload selected files" }));
  return view;
}

describe("independent files in an upload batch", () => {
  it("appends a second selection, deduplicates existing files, and preserves their retry state", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("First file connection interrupted"));
    await select([first]);
    await screen.findByRole("button", { name: "Retry remaining files" });
    const duplicate = new File(["first"], first.name, { type: first.type, lastModified: first.lastModified });
    fireEvent.change(screen.getByLabelText("Photos or videos"), { target: { files: [duplicate, second] } });
    expect(screen.getByText("2 files ready to upload")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Files ready to upload" })).getAllByRole("listitem")).toHaveLength(2);
    expect(within(screen.getByRole("alert", { name: "Files to retry" })).getByText(/First file connection interrupted/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry remaining files" }));
    await screen.findByText(/2 files uploaded and checked/);
    expect(mocks.upload.mock.calls.map(([, file]) => file)).toEqual([first, first, second]);
    expect(requests("retry-upload")).toHaveLength(1);
    expect(mocks.fetch.mock.calls.filter(([, request]) => bodyOf(request).filename)).toHaveLength(2);
  });

  it("allows a removed file to be chosen again without duplicating another queued file", async () => {
    render(<MediaManagerPage />);
    fireEvent.click(screen.getByRole("button", { name: "Upload & library" }));
    await screen.findByRole("heading", { name: "Upload to Carpet" });
    const input = screen.getByLabelText("Photos or videos");
    fireEvent.change(input, { target: { files: [first, second] } });
    fireEvent.click(screen.getByRole("button", { name: "Remove first.jpg from upload queue" }));
    expect(input).toHaveValue("");
    fireEvent.change(input, { target: { files: [first, second] } });
    expect(screen.getByText("2 files ready to upload")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload selected files" }));
    await screen.findByText(/2 files uploaded and checked/);
    expect(mocks.upload.mock.calls.map(([, file]) => file.name)).toEqual([second.name, first.name]);
  });
  it("offers a property-services upload with a work stage and preserves that category", async () => {
    render(<MediaManagerPage />);
  fireEvent.click(screen.getByRole("button", { name: "Upload & library" }));
    await screen.findByRole("heading", { name: "Upload to Carpet" });
    fireEvent.change(screen.getByLabelText("Service"), { target: { value: "property-services" } });
    await screen.findByRole("heading", { name: "Upload to Property services" });
    fireEvent.change(screen.getByLabelText("Work stage"), { target: { value: "after" } });
    fireEvent.change(screen.getByLabelText("Photos or videos"), { target: { files: [first] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload selected files" }));
    await screen.findByText(/1 file uploaded and checked/);
    const create = mocks.fetch.mock.calls.find(([, request]) => bodyOf(request).filename === first.name);
    expect(bodyOf(create?.[1])).toMatchObject({ category: "property-services", beforeAfter: "after" });
    expect(mocks.fetch.mock.calls.some(([url, request]) => !request && String(url).includes("category=property-services"))).toBe(true);
  });
  it("prepares a generic-MIME phone video with the same canonical type used for its transfer", async () => {
    const phoneVideo = new File(["synthetic video"], "IMG_0001.MOV", { type: "application/octet-stream" });
    await select([phoneVideo]);
    await screen.findByText(/1 file uploaded and checked/);
    const create = mocks.fetch.mock.calls.find(([, request]) => bodyOf(request).filename === phoneVideo.name);
    expect(bodyOf(create?.[1])).toMatchObject({ filename: phoneVideo.name, contentType: "video/quicktime" });
    expect(mocks.upload).toHaveBeenCalledWith(expect.any(String), phoneVideo, expect.any(Function), expect.any(AbortSignal), "video/quicktime");
  });

  it("lets staff remove an unreadable file from the retry queue and continue with another selection", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("The browser could not read or send this file"));
    await select([first]);
    await screen.findByRole("button", { name: "Retry remaining files" });
    fireEvent.click(screen.getByRole("button", { name: "Remove first.jpg from upload queue" }));
    expect(screen.queryByRole("alert", { name: "Files to retry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Files ready to upload" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Photos or videos"), { target: { files: [second] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload selected files" }));
    await screen.findByText(/1 file uploaded and checked/);
    expect(mocks.upload.mock.calls.map(([, file]) => file.name)).toEqual([first.name, second.name]);
  });

  it("continues after a transfer failure, keeps only that file selected, and reuses its record on retry", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("Connection interrupted"));
    await select([first, second, third]);
    await screen.findByRole("button", { name: "Retry remaining files" });
    expect(mocks.upload.mock.calls.map(([, file]) => file.name)).toEqual(["first.jpg", "second.jpg", "third.jpg"]);
    expect(screen.getByText(/2 files uploaded and checked/)).toBeInTheDocument();
    const pending = within(screen.getByRole("list", { name: "Files ready to upload" }));
    expect(pending.getByText(/first.jpg/)).toBeInTheDocument();
    expect(pending.queryByText(/second.jpg/)).not.toBeInTheDocument();
    expect(within(screen.getByRole("alert", { name: "Files to retry" })).getByText(/Connection interrupted/)).toBeInTheDocument();
    expect(requests("fail")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Retry remaining files" }));
    await waitFor(() => expect(screen.queryByRole("list", { name: "Files ready to upload" })).not.toBeInTheDocument());
    expect(requests("retry-upload")[0][0]).toContain("id=first.jpg");
    expect(mocks.fetch.mock.calls.filter(([, request]) => bodyOf(request).filename)).toHaveLength(3);
    expect(mocks.upload).toHaveBeenCalledTimes(4);
  });

  it("retains an uploaded original after verification fails, continues the batch, and verifies it without a second transfer", async () => {
    const normal = mocks.fetch.getMockImplementation()!;
    let verificationFailed = false;
    mocks.fetch.mockImplementation(async (url: string, request?: Request) => {
      const body = bodyOf(request);
      if (body.action === "complete" && url.includes("id=first.jpg") && !verificationFailed) {
        verificationFailed = true;
        throw new Error("Storage check temporarily unavailable");
      }
      if (body.action === "retry-upload") return { id: "first.jpg", alreadyStored: true };
      return normal(url, request);
    });
    await select([first, second]);
    await screen.findByRole("button", { name: "Retry remaining files" });
    expect(screen.getByText(/The transfer finished, but the final check did not complete/)).toBeInTheDocument();
    expect(requests("fail")).toHaveLength(0);
    expect(requests("complete")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Retry remaining files" }));
    await waitFor(() => expect(screen.queryByRole("list", { name: "Files ready to upload" })).not.toBeInTheDocument());
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(requests("complete")).toHaveLength(3);
    expect(requests("retry-upload")[0][0]).toContain("id=first.jpg");
  });

  it("continues after preparing one file fails and does not send a failure callback without an asset", async () => {
    const normal = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation(async (url: string, request?: Request) => {
      if (bodyOf(request).filename === first.name) throw new Error("Could not prepare this file");
      return normal(url, request);
    });
    await select([first, second]);
    await screen.findByRole("button", { name: "Retry remaining files" });
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.upload.mock.calls[0][1]).toBe(second);
    expect(requests("fail")).toHaveLength(0);
    expect(screen.getByText(/1 file uploaded and checked/)).toBeInTheDocument();
  });

  it("stops the entire batch when cancelled during transfer and retains files not started", async () => {
    mocks.upload.mockImplementationOnce((_url: string, _file: File, _progress: unknown, signal: AbortSignal) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => reject(new Error("Upload cancelled")), { once: true });
    }));
    await select([first, second]);
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Remove first.jpg from upload queue" })).toBeDisabled();
    expect(screen.getByLabelText("Cleaning stage")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel transfer" }));
    await screen.findByText(/Upload stopped/);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(requests("complete")).toHaveLength(0);
    expect(screen.getByText(/2 files ready to upload/)).toBeInTheDocument();
  });

  it("honours cancellation while preparing the first file instead of starting its transfer afterwards", async () => {
    let finishPlan: (value: unknown) => void = () => {};
    const normal = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation((url: string, request?: Request) => {
      if (bodyOf(request).filename === first.name) return new Promise(resolve => { finishPlan = resolve; });
      return normal(url, request);
    });
    await select([first, second]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel transfer" }));
    await act(async () => finishPlan({ id: "first.jpg", uploadUrl: "https://storage.example/first" }));
    await screen.findByText(/Upload stopped/);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(screen.getByText(/2 files ready to upload/)).toBeInTheDocument();
  });

  it("does not start later files after the media screen is closed", async () => {
    mocks.upload.mockImplementationOnce((_url: string, _file: File, _progress: unknown, signal: AbortSignal) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => reject(new Error("Upload cancelled")), { once: true });
    }));
    const view = await select([first, second]);
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
    await act(async () => view.unmount());
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.fetch.mock.calls.filter(([, request]) => bodyOf(request).filename)).toHaveLength(1);
  });

  it("finishes verification already in progress when cancelled, then leaves the next file untouched", async () => {
    let finishCheck: (value: unknown) => void = () => {};
    const normal = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation((url: string, request?: Request) => {
      if (bodyOf(request).action === "complete") return new Promise(resolve => { finishCheck = resolve; });
      return normal(url, request);
    });
    await select([first, second]);
    await screen.findByText(/Checking the stored original/);
    fireEvent.click(screen.getByRole("button", { name: "Cancel transfer" }));
    await act(async () => finishCheck({ status: "processing" }));
    await screen.findByText(/Upload stopped/);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(requests("fail")).toHaveLength(0);
    expect(screen.getByText(/1 file ready to upload/)).toBeInTheDocument();
  });
});
