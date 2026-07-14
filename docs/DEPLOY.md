# Paper Reader 部署文档

## 黄金法则

**每次部署新代码前，必须先杀掉旧进程。** 不遵守此规则会导致：
- 旧僵尸进程继续占用端口，新进程启动失败
- PM2 状态显示 "online" 但实际运行的仍是旧代码
- `navigator.clipboard` 等新修复看起来"没生效"

## 部署步骤

### 1. 构建

```bash
# 前端
cd /root/paper-reader/frontend
npm run build

# 后端
cd /root/paper-reader/backend
./gradlew bootJar
```

### 2. 杀掉旧进程（关键步骤）

```bash
# 先停 PM2 管理的进程
pm2 stop paper-reader-frontend paper-reader-backend

# 强制杀掉端口上的残留进程（必须做！）
fuser -k 3001/tcp || true
fuser -k 8080/tcp || true

# 确认端口已释放
ss -tlnp | grep -E '3001|8080'
# 预期输出：空（没有任何进程监听这两个端口）
```

### 3. 启动新进程

```bash
# 后端
cd /root/paper-reader/backend
nohup java -jar build/libs/paper-reader-*.jar > /tmp/backend.log 2>&1 &
# 或通过 PM2：
pm2 start paper-reader-backend
pm2 restart paper-reader-backend --update-env

# 前端
cd /root/paper-reader/frontend
pm2 start paper-reader-frontend
pm2 restart paper-reader-frontend --update-env
```

### 4. 验证

```bash
# 验证端口（最重要的一步！）
ss -tlnp | grep -E '3001|8080'

# 预期输出示例：
# LISTEN 0 511 *:3001 *:* users:(("node",pid=XXXXX,...))
# LISTEN 0 100 *:8080 *:* users:(("java",pid=YYYYY,...))

# 检查进程 PID 是否是最新启动的
ps aux | grep -E 'next|java' | grep -v grep

# 访问验证
curl -s http://localhost:8080/api/papers?page=0\&pageSize=1 | head -c 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001
```

## 常见问题

### 端口被占用

```bash
# 查看谁在占用
ss -tlnp | grep -E '3001|8080'

# 强制杀进程
fuser -k 3001/tcp
fuser -k 8080/tcp
```

### PM2 进程僵死

```bash
# 完全清理 PM2
pm2 delete paper-reader-frontend
pm2 delete paper-reader-backend
pm2 save --force

# 然后重新 start
```

### 验证端口后仍有旧代码行为

```bash
# 检查实际运行的进程启动时间
ps -eo pid,lstart,cmd | grep -E 'next|java' | grep -v grep
# 如果启动时间是几天前 → 旧进程没杀掉，回到步骤 2
```
