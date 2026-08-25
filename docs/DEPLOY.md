# Paper Reader 部署文档

## 系统架构

```
┌──────────────────────────────────────────────────────────┐
│  浏览器                                                   │
│    :3001 (Next.js PWA)                                    │
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
│PG 16│  │Redis │  │ Dufs │  │   GROBID     │
│:5432│  │:6379 │  │:8400 │  │   :8070      │
│     │  │      │  │      │  │ 论文解析服务  │
└─────┘  └──────┘  └──────┘  └──────────────┘
```

### 核心依赖

| 服务 | 用途 | 必须 |
|------|------|------|
| PostgreSQL 16 | 主数据库 | 是 |
| Redis 7 | 缓存 / Session | 是 |
| Dufs | 文件存储（PDF 二进制） | 是 |
| GROBID 0.8.1 | 论文元数据解析 | 是（上传/URL导入功能依赖） |

---

## 第一步：启动 Docker 基础服务

这 4 个服务是后端运行的**前置条件**，必须先启动。

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

> **GROBID 说明**：论文上传或 URL 导入时，后端会调用 GROBID REST API（`/api/processFulltextDocument`）解析 PDF，提取标题、作者、摘要等元数据。首次启动后需要约 30 秒加载模型，期间解析会排队等待。GROBID 内存占用约 4-8GB，确保机器有足够 RAM。

---

## 第二步：配置环境变量

### 后端环境变量 `/root/paper-reader/backend/.env`

```bash
# 运行环境 (development | production)
SPRING_PROFILES_ACTIVE=development
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
NEXT_PUBLIC_AUTH_ENABLED=true
NEXT_PUBLIC_GITHUB_CLIENT_ID=<同上>
NEXT_PUBLIC_GITHUB_REDIRECT_URI=http://<你的服务器IP>:3001/callback
NEXT_PUBLIC_ENABLE_AI_CHAT=true
```

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
  npx -- next start -p 3001

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

---

## 第五步：验证

```bash
# 检查端口
ss -tlnp | grep -E '3001|8080'
# 预期：
# LISTEN ... *:8080 ... users:(("java",pid=...,...))
# LISTEN ... *:3001 ... users:(("next-server",pid=...,...))

# 健康检查
curl -s http://localhost:8080/api/papers?page=0\&pageSize=1 | head -c 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001

# Docker 服务
docker compose -f /root/paper-reader/backend/docker-compose.yml ps
```

---

## 完整首次部署序列

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
pm2 start --name paper-reader-frontend npx -- next start -p 3001

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
# 检查容器状态
docker compose -f /root/paper-reader/backend/docker-compose.yml logs grobid --tail 30

# 重启 GROBID
docker compose -f /root/paper-reader/backend/docker-compose.yml restart grobid
# 等约 30 秒模型加载完成
curl -s http://localhost:8070/api/isalive
# 应返回 "true"
```

### 数据库迁移失败

```bash
# Flyway 会在首次启动时自动创建表（pr_ 前缀）
# 查看迁移状态
docker compose -f /root/paper-reader/backend/docker-compose.yml exec postgres \
  psql -U paper_reader -c "\dt pr_*"
```

### 运行时仍是旧代码

```bash
# 检查进程启动时间
ps -eo pid,lstart,cmd | grep -E 'next|java' | grep -v grep
# 如果启动时间是几天前 → 没杀掉旧进程，回到第四步重新执行
```
