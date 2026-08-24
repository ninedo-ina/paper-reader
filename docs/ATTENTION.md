# PaperReader 注意事项

## v0.1.19 当前迭代注意事项

- 本次是功能迭代，版本为 `v0.1.19`、分支为 `feature/v0.1.19`，不追加 `-fix`。
- `<think>` 解析必须跨 SSE chunk，正文和 reasoning 要分别持久化；旧本地消息缺少 reasoning 字段时必须正常读取。
- 论文问答只能使用当前用户有权限的论文上下文；后端返回 chunks 前必须校验 `paperId + userId`，不能通过接口读取其他用户的全文。
- GROBID 原始 TEI 不包含 Provider Key，但仍可能包含论文全文；日志只能记录 paper ID、状态和错误类型，不记录 TEI、选中文本或 Prompt。
- 上传解析使用状态机 `PENDING -> PROCESSING -> READY/FAILED`。删除论文时必须级联删除 chunks，并清理正在执行的任务结果。
- 解析失败不得阻断 PDF 阅读和批注；问答必须有明确的上下文不可用提示，不得静默把空上下文当作完整论文。
- 首版使用文本规范化和相邻 chunks，不引入 embedding、OCR 或向量数据库；任何扩展都要单独评估版本和资源占用。
- 论文上下文只作为模型请求的隐藏上下文，用户气泡显示引用文本和问题，不显示完整系统 Prompt。

## v0.1.18-fix 历史迭代注意事项

- 本次是问题修复，版本为 `v0.1.18-fix`、分支为 `feature/v0.1.18-fix`。
- 每个 `DirectChat` 的 `providerId` 和 `model` 独立持久化；不得用全局激活 Provider 覆盖历史会话。
- 新对话继承前一会话配置，切换历史会话恢复原配置；Provider 被删除后历史仍可读，但发送前必须重新选择现存 Provider。
- 标题生成会在首次正文成功后额外发送一次 `stream: false` 请求，可能增加 Provider 费用和限流占用；标题失败不能覆盖正文成功状态。
- 标题若与用户原问题在忽略标点、符号和空白后相同，客户端拒绝使用，避免退回旧的“问题即标题”行为。
- 直连请求状态按会话 ID 保存；同一会话禁止重复发送，不同会话允许并发。所有异步回调必须写回捕获的目标会话。
- 用户头像缺失时必须显示首字母兜底；助手名称统一为 `PR助手`，处理中、正常和错误状态都要一致。
- `v0.1.18-fix` favicon 请求参数为 `v=0.1.18-fix-r1`。

## 版本与发布

- 普通迭代只增加 patch 版本，当前规则是 `0.1.10 -> 0.1.11 -> 0.1.12`。
- 问题修复迭代在被修复版本后追加 `-fix`，例如 `0.1.12 -> 0.1.12-fix`；分支名同步使用 `feature/v0.1.12-fix`。
- 历史 Provider 测试修复迭代为 `0.1.13-fix`；当前 Provider relay 修复迭代为 `0.1.18-fix`。
- `main` 是仓库默认分支和生产主分支，`dev` 是集成分支；版本分支必须先合并到 `dev`，再由 `dev` 合并到 `main`。
- 所有版本分支都要保留，不能因为已经合并就删除。
- 未经明确要求，不要擅自改成 `0.2.0` 或 `1.0.0`。
- 每次提交代码都要同步更新版本、文档、构建、重启和远程推送。

## Provider 与 API Key

- Provider 配置目前保存在浏览器持久化存储中，API Key 属于敏感信息。
- 不要把 API Key 放到 URL、commit、截图、README、服务端日志或错误信息中。
- 直连 Provider 仍优先由浏览器发出；若发生 CORS/网络失败，才使用 JWT 保护的同源 relay。relay 不落库、不记录 API Key，并且只允许 HTTPS 公网目标。
- relay 的原始请求必须通过 JWT；只允许 Servlet `ASYNC` 内部二次分发跳过重复授权，否则 `StreamingResponseBody` 可能在正文已发送后触发 `AuthorizationDeniedException`。
- 用户修改或删除 Provider 后，历史对话仍可能保留旧 Provider ID 和消息，这是本地历史数据；发送新消息前必须重新选择一个当前激活的 Provider。
- 未配置 Provider 时，模型选择器必须不可用，不能让用户误以为内置模型可以直接发送。
- Provider 测试必须验证实际使用的 `/chat/completions`；`/models` 只能用于可选的模型发现，不能单独作为连接可用性的结论。
- `https://lzhiyu.ccwu.cc` 的 API 根路径是 `/v1`；推荐在配置中填写 `https://lzhiyu.ccwu.cc/v1`，模型填写 `gpt-oss-20b`。
- 测试没有模型可用时不得猜测模型名称；应提示用户填写 Provider 支持的模型。

## 对话历史

- 当前右侧 AI 面板的历史是浏览器本地历史，与后台 `/api/ai-chats` 不是同一数据源。
- 清空当前对话只清空当前 UI 会话状态，不代表删除所有本地历史。
- 目前未提供历史删除按钮；后续增加删除前要设计确认、存储清理和失败反馈。
- 浏览器本地存储不适合保存高敏感或无限增长的消息；增加同步前必须定义加密、容量、跨设备和退出登录清理策略。

## 部署与缓存

- `paper.pilo.eu.cc` 通过 Cloudflare -> Apache -> PM2 Next.js，不是 Cloudflare Pages。
- 修改源码后只 push 不会生效；必须执行 `pnpm run build`、PM2 重启并验证公网。
- favicon 使用版本 query string 防止浏览器/边缘缓存旧图标；更新版本时同步修改 metadata 和主题同步组件。
- 本次 v0.1.12 只调整浏览器标签页 favicon；不要将 favicon 的尺寸调整误应用到首页左上角品牌 Logo。
- 历史 v0.1.12-fix 修复了侧栏折叠按钮的点击层级；当前 v0.1.13-fix 修复 AI Provider 测试连接逻辑。
- 不要用宽泛的 `rm -rf`、`killall` 或批量 kill 处理部署问题。

## UI 回归

- 右侧面板在 Reader 主页面中嵌套，AI Tab 必须使用 `min-h-0` 和正确的 overflow，否则 composer 会被内容挤出底部。
- 新增入口要同时检查明亮/暗色主题、窄宽度、键盘操作和 hover/focus 状态。
- “新对话”按钮只使用图标，但必须提供 `title` 和 `aria-label`。
- Provider 警告不能只依赖颜色，应同时有感叹号图标和文本。
