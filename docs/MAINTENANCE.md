# PaperReader 维护规范

## 1. 适用范围

本文档适用于 `/root/paper-reader` C 端论文阅读项目。后台管理项目是独立仓库，不在本项目的代码变更范围内；如果一个需求同时影响两个项目，必须分别确认、分别更新版本、分别构建和分别推送。

## 2. 分支与版本

当前采用版本分支：

```text
feature/v主版本.次版本.修订版本
```

普通迭代默认只增加修订版本号：

```text
0.1.10 -> 0.1.11 -> 0.1.12
```

问题修复迭代在被修复版本后追加 `-fix`，并同步到分支、前后端版本文件、页面可见版本和文档：

```text
0.1.12 -> 0.1.12-fix -> 0.1.13
```

次版本和主版本不自动升级。只有产品负责人明确提出中版本或大版本更新时，才执行：

```text
0.1.x -> 0.2.0   # 中版本
0.x.y -> 1.0.0   # 大版本
```

一次迭代至少应保持以下信息一致：

- 当前 Git 分支名，例如 `feature/v0.1.12-fix`。
- `frontend/package.json` 的 `version`。
- `frontend/VERSION` 和 `backend/VERSION`。
- README 的当前版本说明。
- 页面可见版本号和 favicon 缓存参数。
- 本次迭代对应的计划、注意事项和技术方案文档。

历史文档中的版本号是历史记录，不为了追求全文统一而改写；当前发布信息和新文档必须使用当前版本。

## 3. 每次代码迭代的标准流程

1. 查看当前分支、工作区、远程分支和最近提交，确认没有覆盖用户已有改动。
2. 从最新的目标分支创建或切换到下一版本分支。
3. 在 `docs/PLAN.md` 记录需求范围、验收标准和不在本次范围内的内容。
4. 先确认真实运行链路和真实引用组件，再修改代码；不要只修改未被页面引用的旧组件。
5. 在 `docs/ATTENTION.md` 记录安全、兼容性、部署、数据迁移和回滚风险。
6. 在对应技术方案文档中记录状态流、数据流、组件关系和边界条件。
7. 完成实现后运行：

   ```bash
   cd frontend
   pnpm exec tsc --noEmit
   pnpm test
   pnpm run build
   ```

8. 对前端生产进程执行构建、重启和保存：

   ```bash
   cd /root/paper-reader/frontend
   pnpm run build
   pm2 restart paper-reader-frontend --update-env
   pm2 save
   ```

9. 检查本机进程、页面状态码、静态资源状态码和公网域名；需要时检查 Apache、Cloudflare 缓存头和 PM2 日志。
10. 查看 `git diff --check`、`git status` 和最终 diff，提交清晰的 commit，然后推送当前版本分支。

## 4. 实际部署链路

```text
浏览器
  -> Cloudflare DNS/Proxy/TLS
  -> Apache paper.pilo.eu.cc
       /api -> Spring Boot :8080
       /ws  -> Spring WebSocket :8080/ws
       /    -> PM2 Next.js :3001
```

因此本项目不是 Cloudflare Pages 部署。修改前端源码之后，仅推送 Git 不会自动让公网生效；必须构建并重启 `paper-reader-frontend`。重启前应确认目标进程和端口，不能使用宽泛的 kill 或删除命令。

常用检查：

```bash
pm2 show paper-reader-frontend
pm2 logs paper-reader-frontend --lines 100 --nostream
ss -ltnp | grep 3001
curl -I https://paper.pilo.eu.cc/zh/login
```

## 5. 提交与推送

- 每次有代码改动都要提交并推送远程对应分支。
- commit message 使用能说明意图的短句，例如 `feat: redesign AI chat composer`。
- 推送前确认没有把 `.env.local`、API Key、Token、数据库备份或构建缓存加入提交。
- 不强行覆盖远程分支；发现远程已有新提交时先读取并合并/变基方案，再继续。
- 生产验证失败时，不要宣称已完成；先保留证据并修复或明确阻塞原因。

## 6. 对话功能的维护边界

AI 对话目前存在两套技术路径：

- C 端右侧 AI 面板直接调用用户在浏览器中配置的 OpenAI 兼容 Provider，并将该路径的历史保存在浏览器。
- 旧的后台 `/api/ai-chats` 接口使用服务器端配置的 AI 服务，供其他历史组件使用。

修改其中一套时，必须确认是否需要同步另一套，不能因为接口 DTO 名称相似就混用。任何涉及 API Key 的功能都应避免把密钥写入服务端日志、URL、错误提示或提交记录。
