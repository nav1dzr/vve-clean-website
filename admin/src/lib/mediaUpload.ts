/** Direct signed upload. Signed URLs are never saved in browser storage. */
export function uploadMediaFile(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let idleTimer: ReturnType<typeof setTimeout>;
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(idleTimer);
      signal.removeEventListener("abort", cancel);
      if (error) reject(error);
      else resolve();
    };
    const cancel = () => {
      finish(new Error("Upload cancelled. Choose the same file to retry."));
      xhr.abort();
    };
    const watch = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        finish(
          new Error(
            "No upload progress for 60 seconds. Check your connection and retry.",
          ),
        );
        xhr.abort();
      }, 60_000);
    };
    if (signal.aborted) {
      finish(new Error("Upload cancelled."));
      return;
    }
    signal.addEventListener("abort", cancel, { once: true });
    xhr.open("PUT", url);
    xhr.timeout = 15 * 60_000;
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("If-None-Match", "*");
    xhr.upload.onprogress = (event) => {
      watch();
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        finish();
      } else
        finish(
          new Error(
            xhr.status === 412
              ? "This original is already stored. Use Retry processing in the library."
              : `Upload did not finish (${xhr.status}). Retry to obtain a fresh upload link.`,
          ),
        );
    };
    xhr.onerror = () =>
      finish(
        new Error(
          "Upload could not reach storage. Check your connection; if it persists, check the media upload origin settings.",
        ),
      );
    xhr.ontimeout = () =>
      finish(
        new Error(
          "Upload timed out. Choose a smaller file or retry on a faster connection.",
        ),
      );
    xhr.onabort = () => finish(new Error("Upload cancelled."));
    watch();
    xhr.send(file);
  });
}
