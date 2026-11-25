import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { collectPaths, readAttachments } from "../src/cli/compose.ts";

describe("collectPaths", () => {
  test("accumulates repeated --attach values", () => {
    expect(collectPaths("b.txt", collectPaths("a.txt"))).toEqual(["a.txt", "b.txt"]);
  });
});

describe("readAttachments", () => {
  const dir = mkdtempSync(join(tmpdir(), "gmail-cli-"));

  test("reads the file, its name and a type from the extension", async () => {
    const path = join(dir, "notes.pdf");
    writeFileSync(path, "%PDF");
    const file = (await readAttachments([path]))[0]!;
    expect(file.filename).toBe("notes.pdf");
    expect(file.mimeType).toBe("application/pdf");
    expect(Buffer.from(file.data).toString()).toBe("%PDF");
  });

  test("falls back to application/octet-stream for unknown extensions", async () => {
    const path = join(dir, "blob.unknownext");
    writeFileSync(path, "x");
    const file = (await readAttachments([path]))[0]!;
    expect(file.mimeType).toBe("application/octet-stream");
  });

  test("names the missing file in the error", async () => {
    await expect(readAttachments([join(dir, "missing.txt")])).rejects.toThrow("missing.txt");
  });
});
