# PaperReader 迭代计划

## 当前迭代：v0.1.19-fix

分支：`feature/v0.1.19-fix`

迭代类型：问题修复。修复生产后端已经运行 v0.1.19 JAR，但 `/api/health` 仍返回硬编码旧版本 `0.1.18-fix` 的问题。

### 本次目标与范围

- 将后端版本更新为 `0.1.19-fix`，同步前端版本、版本文件、favicon 缓存参数和发布文档。
- 由 Spring Boot 构建任务生成 `META-INF/build-info.properties`。
- `/api/health` 从当前 JAR 的 `BuildProperties.version` 读取版本，不再维护独立硬编码字符串。
- 构建元数据不存在时返回 `development`，方便 IDE 或轻量测试环境明确区分非发布构建。
- 增加健康接口版本来源和回退行为的回归测试。

### 验收标准

- 构建产物包含版本为 `0.1.19-fix` 的 `META-INF/build-info.properties`。
- 本机和公网 `/api/health` 均返回 `status=ok`、`version=0.1.19-fix`。
- Controller 中不再出现历史版本硬编码，后续只需更新构建版本即可驱动健康接口。
- 前端类型检查、测试、生产构建和后端 `clean test bootJar` 全部通过。

### 本次不包含

- 不修改 AI 对话、PDF 解析、数据库结构或 Provider 配置。
- 不修改后台管理项目 `/root/paperread-admin`。

## 历史迭代：v0.1.19

分支：`feature/v0.1.19`

已完成 AI 思考内容折叠、论文选区询问 AI、GROBID 全文结构化提取、论文上下文查询和数据库 V11 迁移；详情见 AI 技术方案及维护文档第 8 节。

## 历史迭代：v0.1.18-fix

分支：`feature/v0.1.18-fix`

已完成 Provider `/v1` 根路径、CORS relay、流式响应和 AI 会话并发修复；详情见维护文档中的 v0.1.18 条目。

## 历史迭代：v0.1.13-fix

分支：`feature/v0.1.13-fix`

### 目标

修复偏好设置中 AI Provider“测试连接”误报失败的问题，使测试请求与实际对话请求使用同一条 `/chat/completions` 流程。

### 已完成

- 已填写模型时直接测试实际使用的 `/chat/completions`，不再先依赖 `/models`。
- 未填写模型时才请求 `/models` 获取模型，并使用获取到的第一个模型测试 chat。
- 不再猜测 `gpt-4o-mini`，避免自定义 Provider 因模型不存在被误判为连接失败。
- 统一 Base URL 规范化、Authorization 请求头和错误脱敏逻辑，聊天发送路径复用同一套工具。
- 错误提示包含真实 chat HTTP 状态和 Provider 错误消息，但不会泄露 API Key。
- 更新 `0.1.13-fix` 版本信息和 favicon 缓存参数。

### 验收标准

- 已配置模型时测试按钮只发起 chat 请求，且请求模型等于配置模型。
- 未配置模型时能从常见 `/models` 响应格式提取模型，再测试 chat。
- `/models` 不可用时不会使用猜测模型，界面会明确提示填写模型。
- chat 接口失败时显示 chat 接口真实错误，而不是旧的 `/models` 错误。
- 浏览器请求带有 `v=0.1.13-fix-r1` 的 favicon 缓存参数。
- 首页左上角 Logo 与页面其他品牌元素未被本次修复影响。
- 构建、测试、重启和公网检查均通过。

## 后续计划

### v0.1.14（待确认）

- 评估将直接 Provider 对话同步到后端账户历史的必要性。
- 为历史对话增加删除、重命名和按 Provider 筛选。
- 为模型选择记忆每个 Provider 的最近选择。
- 评估输入框自动高度和长消息性能。

## 已完成迭代

### v0.1.18

- 完成 C 端 AI 会话身份、会话级 Provider/模型、AI 标题总结和跨会话并发处理。
- 详情见 [AI_CHAT_TECHNICAL_SOLUTION.md](AI_CHAT_TECHNICAL_SOLUTION.md) 和维护文档中的 v0.1.18 条目。

### v0.1.12

- 完成浏览器标签页 favicon 的 R 缩小与居中调整。

### v0.1.12-fix

- 修复侧栏折叠按钮跨边界时部分区域无法点击的问题。

### v0.1.11

- 完成 C 端右侧 AI 对话面板的 Provider 配置、模型选择、新建对话和本地历史对话流程重构。
- 详情见 [AI_CHAT_TECHNICAL_SOLUTION.md](AI_CHAT_TECHNICAL_SOLUTION.md)。

### 后续中版本（需明确授权）

- 语音识别输入：必须先定义浏览器权限、语音服务 Provider、隐私提示和失败回退。
- 多模态模型能力：需要区分“已粘贴图片”与 Provider 是否支持视觉输入。
- 服务端加密保存 Provider 配置和跨设备对话同步。

以上中版本事项不会在普通 patch 迭代中自动实施。
