# PaperReader 注意事项

## v0.1.23 外部论文元数据补全注意事项（待实施）

- 当前提交只整理方案和计划，不修改业务代码、数据库、版本号、生产论文数据或线上服务；`0.1.22` 仍是当前发布版本。
- arXiv ID 的版本后缀 `v7` 表示修订版本，绝不能写进出版卷号；`15 pages` 是预印本说明，不能写进出版页码。
- `10.48550/arXiv.<id>` 是 arXiv/DataCite 仓储 DOI，不等于出版社正式 DOI。正式 DOI 不存在时必须保留为空，不能猜测。
- arXiv Atom/OAI 的字段只代表预印本形态；正式会议/期刊卷期页必须来自明确关联的官方 proceedings 或领域书目源，并在来源中标注，不能把两个形态写进同一套字段。DBLP 是书目核对源，不自动等同于出版社官方证明。
- 标题、作者和摘要完全相同也不足以自动认定 DOI。Crossref/OpenAlex 当前存在 Attention 论文的 2025 同名异常候选，模糊搜索永远只能生成候选，不能静默写入。
- 外部补全默认只填空值。任何非空人工值、已确认值或来源冲突都必须展示差异并由用户选择，不能用 Provider 整条记录覆盖 Paper。
- `pageCount` 是当前 PDF 物理页数，`publicationPages` 是正式出版页码；两者必须分别存储和展示。
- 现有 `journal` 与 `extraFields.journalName`、以及 JSON 中的 volume/issue/pages 是迁移风险。实施前先审计冲突，V13 只增加可空结构并保留旧值，不编辑 V1–V12。
- 新增来源/标识表时使用 `ON DELETE CASCADE`，或同步更新 `PaperDeletionService`；不能让新增外键破坏论文删除流程。
- 外部补全与异步 GROBID、人工编辑可能并发。必须使用字段级 merge 和并发版本校验，禁止 last-write-wins 整行覆盖。
- arXiv Atom/OAI 等 legacy API 所有受控机器合计每三秒最多一次请求且单连接。必须加入缓存、全局限流、退避、负缓存和重复请求合并。
- 常规链路使用官方机器接口，不解析 arXiv HTML；Provider 客户端只允许固定 HTTPS 域名/路径，禁用 XML 外部实体并限制响应大小。
- 模糊查询会把论文标题、作者等信息发送给第三方；私密论文场景需显式触发或用户配置允许，绝不发送 PDF 正文、TEI 全文、批注、笔记或 AI 对话。
- SCI、EI、SSCI、CSSCI、北大核心等需要授权名单和按年份核验；arXiv 分类、OpenAlex `is_core`、DOAJ 或主题字段都不能当作收录证明。
- Provider 不可用或限流不得阻断 PDF 上传、GROBID 解析、阅读、批注、笔记和人工元数据编辑。
- 官方 proceedings Provider 只能访问固定 HTTPS 域名和路径；不能为了补卷页而开放任意 URL 抓取或绕过来源校验。

## v0.1.22 当前迭代注意事项

- 本次是交接与维护需求，版本为 `v0.1.22`、分支为 `feature/v0.1.22`，不追加 `-fix`。
- 真实 `backend/.env` 和 `frontend/.env.local` 只从 Git 索引移除，本机文件必须保留，不能因此删除或覆盖生产配置。
- 任何文档、diff、测试日志和最终回复都不能包含真实密码、JWT Secret、OAuth Secret、Provider Key、Token、Cookie 或用户数据。
- 历史跟踪过的配置和工具脚本凭据应视为可能泄漏；轮换凭据和清理 Git 历史需要独立授权、备份和回滚，本轮不擅自执行。
- 当前生产基础设施容器没有 Compose labels，不属于仓库 `backend/docker-compose.yml` 的可确认管理范围；生产禁止盲目执行 `docker compose up -d`。
- 当前生产文件存储是 `local`，目录 `/root/paper-reader/backend/uploads` 是用户数据，禁止清空、移动、纳入 Git 或在部署中覆盖。
- 当前生产后端使用 `development` profile，这是已知风险，但本轮只记录，不直接切换。
- 线上已完成 `0.1.22` 验收；后续文档判断仍以 PM2 参数、本机/公网健康接口和实际静态资源为准，不能只看源码版本。
- 本次不修改业务、Flyway、GROBID 服务或 `/root/paperread-admin`。

## v0.1.21 历史迭代注意事项

- 本次是功能迭代，版本为 `v0.1.21`、分支为 `feature/v0.1.21`，不追加 `-fix`。
- 标题清洗只允许匹配位于开头的完整、已确认授权声明；禁止按标题长度、首个句号、大小写或固定词数粗暴截断。
- 清洗后的候选标题必须包含字母或数字；否则保留 GROBID 原始标题，不能把非空标题改成空值。
- V12 是受控数据修正迁移，只更新匹配同一明确前缀且剩余标题有效的历史记录；已应用后不得修改其内容。
- 真实样例标题已通过 arXiv `1706.03762` 的权威记录确认是 `Attention Is All You Need`；GROBID 原始 TEI 继续保留，便于审计和未来重新解析。
- 当前卡片标记必须保持内缩、短胶囊和 `pointer-events-none`，不能遮挡卡片点击区域，也不能恢复成全高纯黑边条。
- 选中卡片的背景、边框、标记和阴影都使用明暗主题变量；调整时必须同时回归两种主题。
- 本次不修改或推送 GROBID 解析服务，也不修改 `/root/paperread-admin`。

## v0.1.20 历史迭代注意事项

- 该次是功能迭代，版本为 `v0.1.20`、分支为 `feature/v0.1.20`，不追加 `-fix`。
- 删除弹窗中的“同时删除原文件”默认不勾选；未经用户明确选择，不得物理删除服务器文件。
- `DELETE /api/papers/{id}?deleteFile=false` 只删除数据库记录及关联数据；`deleteFile=true` 才调用文件存储删除。
- 兼容旧客户端：缺少 `deleteFile` 参数时后端同样按 `false` 处理，不得沿用旧接口无条件删除文件的行为。
- 删除前必须使用 `paperId + userId` 校验所有权，不能先操作文件再校验权限。
- 物理文件删除失败必须抛出业务错误并回滚数据库事务，避免记录消失但用户误以为文件也已删除。
- 论文删除要显式清理批注评论、批注、笔记、阅读记录、旧 AI 会话消息、版本、标签和 chunks；后续新增论文关联表时必须同步评估删除链路。
- 服务器文件路径和删除异常不得回传到前端、审计文案或日志之外的用户消息中。
- `hasOriginalFile` 只表示 PaperReader 记录具有非空文件路径，不执行昂贵的远程文件探测；实际删除仍以存储服务结果为准。
- 卡片三点按钮必须在布局流中拥有固定单元，不能再次用绝对定位覆盖分类标签。

## v0.1.19-fix 历史迭代注意事项

- 本次是问题修复，版本为 `v0.1.19-fix`、分支为 `feature/v0.1.19-fix`。
- `/api/health` 的版本只能来自当前构建生成的 `BuildProperties`，不得再次在 Controller、配置类或启动脚本中手写发布版本。
- `springBoot.buildInfo()` 必须保留；移除后正式 JAR 会退回 `development`，健康检查将无法反映真实发布版本。
- 发布验收必须同时确认 JAR 文件名、JAR 内 `META-INF/build-info.properties`、PM2 启动参数和公网 `/api/health` 四处一致。
- 本次不涉及数据库迁移和 Provider 配置，不得借此修改或输出任何 API Key。
- favicon 缓存参数为 `v=0.1.19-fix`，避免浏览器继续命中上一版本静态资源。

## v0.1.19 历史迭代注意事项

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
- 历史 Provider 测试修复迭代为 `0.1.13-fix`，Provider relay 修复迭代为 `0.1.18-fix`，健康接口版本修复迭代为 `0.1.19-fix`，论文删除功能迭代为 `0.1.20`，标题与卡片迭代为 `0.1.21`，当前交接文档迭代为 `0.1.22`。
- `main` 是仓库默认分支和生产主分支，`dev` 是集成分支；版本分支必须先合并到 `dev`，再由 `dev` 合并到 `main`。
- 所有版本分支都要保留，不能因为已经合并就删除。
- 未经明确要求，不要擅自改成 `0.2.0` 或 `1.0.0`。
- 每次提交代码都要同步更新版本、文档、构建、重启和远程推送。

## Provider 与 API Key

- Provider 配置目前保存在浏览器持久化存储中，API Key 属于敏感信息。
- 不要把 API Key 放到 URL、commit、截图、README、服务端日志或错误信息中。
- 真实 `.env` 不得被 Git 跟踪；`.env.example` 只放无害示例。取消跟踪不会清除历史，已出现过的凭据必须另行轮换。
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
- 后端版本化 JAR 需要重建 PM2 项；新项不会继承被删除进程的应用环境变量，必须在同一个 shell 加载 `backend/.env` 后启动，并在健康检查通过后再 `pm2 save`。
- favicon 使用版本 query string 防止浏览器/边缘缓存旧图标；更新版本时同步修改 metadata 和主题同步组件。
- 本次 v0.1.12 只调整浏览器标签页 favicon；不要将 favicon 的尺寸调整误应用到首页左上角品牌 Logo。
- 历史 v0.1.12-fix 修复了侧栏折叠按钮的点击层级；v0.1.20 增加论文删除确认与原文件选项；v0.1.21 清理已知标题声明并优化选中卡片样式。
- 不要用宽泛的 `rm -rf`、`killall` 或批量 kill 处理部署问题。
- 当前生产 `next start --hostname localhost` 实际监听 `::1:3001`；`127.0.0.1:3001` 失败不能单独作为服务离线结论。
- 当前生产 PostgreSQL、Redis 和 GROBID 是既有容器且无 Compose labels；先只读确认归属，不能直接用仓库 Compose 重建。

## UI 回归

- 右侧面板在 Reader 主页面中嵌套，AI Tab 必须使用 `min-h-0` 和正确的 overflow，否则 composer 会被内容挤出底部。
- 新增入口要同时检查明亮/暗色主题、窄宽度、键盘操作和 hover/focus 状态。
- “新对话”按钮只使用图标，但必须提供 `title` 和 `aria-label`。
- Provider 警告不能只依赖颜色，应同时有感叹号图标和文本。
