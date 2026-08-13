/**
 * Discord-flavoured markdown, and only that.
 *
 * Discord supports a small subset of markdown, so this is deliberately not a
 * general markdown implementation. What a message actually renders:
 *
 *   **bold**  *italic*  __underline__  ~~strike~~  `code`  ```block```
 *   # H1   ## H2   ### H3   (nothing deeper)
 *   > quote      - bullet      1. numbered      [text](url)
 *   -# subtext
 *
 * Anything else — images, tables, rules, H4+ — is not supported by Discord and
 * so is not supported here either. Both the editor and the preview go through
 * this file, which is what makes "what you see is what Discord posts" true.
 *
 * No `server-only`: the editor preview renders this in the browser and the
 * student dashboard renders it on the server.
 */

/** Discord rejects a message body over 2000 characters. */
export const DISCORD_MESSAGE_LIMIT = 2000;

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char]);
}

/** Neutralise Discord's markup characters inside literal text. */
export function escapeDiscordText(value: string) {
  return value.replace(/([\\*_~`|>])/g, "\\$1");
}

/** Only http(s) survives — never javascript: or data: from a pasted link. */
function safeHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : "";
}

/**
 * Inline formatting. Code spans and links are pulled out into placeholders
 * first so their contents are never re-formatted (a URL full of underscores
 * must not turn into italics).
 */
function renderInline(source: string) {
  const slots: string[] = [];
  // NUL cannot occur in the source, so a placeholder is unambiguous and comes
  // through every regex below untouched.
  const slot = (html: string) => {
    slots.push(html);
    return `\u0000${slots.length - 1}\u0000`;
  };

  // 1. Code spans, before anything can chew on their contents.
  let text = source.replace(
    /`([^`\n]+)`/g,
    (_, code: string) => slot(`<code>${escapeHtml(code)}</code>`),
  );

  // 2. Everything that is left is literal text.
  text = escapeHtml(text);

  // 3. Masked links, then bare URLs Discord would autolink anyway.
  text = text.replace(
    /\[([^\]\n]+)\]\(([^)\s]+)\)/g,
    (match, label: string, url: string) => {
      const href = safeHref(url);
      if (!href) return match;
      return slot(
        `<a href="${href}" target="_blank" rel="noreferrer noopener">${label}</a>`,
      );
    },
  );
  text = text.replace(/https?:\/\/[^\s<]+[^\s<.,:;"')\]]/g, (url) =>
    slot(`<a href="${url}" target="_blank" rel="noreferrer noopener">${url}</a>`),
  );

  // 4. Marks. Longer delimiters first so ** never loses to *.
  text = text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/(^|[\s(])_(.+?)_(?=$|[\s.,!?)])/g, "$1<em>$2</em>");

  // 5. Discord escapes with a backslash; drop it now that parsing is done.
  text = text.replace(/\\([*_~`|\\[\]#>-])/g, "$1");

  return text.replace(/\u0000(\d+)\u0000/g, (_, index: string) => slots[Number(index)]);
}

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; lines: string[] }
  | { kind: "subtext"; lines: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "code"; language: string; lines: string[] }
  | { kind: "list"; ordered: boolean; items: { depth: number; text: string }[] };

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "") {
      index++;
      continue;
    }

    const fence = /^```(\w*)\s*$/.exec(line.trim());
    if (fence) {
      const body: string[] = [];
      index++;
      while (index < lines.length && !/^```\s*$/.test(lines[index].trim())) {
        body.push(lines[index]);
        index++;
      }
      index++; // closing fence
      blocks.push({ kind: "code", language: fence[1], lines: body });
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      index++;
      continue;
    }

    if (/^-#\s+/.test(line)) {
      const body: string[] = [];
      while (index < lines.length && /^-#\s+/.test(lines[index])) {
        body.push(lines[index].replace(/^-#\s+/, ""));
        index++;
      }
      blocks.push({ kind: "subtext", lines: body });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        body.push(lines[index].replace(/^>\s?/, ""));
        index++;
      }
      blocks.push({ kind: "quote", lines: body });
      continue;
    }

    const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);
    const numbered = /^(\s*)\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const items: { depth: number; text: string }[] = [];
      while (index < lines.length) {
        const match = ordered
          ? /^(\s*)\d+[.)]\s+(.*)$/.exec(lines[index])
          : /^(\s*)[-*]\s+(.*)$/.exec(lines[index]);
        if (!match) break;
        // Discord indents a sub-list at two spaces, and goes no deeper than one.
        items.push({
          depth: Math.min(1, Math.floor(match[1].length / 2)),
          text: match[2],
        });
        index++;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    const body: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !/^(#{1,3}\s|>|-#\s|```|\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[index])
    ) {
      body.push(lines[index]);
      index++;
    }
    blocks.push({ kind: "paragraph", lines: body });
  }

  return blocks;
}

function renderList(block: Extract<Block, { kind: "list" }>) {
  const tag = block.ordered ? "ol" : "ul";
  let html = `<${tag}>`;
  // A sub-list belongs *inside* the item above it, otherwise ProseMirror
  // throws it away when the markdown is loaded back into the editor.
  let nested = false;
  let itemOpen = false;

  for (const item of block.items) {
    if (item.depth === 1) {
      if (!nested) {
        html += `<${tag}>`;
        nested = true;
      }
      html += `<li>${renderInline(item.text)}</li>`;
      continue;
    }

    if (nested) {
      html += `</${tag}>`;
      nested = false;
    }
    if (itemOpen) html += "</li>";
    html += `<li>${renderInline(item.text)}`;
    itemOpen = true;
  }

  if (nested) html += `</${tag}>`;
  if (itemOpen) html += "</li>";
  return `${html}</${tag}>`;
}

/**
 * Markdown → HTML. The output uses plain semantic tags on purpose: it is both
 * what the preview shows and what Tiptap parses back when a task is edited.
 */
export function renderDiscordMarkdown(markdown: string) {
  return parseBlocks(markdown)
    .map((block) => {
      switch (block.kind) {
        case "heading":
          return `<h${block.level}>${renderInline(block.text)}</h${block.level}>`;
        case "code":
          return `<pre><code${
            block.language ? ` class="language-${escapeHtml(block.language)}"` : ""
          }>${escapeHtml(block.lines.join("\n"))}</code></pre>`;
        case "quote":
          return `<blockquote><p>${block.lines
            .map(renderInline)
            .join("<br />")}</p></blockquote>`;
        case "subtext":
          return `<p class="md-subtext">${block.lines
            .map(renderInline)
            .join("<br />")}</p>`;
        case "list":
          return renderList(block);
        case "paragraph":
          return `<p>${block.lines.map(renderInline).join("<br />")}</p>`;
      }
    })
    .join("");
}

/** Rough plain-text version, for list rows and table cells. */
export function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*(#{1,3}|>|-#|[-*]|\d+[.)])\s+/gm, "")
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, "$1")
    .replace(/[*_~`|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
