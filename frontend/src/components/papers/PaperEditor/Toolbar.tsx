"use client"

import type { ReactNode } from "react"
import type { Editor } from "@tiptap/react"
import {
  Bold, Italic, Underline, Strikethrough, Code, SquareCode,
  Heading1, Heading2, Heading3, Pilcrow,
  List, ListOrdered, Quote,
  AlignLeft, AlignCenter, AlignRight,
  Link2, Unlink, Undo2, Redo2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { TextAlignment } from "./text-align"

const ICON = "size-4"

function ToolbarButton({ onClick, label, active, disabled, children }: {
  onClick: () => void
  label: string
  active?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection when a control is clicked
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "inline-flex items-center justify-center size-8 rounded-md transition-colors",
        "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        active && "bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/15",
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--border-subtle)]" />
}

export interface EditorToolbarProps {
  editor: Editor | null
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null
  const chain = () => editor.chain().focus()

  const setAlign = (align: TextAlignment) => {
    const type = editor.isActive("heading") ? "heading" : "paragraph"
    chain().updateAttributes(type, { textAlign: align }).run()
  }

  const toggleLink = () => {
    if (editor.isActive("link")) {
      chain().unsetLink().run()
      return
    }
    const prev = (editor.getAttributes("link").href as string) || ""
    const url = window.prompt("Link URL", prev)
    if (url === null) return
    if (url.trim() === "") chain().unsetLink().run()
    else chain().setLink({ href: url.trim() }).run()
  }

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b border-[var(--border-subtle)] glass-surface">
      <ToolbarButton label="Undo" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}><Undo2 className={ICON} /></ToolbarButton>
      <ToolbarButton label="Redo" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}><Redo2 className={ICON} /></ToolbarButton>
      <Divider />
      <ToolbarButton label="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => chain().toggleHeading({ level: 1 }).run()}><Heading1 className={ICON} /></ToolbarButton>
      <ToolbarButton label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()}><Heading2 className={ICON} /></ToolbarButton>
      <ToolbarButton label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()}><Heading3 className={ICON} /></ToolbarButton>
      <ToolbarButton label="Paragraph" active={editor.isActive("paragraph")} onClick={() => chain().setParagraph().run()}><Pilcrow className={ICON} /></ToolbarButton>
      <Divider />
      <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()}><Bold className={ICON} /></ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()}><Italic className={ICON} /></ToolbarButton>
      <ToolbarButton label="Underline" active={editor.isActive("underline")} onClick={() => chain().toggleUnderline().run()}><Underline className={ICON} /></ToolbarButton>
      <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => chain().toggleStrike().run()}><Strikethrough className={ICON} /></ToolbarButton>
      <ToolbarButton label="Inline code" active={editor.isActive("code")} onClick={() => chain().toggleCode().run()}><Code className={ICON} /></ToolbarButton>
      <Divider />
      <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()}><List className={ICON} /></ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()}><ListOrdered className={ICON} /></ToolbarButton>
      <ToolbarButton label="Blockquote" active={editor.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()}><Quote className={ICON} /></ToolbarButton>
      <ToolbarButton label="Code block" active={editor.isActive("codeBlock")} onClick={() => chain().toggleCodeBlock().run()}><SquareCode className={ICON} /></ToolbarButton>
      <Divider />
      <ToolbarButton label="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => setAlign("left")}><AlignLeft className={ICON} /></ToolbarButton>
      <ToolbarButton label="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => setAlign("center")}><AlignCenter className={ICON} /></ToolbarButton>
      <ToolbarButton label="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => setAlign("right")}><AlignRight className={ICON} /></ToolbarButton>
      <Divider />
      <ToolbarButton label="Link" active={editor.isActive("link")} onClick={toggleLink}><Link2 className={ICON} /></ToolbarButton>
      <ToolbarButton label="Remove link" disabled={!editor.isActive("link")} onClick={() => chain().unsetLink().run()}><Unlink className={ICON} /></ToolbarButton>
    </div>
  )
}
