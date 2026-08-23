# AI 对话技术方案

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

这里刻意不复用后台 `AiChatListDto`：后台接口的消息由服务器模型处理，而直接 Provider 对话由浏览器访问用户选择的 Base URL。混用会导致历史内容、模型和鉴权语义不一致。

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

Provider 的 Base URL 只去掉末尾斜杠，然后追加 `/chat/completions`。现有实现沿用 OpenAI 兼容协议和 Bearer API Key。失败时移除空的 assistant 占位消息并在页面显示错误，不清除用户刚输入的历史消息。

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

连接测试直接在浏览器请求用户配置的 Provider，因此仍受 Provider CORS、HTTPS Mixed Content 和浏览器网络策略影响；请求不经过 PaperReader 后端。

## 9. 后续扩展边界

如果未来要把本地历史改为服务端历史，需要新增明确的数据协议和安全方案，而不是直接调用现有 `/api/ai-chats`：

- Provider 凭据是否永不上传，或采用服务端加密托管。
- 历史是否按账户同步，退出登录和多设备如何处理。
- Provider 删除后历史是否仍可读。
- Provider 不支持 SSE 或模型不支持图片时如何回退。
- 本地存储容量、消息裁剪和敏感消息清理。
