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
| PDF 渲染 | [PDF_RENDERING_PIPELINE.md](PDF_RENDERING_PIPELINE.md) | PDF.js、文本层、选区、批注与渲染兼容 |
| 论文创建 | [CREATE_PAPER_FEATURE.md](CREATE_PAPER_FEATURE.md) | 手动创建、字段模型和编辑器 |
| 写作方向规划 | [WRITER_ROADMAP.md](WRITER_ROADMAP.md) | reader → writer 的需求归纳、现状差距、W1-W9 主题与迭代拆分（**W1 正文持久化已由 v0.1.52 落地，W4 学术能力已由 v0.1.54 落地，W3 自动保存已由 v0.1.56 落地，W2 编辑器内核与基础体验已由 v0.1.57 落地，W5 导入导出与投稿已由 v0.1.59 落地，W6 版本历史已由 v0.1.60 落地，W8 AI 辅助写作已由 v0.1.62 落地，W9 平台、运维与合规已由 v0.1.61 落地——只剩 W7 协作**） |
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

- 当前发布版本：`0.1.61`（**W9 平台、运维与合规**：正文读写的体积上限与快照保留策略、自动保存的写放大控制、导出资源闸门复核、编辑器文案 14 语言齐全含 RTL、删除论文不留残余、审计覆盖「保存正文」，`REQ-202609-0265`，2026-09-27 UTC 已发布）。**本轮有真实 Kotlin 改动、后端 jar 已重建重启**（PM2 id `6` → `7`），因此 `/api/health`、favicon 与产物哈希三者都是有效版本信号；**无新迁移，Flyway 仍为 `V19`**。
- 当前发布版本分支：`feature/v0.1.61`（W9，后端 + 前端，**无迁移**）；代码合并提交 `a7fc36f`〔父 `8979c22`〔W8 / `0.1.62` 的文档同步〕+ `b749de6`（本轮单个代码提交，62 文件 / +3109−106）〕。**生产前端与后端均为 `0.1.61`**（2026-09-27 UTC 已核验：`/api/health` 本机与公网均 `0.1.61`、favicon `?v=0.1.61`、编辑器 chunk `app/[locale]/page-08856aa07f6a5fd8.js` 与公共 chunk `110-b66e7ac779a375f3.js` 线上 sha256 与本地 `.next` 逐字节一致；`GET /api/papers/content-limits` → `200`、17,825,792 字节的 `PUT …/7/content` → `413`/`1014` 且论文未被改动）。
- 开发中版本：无（`0.1.61` 已发布）。**版本链是 `v0.1.56（W3）→ v0.1.57（W2）→ v0.1.58（上传限额）→ v0.1.59（W5）→ v0.1.60（W6，并行工作流交付）→ v0.1.62（W8，并行工作流交付）→ v0.1.61（W9，本轮）`**：四条并行 worktree 开工时各按 `origin` 上空闲号预定了 `0.1.60`/`0.1.61`/`0.1.62`/`0.1.63`，**先做完先合，所以落地顺序（W6 → W8 → W9）与版本号顺序刻意不一致**，`0.1.61` 在 `0.1.62` 之后上线是预期结果；`0.1.55` 原分配给 W2，因并行的 W3 先合入 `0.1.56` 而被放弃（分支 `feature/v0.1.55` 留在 origin 作痕迹）。
- **并行迭代撞号（已解决、已发布）**：W9 开工时 `main` 在 `29b4158`（v0.1.59 文档），四条 worktree 互不重叠；开发期间 W6（`0.1.60`）与 W8（`0.1.62`）先后进了 `main`，本轮**把分支 rebase 到最新 `origin/main`（`8979c22`）并压成单个干净提交 `b749de6`**（该分支为本轮新开、仅本轮使用，未强推、未改写他人历史），随后以显式 `--no-ff` 合并提交 `a7fc36f` 合入 `main`。**W8 的 `docs/ATTENTION.md` 曾把 `0.1.61` 记成「并行非 writer 需求占用的号、没有线上版本」，本轮已同步修正**——`0.1.61` 正是 writer 路线图的 W9。
- 长期分支：`dev`（集成）、`main`（默认/生产）。`v0.1.61` 的代码合并与文档同步同样分两次显式 `--no-ff` 合入 `main`（既有做法），`dev` 快进对齐；分支保留，未强推、未改写历史。
- 生产域名：`https://paper.pilo.eu.cc`
- 文档核对日期：2026-09-27（UTC）
- 2026-09-26（UTC）新增写作方向规划文档（`REQ-202609-0255`）：[WRITER_ROADMAP.md](WRITER_ROADMAP.md) 与 [PAPER_EDITOR_SELECTION.md](PAPER_EDITOR_SELECTION.md)。该轮为纯文档迭代（不含代码改动、不涉及版本号变更、不触发生产部署）；其 **W1** 随后由 v0.1.52 落地、**W4** 由 v0.1.54 落地、**W3** 由 v0.1.56 落地、**W2** 由 v0.1.57 落地、**W5** 由 v0.1.59 落地、**W6** 由 v0.1.60 落地、**W8** 由 v0.1.62 落地、**W9** 由 v0.1.61 落地（**W1-W6、W8 与 W9 至此完成，只剩 W7 协作**；落地顺序 W6 → W8 → W9 与版本号顺序刻意不一致，原因见上文版本链），详见 [WRITER_ROADMAP.md](WRITER_ROADMAP.md)。

如果这里的版本低于根目录 `frontend/VERSION` 或 `backend/VERSION`，说明交接文档没有随发布更新，应在继续开发前先核实并修正文档。
