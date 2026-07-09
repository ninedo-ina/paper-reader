# Create Paper Feature Design Document

> **Status**: Plan — awaiting review
> **Date**: 2026-07-09
> **Version**: 0.1.4 (planned)

---

## 1. Overview

### Problem

The system currently only supports adding papers via PDF upload or URL import. Users cannot manually create paper entries (e.g., for papers not yet available as PDF, or for drafting new papers).

### Solution

A standalone "Create Paper" flow triggered by the ➕ button in PaperList. Users fill in metadata (title, authors, participants, abstract), the paper is created without requiring a PDF file, and the main content area becomes a TipTap-based editor for writing.

### Scope

| Layer | Changes |
|-------|---------|
| Database | New Flyway migration V3 — make `file_path` nullable, add `participants` column |
| Backend | New `POST /api/papers` endpoint, service method, null-safety fixes |
| Frontend | CreatePaperDialog, PaperEditor (TipTap), store/API extensions, page routing |

---

## 2. Editor Selection: TipTap

### Comparison Summary

| Library | Bundle | React 19 | Tailwind 4 | Markdown | Academic Fit | Score |
|---------|--------|----------|------------|----------|-------------|-------|
| **TipTap** | ~65KB gzip | Yes | Headless | Extension | Best ecosystem | **9.0** |
| Lexical | ~55KB gzip | Yes | Headless | Plugin | Fast, needs custom nodes | 8.0 |
| Milkdown | ~92KB gzip | Partial | Plugin-based | Native | Small community | 7.0 |
| Plate | ~180KB gzip | Yes | Headless | Plugin | Pre-built UI, heavy | 7.0 |

### Why TipTap

1. **ProseMirror engine** — battle-tested, schema-driven document model ideal for structured academic content
2. **Headless architecture** — full control over styling via Tailwind CSS 4 + CSS variables; zero conflicts with `next-themes`
3. **200+ extensions** — math (KaTeX), footnotes, tables, code blocks, typography; citations can be custom nodes
4. **Community** — 26k+ GitHub stars, 1-2M weekly npm downloads, commercial backing by Tiptap GmbH
5. **Markdown** — `@tiptap/extension-markdown` for import/export when needed
6. **Collaboration path** — TipTap + Y.js + Hocuspocus is a proven real-time co-authoring stack

### Dependencies to Install

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder
npm install --save-dev @tiptap/pm
```

---

## 3. Backend Design

### 3.1 Database Migration

**File**: `backend/src/main/resources/db/migration/V3__create_paper.sql`

```sql
ALTER TABLE pr_papers ALTER COLUMN file_path DROP NOT NULL;
ALTER TABLE pr_papers ADD COLUMN participants VARCHAR(2000);
```

Existing migration files:
- `V1__init.sql` — initial schema
- `V2__oauth_email_login.sql` — OAuth + email login

> **Naming**: Must be `V3` (not V2) because V2 already exists. Flyway enforces strict version ordering.

### 3.2 Entity Changes

**File**: `backend/src/main/kotlin/org/paperreader/model/Paper.kt`

```kotlin
// filePath: nullable for manual papers
@Column
val filePath: String? = null,  // was: @Column(nullable = false) val filePath: String

// New field
@Column(length = 2000)
val participants: String? = null,
```

`sourceType` already stores a plain String — no enum constraint change needed. `"MANUAL"` is accepted as-is.

### 3.3 DTO

**File**: `backend/src/main/kotlin/org/paperreader/dto/Requests.kt`

```kotlin
// New request DTO
data class CreatePaperRequest(
    val title: String,           // required (non-nullable — Jackson rejects if missing)
    val authors: String? = null,
    val participants: String? = null,
    val abstractText: String? = null,
)

// PaperDetailDto: add participants field
val participants: String?,
```

`PaperDto.filePath` → changed to `String?` for consistency.

### 3.4 Service

**File**: `backend/src/main/kotlin/org/paperreader/service/PaperService.kt`

```kotlin
@Transactional
fun createPaper(request: CreatePaperRequest, userId: Long): PaperDetailDto {
    require(request.title.isNotBlank()) { "Title is required" }
    val paper = paperRepository.save(Paper(
        userId = userId,
        title = request.title,
        authors = request.authors,
        participants = request.participants,
        abstractText = request.abstractText,
        sourceType = "MANUAL",
        sourceUrl = null,
        filePath = null,
        pageCount = 0,
        fileSize = 0,
    ))
    return paper.toDetailDto()
}
```

Null-safety fixes for existing methods:

```kotlin
// deletePaper: guard filePath access
paper.filePath?.let { fileStorageService.delete(it) }

// downloadPaper: throw if no file
val filePath = paper.filePath
    ?: throw BusinessException(1005, "This paper has no downloadable file", 400)
```

### 3.5 Controller

**File**: `backend/src/main/kotlin/org/paperreader/controller/PaperController.kt`

```kotlin
@PostMapping
fun create(
    @RequestBody request: CreatePaperRequest,
    @AuthenticationPrincipal principal: UserPrincipal,
): ApiResponse<PaperDetailDto> =
    ApiResponse(data = paperService.createPaper(request, principal.userId))
```

The empty `@PostMapping` maps to `POST /api/papers` (class-level `@RequestMapping("/api/papers")`). Existing `SecurityConfig` already requires authentication for all non-auth endpoints — no config change needed.

### 3.6 Backend File Summary

| # | File | Action |
|---|------|--------|
| 1 | `.../db/migration/V3__create_paper.sql` | **New** |
| 2 | `.../model/Paper.kt` | Edit: nullable filePath, add participants |
| 3 | `.../dto/Requests.kt` | Edit: CreatePaperRequest, nullable filePath, participants |
| 4 | `.../service/PaperService.kt` | Edit: createPaper(), null-safe delete/download |
| 5 | `.../controller/PaperController.kt` | Edit: POST / endpoint |

---

## 4. Frontend Design

### 4.1 Type System

**File**: `frontend/src/lib/api/types.ts`

```typescript
export type SourceType = "UPLOAD" | "URL" | "MANUAL"  // add "MANUAL"

export interface PaperDetailDto {
  // ...existing fields...
  participants?: string  // new
}

export interface CreatePaperRequest {
  title: string
  authors?: string
  participants?: string
  abstractText?: string
}
```

### 4.2 API Client

**File**: `frontend/src/lib/api/papers.ts`

```typescript
export function createPaper(data: CreatePaperRequest): Promise<PaperDetailDto> {
  return post<PaperDetailDto>("/papers", data)
}
```

Uses existing `post` helper (JWT auth, auto-refresh, ApiResponse unwrap).

### 4.3 Store

**File**: `frontend/src/stores/paper-store.ts`

```typescript
// Interface addition:
createPaper: (data: CreatePaperRequest) => Promise<PaperDetailDto>

// Implementation:
createPaper: async (data) => {
  set({ error: null })
  const paper = await papersApi.createPaper(data)
  // Reload list so badge/badge count is accurate
  const list = await papersApi.listPapers(1)
  set({ papers: list.items, total: list.total, page: list.page, currentPaper: paper })
  return paper
},
```

Pattern matches existing `uploadPdf` / `uploadFromUrl` — returns paper so dialog can await it.

### 4.4 CreatePaperDialog

**File**: `frontend/src/components/papers/CreatePaperDialog.tsx` (NEW)

Follows `UploadDialog` styling exactly:
- Fixed overlay: `bg-black/40 backdrop-blur-sm`
- Panel: `glass-surface-strong rounded-xl border border-white/10 w-full max-w-lg p-6 shadow-2xl`
- Fields: title (required `<Input>`), authors (`<Input>`), participants (`<Input>`), abstract (`<textarea rows={4}>`)
- Buttons: Cancel (`variant="secondary"`) + Create (`variant="primary"` with `<Loader2>` spinner when loading)
- Error display from store

```tsx
interface CreatePaperDialogProps {
  open: boolean
  onClose: () => void
}
```

### 4.5 PaperEditor (TipTap)

**File**: `frontend/src/components/papers/PaperEditor/PaperEditor.tsx` (NEW)
**File**: `frontend/src/components/papers/PaperEditor/index.ts` (NEW, barrel with dynamic import)

Architecture:
```
PaperEditor/index.ts          — dynamic(() => import("./PaperEditor"), { ssr: false })
  └── PaperEditor.tsx         — useEditor() + EditorContent
```

Key design:
- `immediatelyRender: false` — prevents SSR hydration mismatches
- `next/dynamic({ ssr: false })` — TipTap is browser-only (needs document/window/getSelection)
- Extensions: `StarterKit` (bold, italic, headings 1-3, lists, code, blockquote, history) + `Placeholder` ("Start writing your paper...")
- Initial content: `paper.abstractText || ""`
- Styling: `prose prose-sm dark:prose-invert max-w-none` via `editorProps.attributes.class`
- Header bar: paper title + manual Save button (placeholder for future PUT endpoint)

### 4.6 Page Wiring

**File**: `frontend/src/app/[locale]/page.tsx`

Changes:
1. New import: `CreatePaperDialog`, `PaperEditor`
2. New state: `const [showCreate, setShowCreate] = useState(false)`
3. Fix `onCreate`: change from `() => setShowUpload(true)` to `() => setShowCreate(true)`
4. Main content area routing:
   ```tsx
   {currentPaper && currentPaper.sourceType === "MANUAL" ? (
     <PaperEditor paper={currentPaper} onSave={async (content) => { /* future PUT endpoint */ }} />
   ) : (
     <PDFViewer paper={currentPaper} onUploadClick={() => setShowUpload(true)} />
   )}
   ```
5. Add `<CreatePaperDialog open={showCreate} onClose={() => setShowCreate(false)} />`

### 4.7 i18n

**Files**: `frontend/src/i18n/locales/zh/common.json`, `frontend/src/i18n/locales/en/common.json`

```json
// Under "reader" section:
"createPaper": "创建论文" / "Create Paper",
"paperTitle": "论文标题" / "Paper Title",
"paperTitlePlaceholder": "输入论文标题" / "Enter paper title",
"paperAuthors": "作者" / "Authors",
"paperAuthorsPlaceholder": "作者姓名" / "Author names",
"paperParticipants": "参与者" / "Participants",
"paperParticipantsPlaceholder": "参与者姓名" / "Participant names",
"paperAbstract": "摘要" / "Abstract",
"paperAbstractPlaceholder": "输入或粘贴摘要..." / "Enter or paste abstract...",
"creating": "创建中..." / "Creating..."
```

### 4.8 CSS

**File**: `frontend/src/app/globals.css`

```css
/* TipTap placeholder styling */
.tiptap p.is-editor-empty:first-child::before {
  color: var(--text-tertiary);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
```

### 4.9 Frontend File Summary

| # | File | Action |
|---|------|--------|
| 1 | `package.json` | Edit: add TipTap deps |
| 2 | `src/lib/api/types.ts` | Edit: SourceType, PaperDetailDto, CreatePaperRequest |
| 3 | `src/lib/api/papers.ts` | Edit: createPaper() |
| 4 | `src/stores/paper-store.ts` | Edit: createPaper action |
| 5 | `src/i18n/locales/zh/common.json` | Edit: new keys |
| 6 | `src/i18n/locales/en/common.json` | Edit: new keys |
| 7 | `src/components/papers/CreatePaperDialog.tsx` | **New** |
| 8 | `src/components/papers/PaperEditor/PaperEditor.tsx` | **New** |
| 9 | `src/components/papers/PaperEditor/index.ts` | **New** |
| 10 | `src/app/globals.css` | Edit: TipTap placeholder CSS |
| 11 | `src/app/[locale]/page.tsx` | Edit: wire create flow |

---

## 5. Component Interaction Flow

```
User clicks ➕ (PaperList header)
  → page.tsx: setShowCreate(true)
  → CreatePaperDialog opens (modal)
User fills fields, clicks "Create"
  → createPaper(request) in paper-store
    → POST /api/papers (backend creates, returns PaperDetailDto)
    → GET /api/papers?page=1 (reload list for badge count)
    → set currentPaper = new paper
  → Dialog closes
  → PaperList re-renders with new paper (+ badge count updated)
  → Main content area detects sourceType === "MANUAL"
    → Renders PaperEditor (TipTap) instead of PDFViewer
```

---

## 6. Edge Cases

| Case | Handling |
|------|----------|
| Empty title submitted | HTML `required` attribute on input prevents form submission |
| API returns error | Error caught in store, dialog shows error text, Create button re-enabled |
| Cancel during creation | Dialog closes, form state resets |
| PaperEditor: browser SSR | `next/dynamic({ ssr: false })` with skeleton loading state |
| PaperEditor: empty content | TipTap Placeholder extension shows prompt text |
| Delete a MANUAL paper | `paper.filePath` is null, deletePaper guards with `?.let` |
| Download a MANUAL paper | `filePath` null → `BusinessException(1005)` |
| UploadDialog vs CreatePaperDialog | Two separate dialogs, independently controlled by `showUpload` / `showCreate` |

---

## 7. Future Iterations

1. **Save content API**: `PUT /api/papers/:id` with editor HTML/markdown body (requires backend `content` or `body` column)
2. **Auto-save**: Debounced `useEffect` (2s) calling save automatically
3. **Formatting toolbar**: TipTap `BubbleMenu` or `FloatingMenu` extension for visible formatting controls
4. **Markdown import/export**: `@tiptap/extension-markdown` for markdown serialization
5. **Version history**: Store revision snapshots of paper content
6. **Citation manager**: Custom TipTap node for academic citations
7. **Collaborative editing**: TipTap + Y.js + Hocuspocus for real-time co-authoring
