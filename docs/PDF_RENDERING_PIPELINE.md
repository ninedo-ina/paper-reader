# PDF 渲染全链路技术分析

> paper-reader 项目 PDF 阅读器从上传到浏览器渲染的端到端链路分析
> 编写日期: 2026-07-16 | 当前分支: feature/v0.1.8

---

## 1. 整体架构概览

### 1.1 端到端数据流

```
                          ┌─────────────┐
                          │   浏览器     │
                          └──────┬──────┘
                                 │  ① 用户上传 PDF / 选择论文
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          前端 (Next.js 15)                           │
│                                                                      │
│  ┌──────────┐    ┌──────────────────┐    ┌───────────────────────┐  │
│  │   Page   │───▶│ PaperContentArea │───▶│      PDFViewer        │  │
│  │ (首页)    │    │ (论文内容区)       │    │ (dynamic import,      │  │
│  └──────────┘    └──────────────────┘    │  ssr:false 包装)      │  │
│                                           └───────────┬───────────┘  │
│                                                       │              │
│  ② GET /papers/{id}     ⑥ GET /papers/{id}/download   │              │
│  ┌──────────────────┐   ┌──────────────────────────┐   │              │
│  │  PaperDetailDto  │   │  PDF Binary (ByteArray)  │   │              │
│  └──────────────────┘   └──────────────────────────┘   │              │
│                                          ┌──────────────▼──────────┐ │
│  ③ 数据处理                    ┌────────│        PDFReader         │ │
│  ┌───────────┐                 │        │  react-pdf Document/Page │ │
│  │ PaperStore│                 │        │  + AnnotationLayer 覆盖   │ │
│  └───────────┘                 │        └──────────────────────────┘ │
│  ┌───────────┐    ④ 加载批注   │                                     │
│  │ReaderStore│◀────annotations │  ⑦ 用户交互                        │
│  │ Zustand   │    /notes API   │  ┌──────────────────────────────┐  │
│  └───────────┘                 │  │ 文本选中 → 弹出菜单 → 批注/    │  │
│                                │  │ 笔记创建 → AnnotationDialog   │  │
│  ⑤ 渲染覆盖层                   │  │ → API 提交 → ReaderStore 更新 │  │
│  ┌──────────────────┐          │  └──────────────────────────────┘  │
│  │ AnnotationLayer  │──────────┘                                    │
│  │ UnderlineMarker  │                                               │
│  │ PopupMenu        │                                               │
│  │ findTextPositions│                                               │
│  └──────────────────┘                                               │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                                 │  HTTP REST (JWT Bearer Token)
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       后端 (Kotlin/Spring Boot)                       │
│                                                                      │
│  ┌────────────────┐     ┌──────────────────┐    ┌────────────────┐  │
│  │ PaperController│────▶│   PaperService   │───▶│PaperRepository │  │
│  │  upload/download│     │ uploadPdf        │    │ (JPA/Hibernate)│  │
│  │  CRUD          │     │ uploadFromUrl     │    │                │  │
│  └────────────────┘     │ createPaper       │    └───────┬────────┘  │
│                          │ downloadPaper     │            │          │
│  ┌────────────────┐     │ deletePaper       │    ┌───────▼────────┐  │
│  │AnnotationCtrl  │     │ parsePdf          │    │  PostgreSQL    │  │
│  │NoteController  │     └──┬─────────┬──────┘    │  pr_papers     │  │
│  └────────────────┘        │         │           │  grobidResult  │  │
│                             │         │           │  (jsonb)       │  │
│                             ▼         ▼           └────────────────┘  │
│  ┌────────────────┐  ┌─────────┐  ┌──────────┐                      │
│  │FileStorageSvc  │  │GrobidClient│ │  dufs    │                      │
│  │ store/read/del │  │processHeader│ │ port:8400│                      │
│  │local │ dufs    │  │processFulltext│           │                      │
│  └───┬───┬────────┘  └─────┬─────┘  └──────────┘                      │
│      │   │                 │                                          │
│      │   │    ┌────────────▼────────────┐                             │
│      │   │    │ GROBID (Docker 0.8.1)   │                             │
│      │   │    │ port:8070               │                             │
│      │   │    │ processHeaderDocument   │                             │
│      │   │    │ → TEI XML               │                             │
│      │   │    └─────────────────────────┘                             │
│      ▼   ▼                                                            │
│  ┌──────────┐   ┌──────────────┐                                     │
│  │ 本地磁盘  │   │  S3 / OSS 等 │                                     │
│  │ ./uploads│   │  (通过 dufs) │                                     │
│  └──────────┘   └──────────────┘                                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.2 关键数据流步骤

| 步骤 | 描述 | 涉及组件 |
|------|------|----------|
| ① | 用户上传 PDF 或选择论文 | Page → PaperContentArea |
| ② | 后端接收 PDF，存储文件，GROBID 解析元数据 | PaperService.uploadPdf() |
| ③ | 前端获取 PaperDetailDto，存入 PaperStore | paper-store.ts |
| ④ | 前端加载该论文的批注/笔记列表 | loadAnnotations / loadNotes |
| ⑤ | AnnotationLayer 计算覆盖层位置 | findTextPositions |
| ⑥ | react-pdf 通过 JWT 认证的 URL 下载 PDF 二进制并渲染 | Document file prop |
| ⑦ | 用户选中文本创建批注/笔记，乐观更新到 ReaderStore | handleCreateAnnotation |

### 1.3 技术栈一览

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| PDF 渲染引擎 | pdfjs-dist | 5.4.296 | Mozilla PDF.js，react-pdf 的底层依赖 |
| React 封装 | react-pdf | 10.4.1 | 提供 `<Document>` / `<Page>` React 组件 |
| Worker | pdf.worker.min.mjs | 5.4.296 | 从 unpkg CDN 动态加载 |
| 前端框架 | Next.js + React | 15 / 19 | App Router |
| 状态管理 | Zustand | - | PaperStore + ReaderStore |
| 后端框架 | Kotlin / Spring Boot | - | REST API |
| PDF 解析 | GROBID | 0.8.1 (Docker) | 机器学习 PDF 元数据提取，返回 TEI XML |
| 文件存储 | dufs / 本地文件系统 | - | HTTP 文件服务器或本地磁盘 |
| 数据库 | PostgreSQL | - | grobidResult 存为 jsonb |

---

## 2. 分层分析

将渲染链路拆为三层，标注可修改程度：

### 2.1 Layer 0 — 底层不可改

这些是外部依赖，内部逻辑无法修改，只能通过配置或 patch 影响行为。

| 组件 | 文件/位置 | 职责 | 为什么不可改 |
|------|----------|------|-------------|
| **pdfjs-dist** | `node_modules/pdfjs-dist` | PDF 解析、字体渲染、文本提取、Canvas 绘制 | Mozilla 维护的开源库，数百万行代码 |
| **pdf.worker** | unpkg CDN: `pdfjs-dist@5.4.296/build/pdf.worker.min.mjs` | 在 Web Worker 中解析 PDF（不阻塞主线程） | pdfjs 内置，通过 `GlobalWorkerOptions.workerSrc` 指定来源 |
| **react-pdf Document** | `react-pdf/dist/cjs/Document.js` | 接收 PDF 文件源，管理 pdfjs 的 `PDFDocumentProxy` 对象 | react-pdf 库内部实现 |
| **react-pdf Page** | `react-pdf/dist/cjs/Page.js` | 渲染单页 PDF：Canvas 层 + TextLayer + AnnotationLayer | react-pdf 库内部实现 |
| **浏览器 Canvas** | 浏览器原生 API | PDF 页面的像素级渲染 | 浏览器底层，无法干预 |
| **浏览器 TextLayer DOM** | react-pdf 生成的 DOM | `span[role="presentation"]` 文本节点，提供文本选择和复制能力 | react-pdf 内部生成，结构由 pdfjs 控制 |
| **GROBID** | Docker `lfoppiano/grobid:0.8.1` | PDF → TEI XML 元数据提取 | 独立微服务，只能通过 HTTP API 调用 |

**可影响的方式**：
- pdfjs-dist 通过 **patch**（`patches/pdfjs-dist@5.4.296.patch`）修改 webpack bundle 输出，解决变量冲突和空值兼容性问题
- react-pdf 通过组件 props（`file`, `onLoadSuccess`, `onLoadProgress`, `scale`, `renderTextLayer`）控制行为
- GROBID 通过 HTTP 请求参数（`segment`, `consolidateHeader`）控制处理行为

### 2.2 Layer 1 — 可改但需谨慎

修改这些部分会影响整个渲染管线，功能可用但不优化。

| 模块 | 当前实现 | 所属文件 | 风险等级 | 说明 |
|------|---------|----------|---------|------|
| **PDF 下载方式** | `GET /papers/{id}/download` 返回完整 `ByteArrayResource` | `PaperController.kt:113-123` | 中 | 无 HTTP Range 请求，大 PDF 首次加载慢。改这个需前后端联动 |
| **JWT 认证传递** | `file = { url, httpHeaders: { Authorization: "Bearer ..." } }` | `PDFReader.tsx:213-217` | 中 | react-pdf 内部 fetch 不走封装的 client.ts，token 过期时无自动刷新 |
| **pdfjs-dist patch** | `patches/pdfjs-dist@5.4.296.patch` | `patches/` | 高 | 修改 webpack 内部变量名、空值保护。与版本强绑定，升级 react-pdf 需重新生成 |
| **坐标系统选型** | 基于 viewport 绝对坐标 + layer 相对坐标 | `AnnotationLayer.tsx:44-82` | **高** | 这是整个批注定位方案的根基。存的是某次渲染时的坐标，非 PDF 原生坐标。改用 PDF 原生坐标需重构整个 AnnotationLayer + 数据库 schema |
| **webpack 配置** | `next.config.ts` 强制 `cheap-module-source-map` | `next.config.ts` | 低 | pdfjs-dist ESM 与 eval-* devtool 不兼容 |

### 2.3 Layer 2 — 可自由修改

这些是项目自有的业务层代码，可以独立修改不破坏渲染管线。

| 模块 | 文件 | 主要功能 | 修改自由度 |
|------|------|---------|-----------|
| **AnnotationLayer** | `AnnotationLayer.tsx` (557行) | 文本选区检测、弹出菜单、划线渲染 | 完全自由 |
| **UnderlineMarker** | `AnnotationLayer.tsx:474-493` | 绝对定位 div 渲染彩色下划线 | 完全自由 — 可替换为 Canvas/SVG |
| **findTextPositions** | `AnnotationLayer.tsx:90-239` | 四级 fallback 文本匹配算法 | 完全自由 — 可替换为 pdfjs 原生 API |
| **useTextMatchPositions** | `AnnotationLayer.tsx:246-322` | 30 帧重试等待 TextLayer 渲染 | 完全自由 |
| **PDFReader** | `PDFReader.tsx` (353行) | 工具栏 UI、缩放控制、翻页、对话框调度 | 完全自由 |
| **ReaderStore** | `reader-store.ts` (155行) | Zustand 状态管理、乐观更新、DTO 转换 | 完全自由 |
| **AnnotationDialog** | `AnnotationDialog.tsx` | 批注/笔记创建编辑对话框 | 完全自由 |
| **RightPanel** | `RightPanel.tsx` | 右侧边栏批注/笔记列表 | 完全自由 |
| **PDFViewer** | `PDFViewer.tsx` | dynamic import + 空状态占位 | 完全自由 |
| **后端 API** | `AnnotationController.kt` `NoteController.kt` | 批注/笔记 CRUD 接口 | 完全自由 |

---

## 3. 关键技术细节

### 3.1 坐标系统转换链

批注/笔记的坐标在以下环节之间流转：

```
┌─────────────────────────────────────────────────────────────────┐
│ 环节 1: 用户选中文本（浏览器 viewport 坐标）                       │
│                                                                   │
│  window.getSelection()                                            │
│    → range.getClientRects()           // 每行一个 DOMRect          │
│    → [{ x, y, width, height }...]     // viewport 绝对坐标         │
│                                    ↕                               │
│ 环节 2: 转换为 layer 相对坐标                                     │
│                                                                   │
│  toLayerRelative(rects, layerRect)                                │
│    → x: r.x - layerRect.left         // 减去 layer 的 viewport 位移│
│    → y: r.y - layerRect.top                                       │
│                                    ↕                               │
│ 环节 3: 存储到后端（该次渲染的快照坐标）                             │
│                                                                   │
│  POST /api/annotations                                            │
│  body: { position: { x, y, width, height },                       │
│          positions: [{ x,y,width,height }...] }                   │
│  → PostgreSQL jsonb 列存储                                        │
│                                    ↕                               │
│ 环节 4: 打开论文时加载并转换类型                                    │
│                                                                   │
│  GET /api/annotations/paper/{id}                                  │
│  → AnnotationDto.position: Record<string, unknown>                │
│  → reader-store.ts 转为 PositionRect                              │
│      { x: Number(pos.x ?? 0), y: Number(pos.y ?? 0), ... }       │
│                                    ↕                               │
│ 环节 5: 重新匹配到当前 viewport（关键补救步骤）                      │
│                                                                   │
│  useTextMatchPositions(anchors, pageNum, scale)                   │
│  → findTextPositions(text, pageNumber)  // 通过文本找到当前 DOM 位置│
│  → range.getClientRects()               // 获取当前 viewport 坐标  │
│  → toLayerRelative(...)                 // 转为当前 layer 相对坐标 │
│                                                                   │
│  mergeAnchors() 优先使用 matchedPositions（实时匹配）                │
│  匹配失败时 fallback 到存储的坐标                                   │
└─────────────────────────────────────────────────────────────────┘
```

**核心问题**：数据库存储的是**某一次渲染时的坐标快照**，而非 PDF 原生坐标。这意味着——如果窗口大小、字体缩放、PDF 版本发生变化，存储的坐标会失效。系统通过**文本匹配**来补救，但匹配不一定总能成功。

### 3.2 文本匹配算法详解

**文件**: `frontend/src/components/reader/AnnotationLayer.tsx` — `findTextPositions()` (第 90-239 行)

```typescript
function findTextPositions(searchText: string, pageNumber: number): PositionRect[] | null
```

#### 算法流程

```
输入: searchText (批注的 quotedText), pageNumber
       │
       ▼
┌─ Step 1: 收集文本 span ─────────────────────────────────────┐
│                                                              │
│  el = page.querySelector(`[data-page-number="${page}"]`)     │
│  spans = el.querySelectorAll('span[role="presentation"]')    │
│  entries = spans.map(s => ({                                 │
│    el: s,                                                    │
│    text: s.textContent,                                      │
│    start: 累积长度,                                          │
│    end: 累积长度 + s.textContent.length                       │
│  }))                                                         │
│  fullText = entries.map(e => e.text).join('')                │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌─ Step 2: 四级匹配 ──────────────────────────────────────────┐
│                                                              │
│  Level 0: idx = fullText.indexOf(searchText)                 │
│    直接逐字符匹配                                            │
│                                                              │
│  Fallback 1: stripInvisible(fullText).indexOf(...)           │
│    移除零宽字符 (zero-width space, RTL marks 等) 后重试      │
│                                                              │
│  Fallback 2: collapseWhitespace 匹配                         │
│    将连续空白折叠为单个空格后匹配，                            │
│    通过逐字符映射找回原始位置                                  │
│                                                              │
│  Fallback 3: Unicode NFKD 归一化                              │
│    "fi".normalize("NFKD") → "fi" (展开连字)                  │
│    处理 PDF 中 fi/fl/ffl 等连字符导致的匹配失败               │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌─ Step 3: 定位文本节点 ──────────────────────────────────────┐
│                                                              │
│  找到匹配位置所在的 span                                     │
│  walker = document.createTreeWalker(span.el, SHOW_TEXT)      │
│  遍历 Text 节点找到精确的字符级别偏移量                        │
│  range.setStart(startTextNode, startOffset)                  │
│  range.setEnd(endTextNode, endOffset)                        │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌─ Step 4: 获取精确坐标 ──────────────────────────────────────┐
│                                                              │
│  rects = range.getClientRects()    // 每行一个 DOMRect        │
│  → toLayerRelative(rects, layerRect)                         │
│  → [{ x, y, width, height }...]                              │
└──────────────────────────────────────────────────────────────┘
```

#### 匹配等待机制

```typescript
// useTextMatchPositions hook (AnnotationLayer.tsx:246-322)
// 最多重试 30 帧 (~500ms @ 60fps)，等待 react-pdf TextLayer 渲染完成
const maxAttempts = 30
let attempts = 0

function attemptMatch() {
  const positions = findTextPositions(text, pageNumber)
  if (positions) {
    setMatchedPositions(...)
  } else if (attempts++ < maxAttempts) {
    requestAnimationFrame(attemptMatch)
  }
}
```

**触发时机**: 当 `[anchors, pageNumber, scale]` 变化时（即缩放或翻页导致 react-pdf 重新渲染 TextLayer）

### 3.3 批注覆盖层 DOM 结构

```
<div ref={layerRef} className="relative w-fit mx-auto">   ← AnnotationLayer 容器
  │
  ├── <Page pageNumber={n} scale={scale}
  │        renderTextLayer={true}
  │        renderAnnotationLayer={true} />
  │     │
  │     ├── <canvas className="react-pdf__Page__canvas" />   ← Canvas 渲染层
  │     ├── <div className="react-pdf__Page__textContent">  ← TextLayer
  │     │     └── <span role="presentation">文本片段</span>  ← 可选中文本
  │     └── <div className="react-pdf__Page__annotations" /> ← react-pdf 内置 AnnotationLayer
  │
  ├── {/* 弹出菜单 — fixed 定位，不受 layer 滚动影响 */}
  │   {popup && (
  │     <div className="fixed z-50" style={{ left: popup.x, top: popup.y }}>
  │       <button>创建批注</button>
  │       <button>创建笔记</button>
  │       <button>询问AI</button>
  │       <button>复制文本</button>
  │     </div>
  │   )}
  │
  └── {/* 下划线标记 — absolute 定位，相对 layer */}
      {matchedAnchors.map(anchor =>
        anchor.matchedPositions.map(rect => (
          <div className="absolute"              ← UnderlineMarker
               style={{
                 left: rect.x, top: rect.y + rect.height + 1,
                 width: rect.width, height: "1.5px",
                 background: anchor.color,
                 opacity: 0.6,
                 pointerEvents: "none"            ← 不阻断鼠标事件
               }}
          />
        ))
      )}
```

**颜色规则** (`mergeAnchors` 函数):
| 类型 | 颜色 | 色值 |
|------|------|------|
| 仅批注 (annotation) | 黄色 | `#FBBF24` |
| 仅笔记 (note) | 紫色 | `#A78BFA` |
| 批注 + 笔记共存 | 蓝色 | `#60A5FA` |

### 3.4 乐观更新时序

批注/笔记创建采用乐观更新（先显示，后确认）：

```
用户点击"保存"按钮
    │
    ▼
handleDialogSubmit(data)
    │
    ├── tempId = Date.now()                     // 生成临时 ID
    ├── addAnnotation({id: tempId, ...data})    // ① 立即在 UI 显示
    ├── setDialogOpen(false)                    // ② 关闭对话框
    │
    ├── createAnnotation(apiPayload)            // ③ 异步调用 API
    │
    ├── 成功:
    │   ├── removeAnnotation(tempId)            // ④ 删除临时条目
    │   └── addAnnotation({id: created.id, ...}) // ⑤ 插入服务器返回的真实条目
    │
    └── 失败:
        ├── removeAnnotation(tempId)            // ④ 回滚
        └── addToast("创建批注失败")              // ⑤ 错误提示
```

**编辑和删除**走的是非乐观路径：先调 API，成功后更新 store。

### 3.5 PDF 加载与认证流程

```
PDFReader 组件挂载
    │
    ├── pdfjs.GlobalWorkerOptions.workerSrc =
    │     `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
    │
    ├── pdfUrl = getDownloadUrl(paper.id)
    │     → `${NEXT_PUBLIC_API_URL}/papers/${paper.id}/download`
    │
    ├── file = useMemo(() => {
    │     const token = getAccessToken()          // 从内存读取 JWT
    │     if (token) {
    │       return {
    │         url: pdfUrl,
    │         httpHeaders: {
    │           Authorization: `Bearer ${token}`
    │         }
    │       }
    │     }
    │     return pdfUrl                           // 无 token 时直接返回 URL
    │   }, [pdfUrl])
    │
    └── <Document file={file}                     // react-pdf 内部 fetch
           onLoadSuccess={onDocumentLoadSuccess}
           onLoadProgress={({loaded, total}) =>
             setLoadingProgress(loaded / total * 100)
           }
           loading={<LoadingPlaceholder />}
           error={<ErrorPlaceholder />}
        >
```

**注意事项**：
- react-pdf 的 Document 组件内部直接使用 `fetch()`，不走项目封装的 `client.ts`
- Token 过期时，react-pdf 的 PDF 请求会返回 401，但不会自动触发 `refreshAccessToken()`
- PDF 文件是一次性完整下载的（无 Range 请求），存储在浏览器内存中

### 3.6 后端 PDF 处理链路

#### 上传流程

```
POST /api/papers/upload (multipart/form-data)
    │
    ▼
PaperService.uploadPdf(file, userId, title?)
    │
    ├── ① 创建 Paper 实体 (title=filename, sourceType=UPLOAD, filePath="")
    ├── ② FileStorageService.store(file, userId, paper.id)
    │       └── 本地: file.transferTo(./uploads/{userId}/{paperId}/{uuid}.pdf)
    │       └── dufs: HTTP PUT dufsUrl/userId/paperId/uuid.pdf
    ├── ③ GrobidClient.processHeader(pdfBytes)
    │       └── POST http://localhost:8070/api/service
    │           multipart: input=pdf, segment=processHeaderDocument
    │           → 返回 TEI XML 字符串
    ├── ④ parseTeiMetadata(teiXml)
    │       └── DOM 解析 TEI XML，提取 title/authors/abstract/doi/year/journal/pageCount
    ├── ⑤ paper.copy(grobidResult=teiXml, ...metadata) → save
    └── ⑥ 返回 PaperDetailDto
```

#### 下载流程

```
GET /api/papers/{id}/download
    │
    ▼
PaperService.downloadPaper(id, userId)
    │
    ├── paperRepository.findByIdAndUserId(id, userId)
    ├── fileStorageService.read(paper.filePath)
    │       └── 本地: Files.readAllBytes(Path.of(filePath))
    │       └── dufs: HTTP GET dufsUrl/filePath
    └── 返回 Pair("论文标题.pdf", byteArray)

PaperController.download()
    └── ResponseEntity<ByteArrayResource>
        ├── Content-Type: application/pdf
        ├── Content-Disposition: attachment; filename="*.pdf"
        └── body: ByteArrayResource(bytes)
```

#### 存储后端切换

```yaml
# application.yml
app:
  storage:
    type: ${STORAGE_TYPE:dufs}        # 默认 dufs；设置为 local 使用本地磁盘
    local-path: ${STORAGE_LOCAL_PATH:./uploads}
  dufs:
    url: ${DUFS_URL:http://localhost:8400}
```

两种模式下的 `Paper.filePath` 值不同：
- **本地模式**: 绝对路径，如 `/app/uploads/5/42/uuid.pdf`
- **dufs 模式**: 相对路径，如 `5/42/uuid.pdf`（作为 HTTP API 的 object key）

---

## 4. 已知问题与可优化点

### 4.1 批注定位方案 — 严重程度: 高

**问题**: 批注/笔记的屏幕坐标依赖 DOM 文本匹配，而非 PDF 原生坐标。

**影响**:
- 文本匹配可能失败（连字符断裂、特殊字符、PDF 字体编码异常）
- 匹配失败时 fallback 到上次渲染存储的坐标，可能在当前视口位置错误
- 数据库已有 `startOffset` / `endOffset` 字段但从未被填充和使用

**表现**: 批注下划线不显示或显示在错误位置。

### 4.2 划线渲染方式 — 严重程度: 中

**问题**: 用绝对定位 `div` 绘制 1.5px 高的水平线条，不支持真正的高亮（半透明色块覆盖整行文字）、曲线下划线、删除线效果。

**局限**:
- 无法实现 GitHub/PDF Expert 风格的高亮（背景色块覆盖文本行）
- 无法实现波浪下划线（拼写检查风格）
- 无法实现删除线（贯穿文本腰部的线条）

### 4.3 react-pdf 版本锁定 — 严重程度: 中

**问题**: react-pdf 10.4.1 + pdfjs-dist 5.4.296 被锁定，patch 文件与 webpack bundle 结构强绑定。

**影响**:
- 升级 react-pdf 需要重新生成 patch，且可能遇到新的兼容性问题
- Patch 根因：pdfjs-dist 的 webpack runtime 使用了全局 `__webpack_require__`，与 Next.js 15 的 webpack runtime 冲突

### 4.4 PDF 全量下载 — 严重程度: 中

**问题**: `GET /api/papers/{id}/download` 返回完整 PDF 二进制，无 HTTP Range 支持。

**影响**:
- 大 PDF (50MB+) 首次加载慢，用户等待时间长
- fetch 无进度细分（只有下载进度，没有解析进度）
- 内存占用 = 完整 PDF 大小

### 4.5 批注全量加载 — 严重程度: 低

**问题**: 打开论文时加载该论文的所有批注和笔记（`pageSize=100`）。

**影响**: 批注数量数百以上时影响首次渲染，所有 anchor 都要执行文本匹配。

### 4.6 坐标系统不可移植 — 严重程度: 中

**问题**: 存储的坐标是 viewport 相对坐标，不可跨设备/窗口尺寸/字体缩放级别迁移。

**影响**:
- 用户在不同设备上看到的下划线位置可能不同
- PDF 更新为新版本后所有批注位置失效
- 无法支持批注的跨用户共享（每个用户的视口不同）

### 4.7 缩放时文本重匹配 — 严重程度: 低

**问题**: 每次 scale 变化 → react-pdf 重新渲染 TextLayer → 所有 anchor 重新执行 `findTextPositions`。

**影响**: 大量批注 + 频繁缩放时可能有性能抖动。

---

## 5. 增强方向

### 5.1 划线体验提升方案

| 方案 | 实现方式 | 优势 | 代价 |
|------|---------|------|------|
| **customTextRenderer** | 在 `<Page customTextRenderer={fn}>` 中修改文本样式，直接给 TextLayer 的 span 加背景色 | 原生高亮，无需覆盖层 | 需要按照 pdfjs TextItem 的坐标系处理，只能高亮整个文本片段 |
| **Canvas 叠加层** | 在 Page Canvas 上方添加新 Canvas，利用 `Page.getViewport()` 计算坐标后绘制高亮矩形 | 灵活性最高，支持渐变/透明度/删除线 | 需要手动处理坐标转换、事件穿透 |
| **SVG 覆盖层** | 用 SVG `<rect>` / `<path>` 替代 div，支持更丰富的绘制 | 矢量绘制，缩放不失真 | 需要额外坐标转换 |

### 5.2 引入 PDF 原生坐标系统

**目标**: 彻底解决坐标不可移植的问题。

**方案**:
```
创建批注时:
  1. 利用 pdfjs Page.getTextContent() 获取所有文本 item 的原生坐标
  2. 根据选中文本找到对应的 textContent items
  3. 存储: { pageNumber, startOffset, endOffset, quadPoints (PDF 原生坐标) }

渲染批注时:
  1. 使用 Page.getViewport({ scale }) 将原生坐标反算为当前 viewport 坐标
  2. 在 Canvas/SVG 层绘制高亮/下划线
```

**优势**: 跨缩放级别、跨窗口大小、跨 PDF 版本、可跨用户共享。

**代价**: 需要重构整个坐标系流程、数据库 migration、前后端 API 改动。

**数据**:
- `startOffset` / `endOffset` 字段已存在于 `pr_annotations` 和 `pr_notes` 表中
- pdfjs `TextContent.items[].transform` 提供了每个字符的原生变换矩阵
- `Page.getViewport()` 提供了原生坐标到 viewport 坐标的映射

### 5.3 渲染方案替代对比

| 方案 | 优势 | 劣势 | 适用场景 |
|------|------|------|----------|
| react-pdf (当前) | 成熟稳定，TextLayer 原生支持文本选择 | 版本锁定，patch 维护成本，全量下载 | 当前场景 |
| pdfjs-dist 直接使用 | 完全控制，可按需加载页面，Range 请求 | 需自行实现分页/TextLayer/AnnotationLayer | 需精细控制时 |
| @react-pdf-viewer/core | 功能丰富，自带工具栏 | 体积大，定制化受限 | 快速原型 |
| 服务端渲染为图片 | 前端无需加载 PDF，安全 | 增加服务端负载，交互延迟，无文本选择 | 敏感文档 |
| Canvas only | 性能最优 | 无法文本选择，无法批注定位 | 纯阅读场景 |

### 5.4 渐进式改造路线

**短期（低风险，快速见效）**:
1. 填充 `startOffset` / `endOffset` 字段（创建批注时从 textContent 中获取）
2. 使用 customTextRenderer 实现高亮效果
3. 增加文本匹配失败日志，评估匹配成功率
4. 后端支持 `Accept-Ranges: bytes`，给 react-pdf 提供 Range 请求能力

**中期（中等风险，明显提升）**:
1. 引入 PDF 原生坐标存储（并行于现有多元坐标，逐步迁移）
2. Canvas 覆盖层实现高亮/删除线/曲线下划线
3. 批注按页懒加载（IntersectionObserver）

**长期（高风险，根本性改进）**:
1. 彻底废弃 viewport 坐标，统一使用 PDF 原生坐标
2. 移除 `findTextPositions` 文本匹配逻辑
3. 支持批注跨设备/用户共享
4. 支持 PDF 版本变更时的批注位置迁移

---

## 6. 附录

### 6.1 PDF 下载接口 HTTP 响应结构

```
GET /api/papers/{id}/download
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

Response:
  HTTP/1.1 200 OK
  Content-Type: application/pdf
  Content-Disposition: attachment; filename="论文标题.pdf"
  Content-Length: 1234567

  [PDF 二进制数据]

Error responses:
  HTTP/1.1 404  → { code: 1004, message: "论文不存在" }
  HTTP/1.1 400  → { code: 1003, message: "本文没有可下载的文件" }
```

### 6.2 数据库表结构（关键字段）

**pr_papers**:
| 列 | 类型 | 说明 |
|----|------|------|
| id | BIGINT | 主键 |
| user_id | BIGINT | 所属用户 |
| title | VARCHAR(500) | 论文标题 |
| file_path | TEXT | PDF 文件路径（本地绝对路径或 dufs object key） |
| file_size | BIGINT | 文件大小（字节） |
| source_type | VARCHAR(20) | UPLOAD / URL / MANUAL |
| grobid_result | JSONB | GROBID 解析的原始 TEI XML |

**pr_annotations**:
| 列 | 类型 | 说明 |
|----|------|------|
| id | BIGINT | 主键 |
| paper_id | BIGINT | 所属论文 |
| page_number | INT | 所在页码 |
| type | VARCHAR(20) | HIGHLIGHT / UNDERLINE / STRIKETHROUGH / NOTE / AREA |
| position | JSONB | 位置信息: {x, y, width, height, positions: [{...}]} |
| quoted_text | TEXT | 引用的原文 |
| comment | TEXT | 用户的批注内容 |
| start_offset | INT | 文本起始偏移（目前未使用） |
| end_offset | INT | 文本结束偏移（目前未使用） |
| images | TEXT | 图片 URL 列表（逗号分隔） |
| color | VARCHAR(20) | 颜色 |

**pr_notes**:
| 列 | 类型 | 说明 |
|----|------|------|
| id | BIGINT | 主键 |
| paper_id | BIGINT | 所属论文 |
| page_number | INT | 所在页码 |
| title | VARCHAR(500) | 笔记标题 |
| content | TEXT | 笔记正文（Markdown） |
| position | JSONB | 位置信息 |
| quoted_text | TEXT | 引用的原文 |
| start_offset | INT | 文本起始偏移（目前未使用） |
| end_offset | INT | 文本结束偏移（目前未使用） |
| images | TEXT | 图片 URL 列表 |
| chapter | VARCHAR(255) | 章节名 |
| tags | VARCHAR(500) | 标签 |

### 6.3 pdfjs-dist patch 完整内容

**文件**: `frontend/patches/pdfjs-dist@5.4.296.patch`

三类修改：

#### 修改 1: 避免全局命名冲突（webpack runtime 变量重命名）
```diff
- var __webpack_require__ = {};
+ var _pdfjs_require_ = {};
```
将所有 `__webpack_require__` → `_pdfjs_require_`，避免与 Next.js 本身的 webpack runtime 变量冲突。

#### 修改 2: Object.defineProperty 空值保护
```diff
- Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
+ if (exports && (typeof exports === "object" || typeof exports === "function")) {
+   Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
+ }
```
防止在 `exports` 为 null/undefined 时调用 `Object.defineProperty` 导致运行时错误。

#### 修改 3: shadow() 函数空值保护
```diff
function shadow(obj, prop, value, nonSerializable = false) {
-   Object.defineProperty(obj, prop, { ... });
+   if (obj && typeof obj === "object") {
+     Object.defineProperty(obj, prop, { ... });
+   }
}
```

### 6.4 关键类型定义

```typescript
// 位置矩形（统一使用的坐标单位）
interface PositionRect {
  x: number
  y: number
  width: number
  height: number
}

// 文本锚点（用于覆盖层渲染）
interface TextAnchor {
  id: number
  type: "annotation" | "note"
  text: string                    // quotedText，用于 findTextPositions 匹配
  pageNumber: number
  position: PositionRect          // 存储的坐标（fallback）
  positions?: PositionRect[]      // 多行 rects（fallback）
}

// 创建批注请求
interface CreateAnnotationRequest {
  paperId: number
  pageNumber: number
  type: "HIGHLIGHT" | "UNDERLINE" | "STRIKETHROUGH" | "NOTE" | "AREA"
  position: Record<string, unknown>  // { x, y, width, height, positions: [{...}] }
  text?: string
  comment?: string
  quotedText?: string
  images?: string[]
}

// Reader 内部类型（DTO 转换后）
interface ReaderAnnotation {
  id: number
  paperId: number
  pageNumber: number
  quotedText: string
  content: string
  images: string[]
  position: PositionRect
  positions?: PositionRect[]
  startOffset?: number
  endOffset?: number
  commentCount: number
  createdAt: string
}
```

### 6.5 相关文件索引

#### 前端核心文件

| 文件路径 | 职能 |
|---------|------|
| `frontend/src/components/reader/PDFReader.tsx` | PDF 阅读器入口：react-pdf Document/Page 集成、缩放、翻页 |
| `frontend/src/components/reader/AnnotationLayer.tsx` | 批注覆盖层：选区检测、文本匹配、下划线渲染 |
| `frontend/src/components/reader/AnnotationDialog.tsx` | 批注/笔记创建编辑对话框 |
| `frontend/src/components/reader/PDFViewer.tsx` | PDF 阅读器外壳：dynamic import + 空状态 |
| `frontend/src/stores/reader-store.ts` | Reader 状态管理：annotations/notes CRUD、DTO 转换 |
| `frontend/src/stores/paper-store.ts` | 论文状态管理：当前论文加载 |
| `frontend/src/lib/api/papers.ts` | 论文 API：getDownloadUrl() |
| `frontend/src/lib/api/annotations.ts` | 批注 API 客户端 |
| `frontend/src/lib/api/notes.ts` | 笔记 API 客户端 |
| `frontend/src/lib/api/types.ts` | 全局 TypeScript DTO 类型定义 |
| `frontend/src/lib/api/client.ts` | HTTP 客户端封装（JWT 自动附加，401 自动刷新） |
| `frontend/src/components/layout/RightPanel.tsx` | 右侧面板：批注/笔记列表、编辑/删除 |
| `frontend/src/components/annotations/CommentThread.tsx` | 批注评论线程 |
| `frontend/patches/pdfjs-dist@5.4.296.patch` | pdfjs-dist webpack 兼容性 patch |
| `frontend/next.config.ts` | Next.js 配置（含 pdfjs-dist 相关 webpack 调整） |

#### 后端核心文件

| 文件路径 | 职能 |
|---------|------|
| `backend/.../controller/PaperController.kt` | 论文 REST API（上传、下载、CRUD） |
| `backend/.../controller/AnnotationController.kt` | 批注 REST API |
| `backend/.../controller/NoteController.kt` | 笔记 REST API |
| `backend/.../controller/GrobidController.kt` | GROBID 重新解析 API |
| `backend/.../service/PaperService.kt` | 论文业务逻辑：上传编排、PDF 解析、下载 |
| `backend/.../service/FileStorageService.kt` | 文件存储抽象：本地 / dufs |
| `backend/.../service/GrobidClient.kt` | GROBID HTTP 客户端 |
| `backend/.../service/AnnotationService.kt` | 批注 CRUD |
| `backend/.../service/NoteService.kt` | 笔记 CRUD |
| `backend/.../model/Paper.kt` | Paper JPA 实体 |
| `backend/.../model/Annotation.kt` | Annotation JPA 实体 |
| `backend/.../model/Note.kt` | Note JPA 实体 |
| `backend/.../config/GrobidConfig.kt` | GROBID 配置：URL、超时 |
| `backend/.../config/AppConfig.kt` | 应用配置：RestTemplate Bean |
| `backend/.../dto/ApiResponse.kt` | 通用响应 + 认证 DTO |
| `backend/.../dto/Requests.kt` | 论文、批注、笔记等 DTO 定义 |
| `backend/src/main/resources/application.yml` | 后端配置文件 |
| `docker-compose.yml` | 容器编排（GROBID 服务） |
