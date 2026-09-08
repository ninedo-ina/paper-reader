# PaperHelper 维护规范

## 1. 适用范围

本文档适用于 `/root/paper-reader` C 端论文阅读项目。后台管理项目是独立仓库，不在本项目的代码变更范围内；如果一个需求同时影响两个项目，必须分别确认、分别更新版本、分别构建和分别推送。

新人先阅读 [文档索引](README.md)、[新人维护指引](NEW_MAINTAINER_GUIDE.md) 和 [项目完整现状](PROJECT_STATUS.md)。本文保留版本流程及历史问题记录，不应被当作唯一的动态生产清单。

## 2. 分支与版本

当前采用版本分支：

```text
feature/v主版本.次版本.修订版本
```

普通迭代默认只增加修订版本号：

```text
0.1.10 -> 0.1.11 -> 0.1.12
```

问题修复迭代在被修复版本后追加 `-fix`，并同步到分支、前后端版本文件、页面可见版本和文档：

```text
0.1.12 -> 0.1.12-fix -> 0.1.13
```

次版本和主版本不自动升级。只有产品负责人明确提出中版本或大版本更新时，才执行：

```text
0.1.x -> 0.2.0   # 中版本
0.x.y -> 1.0.0   # 大版本
```

一次迭代至少应保持以下信息一致：

- 当前 Git 分支名，例如 `feature/v0.1.14-fix`。
- `frontend/package.json` 的 `version`。
- `frontend/VERSION` 和 `backend/VERSION`。
- README 的当前版本说明。
- 页面可见版本号和 favicon 缓存参数。
- 本次迭代对应的计划、注意事项和技术方案文档。

历史文档中的版本号是历史记录，不为了追求全文统一而改写；当前发布信息和新文档必须使用当前版本。

## 3. 主干与版本分支工作流

仓库使用两条长期分支和一组永久保留的版本分支：

- `main`：生产主分支，也是 GitHub 仓库默认分支。只接收已经在 `dev` 验证通过的变更。
- `dev`：集成分支。完成开发、测试和生产构建的版本分支先合并到这里。
- `feature/v主版本.次版本.修订版本`：版本开发分支，例如 `feature/v0.1.13`。
- `feature/v主版本.次版本.修订版本-fix`：问题修复分支，例如 `feature/v0.1.12-fix`。

每个版本分支都必须保留，合并到 `dev` 或 `main` 后不删除，作为版本溯源和回滚依据。

标准流程如下：

1. 从远程最新发布版本对应的基线创建下一迭代分支：新需求创建下一个版本的 `feature/vX.Y.Z`；修复某个已发布版本产生的 Bug，创建该版本对应的 `feature/vX.Y.Z-fix`。不得从陈旧分支继续堆叠。
2. 在版本分支完成开发，并同步版本文件、计划、注意事项和技术文档。
3. 在版本分支执行完整的类型检查、测试和生产构建；全部通过后立即提交并推送远程版本分支。
4. 通过 Pull Request 或等价的受控合并，将版本分支合并到 `dev`；合并后再次执行必要的集成验证。
5. `dev` 验证通过后立即合并到 `main`。不得跳过 `dev`，也不得直接在 `main` 开发。
6. `main` 合并完成后立即执行生产环境部署：重新构建生产产物，按实际 PM2/Apache 链路重启服务，完成本机和公网验收；不得以 `dev`、`development` 或临时开发服务器代替生产部署。
7. 生产验收通过后再执行 `pm2 save`，并记录提交、构建、部署、健康检查和公网验收结果。
8. 保留版本分支、合并提交和验证记录，不通过强制推送改写 `main`、`dev` 或历史版本分支。

当前已发布基线为 `feature/v0.1.32`，生产已核验为 `0.1.32`；后续新需求从最新发布基线创建下一个版本分支，已发布版本 Bug 使用对应 `-fix` 分支。历史版本分支全部保留，不以早期初始化基线替代当前 `dev`。

## 4. 每次代码迭代的标准流程

1. 查看当前分支、工作区、远程分支和最近提交，确认没有覆盖用户已有改动。
2. 从最新的目标分支创建或切换到下一版本分支。
3. 在 `docs/PLAN.md` 记录需求范围、验收标准和不在本次范围内的内容。
4. 先确认真实运行链路和真实引用组件，再修改代码；不要只修改未被页面引用的旧组件。
5. 在 `docs/ATTENTION.md` 记录安全、兼容性、部署、数据迁移和回滚风险。
6. 在对应技术方案文档中记录状态流、数据流、组件关系和边界条件。
7. 完成实现后运行：

   ```bash
   cd frontend
   pnpm exec tsc --noEmit
   pnpm test
   pnpm run build

   cd ../backend
   ./gradlew clean test bootJar
   ```

8. 查看 `git diff --check`、`git status` 和最终 diff，提交清晰的 commit，然后立即推送当前版本分支。提交和推送必须发生在生产部署之前。
9. 按受控流程将已推送分支合并到 `dev`，完成集成验证后再合并到 `main`；合并前不得部署，也不得把本地未推送改动直接部署为正式版本。
10. `main` 合并完成后立即执行生产部署：前端重新生产构建并重启 `paper-reader-frontend`；后端版本变化时按 `docs/DEPLOY.md` 定向重建并启动当前版本 JAR。不能只执行 `pm2 restart paper-reader-backend`，因为 PM2 会保留旧的 JAR 参数。删除旧项后，新 PM2 项不会继承应用环境变量，必须在同一 shell 先加载 `backend/.env` 再启动。
11. 检查本机进程、页面状态码、静态资源状态码和公网域名；需要时检查 Apache、Cloudflare 缓存头和 PM2 日志。生产部署必须使用生产构建和 PM2/Apache 链路，不得用 `pnpm dev`、`./gradlew bootRun` 或其他开发服务器替代。
12. 只有本机和公网验收全部通过后才执行 `pm2 save`，并记录提交、合并、构建、部署、健康检查和公网验收结果。

## 5. 实际部署链路

```text
浏览器
  -> Cloudflare DNS/Proxy/TLS
  -> Apache paper.pilo.eu.cc
       /api -> Spring Boot :8080
       /ws  -> Spring WebSocket :8080/ws
       /    -> PM2 Next.js :3001
```

因此本项目不是 Cloudflare Pages 部署。修改前端源码之后，仅推送 Git 不会自动让公网生效；必须构建并重启 `paper-reader-frontend`。重启前应确认目标进程和端口，不能使用宽泛的 kill 或删除命令。

常用检查：

```bash
pm2 show paper-reader-frontend
pm2 logs paper-reader-frontend --lines 100 --nostream
ss -ltnp | grep 3001
curl -I https://paper.pilo.eu.cc/zh/login
```

## 6. 提交与推送

- 每次有代码改动都要提交并推送远程对应分支。
- commit message 使用能说明意图的短句，例如 `feat: redesign AI chat composer`。
- 推送前确认没有把 `.env.local`、API Key、Token、数据库备份或构建缓存加入提交。
- 不强行覆盖远程分支；发现远程已有新提交时先读取并合并/变基方案，再继续。
- 生产验证失败时，不要宣称已完成；先保留证据并修复或明确阻塞原因。

## 7. 对话功能的维护边界

AI 对话目前存在两套技术路径：

- C 端右侧 AI 面板直接调用用户在浏览器中配置的 OpenAI 兼容 Provider，并将该路径的历史保存在浏览器。
- 旧的后台 `/api/ai-chats` 接口使用服务器端配置的 AI 服务，供其他历史组件使用。

修改其中一套时，必须确认是否需要同步另一套，不能因为接口 DTO 名称相似就混用。任何涉及 API Key 的功能都应避免把密钥写入服务端日志、URL、错误提示或提交记录。

## 8. v0.1.19 AI 思考内容与论文上下文

### 需求

- Provider 返回的 `<think>`、`reasoning_content`、`thinking` 等内容属于模型思考过程，必须与正式答案分离。
- AI 思考默认折叠，用户可以展开查看；正文 Markdown、图表和代码渲染不能受影响。
- PDF 选区菜单的“询问 AI”必须真正进入当前 C 端 AI 对话，并携带论文、页码和选中文本。
- 上传 PDF 后应立即启动 GROBID 全文解析，结果可用于后续论文问答。

### 原因与实现

- 旧解析器虽然识别 reasoning 字段，但只通过 `onContent` 输出正文，reasoning 在消费函数结束时被丢弃；直接混在正文里的 `<think>` 也没有跨 chunk 解析。
- `AnnotationLayer` 已有 `onAskAI`，但 `PDFReader` 没有传入回调；`RightPanel` 的 Tab 状态是内部状态，需通过 reader store 的待处理问题事件连接阅读器和 AI 面板。
- GROBID 客户端原先固定请求 `/api/service`，上传流程只调用 header 解析并捕获异常后返回原论文。v0.1.19 改为调用 `/api/processFulltextDocument`，将 TEI 转换为受限长度的章节/段落 chunks。
- 每次问答只发送摘要、选区、相关 chunks 和用户问题；后端不接触 Provider Key。解析状态使用 `PENDING/PROCESSING/READY/FAILED`，避免全文解析阻塞上传请求。

### 数据与兼容

- `ChatMessageItem.reasoning` 为可选字段，旧的本地历史没有该字段时按空值兼容。
- 论文原始 TEI 使用 TEXT 保存；解析状态、错误信息和 chunks 使用独立字段/表，不能把 XML 当作 `Map` 放入 `jsonb`。
- GROBID 失败不影响 PDF 下载、阅读、批注和笔记；问答在没有解析上下文时退化为标题、摘要和选中文本。

### 后续风险

- `<think>` 标签可能跨 SSE chunk，任何按单 chunk 正则替换的实现都不可靠，必须使用累积缓冲或状态机。
- GROBID 对扫描版、加密版和版式异常 PDF 可能提取失败；首版不引入 OCR，失败必须可见且可重试。
- 相关片段匹配不是语义检索，长距离同义表达可能召回不足；后续增加 embedding 前要重新评估存储、成本和隐私。
- reasoning 可能包含敏感内容，本地持久化前端历史时不得写入 URL、日志或服务端审计记录。

### 验证记录

- 本地 GROBID 0.8.1 已验证 `/api/processFulltextDocument` 可返回结构化 TEI；样例结果约 85KB，包含正文、章节、图表、公式和参考文献结构。
- v0.1.19 前端类型检查、59 个测试、生产构建和后端 `clean test bootJar` 均通过。
- Flyway 已校验并应用 V11，生产后端运行 `paper-reader-backend-0.1.19.jar`，GROBID 存活检查和公网登录页均正常。

## 9. v0.1.14-fix AI 对话空白气泡问题

### 问题

用户发送消息后，AI 尚未返回内容时，界面可能出现一个没有文字的助手气泡；部分 Provider 返回后，气泡仍然为空，用户看不到“正在处理”的状态，也不知道请求是否仍在进行。

### 原因

原实现只有在收到响应头并成功取得流读取器之后才创建助手消息，因此请求等待期间没有明确的处理中状态。与此同时，流式解析器只接受严格的 `data: ` SSE 行，并且只读取带有 `choices[0].delta.content` 的数据；不带空格的 `data:{...}`、末尾没有换行的最后一条数据、普通 JSON 响应以及其他兼容 Provider 的文本结构都会被忽略。解析结束后原实现仍保留空助手消息，形成“空气泡”。

### 解决

- 发送消息时立即创建带 `thinking` 状态的助手消息，气泡显示动态的“思考中 / 正在处理 / 整理答案”状态和动画。
- 收到第一段有效文本后，原位将状态切换为流式回复；完成后标记为 `complete`。
- 统一兼容宽松 SSE、普通 JSON、无末尾换行响应，以及常见 OpenAI-compatible、Anthropic/Gemini 风格的文本字段。
- HTTP、网络错误和成功但无文本的响应都转换为助手气泡内的明确错误信息，不再留下空白气泡。
- 页面重新打开时，将上次遗留的未完成助手消息恢复成可理解的失败状态，避免再次显示空泡。

### 后续风险

只要 Provider 返回可识别的文本内容，处理中状态和回复状态就不会再分离。若 Provider 使用完全私有且未覆盖的响应协议，仍可能无法提取正文；此时界面会显示明确的“没有可显示文本”错误，而不是静默留下空气泡。新增 Provider 适配时必须补充响应解析回归测试。

## 9. v0.1.15-fix Provider 成功但回复为空问题

### 问题

Provider 返回 HTTP 2xx 后，AI 对话仍显示“Provider 返回成功，但响应中没有可显示的文本”，用户看不到实际回复。该问题也可能让偏好设置中的“测试连接”仅依据响应头误报成功。

### 原因

上一版解析器主要按 OpenAI SSE 的 `choices[0].delta.content` 和非流式 `choices[0].message.content` 读取正文。部分 Provider 返回 JSON 数组、`data`/`result`/`response` 包装对象、NDJSON、Responses API `output`、Gemini `candidates`，或把正文放在顶层 `message`、嵌套文本对象、`reasoning_content` 中；这些响应虽然请求成功，却没有被完整识别。测试连接此前在收到 2xx 响应头后就结束读取，没有确认正文可显示。

### 解决

- 统一聊天请求与 Provider 测试请求的响应消费逻辑，测试连接现在必须成功提取正文才会报告成功。
- 扩展解析器，支持 JSON 数组、NDJSON、多个 SSE `data:` 行组成的事件、顶层 `message`、`data`/`result`/`response`/`payload`/`body` 包装、嵌套文本对象、Responses API 输出、Gemini 内容片段和常见 reasoning 字段。
- 正式文本优先于 reasoning 文本；只有 Provider 没有返回正式文本时，才将 reasoning 作为可见兜底，避免留下空气泡。
- 当流式请求返回 2xx 但没有任何可提取文本时，客户端保持当前“思考中”气泡并自动重试一次 `stream: false`。HTTP 错误、网络错误和已提取到文本的响应不会重复请求。
- 对重试路径、兼容响应结构和对话状态补充回归测试。

### 后续风险

非流式兜底会向 Provider 再发送一次相同的对话请求，某些服务可能因此产生额外计费或重复副作用。完全私有且不返回文本字段的协议仍无法自动适配；此时界面会显示明确错误。新增 Provider 适配必须补充样例响应和测试，并确认其 CORS、流式及非流式行为。

## 10. v0.1.16-fix Provider 私有响应仍无法显示问题

### 问题

v0.1.15-fix 上线后，用户使用浏览器中已配置的 Provider 发送消息，流式请求和自动非流式重试仍都返回“没有可显示文本”。PaperHelper 服务器无法直接取得该响应，因为 Provider 配置和请求都只存在于用户浏览器中。

### 原因

上一版虽然覆盖了标准 OpenAI、Responses API 和 Gemini 等结构，但仍依赖预先列出的字段路径。部分兼容服务会返回 DashScope `output.choices`、Spark `payload.choices.text`、AI SDK `text-delta` 或 `0:"..."` 数据流、连续 JSON 对象、非首个 choice、自定义语义字段、大小写变化字段，或者用 HTTP 200 包装业务错误和 HTML 页面。这些情况会被误判为空响应。原错误信息没有响应结构，无法区分“字段未适配”“业务错误”“Base URL 指向网页”或“正文确实为空”。

### 解决

- 增加 DashScope、Spark、AI SDK data stream、连续 JSON、后续非空 choice、大小写字段和常见自定义语义字段兼容。
- 在固定协议路径未命中时，对非元数据对象进行受限递归搜索；跳过请求、prompt、usage、tool、metadata 等容器，避免把用户输入或统计信息当作模型回复。
- 对错误标记为 JSON 的普通文本响应增加最后兜底。
- 识别 HTTP 200 中的 `error`、失败 `code/status`、拒绝、内容过滤和仅工具调用响应，并显示真实业务原因。
- Base URL 返回 HTML 时明确提示地址不是模型 API。
- 流式和非流式都无正文时，错误气泡显示两次响应的 `content-type`、字节数和字段类型结构。诊断只包含字段名和数据类型，不包含字段值、模型输出、用户提示词或 API Key。
- Provider 测试连接与真实对话共用同一解析、错误识别和安全诊断逻辑。

### 后续风险

完全不含文本语义、使用二进制私有协议或仅返回工具调用的服务仍不能作为普通聊天回复展示。若安全结构诊断仍显示未知格式，必须根据错误气泡中的 shape 添加定向样例测试；不得要求用户发送 API Key。流式无文本时的非流式重试仍可能产生一次额外 Provider 计费。

## 11. v0.1.17-fix Provider Base URL 命中网页路由问题

### 问题

用户配置的 Base URL 未包含 Provider 的标准 `/v1` API 路径时，PaperHelper 原先直接请求 `${Base URL}/chat/completions`。部分服务会把这个地址路由到官网、控制台或登录页，因此浏览器收到 HTML，聊天显示“Provider 返回了 HTML 页面而不是模型响应”，连接测试也无法完成。

### 原因

客户端此前只按用户填写的地址请求一次，没有区分“API 端点不存在”与认证失败、额度不足、模型不可用等 Provider 业务错误，也没有在发现正确端点后把地址保存回浏览器的 `pr-preferences` 配置。该配置和 API Key 只存在用户浏览器中，服务器无法通过后台配置复现这一次请求。

### 解决

- 保留用户填写的 Base URL 作为第一次请求地址。
- 当聊天或模型列表请求收到 HTML、HTTP 404 或 HTTP 405 时，有限尝试同一路径下的标准 `/v1` 变体；认证、额度、模型和其他普通 Provider 错误不触发端点回退。
- 连接测试和真实聊天共用端点回退逻辑；回退成功后，连接测试自动把纠正后的 Base URL 写回 Provider，真实聊天也会同步更新浏览器配置。
- 增加 HTML、404、405、认证错误不回退、模型发现回退和地址自动纠正的回归测试；诊断中不打印 API Key。

### 后续风险

并非所有 Provider 都使用 `/v1`，且某些服务会将 404 用于“模型不存在”等业务错误。客户端只在首个候选地址上做一次有限回退；如果 `/v1` 仍不可用，仍需在偏好设置中填写服务商文档给出的准确 API 根路径。浏览器跨域、TLS、网关鉴权和服务商限流问题不会由该回退机制解决。

## 12. v0.1.18 AI 会话身份、配置、标题与并发增强

### 迭代性质

本次是产品功能需求，不是线上 bug 修复，因此版本从 `0.1.17-fix` 递增为 `0.1.18`，版本分支使用 `feature/v0.1.18`，不追加 `-fix`。

### 需求

- 用户消息显示当前登录用户头像，助手保留 Bot 图标并显示昵称 `PR助手`。
- 每个本地历史会话独立保存 Provider 和模型，新会话继承前一个会话的选择。
- 切回历史会话时恢复该会话原有配置，不影响其他会话。
- 标题由 AI 根据用户问题和助手回复总结，不能直接复制用户问题。
- 历史列表显示创建时间和最后对话时间。
- 一个会话等待回复时，其他没有请求的会话仍可发送。

### 实现

- `DirectChat.providerId` 和 `DirectChat.model` 继续作为会话持久化字段，新增 `updateDirectChatConfig` 只修改指定会话。
- `ChatPanel` 的 Provider/模型选择器以当前会话为数据源；新建与历史切换分别执行继承和恢复。
- 用户头像读取 `useUserStore.profile`，无头像时使用名称首字母；助手所有状态统一显示 `PR助手`。
- 移除首条问题直接生成标题的逻辑。首次成功回复后，以同一 Provider/模型发起一次 `stream: false` 请求生成标题，清理前缀、引号和超长文本，并拒绝与用户问题相同的结果。
- 新增 `directChatSending` 和 `directChatTitleGenerating` 两组按会话 ID 管理的运行时状态。所有异步回调捕获目标会话 ID，因此跨会话请求不会串线。
- 历史按 `updatedAt` 排序，显示 `createdAt`、`updatedAt`、Provider、模型和各自的回复中状态。
- 持久化恢复时清空运行时状态，遗留中的助手占位消息沿既有规则恢复为中断错误。

### 验证与回归要求

- 自动化测试必须覆盖标题请求、拒绝问题原文标题、配置隔离、并发会话、头像、助手昵称、时间字段和新会话继承。
- 标题生成会增加一次 Provider 请求，可能增加费用和限流占用；失败不能影响正文回复。
- 删除 Provider 后历史仍可能保留旧 ID；历史可读，但再次发送前必须重新绑定现存 Provider。
- 后续维护不得重新使用全局 `isSending` 禁用所有直连会话，也不得在异步回调中直接把结果写入当时的当前会话。

## 13. v0.1.18-fix Provider 根路径与浏览器 CORS 连接失败

### 问题

用户在偏好设置中使用 OpenAI-compatible Provider 测试连接或发送对话时，即使 API Key 和模型有效，也可能看到连接失败、Provider 返回 HTML 页面，或响应无法显示。当前验证的 Provider 是 `lzhiyu.ccwu.cc`，模型为 `gpt-oss-20b`。

### 原因

- Provider 的网页根路径下 `/models` 和 `/chat/completions` 不是模型 API；实际 API 根路径是 `/v1`。
- Provider 的浏览器预检响应没有允许 `https://paper.pilo.eu.cc`，所以带 `Authorization` 的浏览器请求会被 CORS 阻断；服务端直接请求则可以正常拿到响应。
- 原实现只在浏览器中直连 Provider，无法区分 CORS 网络错误和上游真实 HTTP 错误，也不能在浏览器读取被拦截的上游错误正文。

### 解决

- 客户端保留用户输入地址作为第一次候选，并在 HTML、404/405 等端点错误时有限尝试 `/v1`；成功后自动把纠正后的地址写回本地 Provider 配置。
- 客户端遇到浏览器网络/CORS 失败时调用同源 `/api/provider-relay`，模型发现和聊天请求共用同一回退逻辑；直连成功时不调用 relay。
- 后端 relay 使用 JWT 登录保护，仅接受两个固定操作、HTTPS 公网目标和标准消息角色；禁用上游重定向并拦截本地/内网/保留地址，API Key 不落库、不写日志。
- relay 保留上游状态、内容类型和安全错误正文，支持 SSE 流式响应和普通 JSON 响应。
- `StreamingResponseBody` 写完正文后会触发 Servlet `ASYNC` 二次分发。初版安全链在这次内部调度中重新要求认证，导致响应已返回 `200` 且正文完整后仍抛出 `AuthorizationDeniedException`，客户端可能收到不完整传输。安全配置现仅放行 `DispatcherType.ASYNC`，原始 relay 请求仍必须先通过 JWT；回归验证要求流式请求收到 `[DONE]`、客户端正常结束且服务端无异步授权异常。
- 当前 Provider 推荐配置：Base URL `https://lzhiyu.ccwu.cc/v1`，模型 `gpt-oss-20b`。

### 后续风险

Provider 如果修改 CORS 或 API 路由，客户端仍会优先尝试直连并在必要时使用 relay；完全私有的响应协议、工具调用-only 响应和非 HTTPS 公网地址仍不在支持范围。relay 会让 API Key 经过 PaperHelper 服务器，因此只作为浏览器无法直连时的受保护回退，不能在日志、截图或提交中暴露密钥。用户已在聊天中公开过的密钥应在验证后撤销并重新生成。

### 本次验证

- 后端 `clean test bootJar` 通过。
- 临时 `0.1.18-fix` 实例验证未登录 relay 返回 `401`，原始请求的 JWT 保护未被放宽。
- 使用推荐 Base URL 和模型验证 `/models` 返回 19 个模型并包含 `gpt-oss-20b`；非流式聊天返回 `200` 和可见正文。
- SSE 聊天返回 `200`、包含 `[DONE]`，客户端正常结束且没有 `AuthorizationDeniedException`。

## 14. v0.1.19-fix 健康接口发布版本错误

### 问题

v0.1.19 已完成构建并部署，PM2 实际启动参数也指向 `paper-reader-backend-0.1.19.jar`，但本机及公网 `/api/health` 仍返回 `version=0.1.18-fix`。这会让部署验收、监控和故障排查误判当前生产版本。

### 原因

`HealthController` 将 `0.1.18-fix` 直接写在响应代码中。后续版本虽然同步更新了 Gradle、前后端 `VERSION`、前端包版本和 UI，却没有同步这一处隐蔽常量。JAR 文件名与进程参数因此是新版本，接口响应仍长期停留在旧版本。

### 解决

- 后端版本更新为 `0.1.19-fix`，并启用 Spring Boot `buildInfo()`，在构建产物中生成 `META-INF/build-info.properties`。
- `HealthController` 通过 `ObjectProvider<BuildProperties>` 读取当前构建的 `version`，不再包含发布版本常量。
- IDE 或测试环境没有构建元数据时明确返回 `development`，避免伪装成任一正式版本，同时不阻止应用启动。
- 增加 Controller 回归测试，覆盖构建版本读取和无元数据回退两条路径。
- 前端包版本、前后端 `VERSION`、favicon 缓存参数、README、计划和注意事项同步更新为 `0.1.19-fix`。

### 后续是否还会出现

正常发布流程下不会再因遗漏 Controller 常量而返回旧版本；健康接口现在跟随正在运行的 JAR 构建元数据。但以下情况仍需在部署验收中检查：如果误删 `springBoot.buildInfo()`，接口会返回 `development`；如果 PM2 仍指向旧 JAR，接口会如实返回旧 JAR 的版本。因此每次后端发布都必须同时核对 JAR 文件名、JAR 内 build-info、PM2 启动参数和公网健康接口，不能只看其中一项。

### 发布验证

- 修复提交：`0f8fba0`；已按既定流程合并到 `dev`（`e44dca4`）和 `main`（`4b1a870`）。版本分支 `feature/v0.1.19-fix` 保留。
- `pnpm exec tsc --noEmit`、前端 5 个测试文件共 59 个测试、`pnpm run build` 和后端 `./gradlew clean test bootJar` 全部通过。
- JAR `paper-reader-backend-0.1.19-fix.jar` 内的 `META-INF/build-info.properties` 已确认 `build.version=0.1.19-fix`。
- PM2 后端已重建并指向 `paper-reader-backend-0.1.19-fix.jar`；前端已重新构建并重启，PM2 状态已保存。
- 本机与公网 `/api/health` 均返回 `status=ok`、`version=0.1.19-fix`；GROBID `/api/isalive` 返回 `true`；`https://paper.pilo.eu.cc/zh/login` 返回 200。
- 公网页面已使用 `paperhelper-favicon-light.svg?v=0.1.19-fix`，用于确认前端新构建已生效。

## 15. v0.1.20 论文卡片操作区与可选原文件删除

### 需求

- 论文卡片的分类标签不得与右下角三点菜单重叠，两者之间要保持稳定间距和可点击区域。
- 三点菜单在收藏、标签、分享、下载之后增加“删除”。
- 删除必须经过二次确认；弹窗包含“同时删除原文件”复选框，并明确说明勾选后服务器不再保留文件副本。

### 原有问题与风险

- 分类标签位于普通布局流中，但三点按钮使用右下角绝对定位；窄侧栏、长分类名称或标签较多时，两者会覆盖。
- `PaperCard` 虽然接收 `onDelete`，菜单中没有删除项，因此侧栏传入的删除函数从未触发。
- 旧后端删除接口无条件调用文件存储删除，用户无法选择只删除记录；文件服务的删除异常又被吞掉，无法保证界面结论与实际服务器状态一致。
- `pr_annotations`、`pr_notes`、`pr_reading_logs`、`pr_paper_versions` 和旧 AI 对话等外键没有全部配置级联，直接删除论文可能因约束失败或留下关联数据。

### 实现方案

- 卡片元数据行使用 `minmax(0, 1fr) / auto / 28px` 三栏网格：元数据可截断、分类标签固定、三点按钮占独立布局单元。
- 新增 `DeletePaperDialog`，默认不勾选原文件删除；提交中和错误状态均在弹窗内可见，失败不会关闭弹窗。
- `PaperListDto` 与 `PaperDetailDto` 增加 `hasOriginalFile`，由后端根据非空 `filePath` 返回，前端据此决定是否显示复选框。
- 删除接口使用 `deleteFile` 查询参数，默认 `false`。删除服务先校验论文归属，再显式清理所有关联表并 flush 数据库约束。
- 用户选择物理删除时，数据库 flush 成功后调用本地/DUFS 文件删除；删除失败抛出 `1005` 业务错误，使数据库事务回滚并让前端保留卡片。
- 删除成功后同步清理被删论文的前端批注、笔记和待提问缓存；只有删除当前正在阅读的论文时，才重置当前选区和页面跳转状态。
- 不勾选时保留原文件，但论文记录删除后该文件成为服务器保留副本；当前版本不提供文件重新关联或孤儿文件管理。

### 验证记录

- `pnpm exec tsc --noEmit` 通过。
- `pnpm test` 通过：8 个测试文件、65 项测试；覆盖卡片删除入口、确认弹窗默认值/文件选项/失败状态，以及删除当前或非当前论文时的 Reader 缓存行为。
- `pnpm run build` 通过；仅有项目既有 lint 警告，无构建错误。
- `./gradlew clean test bootJar` 通过：30 项后端测试，生成 `paper-reader-backend-0.1.20.jar`。
- 功能提交 `787f58a` 已推送并保留在 `feature/v0.1.20`；已合并到 `dev`（`25eb547`）和 `main`（`5e60b6e`）。
- 后端 PM2 已重建并指向 `paper-reader-backend-0.1.20.jar`，前端已重启加载新的 `.next` 构建，最终进程列表已执行 `pm2 save`。
- 本机与公网 `/api/health` 均返回 `status=ok`、`version=0.1.20`；`https://paper.pilo.eu.cc/zh/login` 返回 200。
- 公网页面引用 `paperhelper-favicon-light.svg?v=0.1.20`，明暗两份 favicon 均返回 200；GROBID `/api/isalive` 返回 `true`。
- 部署中曾因重建 PM2 项时未继承旧进程应用变量而出现启动循环；从部署前 PM2 备份恢复同一组应用配置后正常启动。标准部署命令已补充“同一 shell 加载 `backend/.env`”和“健康检查通过前再 `pm2 save`”要求。

### 后续风险

- 数据库事务无法与本地文件系统/DUFS 形成真正的分布式原子事务；当前顺序优先避免数据库约束失败后误删文件。极端情况下，文件删除成功后数据库提交失败，仍可能产生记录存在但文件缺失，后续可通过 outbox/删除任务进一步增强。
- 新增任何引用 `pr_papers` 的表时，都必须更新 `PaperDeletionService` 或为外键明确配置合适的级联/置空语义。
- 保留原文件会形成不再由论文记录引用的副本；上线孤儿文件清理功能前，不得自动清理这些用户明确选择保留的文件。

## 16. v0.1.21 论文标题保守清洗与侧栏选中态优化

### 需求

- 修正阅读器顶部标题把首页授权声明和论文真实标题拼接在一起的问题，保证标题显示与点击复制均准确。
- 优化“我的论文”侧栏中当前论文卡片的左侧标记，使选中态规整、克制，并具有明暗主题下统一的系统级层次感。

### 调查与原因

- 样例 PDF 的首页文本前三行是 Google 授权声明，下一行才是 `Attention Is All You Need`；arXiv `1706.03762` 的权威记录也确认后者为真实标题。
- PDF 自带 Title 元数据为空，不能用 PDF Info 可靠覆盖。GROBID 的 header 和 fulltext 接口都把授权声明与真实标题合并进同一个 TEI `title type="main"`，因此前端只是忠实显示了后端已存储的错误元数据。
- 旧 `TeiDocumentParser` 对 `titleStmt/title` 只做空白规范化，`PaperParsingPersistenceService` 随后直接覆盖论文标题。已有记录即使修改解析器也不会自动重新解析。
- 旧卡片使用贴左边缘、贯穿全高的 3px 纯黑标记，激活边框也使用高对比 `accent`，多个深色轮廓叠加后显得厚重且不规整。

### 实现方案

- 在 TEI 解析层新增保守清洗：仅移除位于标题开头、完整匹配的已确认 Google 授权声明；不使用长度、首句或大小写启发式。
- 清洗后的候选必须非空且包含字母或数字，否则回退到规范化后的原始标题。普通长标题完全保持原样。
- 新增 Flyway V12 数据迁移，以同一完整前缀精确筛选历史记录，并只在剩余文本有效时更新 `title` 和 `updated_at`；GROBID 原始 TEI 不改。
- 当前论文卡片使用距左边 5px、上下各留 12px、宽 2px 的圆角胶囊。激活卡片改用主题变量控制背景、低对比细边框、顶部内高光及两层柔和阴影，标记不接收指针事件。
- 卡片增加 `aria-current="page"` 与 `data-active`，让当前状态同时具备可访问语义和稳定的测试锚点。

### 验证与后续风险

- 自动化覆盖声明清洗、普通长标题不变、只有声明时不返回空标题，以及选中卡片的语义与内缩胶囊样式。
- `pnpm exec tsc --noEmit`、前端 8 个测试文件共 66 项测试、`pnpm run build` 与后端 `./gradlew clean test bootJar` 均通过；后端共 33 项测试，产物为 `paper-reader-backend-0.1.21.jar` 且 build info 为 `0.1.21`。
- V12 已在生产数据库连接上使用显式事务试运行：只命中论文 ID 3，事务内标题变为 `Attention Is All You Need`，随后 `ROLLBACK` 并确认原记录未被提前修改；正式发布时由 Flyway 原子应用。
- 功能提交 `d9ee334` 已推送并保留在 `feature/v0.1.21`；已合并到 `dev`（`ee14b97`）和 `main`（`f657b3c`），GitHub 默认分支仍为 `main`。
- 生产后端 PM2 已重建并指向 `paper-reader-backend-0.1.21.jar`；Flyway 成功应用 V12。数据库已不再存在该声明前缀，论文 ID 3 的标题为 `Attention Is All You Need`。
- 前端已重启并加载新构建；本机与公网 `/api/health` 均返回 `0.1.21`，公网登录页为 200、动态无缓存，并引用 `paperhelper-favicon-light.svg?v=0.1.21` 及包含新选中态变量/组件标记的静态资源。
- 明暗两份 favicon 均返回 200，GROBID `/api/isalive` 返回 `true` 且容器未重建；前后端 PM2 进程均为 online，验证后已执行 `pm2 save`。
- 新的未知出版社声明不会被自动猜测清洗，可能仍需按真实样例增补明确模式；这比通用截断误伤合法标题更安全。
- 数据迁移只能修复当前明确模式。若数据库中已有其他形式的污染标题，应先审计真实 TEI/PDF，再以新版本增加独立、可测试的规则。
- 本次只改 PaperHelper C 端仓库中的解析消费层、数据库迁移和 UI；GROBID 服务及后台管理项目均不变。

## 18. v0.1.23 单篇论文元数据补全（已部署）

### 需求与边界

本轮响应“已有论文刷新并补全元数据”的需求。开发分支 `feature/v0.1.23` 增加了 Reader 右侧论文信息面板入口和后端四个元数据接口：

- `POST /api/papers/{id}/metadata/resolve`
- `GET /api/papers/{id}/metadata/resolutions/{resolutionId}`
- `POST /api/papers/{id}/metadata/resolutions/{resolutionId}/apply`
- `GET /api/papers/{id}/metadata/sources`

用户可以输入或让系统从已有 URL/DOI/TEI 识别 arXiv ID、DOI，生成短期候选预览，再逐字段应用。默认只勾选空字段；冲突字段和正式发表候选不默认勾选。应用前后端都校验论文所有权、resolution 所属用户、15 分钟过期时间和 `expectedUpdatedAt`，避免刷新快照覆盖较新的人工编辑。

### 实现记录

- arXiv Atom 精确查询已接入；DataCite 与 Crossref 作为精确 DOI Provider 已接入。
- arXiv 成功结果缓存 24 小时、失败结果缓存 5 小时，单进程按官方 legacy API 要求做三秒节流；响应限制为 2 MB 并禁用 XML 外部实体。
- V13 只增加 `pr_paper_metadata_resolutions`、`pr_paper_metadata_sources`、`pr_paper_metadata_field_provenance` 三张最小闭环表，并对论文/用户使用级联删除。
- 字段 provenance 保存 Provider、记录链接、匹配方式、置信度、应用时间和用户确认状态。外部 payload 只保留白名单元数据。
- GROBID 解析保存改为只填空字段，不覆盖已有非空人工值或已确认值。
- *Attention Is All You Need* 的 arXiv `1706.03762` 与已审核 NeurIPS 关系作为正式版本候选验收适配器；`v7`、PDF 页数、仓储 DOI 和正式卷页不混用。

### 尚未完成

- 完整 `manifestation`、多标识 `identifier` 和 preferred publication 数据模型尚未落地；V13 不应被描述为完整模型。
- DBLP 通用标题/作者候选、arXiv OAI-PMH、分布式缓存/限流、指数退避和历史库批量刷新不在当前闭环内。
- 前端 apply 后会立即刷新当前论文状态，出版页码兼容展示和新增元数据文案已接入；通用 OAI-PMH、批量刷新及完整 manifestation/identifier 模型仍不在本轮范围内。

### 验证与发布纪律

本节记录 v0.1.23 的实现、发布和验收结果。前后端全量验证、数据库备份、V13 迁移、PM2 重启和公网验收均已完成；本轮未批量刷新或改写既有论文数据。

### 发布与验收记录（2026-08-26 UTC）

- 发布提交：`main` 合并提交 `123db8c`；`dev` 合并提交为 `3c01fd0`，功能提交为 `eb81f05`；版本分支 `feature/v0.1.23` 保留。
- 验证通过：后端 `./gradlew clean test bootJar`；前端 `pnpm install --frozen-lockfile`、`pnpm exec tsc --noEmit`、68 项测试和 `pnpm run build`。构建仅有既有 lint 警告，无阻断错误。
- 生产发布前数据库备份：`/root/paper-reader-backups/paper_reader_20260826T141104Z_pre_v0.1.23.dump`。
- 生产 Flyway 已成功执行 V13 `paper metadata enrichment`；已确认 `pr_paper_metadata_resolutions`、`pr_paper_metadata_sources` 和 `pr_paper_metadata_field_provenance` 三张表存在。
- 后端 PM2 已重建并指向 `paper-reader-backend-0.1.23.jar`；前端 PM2 已重启加载新的 `.next`。两个进程均为 `online`，完成后执行 `pm2 save`。
- 本机与公网 `/api/health` 均返回 `status=ok`、`version=0.1.23`；公网 `/zh/login` 返回 200，明暗 favicon 均返回 200 且引用参数为 `v=0.1.23`。
- GROBID `/api/isalive` 返回 `true`；`infra-postgres`、`infra-redis` 和 `paper-reader-grobid` 未重建；生产上传目录 `/root/paper-reader/backend/uploads` 未修改。
- 回滚基线：已保存发布前 PM2 快照 `/root/paper-reader-backups/pm2_20260826T141212Z_pre_v0.1.23.json`，并保留已验证的 `0.1.22` JAR 备份（如存在）。数据库迁移已应用后不得直接删除 Flyway 记录；如需回滚，应按部署手册恢复对应 JAR、前端构建并采用向前兼容的数据库方案。


### 两篇历史论文补全记录（2026-08-26 UTC）

- 生产库盘点确认共有两条论文记录：ID `2` 和 ID `3`，均为 *Attention Is All You Need*，都识别到 arXiv `1706.03762`。
- 两条记录均通过生产 API 的 `resolve -> apply` 流程完成补全，没有直接绕过业务层写入。补全内容包括标题、作者、摘要、年份、arXiv ID/版本/分类、提交与更新时间、仓储 DOI 和许可证。
- 两条记录均应用了已审核的 NeurIPS 正式出版候选：`Advances in Neural Information Processing Systems`、卷 `30`、出版页码 `5998-6008`、出版社 `Curran Associates, Inc.`、`CONFERENCE_PAPER` 和 DBLP key `conf/nips/VaswaniSPUJGKP17`。
- 记录 ID `3` 原有年份 `2023` 与 arXiv 首次发表年份冲突，经过显式候选确认后改为 `2017`；没有覆盖用户已有的其他非空字段。
- 最终两条记录的 `title`、`year`、`journal`、`extra_fields` 和更新时间已复核；字段 provenance 分别为论文 ID `2` 的 19 项、论文 ID `3` 的 16 项。此次仅处理现有两条记录，未启动历史库批量任务。

## 17. v0.1.22 项目交接、配置安全与新人指引

### 需求

- 将项目完整进度、架构、生产状态、配置方式、历次踩坑、技术债和发布流程集中记录在 `docs/`。
- 提供从根 README 可直接到达的新人入口，使后续维护不依赖历史聊天上下文。
- 提交并推送完整文档，按既定版本分支、`dev`、`main` 流程交付。

### 调查结果

- 生产链路实际是 Cloudflare -> Apache -> PM2，而不是 Cloudflare Pages；Apache 将 `/api`、`/ws` 和 `/` 分别代理到后端与前端。
- Next 以 `localhost:3001` 运行且当前监听 `::1`，因此 `127.0.0.1:3001` 探活会误报；后端监听 `127.0.0.1:8080`。
- 生产只有 `infra-postgres`、`infra-redis`、`paper-reader-grobid` 三个基础设施容器，均无 Compose labels；它们不能被视为仓库 Compose 管理的完整四服务。
- 生产文件存储实际为 local，目录为 `/root/paper-reader/backend/uploads`；没有 Dufs 容器。后端仍使用 development profile，这是待单独评估的运维风险。
- 主阅读器 AI 使用 `components/chat/ChatPanel.tsx` 和浏览器本地 Provider/历史；同名 `components/ai/ChatPanel.tsx` 是旧路径。
- 邮件验证码只写日志、外部存储推送未实现、WebSocket 身份绑定/CORS/浏览器 Key 存储等边界此前没有集中呈现。
- 真实 `backend/.env`、`frontend/.env.local` 和根目录工具脚本曾被 Git 跟踪，包含已配置运行信息或硬编码模型网关凭据。这是安全事件，取消当前跟踪和清理当前脚本不能清除历史。

### 实现

- 新增 `docs/README.md` 文档索引、`PROJECT_STATUS.md` 完整现状和 `NEW_MAINTAINER_GUIDE.md` 新人手册。
- 根 README 增加维护者入口，纠正邮件投递、外部存储推送和生产存储/Compose 描述。
- 更新计划、注意事项、维护和部署文档，统一记录生产拓扑、配置、验证和危险操作边界。
- 补充 `NEXT_PUBLIC_WS_URL`、GROBID 解析线程池模板变量，并把 profile 注释改为代码真实名称。
- `.gitignore` 显式保护各层 `.env`，只允许 `.env.example`；真实环境文件从 Git 索引移除，但服务器本地文件保留。
- 根目录工具启动脚本移除硬编码 Key 和 Base URL，改为要求调用者从本机环境注入；脚本不再承担凭据存储。
- TypeScript 增量构建缓存 `*.tsbuildinfo` 从版本控制移除并忽略，避免每次验证产生无意义的大型 diff。
- 版本统一升级到 `0.1.22`，本轮属于普通维护需求，不使用 `-fix`。

### 安全后续

- 历史中可能出现的数据库、Redis、JWT、OAuth、模型网关等凭据都应视为可能泄漏，安排受控吊销或轮换。JWT 轮换会使现有用户下线，数据库和 Redis 轮换会影响共享服务，不能在文档提交中顺手执行。
- 如需从 Git 历史彻底移除秘密，必须先确认仓库可见范围、所有长期/版本分支和协作者同步方案，再单独授权执行历史重写与强推。
- Provider API Key 目前主要存浏览器 `pr-preferences`，不在前端 `.env.local`；仍需要后续的服务端加密或更安全存储方案。

### 验证与发布记录

- Markdown 相对链接、常见高置信 Secret 模式和 `git diff --check` 已通过；当前跟踪树不再命中已发现的硬编码模型凭据。
- `pnpm exec tsc --noEmit`、前端 8 个测试文件共 66 项测试、`pnpm run build` 均通过；构建仍有项目既有的未使用变量、原生 `<img>` 和 Hook dependency 警告，无错误。
- 后端 `./gradlew clean test bootJar` 通过，共 33 项测试；生成 `paper-reader-backend-0.1.22.jar`，`META-INF/build-info.properties` 为 `build.version=0.1.22`。
- 已确认 `git ls-files backend/.env frontend/.env.local` 无输出，两个本机运行文件仍存在且被 ignore；`frontend/tsconfig.tsbuildinfo` 也已取消跟踪并保留为本地构建缓存。
- 交接提交 `52d479f` 已推送并保留在 `feature/v0.1.22`；已合并到 `dev`（`d166c4b`）和 `main`（`d4862c1`），GitHub 默认分支仍为 `main`。
- 在 `main` 上再次完成前端生产构建和后端 `clean test bootJar`；生产后端 PM2 已重建并指向 `paper-reader-backend-0.1.22.jar`，前端 PM2 已重启加载新 `.next`。
- 后端约 10 秒启动完成，Flyway 确认 public schema 已是 V12、无需新迁移；本机与公网 `/api/health` 均返回 `0.1.22`，本机和公网登录页均为 200 且动态无缓存。
- 公网页面引用 `paperhelper-favicon-light.svg?v=0.1.22`，明暗 favicon 均返回 200；GROBID `/api/isalive` 为 `true`，`infra-postgres`、`infra-redis`、`paper-reader-grobid` 均未重建。
- 两个 PM2 进程均 online、后端零重启；错误日志的最后修改时间早于本次发布，没有新增错误。上传目录保持存在且权限未变，全部验收通过后已执行 `pm2 save`。
- 合并取消跟踪后，Git 按预期移除了工作区里的旧受跟踪 `.env` 副本；部署前已从可信基线提交 `d63a56d` 精确恢复到本机，并确认文件存在、被 ignore 且不在索引中。后续在已采用新 ignore 规则的分支间切换不会再重复删除，但首次落地该安全提交时应注意此迁移行为。

## 19. v0.1.30 PaperHelper 品牌与书架升级（已部署）

本轮在 `feature/v0.1.30` 完成 PaperHelper 品牌升级：产品名称统一为 PaperHelper，Logo 与 favicon 使用大写 H，版本升级为 0.1.30；书架侧栏移除独立收藏菜单，原“我的论文”改为“我的书架”，并在书架中提供所有、创建、导入、收藏四个 Tab。

已完成通知交互回归、品牌资源更新和书架 Tab 功能验证；本轮不涉及后端接口、数据库迁移和用户数据。

## 20. v0.1.30 PaperHelper 品牌与书架升级发布记录（2026-08-30 UTC）

- 发布提交：`eeb98aa`；`feature/v0.1.30` 已推送并合并到 `main`，合并提交为 `93c0733`。
- 前端测试、TypeScript 类型检查、Lint 和 Next.js 生产构建通过；Lint 仅有既有 warning。后端 `./gradlew clean test bootJar` 通过，产物为 `paper-reader-backend-0.1.30.jar`。
- 产品名称、Logo、favicon、环境模板、demo 和用户可见文案已统一为 PaperHelper；Logo 与 favicon 使用大写 H。书架调整为“我的书架”，侧栏收藏入口改为“我的创作”，书架提供所有、创建、导入、收藏四个 Tab。
- 后端 PM2 已重建并指向 `paper-reader-backend-0.1.30.jar`；前端已重新生产构建并重启。两个 PM2 进程均为 `online`，未重建共享 PostgreSQL、Redis、GROBID 或覆盖 uploads。
- 本机与公网 `/api/health` 均返回 `status=ok`、`version=0.1.30`；本机与公网 `/zh/login` 均返回 200；新版明暗 favicon 均返回 200；验收后已执行 `pm2 save`。
- 当前发布基线为 `feature/v0.1.30`，生产版本为 `0.1.30`；后续新需求从最新发布基线创建下一个版本分支，已发布版本 Bug 使用对应 `-fix` 分支。

## 21. v0.1.31 PaperHelper 菜单文案调整（已部署）

本轮需求编号为 `REQ-202608-0012`，基于已发布的 `0.1.30` 创建普通迭代分支 `feature/v0.1.31`。需求仅将书架侧栏的“我的创作”改为“我的论文”，英文同步为 “My Papers”。内部 `created` 路由键、`create` Tab、图标和业务逻辑保持不变。

- 前端 `nav.created` 中英文展示文案已更新；前后端版本和 favicon 缓存参数已升级为 `0.1.31`。
- 本轮不涉及数据库迁移、后端接口、用户数据、后台管理项目或 PostgreSQL、Redis、GROBID 等共享基础设施。
- 代码完成后按规范执行前端测试、TypeScript 类型检查、Lint、生产构建和后端 `clean test bootJar`，然后提交并推送 `feature/v0.1.31`。
- 通过 `feature/v0.1.31 -> dev -> main` 合并后，重新部署生产环境，验证 PM2、本机和公网健康接口、登录页及 favicon；验收通过后执行 `pm2 save`。
- 发布提交：`88002e7`、`ab87472`；`feature/v0.1.31` 已推送并依次合并到 `dev`（`586bc5b`）和 `main`（`70606dc`）。
- 前端测试、TypeScript 类型检查、Lint、生产构建和后端 `clean test bootJar` 均通过；Lint 和 Kotlin 仅有既有 warning。
- 后端 PM2 已重建并指向 `paper-reader-backend-0.1.31.jar`，前端已生产构建并重启；两个 PM2 进程均为 `online`。
- 本机与公网 `/api/health` 均返回 `status=ok`、`version=0.1.31`；公网 `/zh/login` 返回 200；明暗 favicon 返回 200 且页面引用 `v=0.1.31`；验收后已执行 `pm2 save`。
- 本轮不涉及数据库迁移、后台管理项目、共享基础设施或 `backend/uploads`。

## 22. v0.1.32 论文助手 C 端登录页面优化（已部署）

本轮需求编号为 `REQ-202609-0070`，基于 `dev` 创建普通迭代分支 `feature/v0.1.32`。登录页改为左右分栏：左侧使用 Canvas 绘制动态粒子网络背景并展示论文阅读主题轮播，右侧保留原有邮箱密码、验证码和 GitHub OAuth 登录流程；中英文文案同步补齐，窄屏隐藏左侧展示区。前后端版本、页面 favicon 缓存参数升级到 `0.1.32`。

本轮不涉及数据库迁移、后端接口、用户数据、后台管理项目或共享基础设施。发布提交为 `a602471`；后端 PM2 使用 `paper-reader-backend-0.1.32.jar`，前端已重启并执行 `pm2 save`。本机与公网健康接口均返回 `version=0.1.32`，本机与公网 `/zh/login` 均返回 200，页面包含新登录展示和 `v=0.1.32` favicon。前端 `pnpm exec tsc --noEmit`、`pnpm test`（10 个文件、71 项测试）、`pnpm run lint` 和 `pnpm run build` 已通过；Lint 仅有既有 warning。后端 `./gradlew clean test bootJar` 已通过，Kotlin 仅有既有 unchecked cast warning。

## 23. v0.1.33 登录页收尾修复（补齐 v0.1.32 遗留问题）

本轮需求编号为 `REQ-202609-0071`，基于 `dev` 创建修复迭代分支 `feature/v0.1.33`。v0.1.32 的登录页改版验收不完整：左右两栏未等高、右侧登录卡片配色写死不跟随暗色模式、缺少主题/语言切换入口、缺少服务条款与隐私政策链接及对应页面、缺少版本号与版权页脚。本轮逐项修复。

### 实现要点

- `(auth)/layout.tsx` 改为 `items-stretch` 等高布局，右上角加入 `ThemeToggle`/`LangToggle`，底部新增 `AuthFooter`。
- `LoginExperience.tsx` 外层加 `h-full`，全部写死颜色改为读取 `var(--surface-*)`/`var(--text-*)`/`var(--accent)` 等主题变量；粒子背景改为读取 `--accent` 计算颜色并监听 `data-theme` 变化实时更新。
- `LoginForm.tsx` 卡片加 `h-full flex flex-col`，去除写死颜色，底部新增服务条款/隐私政策链接行。
- 新增 `terms`、`privacy` 占位页面（中英文），并加入 `middleware.ts` 公开路径白名单，未登录用户可直接访问。
- `zh/en common.json` 新增 `auth.agreementPrefix/termsLink/privacyLink/and/copyright` 与 `legal.*` 文案。

### 验证记录

- 本地使用 Playwright 对 `zh`/`en` 两种语言、亮/暗两种主题共 4 种组合截图核对：左右卡片高度一致（DOM 测量均为 `height: 688`）、右侧登录卡片颜色随主题切换、主题/语言切换按钮和条款/隐私/版本/版权页脚均正确显示。
- `curl` 确认 `/zh/terms`、`/zh/privacy`、`/en/terms` 均返回 200。
- 前端 `pnpm exec tsc --noEmit` 无错误；`pnpm test` 10 个文件 71 项测试全部通过；`pnpm run build` 成功，新增 `/[locale]/terms`、`/[locale]/privacy` 路由正常生成；Lint 仅有既有 warning（改动文件均未引入新增 lint 问题）。
- 后端 `./gradlew clean test bootJar` 通过，44 项测试全部通过，产物为 `paper-reader-backend-0.1.33.jar`，Kotlin 仅有既有 unchecked cast warning。

### 发布与验收记录（2026-09-07 UTC）

- 功能提交：`183a7a9`；`feature/v0.1.33` 已推送并依次合并到 `dev` 和 `main`（合并提交 `61bc50f`），GitHub 默认分支仍为 `main`。
- 后端 PM2 已重建并指向 `paper-reader-backend-0.1.33.jar`；前端已使用 `main` 上的最新构建重启。两个 PM2 进程均为 `online`，后端 0 次重启，验收后已执行 `pm2 save`。
- 本机与公网 `/api/health` 均返回 `status=ok`、`version=0.1.33`；本机与公网 `/zh/login` 均返回 200；`/zh/terms`、`/zh/privacy` 均返回 200；页面 favicon 引用 `v=0.1.33`。
- 本轮不涉及数据库迁移、后台管理项目、共享基础设施或 `backend/uploads`。
