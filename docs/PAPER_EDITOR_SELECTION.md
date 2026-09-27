# 开源论文编辑器调研与选型

> 需求编号：`REQ-202609-0255`（配套文档：[从 reader 走向 writer 的需求整理与迭代规划](WRITER_ROADMAP.md)）
> 调研取数日期：**2026-09-26（UTC）**
> 取数方式：GitHub REST API（`gh api repos/{owner}/{repo}`）与 npm registry（`registry.npmjs.org/{pkg}`）**逐项实测**，下表数值即实测返回值，不是转述。
> 说明：本轮环境中网页搜索工具返回异常（返回了一段残缺的工具调用片段而非搜索结果），因此调研**不以搜索摘要为据**，只采信 API 可直接验证的客观字段（star 数、许可证 SPDX、最后推送时间、语言、包版本）。凡无法实测确认的结论，本文一律标注「需核实」，不做推断性陈述。

---

## 1. 结论摘要

1. **没有一款开源"论文编辑器"可以整体直接嵌入本项目。** 现存项目分三类，各自都不满足"当组件用"这个前提：
   - **完整应用**（Fidus Writer / Overleaf / TeXlyre / HedgeDoc / ONLYOFFICE）：自带后端、账号体系和数据库，引入等于并行跑第二套系统。
   - **排版引擎**（Typst / Pandoc / Quarto / MyST）：没有编辑界面，但**可以且应该**作为服务端导出后端被"直接借用"。
   - **桌面软件**（Zettlr）：无法嵌入 Web。
2. **编辑器内核继续用 Tiptap 3。** 它是本仓库**已有依赖**（锁文件 3.27.3），MIT 许可，38.5k stars，2026-09-25 仍在推送。所谓"引入开源编辑器"，在这个架构下的正确形态是**补齐 Tiptap 的官方 MIT 扩展**，而不是换一个编辑器产品。
3. **排版与导出借用 Typst（首选）或 Pandoc（覆盖最广）**，以独立进程调用。
4. **引用能力借用 CSL 生态 + 项目已有的 DOI/arXiv 元数据补全**，不自己发明引文格式。
5. **协作能力借用 Yjs + Hocuspocus**（均 MIT），但**被现有 `/ws` 身份债阻塞**，必须排在安全修复之后。
6. **唯一没有现成免费方案的点是脚注**：npm 上 `@tiptap/extension-footnotes` 与 `@tiptap-pro/extension-footnotes` 实测均返回 HTTP 404，需要自研或另行评估授权。

预期架构（详见第 5 节）：

```
富文本编辑层   Tiptap 3 + 官方 MIT 扩展（数学/表格/唯一ID/Markdown）
                  │  正文 JSON + HTML
存储层         pr_papers 正文列（Flyway V16）
                  │
引用层         CSL 模板 + citation-js（MIT）+ 已有 DOI/arXiv/Crossref 元数据
                  │
导出层         Typst CLI（Apache-2.0） 或 Pandoc（GPL-2.0），独立进程
                  │
协作层（后置）  Yjs + Hocuspocus（MIT）
```

---

## 2. 候选对比（实测数据）

### 2.1 编辑器内核类

| 项目 | Stars | 许可证 | 最后推送 | 语言 | 判断 |
| --- | --- | --- | --- | --- | --- |
| [ueberdosis/tiptap](https://github.com/ueberdosis/tiptap) | 38528 | MIT | 2026-09-25 | TypeScript | **✅ 采用**（已是本项目依赖） |
| [fiduswriter/fiduswriter](https://github.com/fiduswriter/fiduswriter) | 567 | AGPL-3.0 | 2026-09-22 | JavaScript | ❌ 完整应用，非组件 |
| [overleaf/overleaf](https://github.com/overleaf/overleaf) | 18184 | AGPL-3.0 | 2026-09-17 | JavaScript | ❌ 完整应用，非组件 |
| [TeXlyre/texlyre](https://github.com/TeXlyre/texlyre) | 963 | （未返回） | 2026-09-16 | （未返回） | ⚠️ 活跃的 Overleaf 分支（local-first LaTeX & Typst），仍属完整应用 |
| [SwiftLaTeX/SwiftLaTeX](https://github.com/SwiftLaTeX/SwiftLaTeX) | 2319 | AGPL-3.0 | **2024-06-18** | C | ❌ 已近两年无推送，不适合作为新地基 |
| [ether/etherpad](https://github.com/ether/etherpad) | 18555 | Apache-2.0 | 2026-09-25 | TypeScript | ⚠️ 多人协作纯文本，能力弱于 Tiptap 方案 |
| [hedgedoc/hedgedoc](https://github.com/hedgedoc/hedgedoc) | 7444 | AGPL-3.0 | 2026-09-25 | TypeScript | ❌ Markdown 协作应用，非学术文档模型 |

### 2.2 排版与导出引擎类

| 项目 | Stars | 许可证 | 最后推送 | 语言 | 判断 |
| --- | --- | --- | --- | --- | --- |
| [typst/typst](https://github.com/typst/typst) | 56251 | Apache-2.0 | 2026-09-24 | Rust | **✅ 首选 PDF 引擎** |
| [jgm/pandoc](https://github.com/jgm/pandoc) | 46409 | GPL-2.0 | 2026-09-25 | Haskell | **✅ 格式覆盖面最广（DOCX/LaTeX/BibTeX）** |
| [quarto-dev/quarto-cli](https://github.com/quarto-dev/quarto-cli) | 6025 | NOASSERTION | 2026-09-25 | JavaScript | ⚠️ 构建在 Pandoc 之上，多一层模板体系；本项目不需要科学计算叙事 |
| [Myriad-Dreamin/typst.ts](https://github.com/Myriad-Dreamin/typst.ts) | 1227 | Apache-2.0 | 2026-09-24 | TypeScript | ⚠️ **浏览器内**跑 Typst，可用于"导出前预览"，非必需 |
| [Myriad-Dreamin/tinymist](https://github.com/Myriad-Dreamin/tinymist) | 3554 | Apache-2.0 | 2026-09-20 | （未返回） | ⚠️ Typst 语言服务，仅在走"源码模式"时有用 |

### 2.3 引用与文献类

| 项目 | Stars | 许可证 | 最后推送 | 判断 |
| --- | --- | --- | --- | --- |
| [citation-js/citation-js](https://github.com/citation-js/citation-js) | 212 | MIT | 2026-09-18 | **✅ CSL/BibTeX/RIS/DOI 解析，MIT，可直接用** |
| [zotero/zotero](https://github.com/zotero/zotero) | 15396 | NOASSERTION | 2026-09-25 | ⚠️ 桌面文献管理器，参考其 CSL 实践，不嵌入 |
| [Zettlr/Zettlr](https://github.com/Zettlr/Zettlr) | 13580 | GPL-3.0 | 2026-09-22 | ❌ 桌面端 |

npm 实测（版本 / 许可证）：

| 包 | 版本 | 许可证 |
| --- | --- | --- |
| `citation-js` | 0.9.0 | MIT |
| `@citation-js/plugin-csl` | 0.9.0 | MIT |
| `@citation-js/plugin-bibtex` | 0.9.0 | MIT |
| `biblatex-csl-converter` | 3.6.0 | **LGPL-3.0**（Fidus Writer 用的转换器，LGPL 在前端打包场景需单独评估，非必要不用） |
| `citeproc-js` | **HTTP 404**（npm 上不存在该包名，CSL 处理器的许可证**需核实**；`@citation-js/plugin-csl` 是 MIT，优先走它） |

### 2.4 数学排版类

| 包 / 项目 | 版本 / Stars | 许可证 | 判断 |
| --- | --- | --- | --- |
| `@tiptap/extension-mathematics` | 3.31.3 | MIT | **✅ 首选**（LaTeX 数学扩展，基于 KaTeX） |
| [KaTeX/KaTeX](https://github.com/KaTeX/KaTeX)（`katex`） | 20403 / 0.18.9 | MIT | ✅ 渲染引擎 |
| [arnog/mathlive](https://github.com/arnog/mathlive)（`mathlive`） | 2163 / 0.110.0 | MIT | ⚠️ 更强的**输入**体验（可视化公式键盘），可作后续增强 |

### 2.5 协作类

| 包 / 项目 | 版本 / Stars | 许可证 | 判断 |
| --- | --- | --- | --- |
| [yjs/yjs](https://github.com/yjs/yjs)（`yjs`） | 22844 / 13.6.33 | MIT | ✅ CRDT 内核 |
| `y-prosemirror` | 1.3.7 | MIT | ✅ ProseMirror 绑定（Tiptap 底层就是 ProseMirror） |
| [ueberdosis/hocuspocus](https://github.com/ueberdosis/hocuspocus)（`@hocuspocus/server`） | 2600 / 4.7.0 | MIT | ✅ 协作后端，与 Tiptap 同厂 |
| `@tiptap/extension-collaboration` / `-caret` | 3.31.3 | MIT | ✅ 编辑器侧接入 |

### 2.6 Office 文档类（备选路线，本次不采用）

| 项目 | Stars | 许可证 | 最后推送 | 判断 |
| --- | --- | --- | --- | --- |
| [ONLYOFFICE/DocumentServer](https://github.com/ONLYOFFICE/DocumentServer) | 6944 | AGPL-3.0 | 2026-07-22 | ⚠️ 可嵌入的 DOCX 协同编辑器，但引入**独立文档服务器 + 自有存储**，且 AGPL；只有"必须以 DOCX 为唯一权威格式"时才值得 |
| [CollaboraOnline/online](https://github.com/CollaboraOnline/online) | 3356 | NOASSERTION | 2026-09-25 | ⚠️ 同上，主开发在 Gerrit 上 |

### 2.7 Tiptap 官方扩展（npm 实测，全部 3.31.3 / MIT）

可用且与本需求直接相关：`extension-mathematics`、`extension-table`、`extension-unique-id`、`extension-collaboration`、`extension-collaboration-caret`、`extension-character-count`、`extension-subscript`、`extension-superscript`、`extension-highlight`、`extension-text-align`、`extension-link`、`extension-image`、`extension-file-handler`、`extension-task-list`、`extension-typography`、`suggestion`、`static-renderer`、`@tiptap/markdown`（Markdown 解析/序列化）。

**`@tiptap/extension-footnotes` 与 `@tiptap-pro/extension-footnotes` 均返回 HTTP 404** → 公开 npm 上不存在免费脚注扩展。
**`@tiptap/extension-markdown` 不存在**，Markdown 支持的包名是 **`@tiptap/markdown`**（写代码时不要按错包名）。

> 关于免费 / 付费边界：本文只断言"能在公开 npm 上查到"的部分（上列均为 MIT / 3.31.3）。**凡不在公开 npm 上的 Tiptap 能力（如文档转换、评论、版本历史等），一律视为 Pro 付费项 —— 这条是推断，立项时必须二次核实**，不要据此做预算决策。

---

## 3. 为什么"引入某个论文编辑器"不成立

| 候选 | 类型 | 为什么不能"直接借用" |
| --- | --- | --- |
| Fidus Writer | 完整应用 | 自带 Django + 自有数据库 + 自有用户体系。嵌入 = 第二套账号、第二套数据、无法与现有论文/引用/分享打通；AGPL-3.0 还带网络服务条款。其技术栈（JavaScript + Django）与本项目 Next.js/Kotlin 不重叠，抽源码 ≈ 重写。 |
| Overleaf | 完整应用 | 后端是 Node + TeX Live，强绑定 LaTeX 源码工作流；AGPL-3.0。本项目用户是**阅读**论文的用户，要的是所见即所得的富文本，不是 LaTeX 编辑器。 |
| TeXlyre | Overleaf 分支 | 虽然活跃（2026-09-16）且加了 local-first 与 Typst，但形态仍是完整应用（还配套 chelys 桌面端与独立基础设施仓库），同样不可嵌入。 |
| SwiftLaTeX | 浏览器内 LaTeX | 2024-06 后无推送，且是 WYSIWYG LaTeX 编辑器，路线与本项目不同。 |
| Typst / Pandoc / Quarto | 排版引擎 | **没有编辑界面** —— 不能当编辑器用，但正是合适的**导出后端**（见第 5 节）。 |
| Zettlr | 桌面软件 | 无法嵌入 Web 应用。 |

**根因**：这些项目的"论文"语义都建立在**源码/文件 + 编译**之上（LaTeX、Markdown），而本需求要求的是"创建的论文可以自由编辑"，即 WYSIWYG 富文本编辑。两者不是同一类东西。所以正确的复用方式是**分层复用**：编辑层用 Tiptap，排版层用 Typst/Pandoc，引用层用 CSL。

---

## 4. 许可证风险

| 组件 | 许可证 | 用法 | 风险 |
| --- | --- | --- | --- |
| Tiptap 3 及官方扩展 | MIT | 前端依赖 | 无 |
| KaTeX / `@tiptap/extension-mathematics` | MIT | 前端依赖 | 无 |
| Yjs / y-prosemirror / Hocuspocus | MIT | 前端 + 协作服务 | 无 |
| citation-js 及 plugin-csl / plugin-bibtex | MIT | 前端或后端 | 无 |
| Typst CLI | Apache-2.0 | **独立进程**调用 | 低；随包分发需保留 NOTICE/许可证 |
| Pandoc | GPL-2.0 | **独立进程**调用 | 独立进程调用不构成链接；**若随产品分发二进制，需履行 GPL 义务（提供对应源码）** —— 建议只在服务端安装，不分发给终端用户 |
| `biblatex-csl-converter` | LGPL-3.0 | 若前端打包使用 | 需单独评估；有 MIT 的 citation-js 可选时不要引入 |
| Fidus Writer / Overleaf / TeXlyre / ONLYOFFICE | AGPL-3.0 | 若整体引入 | **网络服务条款会传染到本项目**：修改后通过网络提供服务即须开源整个衍生作品。这是排除它们的独立理由（与架构原因并列） |
| Tiptap Pro 扩展 | 商业许可 | 若采购 | 需确认授权范围、是否允许 SaaS 分发、按席位还是按项目计费 —— **未核实，需立项确认** |
| `citeproc-js` | **需核实** | 若直接用 CSL 处理器 | npm 上无同名的公开包，许可证未实测确认；优先用 MIT 的 `@citation-js/plugin-csl` |

---

## 5. 推荐方案与落地顺序

**编辑层（第 1 步）**：Tiptap 3.27.3（现有）→ 按需升到 3.31.3 并补齐 `extension-mathematics`、`extension-table`、`extension-unique-id`、`@tiptap/markdown` 等 MIT 扩展。**升级 Tiptap 单独一轮迭代**，不要和功能开发混在一起（仓库既有纪律：依赖升级不搭车）。

**导出层（第 2 步）**：服务端安装 Typst（首选，Apache-2.0，单二进制，中文与公式支持好）与 Pandoc（补 DOCX/LaTeX 覆盖面）。以**独立进程**方式调用，必须带：超时、并发上限、临时目录隔离、输入大小上限、错误脱敏。

**引用层（第 3 步）**：引用节点存 CSL-JSON 条目 ID；文献来源复用已有 `/api/papers/{id}/metadata/*`（arXiv/Crossref/DataCite/DBLP）与 `pr_paper_metadata_resolutions`；格式化用 CSL 模板 + citation-js。

**协作层（最后）**：Yjs + Hocuspocus。**前置条件**：修好 `/ws` 的 STOMP 身份绑定（现状 `senderId` 来自客户端，可伪造，见 [PROJECT_STATUS.md](PROJECT_STATUS.md) 第 11 节）。在身份问题解决前不要上线协作编辑。〔**已落地（`v0.1.63` / W7）**：身份债已由 `StompAuthChannelInterceptor` 还清；协作层**未采用 Hocuspocus**（会多一个独立 Node 进程 / 新基础设施，不合本项目「一后端 + PM2 + Apache 反代」拓扑），改为 **Yjs 直接骑既有 Spring STOMP `/ws`**、服务端只做带鉴权的中继 + 全量快照持久化、不引入服务端 Yjs——详见 [W7_COLLABORATION_TECHNICAL_SOLUTION.md](W7_COLLABORATION_TECHNICAL_SOLUTION.md)。〕

**明确不做**：不引入 Fidus Writer / Overleaf / TeXlyre / ONLYOFFICE / Collabora / HedgeDoc 作为编辑器内核；不引入 Zettlr / SwiftLaTeX；不在本期引入 Quarto 的叙事模板体系。

---

## 6. 立项前必须做的验证（PoC 清单）

每条都要有可复现的实测结论，不能只给方案：

1. **Typst 中文学术排版 PoC**：用一份含中文标题、公式、表格、脚注、参考文献的样例，验证 Typst 输出的 PDF 中文字体与公式保真度。
2. **Pandoc DOCX PoC**：同样的样例导出 DOCX，检查公式（OMML）、表格、引用编号在 Word 中的表现。
3. **Tiptap JSON ↔ Markdown 往返 PoC**：验证 `@tiptap/markdown` 对公式、表格、自定义引用节点的往返是否无损（官方标注 early release，且表格单元格只允许一个子节点 —— 必须实测，不能假定可用）。
4. **脚注 spike**：评估自研脚注 Node 的成本，或核实 Tiptap Pro 授权条款与价格。
5. **正文体积与写放大实测**：一篇 3 万字正文的 JSON/HTML 体积，以及 2 秒防抖自动保存下的数据库写入频率。
6. **Tiptap 3.27.3 → 3.31.3 升级影响面**：确认 starter-kit / placeholder 的现有用法无破坏性变更。

---

## 7. 本次调研的局限

- 网页搜索工具在本轮环境返回异常，**未能采信任何搜索结果或博客/评测对比**；本文全部结论基于 GitHub API 与 npm registry 的实测字段，属于"项目活跃度 + 许可证 + 生态构成"层面的客观数据，**不包含对各项目编辑体验的主观评测**。
- 上文 Tiptap 免费/付费边界中"不在 npm 上即属 Pro"是推断，**需二次核实**。
- `TeXlyre` 与 `CollaboraOnline` 的许可证字段 GitHub API 未返回 SPDX 标识（NOASSERTION / 缺失），**需进入仓库核实**；这不影响本文结论，因为它们已被架构理由排除。
- star 数与推送时间会随时间变化，本文数值以 **2026-09-26** 为准。
