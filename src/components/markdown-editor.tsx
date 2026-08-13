"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Braces,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";
import type { ComponentType } from "react";

import { Button } from "@/components/ui/button";
import {
  DISCORD_MESSAGE_LIMIT,
  renderDiscordMarkdown,
} from "@/lib/markdown/discord";
import { editorDocToDiscordMarkdown } from "@/lib/markdown/from-editor";
import { cn } from "@/lib/utils";

/**
 * Only the nodes Discord can render are enabled. Horizontal rules, images and
 * headings past level three are switched off rather than silently dropped at
 * post time, so the editor cannot produce something Discord would mangle.
 */
const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    horizontalRule: false,
    trailingNode: false,
    link: {
      openOnClick: false,
      autolink: true,
      protocols: ["http", "https"],
      HTMLAttributes: { rel: "noreferrer noopener", target: "_blank" },
    },
  }),
];

export function MarkdownEditor({
  name,
  defaultValue = "",
}: {
  name: string;
  defaultValue?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: EXTENSIONS,
    // The renderer's HTML is the round-trip format: markdown in, markdown out.
    content: renderDiscordMarkdown(defaultValue),
    editorProps: {
      attributes: {
        class: "md-body min-h-[16rem] px-4 py-3 focus:outline-none",
      },
    },
  });

  // Null until the editor mounts, which is why `immediatelyRender` is off.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      markdown: e ? editorDocToDiscordMarkdown(e.getJSON()) : defaultValue,
      bold: e?.isActive("bold"),
      italic: e?.isActive("italic"),
      underline: e?.isActive("underline"),
      strike: e?.isActive("strike"),
      code: e?.isActive("code"),
      codeBlock: e?.isActive("codeBlock"),
      blockquote: e?.isActive("blockquote"),
      bulletList: e?.isActive("bulletList"),
      orderedList: e?.isActive("orderedList"),
      link: e?.isActive("link"),
      h1: e?.isActive("heading", { level: 1 }),
      h2: e?.isActive("heading", { level: 2 }),
      h3: e?.isActive("heading", { level: 3 }),
    }),
  });

  const markdown = state?.markdown ?? defaultValue;
  const overLimit = markdown.length > DISCORD_MESSAGE_LIMIT;

  const setLink = () => {
    if (!editor) return;
    const current = String(editor.getAttributes("link").href ?? "");
    const url = window.prompt("Link URL", current || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      window.alert("Discord only linkifies http:// and https:// URLs.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="space-y-3">
      {/* The form posts the markdown, never the editor's HTML. */}
      <input type="hidden" name={name} value={markdown} />

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="border-border/70 overflow-hidden rounded-xl border">
          <div className="border-border/70 bg-card/40 flex flex-wrap gap-1 border-b p-2">
            <Tool
              icon={Bold}
              label="Bold"
              active={state?.bold}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            />
            <Tool
              icon={Italic}
              label="Italic"
              active={state?.italic}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            />
            <Tool
              icon={Underline}
              label="Underline"
              active={state?.underline}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            />
            <Tool
              icon={Strikethrough}
              label="Strikethrough"
              active={state?.strike}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
            />
            <Divider />
            <Tool
              icon={Heading1}
              label="Heading 1"
              active={state?.h1}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 1 }).run()
              }
            />
            <Tool
              icon={Heading2}
              label="Heading 2"
              active={state?.h2}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()
              }
            />
            <Tool
              icon={Heading3}
              label="Heading 3"
              active={state?.h3}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 3 }).run()
              }
            />
            <Divider />
            <Tool
              icon={List}
              label="Bullet list"
              active={state?.bulletList}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            />
            <Tool
              icon={ListOrdered}
              label="Numbered list"
              active={state?.orderedList}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            />
            <Tool
              icon={Quote}
              label="Quote"
              active={state?.blockquote}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            />
            <Divider />
            <Tool
              icon={Code}
              label="Inline code"
              active={state?.code}
              onClick={() => editor?.chain().focus().toggleCode().run()}
            />
            <Tool
              icon={Braces}
              label="Code block"
              active={state?.codeBlock}
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            />
            <Tool
              icon={state?.link ? Link2Off : Link2}
              label="Link"
              active={state?.link}
              onClick={setLink}
            />
          </div>
          <EditorContent editor={editor} />
        </div>

        <div className="border-border/70 overflow-hidden rounded-xl border">
          <div className="border-border/70 bg-card/40 text-muted-foreground flex items-center justify-between border-b px-4 py-2 font-mono text-xs">
            <span>Discord preview</span>
            <span className={overLimit ? "text-destructive" : undefined}>
              {markdown.length} / {DISCORD_MESSAGE_LIMIT}
            </span>
          </div>
          <div
            className="md-body min-h-[16rem] px-4 py-3"
            dangerouslySetInnerHTML={{
              __html: renderDiscordMarkdown(markdown),
            }}
          />
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Discord renders bold, italic, underline, strikethrough, code, quotes,
        lists, links and headings up to level three — nothing else, which is
        why the toolbar stops there.
        {overLimit ? (
          <span className="text-destructive">
            {" "}
            The message is over Discord&apos;s 2000-character limit and will be
            trimmed when posted.
          </span>
        ) : null}
      </p>
    </div>
  );
}

function Divider() {
  return <span className="bg-border mx-1 my-1 w-px" aria-hidden />;
}

function Tool({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn("size-8", active && "bg-foreground/10 text-foreground")}
    >
      <Icon className="size-4" />
    </Button>
  );
}
