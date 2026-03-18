# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目
用户指令条目应遵循以下格式：

[用户指令摘要]
- Date: [YYYY-MM-DD]
- Context: [提及的场景或时间]
- Instructions:
  - [用户教导或指示的内容，逐行描述]

### 项目知识条目
Agent 在任务执行过程中发现的条目应遵循以下格式：

[项目知识摘要]
- Date: [YYYY-MM-DD]
- Context: Agent 在执行 [具体任务描述] 时发现
- Category: [代码结构|代码模式|代码生成|构建方法|测试方法|依赖关系|环境配置]
- Instructions:
  - [具体的知识点，逐行描述]

## 去重策略
- 添加新条目前，检查是否存在相似或相同的指令
- 若发现重复，跳过新条目或与已有条目合并
- 合并时，更新上下文或日期信息
- 这有助于避免冗余条目，保持记忆文件整洁

## 条目

[项目技术栈]
- Date: 2026-03-18
- Context: Agent 在执行 upstream token 统计功能开发时发现
- Category: 代码结构
- Instructions:
  - 后端使用 FastAPI + SQLAlchemy 2.0 + Pydantic 2.x，数据库为 PostgreSQL
  - 前端使用 React 18 + TypeScript + Vite + Bootstrap 5 + Recharts
  - 前端通过 Vite proxy 将 /api 请求转发到后端 localhost:8000
  - ORM 模型定义在 backend/models.py，包含 Provider、ClientKey、ApiLog 三张表
  - 数据库迁移采用内联方式，在 backend/main.py 中通过 _migrations 列表管理 ALTER TABLE

[项目代码模式]
- Date: 2026-03-18
- Context: Agent 在执行 upstream token 统计功能开发时发现
- Category: 代码模式
- Instructions:
  - 后端路由按功能模块拆分到 backend/routers/ 目录下
  - Pydantic schema 统一定义在 backend/schemas.py
  - 前端 API 封装统一在 frontend/src/api.ts，使用 axios 实例
  - 前端页面在 frontend/src/pages/ 目录下，使用内联样式为主
  - Provider 列表页按类型（OpenAI/Anthropic）分组展示，支持列选择器
  - ProviderOut schema 使用 from_orm_with_mask 类方法对 API Key 脱敏
