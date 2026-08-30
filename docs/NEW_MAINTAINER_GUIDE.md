# PaperHelper 新人维护指引

本文目标是让第一次接触 PaperHelper 的维护者，在不依赖历史聊天上下文的情况下安全开始工作。先完成“只读认识”，再启动或修改服务。

## 1. 十分钟快速认识

PaperHelper 仓库位于 `/root/paper-reader`，包含：

- `frontend/`：Next.js 15 + React 19 的用户端。
- `backend/`：Kotlin + Spring Boot API。
- `docs/`：项目交接、维护、部署与技术方案。
- 生产域名：`https://paper.pilo.eu.cc`。

不包含：

- `/root/paperread-admin` 后台管理仓库。它独立维护，不要随手一起提交。
- GROBID 源码或镜像定制。PaperHelper 只调用已有解析服务。
- 生产 PostgreSQL/Redis 的生命周期管理。当前容器是共享/外置基础设施，不归仓库 Compose 管理。

开始前按顺序读：本文件 → [项目完整现状](PROJECT_STATUS.md) → [注意事项](ATTENTION.md) → [当前计划](PLAN.md)。涉及上线再读 [部署手册](DEPLOY.md)。

## 2. 进入项目后的第一组命令

以下都是只读操作：

```bash
cd /root/paper-reader
git status --short --branch
git remote -v
git remote show origin
git log --oneline --decorate -10

node --version
pnpm --version
java -version
cd backend && ./gradlew --version
```

确认：

- `origin` 指向正确 PaperHelper 仓库。
- GitHub 的 HEAD/default branch 是 `main`。
- 没有把用户未提交的工作当成自己的改动覆盖。
- 新需求从远程最新发布版本基线创建下一个版本分支；已发布版本的 Bug 从对应版本基线创建 `-fix` 分支，不从陈旧版本分支继续堆叠。
- 版本号在前后端、README 和 favicon 参数中一致。

如果工作区不干净，先用 `git diff` 和 `git status` 区分现有改动；不要执行 `git reset --hard`、`git clean -fd` 或宽泛删除。

## 3. 安全与密钥规则

真实运行配置只存在本机，不进入 Git：

- `backend/.env`
- `frontend/.env.local`

模板：

- `backend/.env.example`
- `frontend/.env.example`

新环境创建配置：

```bash
cd /root/paper-reader
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

随后在本机填值。禁止把真实密码、数据库连接凭据、Redis 密码、JWT Secret、OAuth Secret、Provider API Key、Cookie 或 Token 放进 commit、Markdown、截图、Issue、日志粘贴或命令输出。

### 3.1 历史密钥事件

`0.1.22` 以前，真实 `backend/.env`、`frontend/.env.local` 和根目录工具启动脚本曾被 Git 跟踪，脚本中还出现过硬编码模型网关凭据。本版本从索引移除环境文件、清理脚本并加 ignore，但 Git 历史仍可能包含旧值。因此：

1. 现有本地文件要保留给运行服务，不能因取消跟踪就删除服务器文件。
2. 其中出现过的数据库、Redis、JWT、GitHub OAuth、模型网关等秘密应视为可能泄漏，安排吊销或轮换。
3. 轮换 JWT 会使现有登录失效；数据库/Redis/OAuth 轮换也涉及依赖协调，必须在备份和回滚方案准备好后执行。
4. 如果需要清理 Git 历史，这是影响所有 clone 和分支的独立操作，未经明确授权不得强推改写历史。

可以安全检查文件是否被跟踪，不读取内容：

```bash
git check-ignore -v backend/.env frontend/.env.local
git ls-files backend/.env frontend/.env.local
```

第二条命令正常应无输出。

## 4. 配置说明

### 4.1 前端

| 变量 | 本地示例 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080/api` | REST 根路径，必须含 `/api` |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8080/ws` | STOMP 握手地址 |
| `NEXT_PUBLIC_AUTH_ENABLED` | `true` | 是否启用登录流程 |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | 空 | OAuth 客户端 ID，不是 Secret |
| `NEXT_PUBLIC_GITHUB_REDIRECT_URI` | `http://localhost:3001/callback` | 必须与 GitHub App 配置一致 |
| `NEXT_PUBLIC_ENABLE_AI_CHAT` | `true` | AI UI feature flag |

生产对应 API/WS 为 `https://paper.pilo.eu.cc/api` 和 `wss://paper.pilo.eu.cc/ws`。所有 `NEXT_PUBLIC_*` 都会进入浏览器构建，绝不能放秘密；修改后必须重新 build。

### 4.2 后端

| 组 | 变量 | 要点 |
| --- | --- | --- |
| 应用 | `SPRING_PROFILES_ACTIVE`, `SERVER_ADDRESS`, `SERVER_PORT`, `LOG_LEVEL` | 支持 `development` / `production`；反代部署通常只绑定 loopback |
| 数据库 | `DATABASE_HOST/PORT/NAME/USER/PASSWORD` | 生产使用共享 PostgreSQL，先确认目标库 |
| Redis | `REDIS_HOST/PORT/PASSWORD` | 必须与 Redis 实例密码一致 |
| JWT | `JWT_SECRET`, `JWT_*_EXPIRATION` | Secret 至少 256 bit，不复用示例 |
| 文件 | `STORAGE_TYPE`, `STORAGE_LOCAL_PATH`, `DUFS_URL` | 支持 `local` / `dufs`；生产当前是 local |
| GROBID | `GROBID_BASE_URL`, `GROBID_TIMEOUT`, `GROBID_PARSE_*` | 控制解析地址、超时和异步线程池 |
| 登录 | `MAIL_FROM`, `GITHUB_CLIENT_ID/SECRET` | 邮件实际发送尚未实现 |
| 旧 AI | `OPENAI_*`, `CLAUDE_*`, `DEEPSEEK_*`, `QWEN_*` | 服务端旧 `/api/ai-chats` 使用；主阅读器 Provider 来自浏览器 |

生产当前 local 存储目录为 `/root/paper-reader/backend/uploads`，包含用户数据。不要删除、清空、移动或纳入 Git。

## 5. 本地启动

### 5.1 基础设施选择

全新、隔离的开发机可以使用：

```bash
cd /root/paper-reader/backend
export REDIS_PASSWORD='replace-with-a-local-random-password'
docker compose up -d
docker compose ps
```

然后让 `backend/.env` 使用同一个 Redis 密码。

当前生产机不是这个场景。它已有 `infra-postgres`、`infra-redis`、`paper-reader-grobid` 且无 Compose labels，禁止直接 `docker compose up -d`。先执行：

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
ss -ltnp | rg ':(5432|6379|8070|8400)\b'
```

### 5.2 启动后端

Spring Boot/Gradle 不会自动读取 `.env`，先导出：

```bash
cd /root/paper-reader/backend
set -a
. ./.env
set +a
./gradlew bootRun
```

另一个终端验证：

```bash
curl -fsS http://127.0.0.1:8080/api/health
curl -fsS http://127.0.0.1:8070/api/isalive
```

启动会运行 Flyway。连接共享或生产数据库前，必须先确认环境与备份；不要把“本地启动”误连到生产库。

### 5.3 启动前端

```bash
cd /root/paper-reader/frontend
pnpm install --frozen-lockfile
pnpm dev -- --hostname localhost --port 3001
```

访问 `http://localhost:3001/zh/login`。若使用默认 `pnpm dev`，端口通常是 3000，要同步调整 OAuth callback。

## 6. 先理解再修改的代码路径

### 6.1 主工作台

入口 `frontend/src/app/[locale]/page.tsx` 组合：左侧 Sidebar、论文列表/阅读区域、右侧面板和 Preferences。定位 UI 问题时从这里向下追 props 和 store。

### 6.2 AI 对话

主阅读器实际使用：

- `frontend/src/components/chat/ChatPanel.tsx`
- `frontend/src/stores/chat-store.ts`
- `frontend/src/lib/ai-provider.ts`
- `frontend/src/lib/ai-chat-response.ts`
- `backend/.../ProviderRelayController.kt`
- `backend/.../ProviderRelayService.kt`

不要误改 `frontend/src/components/ai/ChatPanel.tsx` 后期待主界面变化。

Provider 测试应验证真实 `/chat/completions`，不能只依赖 `/models`。Base URL 应是 API 根路径，常见 OpenAI-compatible 地址以 `/v1` 结束。诊断 Provider 响应时只能保留 HTTP 状态、Content-Type 和脱敏结构，不能记录 Key 或完整用户内容。

### 6.3 PDF 与论文上下文

- 阅读与选区：`components/reader/PDFReader.tsx`、`PDFViewer.tsx`、`AnnotationLayer.tsx`。
- 上传：`PaperService.kt`。
- 异步解析：`PaperParsingService.kt`。
- TEI：`GrobidClient.kt`、`TeiDocumentParser.kt`。
- 上下文：`PaperContextService.kt`。

解析失败必须允许继续阅读 PDF。扫描 PDF 无 OCR；上下文匹配是关键词 + 相邻 chunks，不是语义向量检索。

### 6.4 论文列表与删除

- 列表：`PaperList.tsx`、`PaperCard.tsx`。
- 弹窗：`DeletePaperDialog.tsx`。
- 后端：`PaperDeletionService.kt`。

默认只删除记录；只有用户勾选才删除原文件。新增任何 Paper 外键表时，必须更新删除顺序或定义明确级联。

## 7. 开始一个迭代

每次需求必须基于远程最新版本创建新的迭代分支，不得在旧迭代分支上继续堆叠：

- 新需求、功能、维护或文档迭代：从最新发布版本创建下一个版本的 `feature/vX.Y.Z`。
- 某个已发布版本产生的 Bug：从该版本基线创建 `feature/vX.Y.Z-fix`；修复分支完成后仍按完整发布流程交付。
- 版本分支和修复分支合并后均永久保留，作为追溯与回滚依据。

标准交付顺序必须是：

1. 同步远程最新基线并创建对应分支。
2. 在分支上修改代码、测试和文档。
3. 类型检查、测试和生产构建全部通过后，立即提交并推送远程分支。
4. 先合并到 `dev` 并完成集成验证，再合并到 `main`；不得绕过 `dev` 或直接在 `main` 开发。
5. 合并 `main` 后立即执行生产环境部署：构建生产产物、按 PM2/Apache 链路重启服务，并完成本机和公网验收。
6. 生产验收通过后才执行 `pm2 save`，并将提交、构建、合并、部署和验收结果记录到维护文档。

生产部署不等于开发模式启动。`pnpm dev`、`./gradlew bootRun` 仅用于隔离的本地开发验证，不能替代生产构建、生产进程重启和线上验收。

开始编码前：

1. 在 `docs/PLAN.md` 写清目标、验收、不包含范围和分支类型。
2. 在 `docs/ATTENTION.md` 写本次不可破坏的约束。
3. 更新所有版本位置（如本迭代需要发布版本）。
4. 检查工作区已有改动并保留用户内容。

开发完成后，追加 `docs/MAINTENANCE.md`：问题/需求、原因、方案、验证、上线结果、遗留风险。

## 8. 必跑验证

### 前端

```bash
cd /root/paper-reader/frontend
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm test
pnpm run build
```

当前基线是 8 个测试文件、66 项测试。构建警告也要阅读，不要只看退出码。

### 后端

```bash
cd /root/paper-reader/backend
./gradlew clean test bootJar
BACKEND_VERSION="$(tr -d '\r\n' < VERSION)"
test -f "build/libs/paper-reader-backend-${BACKEND_VERSION}.jar"
unzip -p "build/libs/paper-reader-backend-${BACKEND_VERSION}.jar" \
  META-INF/build-info.properties | rg "build.version=${BACKEND_VERSION}"
```

当前基线是 33 项后端测试。数据库改动还要确认新 Flyway 文件编号、SQL 回滚试验和生产备份。

### 仓库与文档

```bash
cd /root/paper-reader
git diff --check
git status --short
rg -n '0\.1\.[0-9]+(-fix)?' \
  README.md frontend/package.json frontend/VERSION backend/VERSION \
  backend/build.gradle.kts frontend/src/app/layout.tsx \
  frontend/src/components/layout/FaviconThemeSync.tsx
git ls-files backend/.env frontend/.env.local
```

最后一条应无输出。提交前还应检查 diff 中是否有疑似 Secret、Token、私钥头、用户数据或绝对生产凭据。

## 9. Git、合并和发布流程

```text
远程最新发布版本基线
  -> feature/vX.Y.Z 或 feature/vX.Y.Z-fix 开发、测试、build
  -> push 并永久保留版本分支
  -> merge 到 dev，验证
  -> dev merge 到 main
  -> 从 main 构建/部署生产
  -> 本机 + 公网验证
  -> 记录部署结果并同步三条分支
```

不要：

- 直接在 `main` 做日常开发。
- 跳过 `dev`。
- 删除历史版本分支。
- force push 改写长期分支。
- 把未测试 commit 合并到生产。
- 将真实 `.env` 作为“配置备份”推远程。

推荐提交信息：`feat:`、`fix:`、`docs:`、`refactor:`、`test:`、`chore:`。一个版本可有多个清晰提交，但最终版本、文档和代码必须一致。

## 10. 生产部署最小安全流程

完整命令见 [DEPLOY.md](DEPLOY.md)。核心顺序：

1. 确认 `main` 指向要发布的 commit，工作区无意外改动。
2. 在 `main` 上重新执行前后端构建与测试。
3. 后端加载 `backend/.env`，删除并按新版本 JAR 路径重建 `paper-reader-backend`。
4. 前端重启 `paper-reader-frontend` 以加载新的 `.next`。
5. 查看两个进程日志与端口。
6. 验证本机 API、GROBID、公网 API、公网页面、静态资源。
7. 全部通过后才执行 `pm2 save`。
8. 将 commit、JAR、健康版本、页面状态和验证时间写入维护文档。

注意：Next 当前绑定 `localhost:3001`，实际监听 `::1`；不要只用 `127.0.0.1:3001` 判定失败。生产已有基础设施容器，不运行仓库 Compose。

## 11. 常见故障的定位顺序

### 域名仍是旧页面

1. `git rev-parse HEAD` 是否为目标 commit。
2. `pnpm run build` 是否在正确目录完成。
3. `pm2 show paper-reader-frontend` 的 cwd、启动时间和命令。
4. `curl -I` 公网页面的 `cache-control` / `cf-cache-status`。
5. favicon/静态 chunk 是否带当前版本或构建哈希。

### API 失败

1. `curl http://127.0.0.1:8080/api/health`。
2. `pm2 logs paper-reader-backend --lines 100 --nostream`。
3. PM2 JAR 参数是否为当前版本。
4. 后端重建前是否在同一 shell 加载 `.env`。
5. Apache `/api` 代理和公网健康接口。

### PDF 能看但没有元数据/上下文

1. GROBID `/api/isalive`。
2. 论文 `parseStatus` 是 PENDING、PROCESSING 还是 FAILED。
3. GROBID 容器日志（不要输出 TEI）。
4. 文件是否仍在 storage。
5. 异步线程池是否满/队列是否拒绝。

### Provider 测试失败

1. Base URL 是 API 根路径，不是官网页面。
2. 是否需要 `/v1`。
3. 模型名是否由 Provider 实际支持。
4. 浏览器 Network 是 Provider 直连还是 PaperHelper relay。
5. HTTP 状态、Content-Type 和脱敏响应形状；绝不复制 Key。

### 删除论文失败

1. 用户所有权和 HTTP 错误。
2. 新增关联表是否未纳入 `PaperDeletionService`。
3. 用户是否选择删除原文件，以及 storage 错误。
4. 不要绕过服务层直接删生产表或手动删除文件。

## 12. 修改后的最低交接标准

一个迭代只有同时满足以下条件才算完成：

- 需求和不包含范围清晰。
- 代码路径真实接入，不是改到同名废弃组件。
- 前后端类型、测试、生产构建通过。
- 配置模板和文档与实现一致，无真实秘密。
- 版本分支已推远程并保留。
- 依次合并 `dev`、`main`。
- 生产重启并完成本机/公网验证（若本轮要求上线）。
- `docs/MAINTENANCE.md` 有原因、方案、测试、部署和遗留风险。
- 新人只读文档即可复现你的判断，不需要回看聊天记录。

不确定是否能操作生产数据、共享容器、凭据轮换、Git 历史重写或后台仓库时，先停止并向项目负责人确认。这些都不是普通代码维护的隐含授权。
