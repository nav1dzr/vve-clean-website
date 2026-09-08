import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { uploadMediaFile } from "./mediaUpload";

class FakeXHR {
  static last: FakeXHR;
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
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  abort = vi.fn(() => this.onabort?.());
  constructor() {
    FakeXHR.last = this;
  }
}
beforeEach(() => {
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
});
