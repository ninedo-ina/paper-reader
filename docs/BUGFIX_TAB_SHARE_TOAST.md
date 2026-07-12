# Bug 修复：Tab 切换、分享弹窗、Toast 系统、导入计数

**日期**: 2026-07-11  
**分支**: feature/v0.1.5

---

## 修复清单

| # | Bug | 根因 | 修复方式 |
|---|-----|------|----------|
| 1 | Tab 切换 (创建/导入) 不刷新论文列表 | `PaperList` 初始加载时未传 `sourceType`，tab 计数用本地过滤计算 | 新增 `loadCounts` action 独立获取计数，`setActiveTab` 已正确传参 |
| 2 | 分享按钮弹窗不显示 | (a) DropdownMenu 事件冒泡到 PaperCard 导致 sidebar 关闭; (b) Sidebar 的 `backdrop-filter` 创建新的 CSS containing block，`position: fixed` 相对 sidebar 而非 viewport | (a) DropdownMenu onClick 加 `e.stopPropagation()`; (b) ShareDialog/TagDialog 改用 `createPortal(..., document.body)` |
| 3 | 导入 tab 显示 count=2 但实际只有 1 篇论文 | `loadCounts` 向后端传原始 sourceType 值 (`"MANUAL"`, `"UPLOAD"`, `"URL"`)，后端 controller 只映射 `"create"` → `["MANUAL"]` / `"import"` → `["UPLOAD","URL"]`，其他值落入 `else -> null` → 不过滤 → 每次返回全部论文，导致 `importCount = 1 + 1 = 2` | 改为传后端能理解的 `"create"` / `"import"`，从 3 次 API 调用缩减为 2 次 |
| 4 | 分享成功后界面无反馈 | 原 ShareDialog 在复制成功后显示绿色"已复制"文字但弹窗仍开着 | 新增 Toast 系统，分享成功后弹窗立即关闭，顶部弹出 Toast |

---

## 文件变更

### 新增文件

- `src/stores/toast-store.ts` — Zustand toast 状态管理
- `src/components/ui/Toast.tsx` — Toast UI 组件 (Portal 渲染到 body)

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/app/[locale]/page.tsx` | 挂载 `<ToastContainer />` |
| `src/components/ui/DropdownMenu.tsx` | onClick 加 `e.stopPropagation()` |
| `src/components/papers/ShareDialog.tsx` | Portal 包裹 + Toast 替代内联 copied 状态 |
| `src/components/papers/TagDialog.tsx` | Portal 包裹 |
| `src/components/papers/PaperList.tsx` | `createCount`/`importCount` 改用 store 字段，`useEffect` 加 `loadCounts()` |
| `src/stores/paper-store.ts` | 新增 `createCount`/`importCount`/`loadCounts`，上传/创建/删除后调用 `loadCounts` |
| `src/i18n/locales/zh/common.json` | 添加 `shareSuccess` |
| `src/i18n/locales/en/common.json` | 添加 `shareSuccess` |

---

## 关键技术细节

### CSS containing block 问题

当父元素有 `backdrop-filter` 时，子元素的 `position: fixed` 不再相对于 viewport，而是相对于该父元素。RightPanel 的 sidebar 使用了 `backdrop-blur`，导致 ShareDialog/TagDialog 的 fixed 定位失效。解决方式：用 `createPortal` 将弹窗渲染到 `document.body`。

### Backend sourceType 映射

```kotlin
// PaperController.kt:48-52
val sourceTypes = when (sourceType) {
    "create" -> listOf("MANUAL")
    "import" -> listOf("UPLOAD", "URL")
    else -> null  // null = 不过滤
}
```

前端与后端约定：`sourceType` 参数只用 `"create"` 或 `"import"`，不直接传数据库枚举值。

### Toast 架构

```
useToastStore (Zustand)
  ├── toasts: ToastItem[]
  ├── addToast({ message, type?, duration? })
  └── removeToast(id)

ToastContainer (Portal → document.body)
  └── 固定定位顶部居中，z-[100]
```

---

## 验证

- [x] Tab 切换后论文列表正确过滤
- [x] 分享弹窗正常打开和关闭
- [x] 分享成功后 Toast 显示"已写入剪切板，快去发送给微信好友吧"
- [x] 导入 tab 计数与实际论文数一致
- [x] 创建 tab 计数与实际论文数一致
- [x] 前端 build 通过
