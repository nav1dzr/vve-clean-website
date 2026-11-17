import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { uploadMediaFile } from "./mediaUpload";

class FakeXHR {
  static last: FakeXHR;
  static failAt: "open" | "send" | null = null;
  hadProgressHandlerAtOpen = false;
  upload: {
    onprogress?: (event: {
      loaded: number;
      total: number;
      lengthComputable: boolean;
    }) => void;
  } = {};
  status = 200;
  timeout = 0;
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  ontimeout?: () => void;
  open = vi.fn(() => {
    this.hadProgressHandlerAtOpen = typeof this.upload.onprogress === "function";
    if (FakeXHR.failAt === "open") throw new DOMException("synthetic open failure", "InvalidStateError");
  });
  setRequestHeader = vi.fn();
  send = vi.fn(() => {
    if (FakeXHR.failAt === "send") throw new DOMException("synthetic file read failure", "NotReadableError");
  });
  abort = vi.fn(() => this.onabort?.());
  constructor() {
    FakeXHR.last = this;
  }
}
beforeEach(() => {
  FakeXHR.failAt = null;
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const file = new File(["image"], "carpet.jpg", { type: "image/jpeg" });
describe("direct media transfer", () => {
  it("shows byte progress and protects existing originals", async () => {
    const progress = vi.fn();
    const promise = uploadMediaFile(
      "https://upload.example/signed",
      file,
      progress,
      new AbortController().signal,
    );
    FakeXHR.last.upload.onprogress?.({
      loaded: 5,
      total: 10,
      lengthComputable: true,
    });
    expect(progress).toHaveBeenCalledWith(50);
    expect(FakeXHR.last.hadProgressHandlerAtOpen).toBe(true);
    expect(FakeXHR.last.setRequestHeader).toHaveBeenCalledWith(
      "If-None-Match",
      "*",
    );
    FakeXHR.last.onload?.();
    await promise;
    expect(progress).toHaveBeenLastCalledWith(100);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels promptly and clears the stalled-transfer timer", async () => {
    const control = new AbortController();
    const promise = uploadMediaFile(
      "https://upload.example/signed",
      file,
      vi.fn(),
      control.signal,
    );
    const result = expect(promise).rejects.toThrow("cancelled");
    control.abort();
    await result;
    expect(FakeXHR.last.abort).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("allows the caller to verify an original already accepted by storage instead of re-uploading it", async () => {
    const progress = vi.fn();
    const promise = uploadMediaFile("https://upload.example/signed", file, progress, new AbortController().signal);
    FakeXHR.last.status = 412;
    FakeXHR.last.onload?.();
    await expect(promise).resolves.toBeUndefined();
    expect(FakeXHR.last.send).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenLastCalledWith(100);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("sends the checked content type when the browser reports none", async () => {
    const untyped = new File(["image"], "IMG_0001.HEIC", { type: "" });
    const promise = uploadMediaFile(
      "https://upload.example/signed",
      untyped,
      vi.fn(),
      new AbortController().signal,
      "image/heic",
    );
    expect(FakeXHR.last.setRequestHeader).toHaveBeenCalledWith(
      "Content-Type",
      "image/heic",
    );
    FakeXHR.last.onload?.();
    await promise;
  });
  it("stops a transfer that makes no progress for a minute", async () => {
    const promise = uploadMediaFile(
      "https://upload.example/signed",
      file,
      vi.fn(),
      new AbortController().signal,
    );
    const result = expect(promise).rejects.toThrow("No upload progress");
    await vi.advanceTimersByTimeAsync(60_000);
    await result;
    expect(FakeXHR.last.abort).toHaveBeenCalled();
  });
  it.each(["open", "send"] as const)("cleans up after a synchronous %s failure so the next file can upload", async (failure) => {
    FakeXHR.failAt = failure;
    const control = new AbortController();
    const removeListener = vi.spyOn(control.signal, "removeEventListener");
    await expect(uploadMediaFile("https://upload.example/signed", file, vi.fn(), control.signal))
      .rejects.toThrow("Download it to your device");
    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
    expect(FakeXHR.last.upload.onprogress).toBeNull();
    FakeXHR.failAt = null;
    const next = uploadMediaFile("https://upload.example/next", file, vi.fn(), new AbortController().signal);
    FakeXHR.last.onload?.();
    await expect(next).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps an actively progressing large transfer alive and waits for storage acknowledgement", async () => {
    const progress = vi.fn();
    const resolved = vi.fn();
    const transfer = uploadMediaFile("https://upload.example/signed", file, progress, new AbortController().signal);
    void transfer.then(resolved);
    expect(FakeXHR.last.timeout).toBe(15 * 60_000);
    for (let chunk = 1; chunk <= 4; chunk += 1) {
      await vi.advanceTimersByTimeAsync(45_000);
      FakeXHR.last.upload.onprogress?.({ loaded: chunk, total: 4, lengthComputable: true });
      expect(FakeXHR.last.abort).not.toHaveBeenCalled();
    }
    expect(progress).toHaveBeenLastCalledWith(100);
    expect(resolved).not.toHaveBeenCalled();
    FakeXHR.last.onload?.();
    await transfer;
    expect(resolved).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
