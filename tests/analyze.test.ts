import { describe, expect, test } from "bun:test";
import { aggregateSenders } from "../src/gmail/analyze.ts";

describe("aggregateSenders", () => {
  test("counts and ranks senders by frequency", () => {
    const result = aggregateSenders([
      "Alice <a@x.com>",
      "a@x.com",
      "Bob <b@x.com>",
      "Alice <a@x.com>",
    ]);
    expect(result[0]).toEqual({ address: "a@x.com", count: 3 });
    expect(result[1]).toEqual({ address: "b@x.com", count: 1 });
  });

  test("ignores empty headers", () => {
    const result = aggregateSenders(["", "  ", "a@x.com"]);
    expect(result).toEqual([{ address: "a@x.com", count: 1 }]);
  });

  test("limits the result to topN", () => {
    const headers = ["a@x.com", "b@x.com", "c@x.com"];
    expect(aggregateSenders(headers, 2)).toHaveLength(2);
  });
});
