import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { withIntl } from "@/test/intl"
import { academicExtensions } from "@/components/papers/PaperEditor/extensions"
import {
  insertCitation,
  replaceBibliographyEntries,
} from "@/components/papers/PaperEditor/extensions/Citation"
import { AiWritingPanel } from "@/components/papers/PaperEditor/AiWritingPanel"
import {
  AiWritingToolbar,
  type AiWritingRequest,
} from "@/components/papers/PaperEditor/AiWritingToolbar"
import {
  AI_WRITING_ACTIONS,
  aiWritingActionMeta,
  applyAiWritingSuggestion,
  buildAiWritingMessages,
  cleanAiWritingText,
  clipDocumentText,
  describeAiWritingDisclosure,
  isAiWritingRangeStale,
  parseCslItems,
  providerHostLabel,
  sameCslIdSet,
} from "@/lib/ai-writing"
import { collectBibliography } from "@/lib/academic-numbering"
import { paperToCslItem, type CslItem } from "@/lib/citations"
import { usePreferencesStore } from "@/stores/preferences-store"

let editor: Editor | null = null

function createEditor(content = "<p>hello</p>") {
  editor = new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      ...academicExtensions({
        locale: "en",
        footnoteTitle: "Footnotes",
        bibliographyTitle: "References",
        crossReferenceLabels: { formula: "Eq.", table: "Table", figure: "Fig.", unknown: "unresolved" },
      }),
    ],
    content,
  })
  return editor
}

const PROVIDER = {
  id: "provider-1",
  name: "Test Provider",
  baseUrl: "https://provider.example/v1",
  apiKey: "test-key",
  models: ["test-model"],
  active: true,
}

/** 面板与工具栏都从 preferences-store 取 Provider，测试里直接摆好状态。 */
function useProvider(providers: (typeof PROVIDER)[] = [PROVIDER]) {
  usePreferencesStore.setState({
    providers,
    activeProviderId: providers[0]?.id ?? null,
  })
}

beforeEach(() => {
  usePreferencesStore.setState({ providers: [], activeProviderId: null })
})

afterEach(() => {
  cleanup()
  editor?.destroy()
  editor = null
  vi.unstubAllGlobals()
  usePreferencesStore.setState({ providers: [], activeProviderId: null })
})

describe("ai writing actions", () => {
  it("routes every action to the writer it needs", () => {
    expect(AI_WRITING_ACTIONS.map((action) => action.id)).toEqual([
      "continue",
      "rewrite",
      "translate",
      "paraphrase",
      "abstract",
      "grammar",
      "reference",
    ])

    // 选区类动作必填选区、不读全文；全文类动作反过来
    for (const id of ["continue", "rewrite", "translate", "paraphrase"] as const) {
      expect(aiWritingActionMeta(id)).toMatchObject({ needsSelection: true, needsDocument: false })
    }
    for (const id of ["abstract", "grammar"] as const) {
      expect(aiWritingActionMeta(id)).toMatchObject({ needsSelection: false, needsDocument: true })
    }
    expect(aiWritingActionMeta("reference")).toMatchObject({ resultKind: "references" })
    // 语法检查只出报告，正文由用户自己改
    expect(aiWritingActionMeta("grammar").resultKind).toBe("report")
  })

  it("refuses an action id it does not know", () => {
    expect(() => aiWritingActionMeta("summarize" as never)).toThrow(/unknown ai writing action/)
  })
})

describe("ai writing prompts", () => {
  it("sends the selection for continue and keeps the rest of the document out", () => {
    const messages = buildAiWritingMessages({
      action: "continue",
      selection: "已有的一段正文",
      document: "不该出现的全文正文",
    })

    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe("system")
    expect(messages[1].content).toContain("已有的一段正文")
    expect(messages[1].content).not.toContain("不该出现的全文正文")
  })

  it("interpolates the chosen language into the translate prompt", () => {
    const messages = buildAiWritingMessages({
      action: "translate",
      selection: "hello",
      document: "",
      targetLanguage: "日本語",
    })

    expect(messages[0].content).toContain("日本語")
    expect(buildAiWritingMessages({ action: "translate", selection: "hello", document: "" })[0].content)
      .toContain("中文")
  })

  it("sends the body text for abstract and grammar", () => {
    for (const action of ["abstract", "grammar"] as const) {
      const messages = buildAiWritingMessages({ action, selection: "", document: "论文正文内容" })
      expect(messages[1].content).toContain("论文正文内容")
    }
  })

  it("sends the bibliography as CSL-JSON and nothing else for reference", () => {
    const item = paperToCslItem({ id: 7, title: "A source", doi: "10.1000/x" })
    const messages = buildAiWritingMessages({
      action: "reference",
      selection: "选区不该发出",
      document: "正文不该发出",
      entries: [item],
    })

    expect(messages[1].content).toContain(item.id)
    expect(messages[1].content).toContain("A source")
    expect(messages[1].content).not.toContain("正文不该发出")
  })
})

describe("ai writing disclosure", () => {
  it("clips only documents that exceed the head and tail budget", () => {
    expect(clipDocumentText("  短正文  ")).toBe("短正文")

    const long = `${"头".repeat(16000)}${"中".repeat(5000)}${"尾".repeat(8000)}`
    const clipped = clipDocumentText(long)
    expect(clipped).toHaveLength(16000 + "\n……\n".length + 8000)
    expect(clipped.startsWith("头".repeat(16000))).toBe(true)
    expect(clipped.endsWith("尾".repeat(8000))).toBe(true)
    expect(clipped).not.toContain("中")
  })

  it("reports exactly what leaves the browser", () => {
    expect(describeAiWritingDisclosure("rewrite", "一二三四", "全文")).toEqual({
      scope: "selection",
      characters: 4,
    })
    expect(describeAiWritingDisclosure("abstract", "", "正文")).toEqual({
      scope: "document",
      characters: 2,
    })
    // 参考文献动作只发条目，不发明文
    expect(describeAiWritingDisclosure("reference", "忽略", "正文")).toEqual({
      scope: "references",
      characters: 0,
    })
  })

  it("shows the provider host so the user can tell where the text goes", () => {
    expect(providerHostLabel("https://api.example.com/v1")).toBe("api.example.com")
    expect(providerHostLabel("  https://api.example.com/v1  ")).toBe("api.example.com")
    // 填了半截地址时也不能把用户输入吞掉
    expect(providerHostLabel("api.example.com")).toBe("api.example.com")
  })
})

describe("ai writing response handling", () => {
  it("strips only a fence that wraps the whole answer", () => {
    expect(cleanAiWritingText("```\n改写后的句子\n```")).toBe("改写后的句子")
    expect(cleanAiWritingText("```json\n[{}]\n```")).toBe("[{}]")
    // 正文里本来就有的行内代码块不能被当成包裹层剥掉
    expect(cleanAiWritingText("先说 ```code``` 再继续")).toBe("先说 ```code``` 再继续")
  })

  it("accepts a plain array, a fenced array and a single object", () => {
    const item = { id: "a1", type: "article-journal", title: "T" }
    for (const raw of [
      JSON.stringify([item]),
      `\`\`\`json\n${JSON.stringify([item])}\n\`\`\``,
      JSON.stringify(item),
    ]) {
      expect(parseCslItems(raw)).toMatchObject([{ id: "a1", title: "T" }])
    }
  })

  it("keeps only the fields the document model knows", () => {
    const parsed = parseCslItems(
      JSON.stringify([
        {
          id: "a1",
          type: "not-a-type",
          title: "T",
          author: [{ family: "Doe", given: "J", "family-name": "junk" }],
          issued: { "date-parts": [["2024", 3]] },
          nonsense: "drop me",
        },
      ]),
    )

    expect(parsed).toEqual([
      {
        id: "a1",
        type: "article",
        title: "T",
        author: [{ family: "Doe", given: "J" }],
        issued: { "date-parts": [[2024, 3]] },
      },
    ])
  })

  it("drops unusable entries and deduplicates ids", () => {
    const parsed = parseCslItems(
      JSON.stringify([
        { title: "no id" },
        { id: "dup", title: "first" },
        { id: "dup", title: "second" },
      ]),
    )

    expect(parsed).toHaveLength(1)
    expect(parsed?.[0].title).toBe("first")
  })

  it("returns null instead of throwing on junk", () => {
    expect(parseCslItems("模型今天心情不好")).toBeNull()
    expect(parseCslItems("[")).toBeNull()
    expect(parseCslItems("[]")).toBeNull()
  })

  it("refuses a bibliography whose id set changed", () => {
    const current: CslItem[] = [
      paperToCslItem({ id: 1, title: "one" }),
      paperToCslItem({ id: 2, title: "two" }),
    ]
    const reordered = [...current].reverse()

    expect(sameCslIdSet(current, reordered)).toBe(true)
    // 少一条会让正文里的引用标记失去落点
    expect(sameCslIdSet(current, [current[0]])).toBe(false)
    expect(sameCslIdSet(current, [...current, paperToCslItem({ id: 3, title: "three" })])).toBe(false)
    expect(sameCslIdSet(current, [current[0], paperToCslItem({ id: 9, title: "swapped" })])).toBe(false)
  })
})

describe("ai writing edits the document only when asked", () => {
  it("detects a selection that went stale while the suggestion was generating", () => {
    const instance = createEditor("<p>hello world</p>")
    instance.commands.setTextSelection({ from: 1, to: 6 })
    const range = { from: 1, to: 6 }

    expect(isAiWritingRangeStale(instance, range, "hello")).toBe(false)

    instance.commands.insertContentAt(1, "前")
    expect(isAiWritingRangeStale(instance, range, "hello")).toBe(true)
  })

  it("inserts a continuation as its own block instead of splitting the paragraph", () => {
    const instance = createEditor("<p>已有的段落</p>")
    instance.commands.setTextSelection({ from: 1, to: 6 })
    const range = { from: 1, to: 6 }

    expect(applyAiWritingSuggestion(instance, "insert", range, "续写的句子")).toBe(true)

    const html = instance.getHTML()
    expect(html).toContain("已有的段落")
    // 落成两个段落：原文没被从半句中间劈开
    expect([...instance.getJSON().content ?? []].filter((node) => node.type === "paragraph")).toHaveLength(2)
    expect(html).toContain("续写的句子")
  })

  it("replaces inside the paragraph when the suggestion is a single line", () => {
    const instance = createEditor("<p>需要改写的原句</p>")
    instance.commands.setTextSelection({ from: 1, to: 8 })

    expect(applyAiWritingSuggestion(instance, "replace", { from: 1, to: 8 }, "改写后的句子")).toBe(true)

    const paragraphs = [...instance.getJSON().content ?? []].filter((node) => node.type === "paragraph")
    expect(paragraphs).toHaveLength(1)
    expect(instance.getText()).toBe("改写后的句子")
  })

  it("turns a multi-line suggestion into several paragraphs", () => {
    const instance = createEditor("<p>原句</p>")
    instance.commands.setTextSelection({ from: 1, to: 3 })

    applyAiWritingSuggestion(instance, "replace", { from: 1, to: 3 }, "第一段\n第二段")

    const paragraphs = [...instance.getJSON().content ?? []].filter((node) => node.type === "paragraph")
    expect(paragraphs).toHaveLength(2)
    expect(instance.getText()).toBe("第一段\n\n第二段")
  })

  it("leaves the document alone for a blank suggestion", () => {
    const instance = createEditor("<p>原句</p>")
    instance.commands.setTextSelection({ from: 1, to: 3 })

    expect(applyAiWritingSuggestion(instance, "replace", { from: 1, to: 3 }, "   \n  ")).toBe(false)
    expect(instance.getText()).toBe("原句")
  })

  it("rewrites the bibliography without breaking in-text citation numbers", () => {
    const instance = createEditor("<p>body</p>")
    const first = paperToCslItem({ id: 1, title: "First source", doi: "10.1000/first" })
    const second = paperToCslItem({ id: 2, title: "Second source", doi: "10.1000/second" })

    instance.commands.focus("end")
    insertCitation(instance, first)
    insertCitation(instance, second)
    expect(instance.getHTML()).toContain('data-citation-number="1"')

    // Provider 只补了字段，没有增删条目：可以整体回写
    const filled: CslItem[] = collectBibliography(instance.state.doc).map((entry) => ({
      ...entry,
      publisher: "Some Press",
    }))
    expect(replaceBibliographyEntries(instance, filled)).toBe(true)
    expect(collectBibliography(instance.state.doc).map((entry) => entry.id)).toEqual([first.id, second.id])
    expect(collectBibliography(instance.state.doc)[0].publisher).toBe("Some Press")
    expect(instance.getHTML()).toContain('data-citation-number="1"')
    expect(instance.getHTML()).toContain('data-citation-number="2"')

    // 内容没变时不应产生一次无意义的文档变更
    expect(replaceBibliographyEntries(instance, collectBibliography(instance.state.doc))).toBe(false)
  })
})

describe("ai writing toolbar", () => {
  it("disables every action until a provider is configured", () => {
    const instance = createEditor("<p>hello</p>")
    instance.commands.setTextSelection({ from: 1, to: 6 })
    render(withIntl(<AiWritingToolbar editor={instance} onRun={() => undefined} />))

    fireEvent.click(screen.getByRole("button", { name: "AI 写作" }))

    expect(screen.getByText("请先到设置里配置 Provider")).toBeTruthy()
    for (const item of screen.getAllByRole("menuitem")) {
      expect((item as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it("enables selection actions once there is a selection, and blocks references on an empty bibliography", () => {
    useProvider()
    const instance = createEditor("<p>hello</p>")
    instance.commands.setTextSelection({ from: 1, to: 6 })
    render(withIntl(<AiWritingToolbar editor={instance} onRun={() => undefined} />))

    fireEvent.click(screen.getByRole("button", { name: "AI 写作" }))

    expect((screen.getByRole("menuitem", { name: /改写/ }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole("menuitem", { name: /生成摘要/ }) as HTMLButtonElement).disabled).toBe(false)

    const reference = screen.getByRole("menuitem", { name: /参考文献格式化建议/ }) as HTMLButtonElement
    expect(reference.disabled).toBe(true)
    expect(reference.textContent).toContain("暂无参考文献")
  })

  it("hands the current selection and its coordinates to the panel", () => {
    useProvider()
    const instance = createEditor("<p>hello</p>")
    instance.commands.setTextSelection({ from: 1, to: 6 })
    const onRun = vi.fn<(request: AiWritingRequest) => void>()
    render(withIntl(<AiWritingToolbar editor={instance} onRun={onRun} />))

    fireEvent.click(screen.getByRole("button", { name: "AI 写作" }))
    fireEvent.click(screen.getByRole("menuitem", { name: /改写/ }))

    expect(onRun).toHaveBeenCalledWith({
      action: "rewrite",
      range: { from: 1, to: 6 },
      selection: "hello",
      needsDocument: false,
    })
  })
})

const SUGGESTION = "改写后的句子"

function mockCompletion(content: string) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      headers: { "content-type": "application/json" },
    }),
  )
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function renderPanel(
  instance: Editor,
  request: AiWritingRequest,
  handlers: { onClose?: () => void; onApplied?: () => void } = {},
) {
  return render(
    withIntl(
      <AiWritingPanel
        editor={instance}
        request={request}
        onClose={handlers.onClose ?? (() => undefined)}
        onApplied={handlers.onApplied ?? (() => undefined)}
      />,
    ),
  )
}

describe("ai writing panel", () => {
  it("generates on open and tells the user what will be sent, before anything is written", async () => {
    useProvider()
    const instance = createEditor("<p>原始句子</p>")
    instance.commands.setTextSelection({ from: 1, to: 5 })
    mockCompletion(SUGGESTION)

    renderPanel(instance, {
      action: "rewrite",
      range: { from: 1, to: 5 },
      selection: "原始句子",
      needsDocument: false,
    })

    // 披露块在生成出结果之前就已经可见
    expect(screen.getByText("本次会发送给你的 AI 服务")).toBeTruthy()
    expect(screen.getByText("选中文本 4 字符")).toBeTruthy()
    expect(screen.getByText("服务：Test Provider（provider.example）· 模型：test-model")).toBeTruthy()

    const input = await screen.findByLabelText<HTMLTextAreaElement>("AI 建议内容")
    expect(input.value).toBe(SUGGESTION)

    // 拿到建议不等于改动正文 —— 需求的红线就在这里
    expect(instance.getText()).toBe("原始句子")
  })

  it("writes into the document only after the user confirms", async () => {
    useProvider()
    const instance = createEditor("<p>原始句子</p>")
    instance.commands.setTextSelection({ from: 1, to: 5 })
    mockCompletion(SUGGESTION)
    const onApplied = vi.fn()
    const onClose = vi.fn()

    renderPanel(
      instance,
      { action: "rewrite", range: { from: 1, to: 5 }, selection: "原始句子", needsDocument: false },
      { onApplied, onClose },
    )

    await screen.findByLabelText("AI 建议内容")
    fireEvent.click(screen.getByRole("button", { name: "写入正文" }))

    expect(instance.getText()).toBe(SUGGESTION)
    expect(onApplied).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("does not touch the document when the user closes the panel", async () => {
    useProvider()
    const instance = createEditor("<p>原始句子</p>")
    instance.commands.setTextSelection({ from: 1, to: 5 })
    mockCompletion(SUGGESTION)

    renderPanel(instance, {
      action: "rewrite",
      range: { from: 1, to: 5 },
      selection: "原始句子",
      needsDocument: false,
    })

    await screen.findByLabelText("AI 建议内容")
    fireEvent.click(screen.getByRole("button", { name: "取消" }))

    expect(instance.getText()).toBe("原始句子")
  })

  it("sends the whole body and offers no write button for a read-only report", async () => {
    useProvider()
    const instance = createEditor("<p>第一句。第二句。</p>")
    const fetchMock = mockCompletion("第一句。 → 标点问题 → 建议改为逗号")

    renderPanel(instance, {
      action: "grammar",
      range: { from: 1, to: 1 },
      selection: "",
      needsDocument: true,
    })

    expect(screen.getByText("全文正文 8 字符（超长时只发首尾两段）")).toBeTruthy()
    await screen.findByText(/标点问题/)

    expect(screen.queryByRole("button", { name: "写入正文" })).toBeNull()
    // 报告动作发的是全文
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(JSON.stringify(body.messages)).toContain("第一句。第二句。")
    // 正文一点没动
    expect(instance.getText()).toBe("第一句。第二句。")
  })

  it("explains itself instead of silently doing nothing when no provider is available", () => {
    const instance = createEditor("<p>原始句子</p>")
    instance.commands.setTextSelection({ from: 1, to: 5 })

    renderPanel(instance, {
      action: "rewrite",
      range: { from: 1, to: 5 },
      selection: "原始句子",
      needsDocument: false,
    })

    expect(screen.getByRole("alert").textContent).toContain("未找到可用的 Provider")
    expect((screen.getByRole("button", { name: "生成建议" }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("asks for the target language before translating", async () => {
    useProvider()
    const instance = createEditor("<p>hello</p>")
    instance.commands.setTextSelection({ from: 1, to: 6 })
    const fetchMock = mockCompletion("你好")

    renderPanel(instance, {
      action: "translate",
      range: { from: 1, to: 6 },
      selection: "hello",
      needsDocument: false,
    })

    // 翻译要先选目标语言，打开面板时不应该已经发过一次请求
    expect(fetchMock).not.toHaveBeenCalled()
    const select = screen.getByRole("combobox") as HTMLSelectElement
    fireEvent.change(select, { target: { value: "日本語" } })
    fireEvent.click(screen.getByRole("button", { name: "生成建议" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.messages[0].content).toContain("日本語")
  })
})
