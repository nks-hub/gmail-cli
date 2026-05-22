/**
 * Opens a URL in the user's default browser. Best effort: failure is silent so
 * callers can fall back to printing the URL for the user to open manually.
 */
export function openBrowser(url: string): void {
  try {
    if (process.platform === "win32") {
      // PowerShell's Start-Process reliably hands the URL to the default
      // browser. The URL is single-quoted so the `&` query separators are
      // taken literally; OAuth URLs are percent-encoded and contain no
      // single quotes, so this is safe. `explorer` and `cmd /c start` both
      // mis-handle such URLs and can open a file window instead.
      Bun.spawn(
        [
          "powershell",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Start-Process '${url}'`,
        ],
        { stdout: "ignore", stderr: "ignore" },
      );
    } else if (process.platform === "darwin") {
      Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
    } else {
      Bun.spawn(["xdg-open", url], { stdout: "ignore", stderr: "ignore" });
    }
  } catch {
    // Ignore: the caller prints the URL as a fallback.
  }
}
