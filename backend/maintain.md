## v0.1.0 - 2026-07-02

### 变更内容
- 初始化项目脚手架：Kotlin + Spring Boot 3.4.1 + Gradle + JDK 17
- 实现用户认证系统（register/login + JWT）
- 完成核心业务模块：
  - Paper 论文管理（上传、URL导入、GROBID解析、下载、删除）
  - Annotation 批注（HIGHLIGHT/UNDERLINE/STRIKETHROUGH/NOTE/AREA）
  - Note 笔记（CRUD + 标签管理）
  - ReadingLog 阅读记录（进度追踪）
  - AI Chat（多模型支持：openai/claude/deepseek/qwen）
  - UserSettings 用户设置
- GROBID 集成：通过 REST API 对接独立 Docker 服务实例
- 文件存储：支持 Dufs（轻量 HTTP 文件服务器）/ 本地文件系统双后端
- Docker Compose：PostgreSQL + Redis + Dufs + GROBID 四服务
- 异常处理：4位错误码体系（1001-1004）+ GlobalExceptionHandler
- 数据库：PostgreSQL + Flyway 迁移，表前缀 pr_
- 安全：Spring Security + JWT + BCrypt

### 影响范围
- 全量后端代码：controllers, services, repositories, entities, DTOs, config, security, exception handling

### 功能列表
| 模块 | 端点 | 状态 |
|------|------|------|
| Auth | POST /api/auth/register, /api/auth/login | ✅ |
| Papers | CRUD + upload/url/download | ✅ |
| Annotations | CRUD | ✅ |
| Notes | CRUD | ✅ |
| Reading Logs | CRUD + progress | ✅ |
| AI Chats | 多轮对话 + 多模型 | ✅ |
| Settings | GET/PUT | ✅ |
| GROBID | 解析 + 健康检查 | ✅ |
