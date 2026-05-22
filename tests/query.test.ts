import { describe, expect, test } from "bun:test";
import { combineQuery, fromSender, quoteValue } from "../src/gmail/query.ts";

describe("quoteValue", () => {
  test("leaves single words unquoted", () => {
    expect(quoteValue("linkedin.com")).toBe("linkedin.com");
  });

  test("quotes values containing whitespace", () => {
    expect(quoteValue("John Doe")).toBe('"John Doe"');
  });

  test("escapes embedded quotes", () => {
    expect(quoteValue('a "b"')).toBe('"a \\"b\\""');
  });
});

describe("combineQuery", () => {
  test("joins fragments with spaces", () => {
    expect(combineQuery(["from:a@b.com", "is:unread"])).toBe(
      "from:a@b.com is:unread",
    );
  });

  test("drops empty and nullish fragments", () => {
    expect(combineQuery(["from:a@b.com", "", undefined, null, "  "])).toBe(
      "from:a@b.com",
    );
  });
});

describe("fromSender", () => {
  test("builds a from: fragment", () => {
    expect(fromSender("a@b.com")).toBe("from:a@b.com");
  });

  test("quotes display names", () => {
    expect(fromSender("Big Corp")).toBe('from:"Big Corp"');
  });
});
