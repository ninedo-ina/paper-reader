# PaperHelper 文档入口

这份目录是 PaperHelper C 端项目的维护知识库。第一次接手项目时，不要从历史聊天记录猜测现状，按下列顺序阅读即可。

## 新人推荐阅读顺序

1. [新人维护指引](NEW_MAINTAINER_GUIDE.md)：15 分钟建立全局认识，完成本地启动、首次改动和发布前检查。
2. [项目完整现状](PROJECT_STATUS.md)：确认当前版本、真实生产拓扑、功能边界、数据流、风险和技术债。
3. [注意事项](ATTENTION.md)：开发、AI、文件删除、数据库迁移和线上操作的红线。
4. [维护规范](MAINTENANCE.md)：版本号、分支、测试、合并、部署与记录流程。
5. [部署手册](DEPLOY.md)：本地基础设施和当前生产机的部署、验证、回滚及排障方法。
6. [当前计划](PLAN.md)：本轮迭代和后续候选事项；实施范围仍以产品负责人最新要求为准。
7. [写作方向路线图](WRITER_ROADMAP.md)：从 reader 延伸到 writer 的需求归纳、现状差距与迭代拆分（`REQ-202609-0255`）。
8. [开源论文编辑器调研与选型](PAPER_EDITOR_SELECTION.md)：候选项目的实测数据、许可证风险与推荐方案（`REQ-202609-0255` 配套）。

## 按主题查找

| 主题 | 文档 | 用途 |
| --- | --- | --- |
| 项目交接 | [PROJECT_STATUS.md](PROJECT_STATUS.md) | 架构、仓库、功能矩阵、API、数据、生产状态、已知问题 |
| 快速上手 | [NEW_MAINTAINER_GUIDE.md](NEW_MAINTAINER_GUIDE.md) | 环境、配置、启动、开发入口、验证、发布、排障 |
| AI 对话 | [AI_CHAT_TECHNICAL_SOLUTION.md](AI_CHAT_TECHNICAL_SOLUTION.md) | Provider、响应兼容、会话隔离、reasoning、论文上下文 |
| 实时协作与分享 | [W7_COLLABORATION_TECHNICAL_SOLUTION.md](W7_COLLABORATION_TECHNICAL_SOLUTION.md) | Yjs 骑既有 STOMP、STOMP 身份拦截器、`PaperAccessService` 授权、正文批注、只读分享链接、`V20` 四表（`REQ-202609-0263` = W7） |
| PDF 渲染 | [PDF_RENDERING_PIPELINE.md](PDF_RENDERING_PIPELINE.md) | PDF.js、文本层、选区、批注与渲染兼容 |
| 论文创建 | [CREATE_PAPER_FEATURE.md](CREATE_PAPER_FEATURE.md) | 手动创建、字段模型和编辑器 |
| 写作方向规划 | [WRITER_ROADMAP.md](WRITER_ROADMAP.md) | reader → writer 的需求归纳、现状差距、W1-W9 主题与迭代拆分（**W1 正文持久化已由 v0.1.52 落地，W4 学术能力已由 v0.1.54 落地，W3 自动保存已由 v0.1.56 落地，W2 编辑器内核与基础体验已由 v0.1.57 落地，W5 导入导出与投稿已由 v0.1.59 落地，W6 版本历史已由 v0.1.60 落地，W8 AI 辅助写作已由 v0.1.62 落地，W9 平台、运维与合规已由 v0.1.61 落地，W7 协作与分享已由 v0.1.63 落地——W1–W9 全部完成**） |
| 编辑器选型 | [PAPER_EDITOR_SELECTION.md](PAPER_EDITOR_SELECTION.md) | 开源论文编辑器/排版引擎/引用生态的实测对比、许可证风险、推荐方案与 PoC 清单 |
| 元数据补全 | [EXTERNAL_METADATA_ENRICHMENT.md](EXTERNAL_METADATA_ENRICHMENT.md) | arXiv/DOI 标识、外部 Provider、字段来源、冲突、已实现边界与后续计划 |
| 通知邮件 | [NOTIFICATION_TEMPLATES.md](NOTIFICATION_TEMPLATES.md) | 通知中心对接契约、`template`/`template_data` 字段、灰度模板要求与验收标准 |
| 国际化 | [I18N.md](I18N.md) | 支持的语言、语言注册表、切换链路、新增语言的步骤、RTL 与文案来源 |
| 历史问题 | [BUGFIX_TAB_SHARE_TOAST.md](BUGFIX_TAB_SHARE_TOAST.md) | Tab、分享弹窗和 Toast 的历史修复 |

## 文档维护规则

- “线上是什么”以公网探活、PM2 启动参数、Apache 配置和容器状态为准；不能仅根据代码或旧文档推断。
- “功能是否完成”以实际代码路径和测试为准。存在 Controller 不代表 UI 已接入，存在 UI 不代表生产依赖已经配置。
- 当前发布信息写在 `PROJECT_STATUS.md` 和根 `README.md`；历史版本记录保留在 `MAINTENANCE.md`，不要批量改写历史版本号。
- 每次迭代同步更新计划、注意事项、维护记录和受影响的专题文档。新增重要入口后同时更新本索引。
- 文档不得包含真实密码、JWT Secret、OAuth Secret、Provider API Key、Cookie、Token 或完整的用户数据。配置只列变量名和示例。
- 本仓库是 C 端与其 API；后台管理仓库 `/root/paperread-admin` 和 GROBID 镜像/服务不因本仓库变更而自动修改。

## 当前基线

- 当前发布版本：`0.1.66-beta`（**URL 导入（`upload-from-url`）失败修复——本仓库第一条来自真实外部用户的反馈**〔`pr_feedbacks` id 6，用户 id 14〕：两个**互相独立**的根因——① `FileStorageService.storeFromUrl` 在 `local` 分支返回**相对路径**，而同类的 `store`/`storeBytes` 返回**绝对路径**〔同一存储契约两种写法〕，`pr_papers.file_path` 因此落成 `14/25/138ef289-….pdf`，按 PM2 的 `exec cwd /root/paper-reader/backend` 解析 → `FileNotFoundException` → `GET /api/papers/25/download` **500** → react-pdf 失败节点〔`pr_papers` 6 行里**只有 id 25 是相对路径**〕；② `downloadPdf` 用裸 `openStream()`〔无 UA、无超时、不看状态码、不看内容〕且文件名**硬编码 `.pdf`**，把 arXiv `/html/` 落地页的 **299,653 字节 `<!DOCTYPE html>` 当作 PDF 存成 `.pdf`**。修法：统一存储契约、改 `HttpURLConnection`〔跟随重定向 / 10s 连接 + 30s 读超时 / 浏览器 UA〕、**按 `%PDF-` 魔数判类型而非 `Content-Type`**、上限**在流式读取时判**、arXiv `/html|abs/` → `/pdf/` 归一化，新增业务码 **1017**（非 PDF）/ **1018**（下载失败）〔均 HTTP 400、刻意分开，复用既有 `handleBusiness`，**未新增异常处理器**〕，前端补两条 `case` + 14 语言两个新键〔`bo`/`ug` 仍英文占位〕；**维护者口头需求，无 `REQ-` 文档**，2026-09-29 UTC 已发布）。**本轮后端与前端均有真实改动、两端都已重建重启**（后端 PM2 id `10` → `11`），因此 `/api/health`、favicon 与产物哈希三者都是有效版本信号。**注意本轮没有迁移：Flyway 仍是 `V21`，与 `0.1.65-beta` 和 `0.1.64-beta` 都相同**——**不要拿 Flyway 版本号判断本轮是否部署**。
- 当前发布版本分支：`fix/v0.1.66-url-import`（后端 + 前端，**无迁移**）；从 `origin/main`（`cdc7b57`）新开，单个代码提交 `d0d1a16`，以显式 `--no-ff` 合并提交 `5553ba9` 合入 `main`。**生产前端与后端均为 `0.1.66-beta`**（2026-09-29 UTC 已核验：`/api/health` 返回 `0.1.66-beta`、favicon `?v=0.1.66-beta`、chunk `659-4fc24d38cb391555.js`（sha256 `c1a5cdf4a7b4cb0724edae56a2f49c14c74e91bc76abb3dd8a7ececfc93afc55`）的线上 sha256 与本地 `.next` 逐字节一致，且线上 chunk 内可 grep 到 `1017:return n("notPdf")` 与 `1018:return n("urlDownloadFailed")`；本地构建 `BUILD_ID=T3diRH81ews0hmg9bUlio`；后端启动日志 `Current version of schema "public": 21` / `No migration necessary.`）。**验收口径是产物级的**：**没有**用真实账号在真实浏览器里走一遍生产页面的 URL 导入（生产只开管理员 GitHub 登录、C 端测试账号密码未记录，同 v0.1.64/v0.1.65）；最接近端到端的是 `FileStorageServiceUrlImportTest` 的 7 条（真 `HttpServer` + 真落盘 + 真 `%PDF-` 魔数校验）。**遗留**：用户那张论文（`arxiv.org/pdf/2609.25851v1`）实测 **26,538,500 字节 ≈ 25.3 MB，超过 10 MB 单文件上限**，维护者明确选择**保持 10MB 不抬**，故该篇修复后**依然导不进来**（失败原因由 500 变为明确的超限提示）；`pr_papers` id 25 与 `pr_feedbacks` id 6 的存量脏数据**刻意未动**；`storeFromUrl` 的 **SSRF 校验刻意未做**（建议后续接 `ProviderRelayTargetValidator` 思路）。
- 上一发布版本：`0.1.65-beta`（**登录自动建号漏洞修复 + 鉴权入参校验 + 接口限流**：`AuthService.login()` 不再对未知邮箱**自动建号**、auth 请求 DTO 补上**真正生效的** bean validation〔`@field:` use-site target〕、`MethodArgumentNotValidException` 从 `9999/500` 改为 `400/1003`、新增 `AuthRateLimiter` 对四条无登录态入口做 Redis 固定窗口限流〔新业务码 `1016` / HTTP `429`〕，前端登录页默认页签切到**邮箱验证码**并补 14 语言 `errors.tooManyRequests` 键；**维护者口头需求（根因收尾），无 `REQ-` 文档**，2026-09-28 UTC 已发布）。与 `0.1.66-beta` 的 schema **同为 `V21`**——连续两个版本无迁移，判版本只能靠 `/api/health` 与产物哈希。
- 更早的发布版本：`0.1.64-beta`（**问题反馈入口 + 侧栏折叠按钮点击区修复**：顶栏「搜索」与「语言切换」之间的反馈按钮〔文字图标「馈」〕与带剪切板粘图的反馈弹窗、`pr_feedbacks` 表 + 本地磁盘落盘、修掉侧栏折叠按钮因被顶栏遮挡而「右半不可点」的 bug；**维护者口头需求，无 `REQ-` 文档**，2026-09-28 UTC 已发布）。**本轮后端与前端均有真实改动、连接两端都已重建重启**（后端 PM2 id `8` → `9`），因此 `/api/health`、favicon 与产物哈希三者都是有效版本信号；**新增迁移 `V21__feedback.sql`，Flyway 到 `V21`**。**注意这是本仓库第一个带 `-beta` 后缀的版本**——后缀由维护者指定、表示测试期，**不代表预发布或未部署**，它已合入 `main` 并上线。
- 更早的发布版本分支：`feature/v0.1.64-beta`（后端 + 前端，**新增迁移 `V21`**）；从含 W7 文档同步的 `origin/main`（`d37aef9`）展开，单个代码提交 `d7fcfd5`（35 个文件、+1350/−8、10 个新文件），以显式 `--no-ff` 合并提交 `62a18e1`（父 `d37aef9` + `d7fcfd5`）合入 `main`。**生产前端与后端均为 `0.1.64-beta`**（2026-09-28 UTC 已核验：`/api/health` 返回 `0.1.64-beta`、favicon `?v=0.1.64-beta`、`/zh/login` `200`、编辑器 chunk `app/[locale]/page-a6b56535440f707e.js`（sha256 `95cd3228…35ce5b`）与公共 chunk `920-4ec0d00615a32288.js`（sha256 `a5c9d3e6…29c3685`）线上 sha256 与本地 `.next` 逐字节一致，且线上 chunk 内确认含文字图标「馈」与 `z-[45]`；后端启动日志显示 Flyway 从 `V20` 迁移到 `V21 - feedback`）。生产侧的反馈链路另以**自签令牌的真实鉴权请求**打通（`POST /api/feedback` → `code=0` + `screenshotCount=1`，落库字段与磁盘 PNG 魔数均已核对），**验完该行与文件已删除**。
- 开发中版本：无（`0.1.66-beta` 已发布）。**版本链是 `v0.1.56（W3）→ v0.1.57（W2）→ v0.1.58（上传限额）→ v0.1.59（W5）→ v0.1.60（W6，并行工作流交付）→ v0.1.62（W8，并行工作流交付）→ v0.1.61（W9，并行工作流交付）→ v0.1.63（W7，并行工作流交付，最后落地）→ v0.1.64-beta（问题反馈入口）→ v0.1.65-beta（登录自动建号漏洞修复，分支 `fix/auth-hardening`）→ v0.1.66-beta（本轮，URL 导入失败修复，分支 `fix/v0.1.66-url-import`）`**：`0.1.60`–`0.1.63` 四条并行 worktree 开工时各按 `origin` 上空闲号预定，**先做完先合，所以落地顺序（W6 → W8 → W9 → W7）与版本号顺序刻意不一致**，`0.1.63`（W7）在 `0.1.61` 之后上线是预期结果，四条并行号**已全部发布上线，writer 路线图 W1–W9 全部完成**；`0.1.55` 原分配给 W2，因并行的 W3 先合入 `0.1.56` 而被放弃（分支 `feature/v0.1.55` 留在 origin 作痕迹）。
- **并行迭代撞号**：W9 开工时 `main` 在 `29b4158`（v0.1.59 文档），四条 worktree 互不重叠；开发期间 W6（`0.1.60`）与 W8（`0.1.62`）先后进了 `main`，W9 那轮**把分支 rebase 到最新 `origin/main`（`8979c22`）并压成单个干净提交 `b749de6`**，随后以显式 `--no-ff` 合并提交 `a7fc36f` 合入 `main`。**W8 的 `docs/ATTENTION.md` 曾把 `0.1.61` 记成「并行非 writer 需求占用的号、没有线上版本」，已同步修正**——`0.1.61` 正是 writer 路线图的 W9。**W7（`0.1.63`）最后落地**：从含 W9 文档同步的 `origin/main` 展开，单个代码提交 `b16162c`，以显式 `--no-ff` 合并提交 `7d2567f` 合入 `main`。**`0.1.64-beta`、`0.1.65-beta` 与 `0.1.66-beta` 都没有撞号**：三轮开工时 `git worktree list` 都只有主仓库（外加本轮自己的 worktree），且都按维护者规矩遍历了 `origin/*` 各分支的 `frontend/VERSION`（分别最高 `0.1.63`、`0.1.64-beta` 与 `0.1.65-beta`）——`0.1.64`、`0.1.65`、`0.1.66` 均无冲突，无跳号、无重号。以上各轮均未强推、未改写他人历史。
- 长期分支：`dev`（集成）、`main`（默认/生产）。`v0.1.66-beta`（分支 `fix/v0.1.66-url-import`）的代码合并（`5553ba9`）与文档同步同样分两次显式 `--no-ff` 合入 `main`（既有做法），`dev` 快进对齐；分支保留，未强推、未改写历史。
- 生产域名：`https://paper.pilo.eu.cc`
- 文档核对日期：2026-09-29（UTC）
- 2026-09-26（UTC）新增写作方向规划文档（`REQ-202609-0255`）：[WRITER_ROADMAP.md](WRITER_ROADMAP.md) 与 [PAPER_EDITOR_SELECTION.md](PAPER_EDITOR_SELECTION.md)。该轮为纯文档迭代（不含代码改动、不涉及版本号变更、不触发生产部署）；其 **W1** 随后由 v0.1.52 落地、**W4** 由 v0.1.54 落地、**W3** 由 v0.1.56 落地、**W2** 由 v0.1.57 落地、**W5** 由 v0.1.59 落地、**W6** 由 v0.1.60 落地、**W8** 由 v0.1.62 落地、**W9** 由 v0.1.61 落地、**W7** 由 v0.1.63 落地（**W1–W9 全部完成**；落地顺序 W6 → W8 → W9 → W7 与版本号顺序刻意不一致，原因见上文版本链），详见 [WRITER_ROADMAP.md](WRITER_ROADMAP.md)。

如果这里的版本低于根目录 `frontend/VERSION` 或 `backend/VERSION`，说明交接文档没有随发布更新，应在继续开发前先核实并修正文档。
