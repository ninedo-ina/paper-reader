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
| 写作方向规划 | [WRITER_ROADMAP.md](WRITER_ROADMAP.md) | reader → writer 的需求归纳、现状差距、W1-W9 主题与迭代拆分（**W1 正文持久化已由 v0.1.52 落地，W4 学术能力已由 v0.1.54 落地，W3 自动保存已由 v0.1.56 落地，W2 编辑器内核与基础体验已由 v0.1.57 落地，W5 导入导出与投稿已由 v0.1.59 落地——W1-W5 全部完成**） |
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

- 当前发布版本：`0.1.59`（W5 导入、导出与投稿：Markdown 导入 + 导出 PDF〔Typst〕/DOCX〔Pandoc〕/LaTeX/BibTeX/Markdown/HTML，导出产物回挂 `pr_paper_versions`，`REQ-202609-0261`，2026-09-26 UTC 已发布）；上一发布版本 `0.1.58`（上传论文限额：单文件 10MB、单用户单日 100MB、单用户累计 200MB 为代码内硬限制，应用单日 1GB 为当前测试阶段上限，`REQ-202609-0267`）
- 当前发布版本分支：`feature/v0.1.59`（W5，有真实 Kotlin 改动、新增迁移 `V18`、后端 jar 已重建并重启）；上一发布分支 `feature/req-202609-0267-upload-quota`（上传限额，有真实 Kotlin 改动）。**生产前端 `0.1.59`、后端 `0.1.59`**（2026-09-26 UTC 已核验：`/api/health` 本地与公网均报 `0.1.59`、favicon `?v=0.1.59`、`app/[locale]/papers/[id]/page-9b0f1750f67828d6.js` 产物 sha256 与本地 `.next` 逐字节一致且含 `export/artifacts`/`import/markdown`）。Flyway 已到 `V18`（`V18__paper_export_artifacts.sql` 新增导出产物表 `pr_paper_export_artifacts`，`version_id` 回挂 `pr_paper_versions`）
- 开发中版本：无（`0.1.59` 已发布）。**版本链是 `v0.1.54 → v0.1.56（W3）→ v0.1.57（W2）→ v0.1.58（上传限额）→ v0.1.59（W5）`**：`0.1.55` 原分配给 W2，因并行的 W3 先合入 `0.1.56` 而被放弃（分支 `feature/v0.1.55` 留在 origin，未合入、未删除），W2 顺延为 `0.1.57` 并以加法方式叠加在 W3 之上——**没有 `0.1.55` 线上版本是有意为之**；`0.1.58` 亦曾被 W5 撞号，W5 顺延为 `0.1.59`（见下条）
- **并行迭代撞号（已解决、已发布）**：W5「文档导入导出与投稿产物」（`REQ-202609-0261`）的分支原也叫 `feature/v0.1.58`（提交 `f8101d4`，基于 `7dff17d`），而 `0.1.58` 已被上传限额需求占用。**W5 已顺延为 `0.1.59` 并于 2026-09-26 UTC 发布**（分支 `feature/v0.1.59`，代码合并提交 `a1c2ed0`〔父 `772dc58` + `e7d9416`〕），原 `feature/v0.1.58` 留在 origin 作痕迹（未合入、未删除）——处理方式同上面的 `0.1.55`/`0.1.57` 先例，详见 [ATTENTION.md](ATTENTION.md)
- 长期分支：`dev`（集成）、`main`（默认/生产）。`v0.1.58` 的代码合并与文档同步同样分两次显式 `--no-ff` 合入 `main`（既有做法），`dev` 快进对齐；分支保留，未强推、未改写历史
- 生产域名：`https://paper.pilo.eu.cc`
- 文档核对日期：2026-09-26（UTC）
- 2026-09-26（UTC）新增写作方向规划文档（`REQ-202609-0255`）：[WRITER_ROADMAP.md](WRITER_ROADMAP.md) 与 [PAPER_EDITOR_SELECTION.md](PAPER_EDITOR_SELECTION.md)。该轮为纯文档迭代（不含代码改动、不涉及版本号变更、不触发生产部署）；其 **W1** 随后由 v0.1.52 落地、**W4** 由 v0.1.54 落地、**W3** 由 v0.1.56 落地、**W2** 由 v0.1.57 落地、**W5** 由 v0.1.59 落地（**W1-W5 至此全部完成**），详见 [WRITER_ROADMAP.md](WRITER_ROADMAP.md)。

如果这里的版本低于根目录 `frontend/VERSION` 或 `backend/VERSION`，说明交接文档没有随发布更新，应在继续开发前先核实并修正文档。
