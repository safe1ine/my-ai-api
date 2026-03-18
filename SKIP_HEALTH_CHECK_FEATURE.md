# 跳过健康检查功能说明

## 功能概述

为支持不支持健康检查的上游供应商，新增了 `skip_health_check` 选项。当此选项开启后：
- 系统将不对该上游执行健康检查
- 在选择上游时，会忽略其健康状态
- **主要按优先级排序，同优先级内跳过健康检查的上游排在队头**

## 上游选择逻辑

新的排序规则（带过滤）：

1. **过滤阶段**：只保留以下上游
   - ✅ 开启了 `skip_health_check` 的上游（忽略健康状态）
   - ✅ 健康检查通过的上游（`last_check_success = True`）
   - ❌ **不健康的上游直接摘除，不参与选择**

2. **排序阶段**（三级排序）：
   - **第一优先：优先级数字**（数字越小越优先，1 最高，10 最低）
   - **第二优先：健康状态类别**（同优先级内）
     - 跳过健康检查的上游（无延迟数据，排在队头）
     - 健康的上游（按延迟排序）
   - **第三优先：延迟时间**（同优先级、同健康状态内按延迟升序）

### 示例

假设有以下上游配置：

| 上游 | 优先级 | skip_health_check | 健康状态 | 延迟 | 结果 |
|------|--------|-------------------|----------|------|------|
| A    | 1      | ✅                | -        | -    | ✅ 选中，排序 1 |
| B    | 1      | ❌                | 健康     | 100ms| ✅ 选中，排序 3 |
| C    | 1      | ❌                | 健康     | 50ms | ✅ 选中，排序 2 |
| D    | 2      | ✅                | -        | -    | ✅ 选中，排序 4 |
| E    | 2      | ❌                | 健康     | 80ms | ✅ 选中，排序 5 |
| F    | 1      | ❌                | **不健康**   | -    | ❌ **摘除，不参与** |
| G    | 1      | ❌                | **未检查**   | -    | ❌ **摘除，不参与** |

**实际选择顺序**：
1. A（优先级1，跳过检查）
2. C（优先级1，健康，延迟50ms）
3. B（优先级1，健康，延迟100ms）
4. D（优先级2，跳过检查）
5. E（优先级2，健康，延迟80ms）

**注意**：F 和 G 因为不健康/未检查且未开启跳过健康检查，已被摘除。

## 修改内容

### 后端修改

#### 1. 数据库模型 (backend/models.py)
- 在 `Provider` 模型中添加了 `skip_health_check` 字段（布尔类型，默认 False）

#### 2. Schema (backend/schemas.py)
- `ProviderBase`: 添加 `skip_health_check: bool = False`
- `ProviderUpdate`: 添加 `skip_health_check: bool | None = None`
- `ProviderOut`: 添加 `skip_health_check: bool = False`
- `ProviderDetail`: 添加 `skip_health_check: bool = False`

#### 3. 代理逻辑 (backend/routers/proxy.py)
修改 `_pick_providers` 函数的上游选择逻辑：

**新的过滤和排序规则**：
```python
# 过滤阶段：只保留 (跳过健康检查) 或 (健康的) 上游
available = []
for p in candidates:
    skip_check = getattr(p, 'skip_health_check', False)
    if skip_check or p.last_check_success is True:
        available.append(p)

# 排序阶段：优先级 → 健康状态 → 延迟
def sort_key(p: Provider):
    priority = p.priority if p.priority is not None else 5
    skip_check = getattr(p, 'skip_health_check', False)
    
    if skip_check:
        health_order = 0
        latency = 0  # 跳过检查的排在同优先级队头
    else:
        health_order = 1
        latency = p.last_check_latency_ms or 999999
    
    return (priority, health_order, latency)
```

关键变化：**不健康的节点在过滤阶段就被摘除，不再参与后续选择**

#### 4. 健康检查服务 (backend/health_checker.py)
修改健康检查循环，跳过 `skip_health_check=True` 的上游：

```python
providers_to_check = [p for p in active_providers if not getattr(p, 'skip_health_check', False)]
```

#### 5. 数据库迁移 (backend/main.py)
添加数据库迁移项：

```python
("providers", "skip_health_check", "ALTER TABLE providers ADD COLUMN skip_health_check BOOLEAN DEFAULT FALSE"),
```

### 前端修改

#### 1. API 类型定义 (frontend/src/api.ts)
- `ProviderOut`: 添加 `skip_health_check: boolean`
- `ProviderCreate`: 添加 `skip_health_check?: boolean`
- `ProviderUpdate`: 添加 `skip_health_check?: boolean`

#### 2. 表单页面 (frontend/src/pages/ProvidersPage.tsx)

**表单默认值**：
```typescript
const emptyForm = {
  // ... 其他字段 ...
  skip_health_check: false,
}
```

**表单 UI**：
在优先级设置和启用状态之间添加了"跳过健康检查"的切换开关：
- 开启时显示橙色样式
- 包含说明文本："开启后，系统将不检查此上游的健康状态，总是尝试使用"

**健康状态徽章**：
修改 `HealthBadge` 组件，为跳过健康检查的上游显示特殊状态：
```typescript
if (p.skip_health_check) {
  return <橙色徽章>已跳过检查</橙色徽章>
}
```

## 使用场景

适用于以下情况：
1. **第三方代理服务**：某些 API 代理服务不提供健康检查接口
2. **内网服务**：内网部署的模型服务，健康检查可能不可达
3. **特殊协议**：使用特殊协议或认证方式的上游，标准健康检查无法通过
4. **始终可用的服务**：对于已知稳定可靠的上游，可以跳过检查以减少开销

## 测试步骤

### 1. 启动后端
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. 启动前端
```bash
cd frontend
npm install
npm run dev
```

### 3. 测试流程
1. 访问管理后台的"供应商配置"页面
2. 创建或编辑一个供应商
3. 在表单中找到"跳过健康检查"选项
4. 开启此选项并保存
5. 观察列表中该供应商的健康状态显示为"已跳过检查"
6. 发起 API 请求，确认此上游会被优先选择

## 注意事项

1. **数据库迁移**：首次启动后端时会自动添加新列
2. **兼容性**：使用 `getattr(p, 'skip_health_check', False)` 确保向后兼容
3. **排序规则**：主要按优先级数字排序，同优先级内跳过健康检查的上游排在队头
4. **不健康节点摘除**：健康检查失败的节点会被完全排除，不参与请求分发
5. **跳过检查的作用**：可以让不支持健康检查的上游持续工作，不会被摘除

## 使用效果总结

当你开启"跳过健康检查"后：
- ⏭️ 系统不再对该上游执行健康检查
- 🛡️ **该上游永远不会因为健康检查失败而被摘除**
- 🎯 **在同优先级内，该上游会排在队头**（优先于健康的上游）
- 🟡 界面上显示"已跳过检查"的橙色标识
- ♻️ 请求失败时仍会重试其他可用上游
- 📊 优先级数字仍然是最重要的排序依据

当不开启"跳过健康检查"时：
- 🔍 系统会定期执行健康检查
- ❌ **如果健康检查失败，该上游会被摘除，不再接收请求**
- ✅ 只有健康检查通过的上游才会参与请求分发

## 更新日志

- 2026-03-18: 初始版本，新增跳过健康检查功能
