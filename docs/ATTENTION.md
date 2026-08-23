# PaperReader 注意事项

## 版本与发布

- 普通迭代只增加 patch 版本，当前规则是 `0.1.10 -> 0.1.11 -> 0.1.12`。
- 问题修复迭代在被修复版本后追加 `-fix`，例如 `0.1.12 -> 0.1.12-fix`；分支名同步使用 `feature/v0.1.12-fix`。
- 当前 Provider 测试修复迭代为 `0.1.13-fix`，分支为 `feature/v0.1.13-fix`。
- `main` 是仓库默认分支和生产主分支，`dev` 是集成分支；版本分支必须先合并到 `dev`，再由 `dev` 合并到 `main`。
- 所有版本分支都要保留，不能因为已经合并就删除。
- 未经明确要求，不要擅自改成 `0.2.0` 或 `1.0.0`。
- 每次提交代码都要同步更新版本、文档、构建、重启和远程推送。

## Provider 与 API Key

- Provider 配置目前保存在浏览器持久化存储中，API Key 属于敏感信息。
- 不要把 API Key 放到 URL、commit、截图、README、服务端日志或错误信息中。
- 直接 Provider 请求由浏览器发出，Provider 必须允许浏览器跨域；CORS 失败时需要在 Provider 侧解决，不能把密钥转发到 PaperReader 后端作为临时绕过。
- 用户修改或删除 Provider 后，历史对话仍可能保留旧 Provider ID 和消息，这是本地历史数据；发送新消息前必须重新选择一个当前激活的 Provider。
- 未配置 Provider 时，模型选择器必须不可用，不能让用户误以为内置模型可以直接发送。
- Provider 测试必须验证实际使用的 `/chat/completions`；`/models` 只能用于可选的模型发现，不能单独作为连接可用性的结论。
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
