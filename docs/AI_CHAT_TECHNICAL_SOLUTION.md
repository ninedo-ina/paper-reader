# AI 对话技术方案

## v0.1.19 论文场景问答与 reasoning 展示

### 1. 目标

v0.1.19 在现有浏览器直连 Provider 的对话基础上，增加论文阅读场景上下文，并把模型思考过程从正文中分离。Provider、模型和本地历史仍沿用 v0.1.18 的会话级隔离规则。

### 2. reasoning 数据流

```text
Provider SSE/JSON
  -> 响应结构解析
  -> 结构化 reasoning / <think> 标签状态机
  -> { content, reasoning }
  -> ChatMessageItem
  -> Markdown 正文 + 默认折叠的思考区域
```

解析器必须能处理结构化字段和正文内标签，并支持标签跨 chunk。`reasoning` 为空时保持现有正文流程；只有 reasoning 时也保留助手消息并显示可展开区域。

### 3. 论文选区数据流

```text
PDF AnnotationLayer
  -> { paperId, title, pageNumber, quote, requestId }
  -> reader-store.pendingPaperQuestion
  -> RightPanel 切换 aiChat
  -> ChatPanel 消费待处理问题
  -> 获取论文相关 chunks
  -> 使用当前会话 Provider/模型发送
```

待处理问题必须有一次性消费语义，避免 React 重渲染重复发送。没有 Provider 时先保留事件并打开 AI 配置；Provider 配置完成后再继续。

### 4. Prompt 组成

模型请求的隐藏上下文按以下顺序组织：

```text
系统角色：你是论文阅读助手，只基于给定论文上下文回答；不确定时明确说明。
论文元数据：标题、作者、摘要。
相关片段：按选中文本匹配的章节、相邻段落和页码信息。
选中文本：用户在 PDF 中标记的原文。
用户问题：用户当前提出的问题或默认解释请求。
```

用户消息只展示问题和引用卡片，不展示完整内部上下文。后续追问继续绑定当前论文上下文，但不把整篇论文无限追加到历史消息。

### 5. 全文提取链路

```text
上传/URL 导入
  -> 保存 PDF
  -> PENDING
  -> 异步调用 GROBID /api/processFulltextDocument
  -> 解析 TEI 元数据和 body
  -> 生成章节/段落 chunks
  -> READY 或 FAILED
```

GROBID 的职责是结构化提取，不是 AI 摘要。原始 TEI 使用 TEXT 保存，chunks 保存规范化正文、章节标题、顺序和可选页码。上下文接口只返回当前用户所属论文的有限相关片段。

### 6. 兼容与回退

- 旧本地对话没有 `reasoning` 字段时按空字符串兼容。
- GROBID 不可用时仍返回论文和 PDF，问答退化到标题、摘要和选中文本。
- 扫描版或加密 PDF 首版标记失败，不自动引入 OCR。
- 首版不使用 embedding；文本匹配失败时使用摘要和邻近 chunks，后续再评估语义检索。

## v0.1.18-fix Provider 连接修复摘要

`v0.1.18-fix` 在 `v0.1.18` 会话增强的基础上修复 Provider 端点和浏览器网络策略兼容性。

- Base URL 会先按用户输入请求；遇到 HTML、404/405 或浏览器网络/CORS 失败时，有限尝试同一路径下的 `/v1` 变体。
- 浏览器直连因 CORS 失败时，使用 `/api/provider-relay/models` 或 `/api/provider-relay/chat/completions` 进行同源转发。
- relay 需要登录 JWT，只允许 HTTPS 公网主机和两个固定上游路径，禁止重定向，并且 API Key 仅存在于单次请求内。
- Provider 返回的 HTTP 状态、HTML 和 JSON 错误会保持可诊断性；密钥和 Bearer 值始终脱敏。

针对当前 Provider，配置值为：Base URL `https://lzhiyu.ccwu.cc/v1`，模型 `gpt-oss-20b`。API Key 只应在用户自己的偏好设置中填写，不应写进仓库或文档。

## v0.1.18 会话增强摘要

`v0.1.18` 在现有右侧 AI 对话流程上增加以下约束：

- 用户消息使用 `useUserStore.profile.avatarUrl`，无头像时显示用户首字母；助手保留 Bot 图标并显示 `PR助手`。
- `DirectChat.providerId` 和 `DirectChat.model` 是会话字段，不受其他历史会话选择影响。新会话继承当前配置，历史切换恢复原配置。
- 首次正文成功后，以同一会话 Provider/模型发送一次 `stream: false` 标题请求；标题清理前缀、引号和长度，并拒绝原样复述用户问题。
- 历史项展示 `createdAt` 与 `updatedAt`，其中 `updatedAt` 表示最近一次消息变化，不因单纯切换或改配置而更新。
- `directChatSending` 与 `directChatTitleGenerating` 均按会话 ID 管理；会话 A 等待时，会话 B 仍可发送，所有异步更新使用目标会话 ID。

完整的版本记录、风险与验证要求见 [docs/MAINTENANCE.md](MAINTENANCE.md) 的 `v0.1.18` 条目。

## 1. 范围

本方案对应 v0.1.11 的 C 端右侧 AI 对话 Tab。目标是把配置、模型、历史和输入组织成接近现代 AI 产品的 composer 流程；语音输入不在本次范围内。

## 2. 组件链路

```text
frontend/src/app/[locale]/page.tsx
  -> RightPanel(onConfigureProvider)
       -> ChatPanel(onConfigureProvider)
            -> usePreferencesStore 读取 Provider
            -> useChatStore 读取消息与本地历史
            -> PreferencesDialog(initialTab="ai")
```

`RightPanel` 中 AI Tab 使用 `components/chat/ChatPanel.tsx`。`components/ai` 目录下的旧组件不是当前 Reader 右侧面板的渲染入口，后续修改前必须重新确认引用关系。

## 3. Provider 状态

有效 Provider 定义为：

```text
providers.find(provider.id === activeProviderId)
```

没有有效 Provider 时：

- 顶部显示警告图标和“未配置 Provider”。
- 点击顶部状态或底部“配置 Provider”打开 Preferences 的 AI Tab。
- 输入框仍可展示，但发送时阻止请求并提示配置 Provider。
- 模型按钮保持不可选；点击时提示先配置 Provider。

有有效 Provider 时，模型来源按以下优先级选择：

1. Provider 自己保存的非空 `models`。
2. 前端内置的兼容列表 `MODELS`。

Provider 配置通过现有 `AiConfigTab` 添加、编辑、测试、获取模型和激活，不在对话组件内重复实现配置表单。

## 4. 页面状态布局

```text
┌────────────────────────────────┐
│ 当前标题 ▾  Provider状态  新对话│  顶部控制区
├────────────────────────────────┤
│                                │
│          消息滚动区             │
│                                │
├────────────────────────────────┤
│  输入文本                       │
│  Provider   模型 ▾       发送   │  一体化 composer
└────────────────────────────────┘
```

右侧面板 AI Tab 的外层取消普通内容滚动，并由 `ChatPanel` 自己管理消息区的 `flex-1 min-h-0 overflow-auto`。这样 composer 始终留在底部。

## 5. 本地历史数据模型

直接 Provider 对话使用 `DirectChat`：

```ts
{
  id: string
  title: string
  model: string
  providerId: string
  messages: ChatMessageItem[]
  createdAt: string
  updatedAt: string
}
```

Zustand persist key 为 `pr-ai-direct-chats`。新对话先创建空记录；第一次发送后，将首条用户消息压缩为最多 32 个字符的标题。切换历史时恢复该记录的消息和模型。

这里刻意不复用后台 `AiChatListDto`：后台接口的消息由服务器模型处理，而直接 Provider 对话由浏览器访问用户选择的 Base URL；只有浏览器网络/CORS 失败时才通过已认证 relay。混用会导致历史内容、模型和鉴权语义不一致。

## 6. 发送流程

```text
用户输入
  -> 检查 activeProvider
  -> 检查 model / isSending
  -> 将用户消息写入当前 DirectChat
  -> POST {baseUrl}/chat/completions (stream=true)
  -> 逐段解析 data: SSE
  -> 更新 assistant 消息
  -> 同步持久化 DirectChat
```

Provider 的 Base URL 去掉末尾斜杠后追加 `/chat/completions`；如果未包含 `/v1`，实现会有限尝试追加 `/v1`。浏览器网络/CORS 失败时再通过同源 relay 转发。失败时保留安全错误信息并在页面显示，不清除用户刚输入的历史消息。

## 7. 交互约束

- Enter 发送，Shift+Enter 换行。
- 发送中禁用输入框和发送按钮，避免并发请求导致消息顺序错乱。
- 新对话使用 `MessageSquarePlus` 图标，并保留 `title`、`aria-label`。
- 历史下拉、模型下拉都支持点击外部关闭。
- Provider 状态同时使用图标和文本，不依赖颜色表达错误。
- 图片粘贴能力保留，但语音输入不在 v0.1.11 中实现。

## 8. Provider 连接测试

Provider 配置页的“测试连接”必须验证与实际对话相同的请求协议：

1. Base URL 去除末尾斜杠；如果用户粘贴了 `/models` 或 `/chat/completions` 完整地址，先去除该 endpoint。
2. 已填写模型时直接向 `/chat/completions` 发送短的流式请求，验证认证、模型和对话接口是否可用。
3. 未填写模型时才请求 `/models` 进行模型发现；发现成功后用第一个模型继续测试 chat。
4. `/models` 不是必需能力，不能因为它不可用就否定一个实际可对话的 Provider；但没有任何可测试模型时必须提示用户填写模型。
5. HTTP 错误只展示状态码和解析后的安全错误摘要；API Key、Bearer 值和敏感文本必须脱敏。

连接测试优先直接请求用户配置的 Provider；当浏览器因 CORS 或网络策略无法读取响应时，自动回退到已认证的 PaperHelper relay。HTTPS Mixed Content、Provider 认证、额度和模型错误仍会明确显示。

## 9. 后续扩展边界

如果未来要把本地历史改为服务端历史，需要新增明确的数据协议和安全方案，而不是直接调用现有 `/api/ai-chats`：

- Provider 凭据是否永不上传，或采用服务端加密托管。
- 历史是否按账户同步，退出登录和多设备如何处理。
- Provider 删除后历史是否仍可读。
- Provider 不支持 SSE 或模型不支持图片时如何回退。
- 本地存储容量、消息裁剪和敏感消息清理。
