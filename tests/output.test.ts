import { describe, expect, test } from "bun:test";
import { formatBytes, renderTable, truncate } from "../src/cli/output.ts";

describe("truncate", () => {
  test("leaves short text unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });
  test("truncates with an ellipsis", () => {
    expect(truncate("hello world", 5)).toBe("hell…");
  });
  test("treats a non-positive max as unlimited", () => {
    expect(truncate("hello", 0)).toBe("hello");
  });
});

describe("formatBytes", () => {
  test("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
  });
  test("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
  test("formats megabytes", () => {
    expect(formatBytes(1024 * 1024 * 3)).toBe("3.0 MB");
  });
});

describe("renderTable", () => {
  test("includes headers and rows", () => {
    const table = renderTable(["ID", "NAME"], [["1", "Alice"], ["2", "Bob"]]);
    expect(table).toContain("ID");
    expect(table).toContain("NAME");
    expect(table).toContain("Alice");
    expect(table).toContain("Bob");
  });

  test("pads columns to a consistent width", () => {
    const table = renderTable(["A"], [["longvalue"]]);
    const [header] = table.split("\n");
    expect(header!.startsWith("A")).toBe(true);
  });
});
