# PaperHelper 部署文档

> **先确认环境**：本页的 Compose 命令只适合全新、隔离环境。当前生产机使用既有的 `infra-postgres`、`infra-redis`、`paper-reader-grobid` 容器，它们没有 Compose labels，且生产存储是本地目录 `/root/paper-reader/backend/uploads`。在当前生产机直接执行仓库 `docker compose up -d` 可能造成端口、数据卷和共享服务冲突。

生产域名为 `https://paper.pilo.eu.cc`，真实请求链路是 Cloudflare -> Apache -> PM2。Cloudflare 只承担 DNS/Proxy/TLS，不负责构建或发布源码。

## 系统架构

```
┌──────────────────────────────────────────────────────────┐
│  浏览器 / Cloudflare / Apache :443                        │
└─────────────┬────────────────────────────────────────────┘
              │ HTTP/WebSocket
┌─────────────▼────────────────────────────────────────────┐
│  前端 (Next.js 15)                  :3001                 │
│  - PDF 渲染 (react-pdf + pdfjs-dist)                     │
│  - 批注/笔记 UI                                          │
│  - AI 对话                                                │
└─────────────┬────────────────────────────────────────────┘
              │ REST API
┌─────────────▼────────────────────────────────────────────┐
│  后端 (Kotlin/Spring Boot 3)         :8080                │
│  - 用户认证 (JWT + GitHub OAuth)                          │
│  - 论文上传/解析/下载                                     │
│  - 批注/笔记 CRUD                                         │
│  - AI 多模型代理                                          │
└──┬──────────┬──────────┬──────────┬──────────────────────┘
   │          │          │          │
┌──▼──┐  ┌───▼──┐  ┌───▼──┐  ┌───▼──────────┐
│PG 16│  │Redis │  │Local/│  │   GROBID     │
│:5432│  │:6379 │  │:8400 │  │   :8070      │
│     │  │      │  │Dufs  │  │ 论文解析服务  │
└─────┘  └──────┘  └──────┘  └──────────────┘
```

### 核心依赖

| 服务 | 用途 | 必须 |
|------|------|------|
| PostgreSQL 16 | 主数据库 | 是 |
| Redis 7 | 缓存 / Session | 是 |
| Local 或 Dufs | 文件存储（PDF 二进制） | 上传/URL 导入时是；生产当前为 Local |
| GROBID 0.8.1 | 论文元数据/正文结构解析 | 上传解析需要；不可用时已有 PDF 仍可阅读 |

---

## 第一步：确认基础服务归属

### 全新或隔离开发环境

仓库模板可启动 PostgreSQL、Redis、Dufs、GROBID 四个服务：

```bash
cd /root/paper-reader/backend
docker compose up -d
```

验证所有容器正常运行：

```bash
docker compose ps
# 预期: postgres / redis / dufs / grobid 四个服务均为 Up 状态
```

端口映射（确保不被其他进程占用）：

| 容器 | 容器内端口 | 宿主机端口 |
|------|-----------|-----------|
| PostgreSQL 16 | 5432 | 5432 |
| Redis 7 | 6379 | 6379 |
| Dufs | 5000 | 8400 |
| GROBID | 8070 | 8070 |

> **GROBID 说明**：论文上传或 URL 导入时，后端会调用 GROBID REST API（`/api/processFulltextDocument`）解析 PDF，提取标题、作者、摘要和 chunks。首次启动后需要约 30 秒加载模型，期间解析会排队等待。GROBID 内存占用较高，确保机器有足够 RAM。

### 当前生产机

只做只读确认，不运行仓库 Compose：

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
ss -ltnp | grep -E '3001|8080|5432|6379|8070|8400'
curl -fsS http://127.0.0.1:8070/api/isalive
```

预期已有 `infra-postgres`、`infra-redis`、`paper-reader-grobid`。当前没有 Dufs；不要为了让 `docker compose ps` 看起来完整而创建一套新服务。

---

## 第二步：配置环境变量

### 后端环境变量 `/root/paper-reader/backend/.env`

```bash
# 运行环境 (development | production)
SPRING_PROFILES_ACTIVE=development
SERVER_ADDRESS=127.0.0.1
SERVER_PORT=8080
LOG_LEVEL=INFO

# PostgreSQL（对应 docker compose 中的配置）
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=paper_reader
DATABASE_USER=paper_reader
DATABASE_PASSWORD=paper_reader

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT（生产环境务必修改）
JWT_SECRET=<至少 256 位随机字符串>
JWT_ACCESS_EXPIRATION=3600000
JWT_REFRESH_EXPIRATION=604800000

# 文件存储 (dufs | local)
STORAGE_TYPE=dufs
STORAGE_LOCAL_PATH=./uploads
DUFS_URL=http://localhost:8400

# GROBID 论文解析
GROBID_BASE_URL=http://localhost:8070
GROBID_TIMEOUT=60000
GROBID_PARSE_CORE_POOL_SIZE=2
GROBID_PARSE_MAX_POOL_SIZE=4
GROBID_PARSE_QUEUE_CAPACITY=20

# GitHub OAuth
GITHUB_CLIENT_ID=<你的 GitHub OAuth App Client ID>
GITHUB_CLIENT_SECRET=<你的 GitHub OAuth App Client Secret>

# AI 模型 (至少配一个)
OPENAI_API_KEY=
CLAUDE_API_KEY=
DEEPSEEK_API_KEY=
QWEN_API_KEY=
```

### 前端环境变量 `/root/paper-reader/frontend/.env.local`

```bash
NEXT_PUBLIC_API_URL=http://<你的服务器IP>:8080/api
NEXT_PUBLIC_WS_URL=ws://<你的服务器IP>:8080/ws
NEXT_PUBLIC_AUTH_ENABLED=true
NEXT_PUBLIC_GITHUB_CLIENT_ID=<同上>
NEXT_PUBLIC_GITHUB_REDIRECT_URI=http://<你的服务器IP>:3001/callback
NEXT_PUBLIC_ENABLE_AI_CHAT=true
```

当前生产使用：

```dotenv
NEXT_PUBLIC_API_URL=https://paper.pilo.eu.cc/api
NEXT_PUBLIC_WS_URL=wss://paper.pilo.eu.cc/ws
NEXT_PUBLIC_GITHUB_REDIRECT_URI=https://paper.pilo.eu.cc/callback
```

真实配置不得写进文档或 Git。`backend/.env` 与 `frontend/.env.local` 必须被 ignore；模板只保留示例。当前生产后端仍使用 `development` profile，这是已知风险，未经专项验证不要在普通发布中直接切换。

---

## 第三步：构建

```bash
# 后端 (Gradle)
cd /root/paper-reader/backend
./gradlew clean test bootJar
BACKEND_VERSION="$(tr -d '\r\n' < VERSION)"
# 产物: build/libs/paper-reader-backend-${BACKEND_VERSION}.jar
test -f "build/libs/paper-reader-backend-${BACKEND_VERSION}.jar"

# 前端 (Next.js)
cd /root/paper-reader/frontend
pnpm run build
# 产物: .next/ (生产构建)
```

---

## 第四步：部署（PM2 管理）

### 首次 PM2 配置

```bash
# 后端
cd /root/paper-reader/backend
BACKEND_VERSION="$(tr -d '\r\n' < VERSION)"
set -a
. ./.env
set +a
pm2 start --name paper-reader-backend \
  --cwd /root/paper-reader/backend \
  java -- -jar "/root/paper-reader/backend/build/libs/paper-reader-backend-${BACKEND_VERSION}.jar"

# 前端
cd /root/paper-reader/frontend
pm2 start --name paper-reader-frontend \
  --cwd /root/paper-reader/frontend \
  ./node_modules/next/dist/bin/next -- \
  start --hostname localhost --port 3001

pm2 save
```

### 后续部署（更新代码后）

```bash
# 1. 构建
cd /root/paper-reader/backend && ./gradlew clean test bootJar
BACKEND_VERSION="$(tr -d '\r\n' < VERSION)"
test -f "build/libs/paper-reader-backend-${BACKEND_VERSION}.jar"
cd /root/paper-reader/frontend && pnpm run build

# 2. 后端 JAR 带版本号；仅 restart 会继续加载旧路径，所以定向重建后端 PM2 项
cd /root/paper-reader/backend
set -a
. ./.env
set +a
# 不要在这里改用 sudo；PM2 必须收到当前 shell 已导出的应用配置。
pm2 delete paper-reader-backend
pm2 start --name paper-reader-backend \
  --cwd /root/paper-reader/backend \
  java -- -jar "/root/paper-reader/backend/build/libs/paper-reader-backend-${BACKEND_VERSION}.jar"

# 3. 前端加载刚生成的 .next 产物
pm2 restart paper-reader-frontend --update-env

# 4. 后端健康检查通过后才保存进程列表
curl --fail --retry 10 --retry-connrefused --retry-delay 2 \
  http://127.0.0.1:8080/api/health
pm2 save
```

重建后的 PM2 项不会继承已删除进程的应用环境变量，因此 `. ./.env`、`pm2 delete`、`pm2 start` 必须在同一个 shell 中连续执行。启动后先确认 `pm2 logs paper-reader-backend --lines 100 --nostream` 无缺少配置项，再执行 `pm2 save`；若启动循环，不要先保存错误状态。

前端的 `NEXT_PUBLIC_*` 在 build 时内联，修改 `.env.local` 后必须重新 `pnpm run build`。当前 `--hostname localhost` 在本机实际监听 `::1:3001`；`127.0.0.1:3001` 请求失败不代表服务离线。

---

## 第五步：验证

```bash
# 检查端口
ss -tlnp | grep -E '3001|8080'
# 预期：
# LISTEN ... *:8080 ... users:(("java",pid=...,...))
# LISTEN ... [::1]:3001 ... users:(("next-server",pid=...,...))

# 健康检查
curl -s http://localhost:8080/api/papers?page=0\&pageSize=1 | head -c 200
curl -fsSI http://localhost:3001/zh/login | head
curl -fsS https://paper.pilo.eu.cc/api/health
curl -fsSI https://paper.pilo.eu.cc/zh/login | head

# 生产容器只读状态（不要用仓库 Compose 重建）
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
```

---

## 完整首次部署序列（只适用于全新隔离环境）

```bash
# 1. Docker 依赖
cd /root/paper-reader/backend
docker compose up -d
sleep 10  # 等数据库初始化

# 2. 配置 .env（按上面的模板填充）
vim /root/paper-reader/backend/.env
vim /root/paper-reader/frontend/.env.local

# 3. 构建
cd /root/paper-reader/backend && ./gradlew clean test bootJar
BACKEND_VERSION="$(tr -d '\r\n' < VERSION)"
test -f "build/libs/paper-reader-backend-${BACKEND_VERSION}.jar"
cd /root/paper-reader/frontend && pnpm run build

# 4. 启动
cd /root/paper-reader/backend
set -a
. ./.env
set +a
pm2 start --name paper-reader-backend java -- \
  -jar "/root/paper-reader/backend/build/libs/paper-reader-backend-${BACKEND_VERSION}.jar"

cd /root/paper-reader/frontend
pm2 start --name paper-reader-frontend \
  --cwd /root/paper-reader/frontend \
  ./node_modules/next/dist/bin/next -- \
  start --hostname localhost --port 3001

pm2 save

# 5. 验证端口
sleep 10
ss -tlnp | grep -E '3001|8080'
```

---

## 常见问题

### 端口被占用

```bash
# 先查精确占用者，再通过对应的 PM2 项或容器处理
ss -tlnp | grep -E '3001|8080|5432|6379|8400|8070'
pm2 status
```

### PM2 进程僵死

```bash
pm2 show <准确的进程名>
pm2 logs <准确的进程名> --lines 100 --nostream
# 只重建确认有问题的 PM2 项，然后执行 pm2 save
```

### GROBID 不可用

```bash
# 当前生产先检查实际容器，不假设 Compose 归属
docker ps --filter name=paper-reader-grobid
docker logs paper-reader-grobid --tail 30

# 确认只有该容器异常且已获运维授权后，才定向重启
docker restart paper-reader-grobid
# 等约 30 秒模型加载完成
curl -s http://localhost:8070/api/isalive
# 应返回 "true"
```

### 数据库迁移失败

```bash
# Flyway 在后端启动时迁移 pr_* 表。生产先看后端日志，避免输出连接密码。
pm2 logs paper-reader-backend --lines 150 --nostream

# 若获授权使用生产容器内 psql，目标是当前实际容器，不是 Compose service 名。
docker exec -it infra-postgres psql -U <database-user> -d <database-name>
```

不要修改已应用的 V1-V12。新增迁移使用下一个编号；生产数据修复先备份，并在显式事务中试运行和回滚验证。

### 运行时仍是旧代码

```bash
# 检查进程启动时间
ps -eo pid,lstart,cmd | grep -E 'next|java' | grep -v grep
# 如果启动时间是几天前 → 没杀掉旧进程，回到第四步重新执行
```

后端还要检查 `pm2 show paper-reader-backend` 的 JAR 参数和公网 `/api/health` 版本；前端检查 `.next` 构建时间、PM2 启动时间和页面静态 chunk/favicon 版本。Cloudflare 不是源码部署端，只 push 不会生效。

## 生产发布后验收清单

- `pm2 status` 中前后端均 online，日志无启动循环和配置缺失。
- 后端 PM2 参数、JAR 文件名、JAR build-info、本机 `/api/health`、公网 `/api/health` 五处版本一致。
- `curl -fsSI http://localhost:3001/zh/login` 和公网页面成功；不要只测 `127.0.0.1:3001`。
- 公网 `/zh/login` 为 200，HTML 为动态/无缓存，静态资源和 favicon 是本次构建。
- GROBID `/api/isalive` 为 `true`；本轮没有业务需要时不重建 GROBID。
- 上传目录仍存在、权限正确，发布过程没有删除或覆盖 `/root/paper-reader/backend/uploads`。
- 所有验证通过后才 `pm2 save`，并把时间、commit、版本和异常写入 `docs/MAINTENANCE.md`。

## 回滚原则

- 回滚前记录当前 commit、PM2 参数、日志和数据库迁移状态。
- 前端可切回已验证 commit 后重建并重启；不要复用来源不明的旧 `.next`。
- 后端可在 schema 向后兼容时切回已验证 JAR，并加载同一套受控环境变量后重建 PM2 项。
- Flyway 已应用迁移不会因切 Git/JAR 自动回滚。涉及 schema/data migration 的版本必须使用预先设计的向前修复或经审核的恢复方案，不能直接删除 `flyway_schema_history` 记录。
- 文件删除和上传用户数据不随 Git 回滚；任何恢复都先备份并确认精确目标。
