# PaperReader 文档入口

这份目录是 PaperReader C 端项目的维护知识库。第一次接手项目时，不要从历史聊天记录猜测现状，按下列顺序阅读即可。

## 新人推荐阅读顺序

1. [新人维护指引](NEW_MAINTAINER_GUIDE.md)：15 分钟建立全局认识，完成本地启动、首次改动和发布前检查。
2. [项目完整现状](PROJECT_STATUS.md)：确认当前版本、真实生产拓扑、功能边界、数据流、风险和技术债。
3. [注意事项](ATTENTION.md)：开发、AI、文件删除、数据库迁移和线上操作的红线。
4. [维护规范](MAINTENANCE.md)：版本号、分支、测试、合并、部署与记录流程。
5. [部署手册](DEPLOY.md)：本地基础设施和当前生产机的部署、验证、回滚及排障方法。
6. [当前计划](PLAN.md)：本轮迭代和后续候选事项；实施范围仍以产品负责人最新要求为准。

## 按主题查找

| 主题 | 文档 | 用途 |
| --- | --- | --- |
| 项目交接 | [PROJECT_STATUS.md](PROJECT_STATUS.md) | 架构、仓库、功能矩阵、API、数据、生产状态、已知问题 |
| 快速上手 | [NEW_MAINTAINER_GUIDE.md](NEW_MAINTAINER_GUIDE.md) | 环境、配置、启动、开发入口、验证、发布、排障 |
| AI 对话 | [AI_CHAT_TECHNICAL_SOLUTION.md](AI_CHAT_TECHNICAL_SOLUTION.md) | Provider、响应兼容、会话隔离、reasoning、论文上下文 |
| PDF 渲染 | [PDF_RENDERING_PIPELINE.md](PDF_RENDERING_PIPELINE.md) | PDF.js、文本层、选区、批注与渲染兼容 |
| 论文创建 | [CREATE_PAPER_FEATURE.md](CREATE_PAPER_FEATURE.md) | 手动创建、字段模型和编辑器 |
| 元数据补全 | [EXTERNAL_METADATA_ENRICHMENT.md](EXTERNAL_METADATA_ENRICHMENT.md) | arXiv/DOI 标识、外部 Provider、字段来源、冲突、已实现边界与后续计划 |
| 历史问题 | [BUGFIX_TAB_SHARE_TOAST.md](BUGFIX_TAB_SHARE_TOAST.md) | Tab、分享弹窗和 Toast 的历史修复 |

## 文档维护规则

- “线上是什么”以公网探活、PM2 启动参数、Apache 配置和容器状态为准；不能仅根据代码或旧文档推断。
- “功能是否完成”以实际代码路径和测试为准。存在 Controller 不代表 UI 已接入，存在 UI 不代表生产依赖已经配置。
- 当前发布信息写在 `PROJECT_STATUS.md` 和根 `README.md`；历史版本记录保留在 `MAINTENANCE.md`，不要批量改写历史版本号。
- 每次迭代同步更新计划、注意事项、维护记录和受影响的专题文档。新增重要入口后同时更新本索引。
- 文档不得包含真实密码、JWT Secret、OAuth Secret、Provider API Key、Cookie、Token 或完整的用户数据。配置只列变量名和示例。
- 本仓库是 C 端与其 API；后台管理仓库 `/root/paperread-admin` 和 GROBID 镜像/服务不因本仓库变更而自动修改。

## 当前基线

- 当前发布版本：`0.1.23`
- 已发布版本分支：`feature/v0.1.23`
- 当前生产版本：`0.1.23`（2026-08-26 UTC 已核验）
- 长期分支：`dev`（集成）、`main`（默认/生产）
- 生产域名：`https://paper.pilo.eu.cc`
- 文档核对日期：2026-08-26（UTC）

如果这里的版本低于根目录 `frontend/VERSION` 或 `backend/VERSION`，说明交接文档没有随发布更新，应在继续开发前先核实并修正文档。
