import { describe, expect, test } from "bun:test";
import { htmlToText } from "../src/cli/render.ts";

describe("htmlToText", () => {
  test("drops script and style blocks whose end tag carries whitespace", () => {
    const html = "<p>Hi</p><script>evil()</script ><style>p{}</style\n>Bye";
    expect(htmlToText(html)).toBe("Hi\nBye");
  });

  test("decodes an escaped entity only once", () => {
    expect(htmlToText("a &amp;lt;b&amp;gt; &amp;amp; c")).toBe("a &lt;b&gt; &amp; c");
  });
});
