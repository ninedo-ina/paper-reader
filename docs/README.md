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
| 写作方向规划 | [WRITER_ROADMAP.md](WRITER_ROADMAP.md) | reader → writer 的需求归纳、现状差距、W1-W9 主题与迭代拆分（**W1 正文持久化已由 v0.1.52 落地，W4 学术能力已由 v0.1.54 落地，W3 自动保存已由 v0.1.56 落地，W2 编辑器内核与基础体验已由 v0.1.57 落地，W5 导入导出与投稿已由 v0.1.59 落地，W6 版本历史已由 v0.1.60 落地，W8 AI 辅助写作已由 v0.1.62 落地——只剩 W7 协作与 W9 平台合规**） |
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

- 当前发布版本：`0.1.62`（W8 AI 辅助写作：选区续写/改写/翻译/降重、摘要生成、参考文献格式化建议、语法与学术用语检查，结果一律先落成"建议"再写正文，`REQ-202609-0264`，2026-09-27 UTC 已发布）。**这一轮是纯前端迭代、后端 jar 有意未重建**，因此 `/api/health` 仍报 `0.1.60`，判版本请看 favicon `?v=0.1.62` 与编辑器 chunk 的 sha256；上一发布版本 `0.1.60`（W6 版本历史与快照：正文快照落 `pr_paper_content_versions`、时间线查看/回滚/打标签，`REQ-202609-0262`，由并行工作流交付、有真实 Kotlin 改动）；再上一发布版本 `0.1.59`（W5 导入、导出与投稿：Markdown 导入 + 导出 PDF〔Typst〕/DOCX〔Pandoc〕/LaTeX/BibTeX/Markdown/HTML，`REQ-202609-0261`）
- 当前发布版本分支：`feature/v0.1.62`（W8，**纯前端、无迁移、后端 jar 未重建**）；代码合并提交 `7eb5001`〔父 `272f1e5`〔W6 / `0.1.60`〕+ `de31eae`〕。**生产前端 `0.1.62`、后端 `0.1.60`**（2026-09-27 UTC 已核验：favicon `?v=0.1.62`、`app/[locale]/page-17dfc4645bea8a2c.js` 产物 sha256 `a0d2a6b97d6ae8bcdf1a8f844fb67c4cf646c740bf510d33bfa987584a16f09c` 与本地 `.next` 逐字节一致且含 `aiWriting*` 文案键，`/zh/login` 200）。Flyway 已到 `V19`（`V19__paper_content_versions.sql` 新增正文快照表 `pr_paper_content_versions`，W6 在 `0.1.60` 启动时应用；`0.1.62` 未新增迁移，因此 `V19` 之后没有 `V20`）
- 开发中版本：无（`0.1.62` 已发布）。**版本链是 `v0.1.56（W3）→ v0.1.57（W2）→ v0.1.58（上传限额）→ v0.1.59（W5）→ v0.1.60（W6，并行工作流交付）→ v0.1.62（W8）`**：`0.1.55` 原分配给 W2，因并行的 W3 先合入 `0.1.56` 而被放弃（分支 `feature/v0.1.55` 留在 origin，未合入、未删除）；`0.1.61`（`REQ-202609-0265`）与 `0.1.63`（`REQ-202609-0263`）是同期并行工作流占用的号、不属 writer 路线图——**没有 `0.1.55`/`0.1.61`/`0.1.63` 线上版本是有意为之**（见下条）
- **并行迭代撞号（已解决、已发布）**：W8 开发期间，并行工作流 `REQ-202609-0262` 交付的 W6（`0.1.60`）先进了 `main`，W8 按仓库先例**把 `main` 合并进需求分支**（不 rebase、不强推，见合并提交 `de31eae`），六处版本号文件与 `PaperEditor.tsx` 的冲突手工做加法合并、`common.json` 与 `PaperEditor.tsx` 两轮都被撞过。W8 自己的版本号 `0.1.62` 由 `git worktree list` 先到先得确认，未与其他并行号冲突；`0.1.61`/`0.1.63` 留在 origin 作痕迹（各自独立交付，未合入本分支）。处理方式同 `0.1.55`/`0.1.57` 先例，详见 [ATTENTION.md](ATTENTION.md)
- 长期分支：`dev`（集成）、`main`（默认/生产）。`v0.1.62` 的代码合并与文档同步同样分两次显式 `--no-ff` 合入 `main`（既有做法），`dev` 快进对齐；分支保留，未强推、未改写历史
- 生产域名：`https://paper.pilo.eu.cc`
- 文档核对日期：2026-09-27（UTC）
- 2026-09-26（UTC）新增写作方向规划文档（`REQ-202609-0255`）：[WRITER_ROADMAP.md](WRITER_ROADMAP.md) 与 [PAPER_EDITOR_SELECTION.md](PAPER_EDITOR_SELECTION.md)。该轮为纯文档迭代（不含代码改动、不涉及版本号变更、不触发生产部署）；其 **W1** 随后由 v0.1.52 落地、**W4** 由 v0.1.54 落地、**W3** 由 v0.1.56 落地、**W2** 由 v0.1.57 落地、**W5** 由 v0.1.59 落地、**W6** 由 v0.1.60 落地、**W8** 由 v0.1.62 落地（**W1-W6 与 W8 至此完成，只剩 W7 协作与 W9 平台合规**），详见 [WRITER_ROADMAP.md](WRITER_ROADMAP.md)。

如果这里的版本低于根目录 `frontend/VERSION` 或 `backend/VERSION`，说明交接文档没有随发布更新，应在继续开发前先核实并修正文档。
