import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownMessage } from "../../src/renderer/components/MarkdownMessage";

const render = (text: string) =>
  renderToStaticMarkup(createElement(MarkdownMessage, { text }));
describe("coach Markdown", () => {
  it("renders headings, emphasis, lists, tables and code", () => {
    const html = render(
      "## Lectura\n\n**Forma** y *fatiga*\n\n- Recuperación\n- Resistencia\n\n| Métrica | Valor |\n| --- | ---: |\n| TSB | **-1,5** |\n\n`CTL`\n\n```text\n42\n```",
    );
    for (const tag of [
      "<h2>",
      "<strong>",
      "<em>",
      "<ul>",
      "<li>",
      "<table>",
      "<th>",
      "<code>",
      "<pre>",
    ])
      expect(html).toContain(tag);
    expect(html).toContain("<strong>-1,5</strong>");
    expect(html).toContain('tabindex="0"');
  });
  it("blocks raw HTML, unsafe links and remote images", () => {
    const html = render(
      '<script>alert(1)</script>\n\n<img src="https://example.com/tracker" onerror="alert(1)">\n\n[unsafe](javascript:alert%281%29)\n\n[local](file:///etc/passwd)\n\n![Imagen](https://example.com/tracker)\n\n[Referencia](https://example.com)',
    );
    expect(html).not.toMatch(/<script|<img|onerror|javascript:|file:|tracker/);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
