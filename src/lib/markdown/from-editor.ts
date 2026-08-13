/**
 * Tiptap document → Discord markdown.
 *
 * The editor is configured (see `markdown-editor.tsx`) to only ever produce
 * nodes Discord can render, so this serialiser is total: every node type it
 * can meet has a Discord equivalent.
 */

import { escapeDiscordText } from "./discord";

type Mark = { type: string; attrs?: Record<string, unknown> };

export type EditorNode = {
  type?: string;
  text?: string;
  marks?: Mark[];
  attrs?: Record<string, unknown>;
  content?: EditorNode[];
};

function applyMarks(text: string, marks: Mark[] = []) {
  let out = text;

  // Code wins outright: Discord does not format inside a code span, so the
  // escapes we would otherwise add would show up literally.
  if (marks.some((m) => m.type === "code")) {
    return `\`${out.replace(/`/g, "")}\``;
  }

  out = escapeDiscordText(out);
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        out = `**${out}**`;
        break;
      case "italic":
        out = `*${out}*`;
        break;
      case "underline":
        out = `__${out}__`;
        break;
      case "strike":
        out = `~~${out}~~`;
        break;
      case "link": {
        const href = String(mark.attrs?.href ?? "");
        if (/^https?:\/\//i.test(href)) out = `[${out}](${href})`;
        break;
      }
    }
  }
  return out;
}

function inlineContent(nodes: EditorNode[] = []): string {
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "\n";
      if (node.type === "text") return applyMarks(node.text ?? "", node.marks);
      return inlineContent(node.content);
    })
    .join("");
}

function listItems(
  node: EditorNode,
  ordered: boolean,
  depth: number,
): string[] {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];
  let counter = 1;

  for (const item of node.content ?? []) {
    const marker = ordered ? `${counter++}.` : "-";
    const children = item.content ?? [];
    const [first, ...rest] = children;

    lines.push(`${indent}${marker} ${inlineContent(first?.content)}`.trimEnd());
    for (const child of rest) {
      if (child.type === "bulletList") lines.push(...listItems(child, false, depth + 1));
      else if (child.type === "orderedList") lines.push(...listItems(child, true, depth + 1));
      else lines.push(`${indent}  ${inlineContent(child.content)}`);
    }
  }

  return lines;
}

function block(node: EditorNode): string {
  switch (node.type) {
    case "heading": {
      // Discord stops at three levels; anything deeper renders as plain text.
      const level = Math.min(3, Number(node.attrs?.level ?? 1));
      return `${"#".repeat(level)} ${inlineContent(node.content)}`;
    }
    case "codeBlock": {
      const language = String(node.attrs?.language ?? "");
      const body = (node.content ?? []).map((c) => c.text ?? "").join("");
      return `\`\`\`${language}\n${body}\n\`\`\``;
    }
    case "blockquote":
      return (node.content ?? [])
        .map(block)
        .join("\n")
        .split("\n")
        .map((line) => `> ${line}`.trimEnd())
        .join("\n");
    case "bulletList":
      return listItems(node, false, 0).join("\n");
    case "orderedList":
      return listItems(node, true, 0).join("\n");
    case "paragraph":
      return inlineContent(node.content);
    default:
      return inlineContent(node.content);
  }
}

export function editorDocToDiscordMarkdown(doc: EditorNode): string {
  return (doc.content ?? [])
    .map(block)
    .filter((chunk) => chunk.trim() !== "")
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
