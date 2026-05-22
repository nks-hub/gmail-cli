/**
 * Opens a URL in the user's default browser. Best effort: failure is silent so
 * callers can fall back to printing the URL for the user to open manually.
 */
export function openBrowser(url: string): void {
  try {
    if (process.platform === "win32") {
      // The empty string is the (required) window-title argument of `start`.
      Bun.spawn(["cmd", "/c", "start", "", url], {
        stdout: "ignore",
        stderr: "ignore",
      });
    } else if (process.platform === "darwin") {
      Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
    } else {
      Bun.spawn(["xdg-open", url], { stdout: "ignore", stderr: "ignore" });
    }
  } catch {
    // Ignore: the caller prints the URL as a fallback.
  }
}
