"use client"

import { type ReactNode } from "react"
import { useEditorState, type Editor } from "@tiptap/react"
import { useTranslations } from "next-intl"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react"
import type { TextAlignment } from "./text-align"

export interface FormatToolbarProps {
  editor: Editor | null
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="format-toolbar-button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // 用 mousedown 触发并阻止默认：不这么做，点按钮会先把编辑器里的选区清掉，格式就落空了
      onMouseDown={(event) => {
        event.preventDefault()
        if (!disabled) onClick()
      }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="format-toolbar-divider" aria-hidden />
}

const ICON = "size-4"

/**
 * 基础排版工具栏：标题、加粗系、列表、对齐、链接、撤销/重做。
 *
 * 按钮的高亮/禁用状态走 useEditorState 订阅，跟 AcademicToolbar 一致——
 * 只在相关状态变化时重渲染，不为每次敲键都刷新整条工具栏。
 */
export function FormatToolbar({ editor }: FormatToolbarProps) {
  const t = useTranslations("papers")

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null
      const align = e.isActive({ textAlign: "center" })
        ? "center"
        : e.isActive({ textAlign: "right" })
          ? "right"
          : e.isActive({ textAlign: "justify" })
            ? "justify"
            : "left"
      return {
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        isBold: e.isActive("bold"),
        isItalic: e.isActive("italic"),
        isUnderline: e.isActive("underline"),
        isStrike: e.isActive("strike"),
        isCode: e.isActive("code"),
        isH1: e.isActive("heading", { level: 1 }),
        isH2: e.isActive("heading", { level: 2 }),
        isH3: e.isActive("heading", { level: 3 }),
        isParagraph: e.isActive("paragraph"),
        isBulletList: e.isActive("bulletList"),
        isOrderedList: e.isActive("orderedList"),
        isBlockquote: e.isActive("blockquote"),
        isCodeBlock: e.isActive("codeBlock"),
        isLink: e.isActive("link"),
        align,
      }
    },
  })

  if (!editor || !state) return null

  const chain = () => editor.chain().focus()

  const setLink = () => {
    const previous = (editor.getAttributes("link").href as string | undefined) ?? ""
    const url = window.prompt(t("editorLinkPrompt"), previous)
    if (url === null) return
    if (url.trim() === "") {
      chain().extendMarkRange("link").unsetLink().run()
      return
    }
    chain().extendMarkRange("link").setLink({ href: url.trim() }).run()
  }

  // 对齐用内置 updateAttributes 写到当前块（标题或段落）的 textAlign 属性上
  const applyAlign = (align: TextAlignment) => {
    chain().updateAttributes(editor.isActive("heading") ? "heading" : "paragraph", { textAlign: align }).run()
  }

  return (
    <div className="format-toolbar" role="toolbar" aria-label={t("editorFormatToolbar")}>
      <ToolbarButton label={t("editorUndo")} disabled={!state.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 className={ICON} />
      </ToolbarButton>
      <ToolbarButton label={t("editorRedo")} disabled={!state.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 className={ICON} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton label={t("editorHeading1")} active={state.isH1} onClick={() => chain().toggleHeading({ level: 1 }).run()}>
        <Heading1 className={ICON} />
      </ToolbarButton>
      <ToolbarButton label={t("editorHeading2")} active={state.isH2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        <Heading2 className={ICON} />
      </ToolbarButton>
      <ToolbarButton label={t("editorHeading3")} active={state.isH3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        <Heading3 className={ICON} />
      </ToolbarButton>
      <ToolbarButton label={t("editorParagraph")} active={state.isParagraph} onClick={() => chain().setParagraph().run()}>
        <Pilcrow className={ICON} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton label={t("editorBold")} active={state.isBold} onClick={() => chain().toggleBold().run()}>
        <Bold className={ICON} />
      </ToolbarButton>
      <ToolbarButton label={t("editorItalic")} active={state.isItalic} onClick={() => chain().toggleItalic().run()}>
        <Italic className={ICON} />
      </ToolbarButton>
      <ToolbarButton label={t("editorUnderline")} active={state.isUnderline} onClick={() => chain().toggleUnderline().run()}>
        <Underline className={ICON} />
      </ToolbarButton>
      <ToolbarButton label={t("editorStrikethrough")} active={state.isStrike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough className={ICON} />
      </ToolbarButton>
      <ToolbarButton label={t("editorInlineCode")} active={state.isCode} onClick={() => chain().toggleCode().run()}>
        <Code className={ICON} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton label={t("editorBulletList")} active={state.isBulletList} onClick={() => chain().toggleBulletList().run()}>
        <List className={ICON} />
      </ToolbarButton>
      <ToolbarButton label={t("editorOrderedList")} active={state.isOrderedList} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered className={ICON} />
      </ToolbarButton>
      <ToolbarButton label={t("editorBlockquote")} active={state.isBlockquote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote className={ICON} />
      </ToolbarButton>
      <ToolbarButton label={t("editorCodeBlock")} active={state.isCodeBlock} onClick={() => chain().toggleCodeBlock().run()}>
        <SquareCode className={ICON} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton label={t("editorAlignLeft")} active={state.align === "left"} onClick={() => applyAlign("left")}>
        <AlignLeft className={ICON} />
      </ToolbarButton>
      <ToolbarButton label={t("editorAlignCenter")} active={state.align === "center"} onClick={() => applyAlign("center")}>
        <AlignCenter className={ICON} />
      </ToolbarButton>
      <ToolbarButton label={t("editorAlignRight")} active={state.align === "right"} onClick={() => applyAlign("right")}>
        <AlignRight className={ICON} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton label={t("editorLink")} active={state.isLink} onClick={setLink}>
        <LinkIcon className={ICON} />
      </ToolbarButton>
      <ToolbarButton label={t("editorUnlink")} disabled={!state.isLink} onClick={() => chain().unsetLink().run()}>
        <Unlink className={ICON} />
      </ToolbarButton>
    </div>
  )
}
