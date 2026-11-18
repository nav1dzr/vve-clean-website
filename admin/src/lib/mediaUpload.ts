/** Direct signed upload. Signed URLs are never saved in browser storage. */
export function uploadMediaFile(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
  signal: AbortSignal,
  // Must equal the type the upload link was signed for. Some browsers report
  // no type for HEIC or MOV files, so the caller passes the checked type.
  contentType: string = file.type,
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
      xhr.upload.onprogress = null;
      xhr.onload = xhr.onerror = xhr.ontimeout = xhr.onabort = null;
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
            "No upload progress for 60 seconds. Keep this page open, check your connection and retry.",
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
    // Some browsers only deliver upload progress when this is registered
    // before open(). Missing progress would otherwise trigger the idle timer.
    xhr.upload.onprogress = (event) => {
      watch();
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      // A retry can race with a completed PUT. Do not overwrite the original or
      // keep retrying it: the caller must still verify it with action=complete.
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 412) {
        onProgress(100);
        finish();
      } else
        finish(
          new Error(
            `Upload did not finish (${xhr.status}). Retry to obtain a fresh upload link.`,
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
    try {
      xhr.open("PUT", url);
      xhr.timeout = 15 * 60_000;
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.setRequestHeader("If-None-Match", "*");
      watch();
      xhr.send(file);
    } catch {
      // A phone may expose a cloud-backed File that is not readable locally.
      // Synchronous browser failures must release the timer/listener too.
      finish(new Error("The browser could not read or send this file. Download it to your device, then select it again and retry."));
      xhr.abort();
    }
  });
}
