# PaperHelper 项目完整现状

> 当前发布版本：`0.1.30`；发布分支：`feature/v0.1.30`；生产版本：`0.1.30`（2026-08-30 UTC 已核验）；核对日期：2026-08-30（UTC）；生产域名：`https://paper.pilo.eu.cc`

本文描述 `/root/paper-reader` 的代码与生产现状，是新维护者判断“已经有什么、实际怎么运行、哪些还不能承诺”的首要依据。动态状态在发布后可能变化，操作线上前仍需重新执行本文的只读检查。

## 1. 项目边界与仓库关系

PaperHelper 是面向用户的论文阅读工作台，本仓库同时包含 C 端 Next.js 客户端和 Kotlin/Spring Boot API。

| 范围 | 位置 | 是否属于本仓库 |
| --- | --- | --- |
| C 端网页与 API | `/root/paper-reader` | 是 |
| 后台管理端 | `/root/paperread-admin` | 否，独立仓库、独立版本与发布流程 |
| GROBID 解析服务 | 当前机器上的 `paper-reader-grobid` 容器 | 否，本仓库只有调用客户端和本地 Compose 定义 |
| PostgreSQL / Redis | 当前机器共享基础设施容器 | 否，不应随本项目部署盲目重建 |

后台管理项目与本项目使用同一 PostgreSQL 实例，但后台数据位于 `paperread_admin` schema。本仓库的 Flyway 只维护 PaperHelper 自身的 `pr_*` 表。除非需求明确同时覆盖两个项目，否则不要修改、提交或部署 `/root/paperread-admin`。

## 2. 当前发布与 Git 状态

- GitHub 默认分支和生产主分支：`main`。
- 集成分支：`dev`。
- 当前发布分支：`feature/v0.1.30`，已按发布流程合并到 `main`；生产正在运行 `0.1.30`。
- 版本分支永久保留，标准流向为 `feature/vX.Y.Z -> dev -> main`。
- 普通需求或维护增加 patch 版本；纯 Bug 修复使用同版本的 `-fix` 后缀。中版本和大版本只能由产品负责人明确提出。
- `0.1.22` 是上一版交接、安全配置模板和文档整理版本，已于 2026-08-25（UTC）完成合并、生产重启和公网验证；随后已由 `0.1.23` 替换。
- `0.1.23` 是当前论文元数据补全发布版本；已合并到 `main`，生产部署和 V13 迁移均已完成。

版本号必须同时更新：

- `frontend/package.json`
- `frontend/VERSION`
- `backend/VERSION`
- `backend/build.gradle.kts`
- 根 `README.md` 当前发布信息
- `frontend/src/app/layout.tsx` favicon 查询参数
- `frontend/src/components/layout/FaviconThemeSync.tsx` favicon 查询参数
- 可见 UI 版本（当前由前端 `package.json` 读取）

## 3. 技术栈与已验证工具链

| 层 | 技术/版本 |
| --- | --- |
| Web | Next.js 15（锁文件当前解析 15.5.19）、React 19、TypeScript 5、Tailwind CSS 4 |
| 状态与 UI | Zustand 5、Radix UI、Lucide、next-intl、next-themes |
| PDF / 编辑器 | react-pdf 10、pdfjs-dist 5.4.296、TipTap 3、React Markdown |
| API | Kotlin 2.1、Spring Boot 3.4.1、Spring Security、JPA、WebSocket/STOMP |
| 数据 | PostgreSQL 16、Flyway V1-V13（生产）；Redis 7 |
| 解析 | GROBID 0.8.1，调用 `/api/processFulltextDocument` |
| 运行 | Java 17、Node 22、pnpm 11、Gradle Wrapper 8.7、PM2、Apache、Cloudflare |

2026-08-25 在当前机器实测的命令版本：Node `22.23.2`、pnpm `11.22.0`、Java `17.0.19`、Gradle `8.7`、PM2 `7.0.3`。依赖升级尤其是 Next/React/PDF.js 升级应单独迭代，不要在无关需求中顺手升级。

## 4. 目录和关键入口

```text
paper-reader/
├── frontend/                         Next.js C 端
│   ├── public/                       favicon 等静态资源
│   ├── patches/pdfjs-dist@5.4.296.patch
│   └── src/
│       ├── app/[locale]/page.tsx     主工作台入口
│       ├── components/reader/        PDF、文本层、选区、批注
│       ├── components/chat/          主阅读器实际使用的右侧 AI 面板
│       ├── components/ai/            旧 AI 组件路径，不是主阅读器入口
│       ├── components/papers/        论文列表、卡片、创建/删除/分享
│       ├── lib/api/                  API 客户端与 DTO
│       └── stores/                   Zustand 状态及浏览器持久化
├── backend/
│   ├── src/main/kotlin/org/paperreader/
│   │   ├── controller/               REST / STOMP 入口
│   │   ├── service/                  业务、文件、解析、Provider relay
│   │   ├── model/                    JPA 实体
│   │   └── security/                 JWT 过滤器
│   ├── src/main/resources/db/migration/  Flyway V1-V13（生产）
│   ├── uploads/                      当前生产本地 PDF（被忽略，绝不能清空）
│   └── docker-compose.yml            新环境开发模板，不代表当前生产容器归属
└── docs/                             维护知识库
```

最容易改错的同名入口：阅读器右侧 AI 目前使用 `frontend/src/components/chat/ChatPanel.tsx`，不是 `frontend/src/components/ai/ChatPanel.tsx`。修改前应从 `frontend/src/app/[locale]/page.tsx` 沿实际 import 链确认。

其他高频入口：

- PDF 阅读：`frontend/src/components/reader/PDFReader.tsx`、`PDFViewer.tsx`、`AnnotationLayer.tsx`。
- 论文侧栏：`frontend/src/components/papers/PaperList.tsx`、`PaperCard.tsx`。
- AI 状态与兼容：`frontend/src/stores/chat-store.ts`、`lib/ai-provider.ts`、`lib/ai-chat-response.ts`。
- GROBID：`PaperParsingService.kt`、`GrobidClient.kt`、`TeiDocumentParser.kt`、`PaperContextService.kt`。
- 论文删除：`PaperDeletionService.kt`，新增论文关联表时必须同步检查这里。

## 5. 生产真实拓扑

```text
Browser
  -> Cloudflare（DNS / Proxy / TLS edge）
  -> Apache :443
       /api -> 127.0.0.1:8080/api       Spring Boot / PM2
       /ws  -> 127.0.0.1:8080/ws        STOMP WebSocket
       /    -> localhost:3001           Next.js / PM2

Spring Boot
  -> 127.0.0.1:5432  infra-postgres
  -> 127.0.0.1:6379  infra-redis
  -> 127.0.0.1:8070  paper-reader-grobid
  -> /root/paper-reader/backend/uploads 本地文件存储
```

Cloudflare 不是构建平台，项目也不是 Cloudflare Pages。Push 源码不会让域名自动更新；必须在服务器构建并重启 PM2。

### 5.1 PM2 当前形态

- `paper-reader-frontend`：`next start --hostname localhost --port 3001`，cwd 为 `/root/paper-reader/frontend`。
- `paper-reader-backend`：`java -jar /root/paper-reader/backend/build/libs/paper-reader-backend-<version>.jar`。
- Next.js 以 `localhost` 绑定时当前落到 IPv6 loopback `::1`。因此 `curl http://127.0.0.1:3001` 可能失败，不代表前端挂掉；使用 `curl http://localhost:3001`、`curl http://[::1]:3001` 或公网域名。
- 后端 JAR 路径包含版本号。只执行 `pm2 restart paper-reader-backend` 会继续运行旧 JAR 参数；每次后端版本变化要在加载 `.env` 的同一 shell 中定向重建该 PM2 项。
- 只有探活和日志验证完成后才能 `pm2 save`，否则可能把错误进程表持久化。

### 5.2 当前基础设施容器

当前生产机只观察到：

- `infra-postgres`（PostgreSQL 16）
- `infra-redis`（Redis 7）
- `paper-reader-grobid`（GROBID 0.8.1）

这些容器没有 `com.docker.compose.*` labels，不能假设由本仓库 `backend/docker-compose.yml` 管理。当前生产没有 Dufs 容器，因为文件存储为 `STORAGE_TYPE=local`。在这台机器上直接执行 `docker compose up -d` 可能抢占 PostgreSQL/Redis/GROBID 端口、创建另一套数据卷或破坏共享服务；先只读核对容器归属和端口，生产上禁止盲目执行。

### 5.3 当前生产配置事实

- 前端 API：`https://paper.pilo.eu.cc/api`。
- 前端 WebSocket：`wss://paper.pilo.eu.cc/ws`。
- Auth 和 AI feature flag 均启用。
- 后端存储：`STORAGE_TYPE=local`。
- 本地文件目录：`/root/paper-reader/backend/uploads`。
- 后端当前绑定 loopback，并使用 `SPRING_PROFILES_ACTIVE=development`。后者是已知运维风险，不能在文档迭代中擅自切换；应先审计日志级别、CORS、配置差异和回滚方案，再单独改为 `production`。
- Apache SSL vhost 在仓库外：`/etc/apache2/sites-available/paper.pilo.eu.cc-ssl.conf`。

## 6. 功能完成度与真实边界

| 模块 | 当前能力 | 边界/备注 |
| --- | --- | --- |
| 认证 | 注册、密码登录、验证码登录接口、GitHub OAuth、access/refresh JWT | 验证码只写后端日志，没有真实邮件发送；未知邮箱密码登录会自动创建用户 |
| 论文 | PDF 上传、URL 导入、手动创建、列表、详情、编辑、收藏、标签、分享文案、下载、删除 | URL 导入会由后端下载远程文件；手动记录可没有原文件 |
| 元数据补全 | Reader 手动触发 arXiv/DOI 精确查询、候选预览、逐字段应用、来源与 provenance | `0.1.23` 已部署最小单篇闭环；无完整 manifestation/identifier 模型、历史批量刷新或收录判定 |
| 阅读 | PDF 翻页、缩放、搜索、进度、选区、批注、笔记 | 扫描型 PDF 无 OCR；PDF.js 依赖项目 patch |
| 解析 | GROBID 异步提取标题、作者、摘要、TEI 与 chunks | 状态 `PENDING -> PROCESSING -> READY/FAILED`；失败不阻断阅读 |
| AI 阅读 | 自定义 OpenAI-compatible Provider、模型选择、流式响应、reasoning 折叠、选区问答 | 当前主链路是浏览器会话，不是后端 `/api/ai-chats`；兼容不等于支持所有私有协议 |
| 论坛/IM | 话题、帖子、评论、赞、收藏、关注、私聊、群聊 API 和 UI | WebSocket 身份绑定存在安全债，见第 11 节 |
| 论文版本 | 建立版本记录、显示 storage push 状态 | 外部 GitHub/Gitee/OSS/S3 实际推送未实现，当前占位逻辑可能错误标记 success |
| 存储配置 | CRUD 与默认配置 | JSONB 可能含明文 Token，接口会返回配置；尚未做字段级加密/脱敏 |
| 搜索 | 页面存在搜索入口/区域 | 搜索结果能力仍不完整，不应对外承诺完整全文检索 |

## 7. 核心数据流

### 7.1 PDF 上传、解析和论文问答

```text
上传 PDF / URL 导入
  -> PaperService 创建 pr_papers
  -> FileStorageService 保存原文件
  -> parse_status=PENDING
  -> 事务提交后异步 PaperParsingService
  -> GROBID processFulltextDocument
  -> TeiDocumentParser 提取元数据和 chunks
  -> pr_papers.grobid_result + pr_paper_chunks
  -> parse_status=READY（失败则 FAILED）

PDF 选中文本 -> “询问 AI”
  -> POST /api/papers/{id}/context（先校验 paperId + userId）
  -> 关键词/相邻 chunk 匹配
  -> 引用、论文信息和相关片段作为隐藏上下文
  -> 当前会话所选 Provider
```

上下文检索不是 embedding、RAG 向量检索或语义搜索，只是规范化文本、关键词计分和相邻 chunks。GROBID 原始 TEI 可能包含大量论文正文，日志中不得输出 TEI、用户选区或完整 Prompt。

标题修正在 `0.1.21` 采用保守规则：只移除已确认、完整匹配的 Google 授权声明；普通长标题不会按长度或句号截断。Flyway V12 修正了已知历史记录。新出版社模板必须拿真实 PDF/TEI 样例单独增加测试，不能扩展成粗暴启发式。

### 7.2 AI 的两条链路

当前存在两套容易混淆的 AI 数据路径：

1. 主阅读器直连链路：`components/chat/ChatPanel.tsx` + `chat-store.ts`。Provider、Key 和历史主要保存在浏览器；浏览器先直连 Provider，遇到 CORS/网络限制后才调用 JWT 保护的 `/api/provider-relay/*`。
2. 旧服务端链路：`/api/ai-chats` + `AiChatService`，使用后端环境中的模型配置并写 `pr_ai_chats/pr_ai_messages`。这不是当前阅读器历史列表的数据源。

主链路的行为：

- Provider 配置存在 `pr-preferences` localStorage，API Key 也是明文浏览器存储。
- 对话存在 `pr-ai-direct-chats` localStorage。每个会话独立保存 Provider 和模型；新会话继承上一会话选择，修改只影响当前会话。
- 不同会话可以并发等待回复；同一会话发送中不能重复发送。
- 回复可兼容多种 OpenAI-compatible/SSE/NDJSON/Responses/Gemini 风格结构；`<think>` 或 reasoning 默认折叠。
- 首次成功回复后可能再发一个非流式标题总结请求，这会增加 Provider 费用和限流占用。
- Relay 不持久化 Key，限制为公网 HTTPS 并做 SSRF 防护；它不是隐藏客户端 Key 的常驻服务端 Provider 管理方案。

### 7.3 删除论文

- 默认 `DELETE /api/papers/{id}?deleteFile=false` 只删数据库记录及关联数据，保留原文件副本。
- 用户明确勾选后才使用 `deleteFile=true` 物理删除本地或 Dufs 文件。
- `PaperDeletionService` 显式清理 chunks、批注评论、批注、笔记、阅读记录、旧 AI 消息/会话、版本和标签。新增任何引用论文的表都要同步评估。
- 数据库事务与文件系统无法真正原子提交；极端情况下仍可能出现记录与文件不一致。未上线 outbox 或孤儿文件管理前，不得自动清理用户选择保留的文件。

## 8. 浏览器状态、鉴权和隐私

| 存储键 | 内容 | 注意事项 |
| --- | --- | --- |
| `pr_session` localStorage | access token、refresh token | XSS 会放大泄漏风险 |
| `pr_session` cookie | 值仅为 `1` 的登录标记 | 供 Next middleware 判断路由，不是服务端认证凭据 |
| `pr-preferences` | 主题、偏好、Provider、API Key | Key 明文存在浏览器，不能截图或输出 |
| `pr-ai-direct-chats` | 主阅读器 AI 历史、模型/Provider 引用 | 本地、非跨设备，退出登录清理语义需谨慎修改 |
| `pr-notifications` | 客户端通知状态 | 本地 UI 状态 |

REST API 的真实认证依赖 `Authorization: Bearer <JWT>`。不要把同名 cookie 误认为安全会话 cookie，也不要在日志中打印 Authorization header。

## 9. 数据库与迁移

- PostgreSQL 表使用 `pr_` 前缀，主要包括用户、论文、批注、笔记、阅读日志、AI、论坛、IM、版本、存储配置、审计和全文 chunks。
- 生产 Flyway 当前为 V1-V13；V13 元数据 resolution/source/provenance 已在 `0.1.23` 启动时应用成功，Hibernate 使用 `ddl-auto=validate`。
- 已应用迁移是不可变历史。任何 schema 或受控数据修复都新增下一个版本文件，绝不编辑 V1-V12。
- 生产迁移前应备份数据库，并对数据修复 SQL 使用显式事务/回滚试运行。不要把生产数据、连接密码或导出文件提交到仓库。
- 本项目和后台管理共享数据库实例，确认 schema/表前缀后再操作，避免把后台 schema 当成本项目迁移目标。

## 10. API 总览

除明确公开的认证入口和 `/api/health` 外，REST API 默认要求 JWT。

| 模块 | 根路径 |
| --- | --- |
| 健康 | `/api/health` |
| 认证 | `/api/auth` |
| 论文/上下文/文件 | `/api/papers` |
| 元数据补全（开发分支） | `/api/papers/{paperId}/metadata/resolve`、`/metadata/resolutions/{resolutionId}`、`/metadata/sources` |
| GROBID | `/api/papers/{paperId}/grobid` |
| 论文版本 | `/api/papers/{paperId}/versions` |
| 阅读日志 | `/api/reading-logs` |
| 笔记 | `/api/notes` |
| 批注与评论 | `/api/annotations` |
| 旧服务端 AI | `/api/ai-chats` |
| Provider relay | `/api/provider-relay` |
| 论坛 | `/api/forum` |
| 私聊/群组 | `/api/chat` |
| 存储配置 | `/api/storage-configs` |
| 用户设置 | `/api/settings` |
| 审计日志 | `/api/audit-logs` |
| STOMP | 握手 `/ws`，发送 `/app/chat.*`，订阅 `/topic/*` |

前端统一 API 客户端在 `frontend/src/lib/api/client.ts`，DTO 在 `frontend/src/lib/api/types.ts`。改接口时必须同步后端 DTO、前端类型、调用方和测试。

## 11. 已知风险与技术债

以下是当前真实边界，不要在交接或产品说明中隐藏：

### 高优先级安全债

- 历史上真实 `backend/.env`、`frontend/.env.local` 以及根目录工具启动脚本曾被 Git 跟踪并含硬编码凭据。`0.1.22` 起环境文件从索引移除、脚本改为只读调用者环境并加强 ignore，但当前修正不能清除 Git 历史；其中出现过的数据库、Redis、JWT、OAuth、模型网关等凭据都应视为可能泄漏并在受控窗口轮换。若仓库曾公开或成员范围不受控，还需评估历史清理。
- CORS 当前允许任意来源模式并允许凭据，生产应收敛到可信域名。
- `/ws/**` 公开，STOMP payload 的 `senderId` 来自客户端，未可靠绑定服务端认证身份，可能被伪造。修复前不要把 IM 当作高安全通信。
- JWT 存 localStorage；Provider Key 也明文存 localStorage。需要 CSP/XSS 防护和后续安全存储设计。
- 存储配置 JSONB 可包含明文 Token，CRUD DTO 会返回配置；需要服务端加密、返回脱敏和迁移方案。

### 产品/实现债

- 邮件验证码只写日志，生产没有真正邮件投递。
- 未知邮箱使用密码登录会自动注册，这是当前代码行为，可能不符合最终账户策略。
- 外部存储版本推送是 TODO，当前占位调用甚至可能把未推送记录标为 `success`。
- AI 本地历史没有完整的服务端同步、加密、跨设备、容量和生命周期策略。
- 搜索区域仍不完整；全文 chunks 也没有向量索引或 OCR。
- 当前后端运行 development profile，应在单独运维迭代中审计并迁移。
- 文件系统与数据库删除不是分布式事务；保留文件会产生无法从 UI 重新关联的孤儿副本。
- 旧 `components/ai` 与当前 `components/chat` 并存，增加误改风险，后续应确认无消费者后再清理。
- 元数据 V13 当前把候选扩展字段放入 `extraFields`，尚未建立独立 manifestation/identifier 投影；正式卷期页、仓储 DOI 与正式 DOI 的长期模型仍需后续迁移设计。

## 12. 构建、测试和兼容约束

当前历史回归基线：前端 8 个测试文件、66 项测试；后端 33 项测试。v0.1.23 新增元数据代码后必须重新运行全套检查，不能沿用该数字作为本轮最终结果。

```bash
cd /root/paper-reader/frontend
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm test
pnpm run build

cd /root/paper-reader/backend
./gradlew clean test bootJar
```

必须保留的特殊兼容：

- `frontend/patches/pdfjs-dist@5.4.296.patch` 由 `pnpm-lock.yaml` 的 `patchedDependencies` 引用。删除 patch 或绕过 pnpm 可能让 PDF.js 构建/运行回归。
- `frontend/next.config.ts` 把开发期 `eval-*` devtool 改为 `cheap-module-source-map`，用于规避 pdfjs-dist ESM 错误。
- PDF worker 当前通过 unpkg 加载，离线或 CDN 受限环境需要另行设计自托管。
- `NEXT_PUBLIC_*` 在 Next.js 构建时内联。修改 `.env.local` 后只重启旧构建不会生效，必须重新 `pnpm run build`。

## 13. 生产状态核验命令

这些命令只读，适合新人进入服务器后先执行：

```bash
cd /root/paper-reader
git status --short --branch
git remote show origin

pm2 status
pm2 show paper-reader-frontend
pm2 show paper-reader-backend
ss -ltnp | rg ':(3001|8080|5432|6379|8070|8400)\b'

docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
curl -fsS http://127.0.0.1:8080/api/health
curl -fsS http://127.0.0.1:8070/api/isalive
curl -fsSI https://paper.pilo.eu.cc/zh/login
curl -fsS https://paper.pilo.eu.cc/api/health
```

不要用 `pm2 env`、`docker inspect` 全量输出、`env` 或 `printenv` 粘贴到聊天和工单中，它们可能包含密钥。完整部署与故障处理见 [DEPLOY.md](DEPLOY.md)。

## 14. 历史踩坑摘要

- 域名看不到改动：只改/推代码没有构建并重启 PM2；Cloudflare 不是本项目部署端。
- 后端健康版本仍旧：PM2 restart 沿用旧版本 JAR 参数；应加载 `.env` 后重建后端 PM2 项。
- 重建后端后启动循环：删除 PM2 项后环境变量不会自动继承；`. ./.env` 和 `pm2 start` 必须在同一 shell。
- 前端 `127.0.0.1:3001` 探活失败：Next 绑定 `localhost` 实际为 `::1`，改用 localhost/IPv6 或公网。
- Provider 测试成功、聊天失败：不能只测 `/models`，必须测实际 `/chat/completions`；Base URL 常需 `/v1`。
- Provider 返回 HTML：Base URL 指向网站页面而非 API 根路径；客户端有 `/v1` 回退，但仍应配置正确 API URL。
- AI 成功却空气泡：响应协议字段或流式格式不兼容；现有解析器有多协议兼容及一次非流式回退，新增格式要用脱敏样本加测试。
- Relay 流中断：Spring `StreamingResponseBody` 会发生 ASYNC 二次分发；安全配置只允许 ASYNC dispatch 通过，不能把整个 relay 改成公开接口。
- 标题带授权声明：污染来自 GROBID TEI，不是前端复制逻辑；只为经证实模板做保守清洗。
- 论文卡片三点菜单被 Tag 压住：操作按钮必须占独立网格列，避免绝对定位重叠。
- 删除论文误解：默认只删除记录，复选框明确选中才删原文件；数据库与文件不具备真正原子性。
- 直接运行仓库 Compose：当前生产基础设施不是该 Compose 管理，可能端口/数据卷冲突。

## 15. 下一位维护者的起点

1. 先读 [NEW_MAINTAINER_GUIDE.md](NEW_MAINTAINER_GUIDE.md) 并执行只读核验。
2. 新需求从远程最新发布版本基线创建下一个版本分支；已发布版本的 Bug 从对应版本基线创建 `-fix` 分支，不要直接在 `main` 开发。
3. 先更新 [PLAN.md](PLAN.md)，确认需求是普通迭代还是 `-fix`。
4. 修改前沿真实 import、API 和数据链路定位，不按文件名猜入口。
5. 完成后运行前后端全套检查，立即提交并推送版本分支，再依次合并 `dev`、`main`。
6. 合并 `main` 后立即执行生产环境部署（不是开发模式启动），用本机与公网两层验证，最后才 `pm2 save`，并把验证记录追加到 [MAINTENANCE.md](MAINTENANCE.md)。

## v0.1.30 当前发布

- 分支：`feature/v0.1.30`。
- 内容：产品更名为 PaperHelper、图标改为 H，并完成我的书架四个 Tab（所有、创建、导入、收藏）与侧栏菜单调整。
- 状态：已完成全量验证、提交、推送、合并和生产验收；生产已运行 `0.1.30`。
