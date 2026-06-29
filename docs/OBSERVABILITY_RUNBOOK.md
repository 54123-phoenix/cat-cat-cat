# 可观测性运维手册

校园猫项目的监控指标、排查路径与 incident 响应手册。

---

## 一、监控什么

| 指标 | 关注点 | 查看方式 |
|------|--------|----------|
| 后端健康 | 服务存活、模型状态 | `GET /api/system/health` |
| 模型健康 | 识别模型资产、embedding、阈值和可选 warm load 是否正常 | `GET /api/system/health` 中 `model` 字段 |
| 请求错误率 | 5xx 比例突增 | 后端日志 `ERROR` / `WARNING` 级别 |
| 慢请求 | 响应超时（>10s） | 后端日志中请求耗时 |
| 上传失败 | 图片上传 4xx/5xx | 后端日志 `upload` 相关错误 |
| 管理端审计活动 | 审核操作是否正常落库 | `GET /api/audit/logs`（admin） |
| 备份/恢复就绪 | 备份脚本可正常运行 | `scripts/backup.ps1 -DryRun` |

---

## 二、如何排查

### 2.1 系统健康检查

```powershell
curl http://localhost:8000/api/system/health
```

返回字段：

- `status`：服务整体状态（`healthy` / `degraded` / `unhealthy`）
- `model.status`：模型状态
- `model.runtime_available`：PyTorch 运行时是否可用
- `model.warm_model_loaded`：启用 `warm_model=true` 时模型是否成功加载
- `checked_at`：检查时间

### 2.2 Harness 报告

```powershell
cd D:\Desktop\cat
powershell -NoProfile -ExecutionPolicy Bypass -File harness\run.ps1 -Mode quick -ContinueOnFailure
```

查看 `harness/reports/latest.md`，关注：

- 是否有新增失败项
- score 是否为 100
- 各 check 段落是否 pass

### 2.3 后端日志

后端使用 `logging.basicConfig` 输出到 stdout，格式 `时间 级别 模块 消息`。

```powershell
cd D:\Desktop\cat\cat-backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

排查关键字：

- `ERROR` — 异常堆栈
- `upload` — 上传相关
- `recognize` — 识别相关
- `admin` — 管理端操作

### 2.4 相关文档

| 文档 | 用途 |
|------|------|
| `docs/MODEL_HEALTH.md` | 模型健康检查与降级策略 |
| `docs/BACKUP_RECOVERY.md` | 备份恢复流程 |
| `docs/PERMISSIONS.md` | 权限矩阵与审计字段 |
| `docs/RELEASE_CHECKLIST.md` | 发布前检查清单 |

---

## 三、Incident 响应手册

### 3.1 识别服务不可用

**现象：** `/api/recognize` 返回 `unavailable`，或前端识猫页提示「识别服务暂时不可用」。

**排查步骤：**

1. 调用 `GET /api/system/health`，检查 `model.status`。
2. 若 `model.status` 为 `unhealthy`，检查权重文件、embedding 文件、阈值配置和运行时依赖。
3. 检查后端日志中 `recognize` / `model` 相关 ERROR。
4. 确认模型权重文件是否存在、路径配置是否正确。

**恢复：**

- 模型权重缺失：恢复权重文件；识别接口应安全降级到 `unavailable` 或 `unknown`。
- 模型加载 OOM：重启后端、降低并发，并用 `GET /api/system/health?warm_model=true` 复查。
- 参考 `docs/MODEL_HEALTH.md`。

### 3.2 上传失败

**现象：** 猫照片 / 偶遇照片上传返回 4xx 或 5xx。

**排查步骤：**

1. 检查后端日志 `upload` 相关错误。
2. 确认 `cat-backend/uploads/` 目录存在且可写。
3. 确认文件大小未超限、类型为图片。
4. 确认磁盘空间充足。

**恢复：**

- 目录权限问题：修正 `uploads/` 权限。
- 磁盘满：清理旧报告 / `__pycache__`，或扩容。
- 持续失败：临时关闭上传入口，保留识别主闭环。

### 3.3 管理员登录失败

**现象：** `/api/admin/login` 返回 401。

**排查步骤：**

1. 确认 `ADMIN_PASSWORD` 环境变量已设置。
2. 确认数据库中存在 `role = "admin"` 的 User 记录。
3. 检查后端日志中 `admin` / `login` 相关记录。
4. 确认是否触发速率限制（`RATE_LOGIN_PER_MIN`）。

**恢复：**

- 环境变量缺失：设置 `ADMIN_PASSWORD` 并重启。
- admin 用户不存在：通过初始化脚本或手动创建。
- 速率限制：等待窗口期或临时调高限制。

### 3.4 需要数据库恢复

**现象：** 数据库损坏、数据丢失、误删记录。

**排查步骤：**

1. 参考 `docs/BACKUP_RECOVERY.md`。
2. 先执行 `scripts/backup.ps1` 对当前状态做一次紧急备份。
3. 确认有可用备份：`backups/<timestamp>/`。
4. DryRun 预览恢复：`scripts/restore.ps1 -BackupPath <path> -DryRun`。

**恢复：**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/restore.ps1 -BackupPath backups\<timestamp> -ConfirmRestore
```

恢复后按 `docs/BACKUP_RECOVERY.md` 第七节验证清单逐项确认。

### 3.5 前端构建失败

**现象：** `npm run build` 报错。

**排查步骤：**

1. 查看构建错误输出，定位类型错误或导入问题。
2. 确认 `cat-frontend/src/` 无语法错误。
3. 确认依赖完整：`npm install`。
4. 确认 `routes.ts` 中路由常量与 `App.tsx` 一致。

**恢复：**

- 类型错误：修正对应文件。
- 依赖缺失：`npm install`。
- 持续失败：回退到上一个可构建 commit，重新引入变更。

---

## 四、发布前验证清单

每次发布前逐项确认：

### 4.1 后端测试

```powershell
cd D:\Desktop\cat\cat-backend
.\.venv\Scripts\python.exe -m pytest tests -q
```

- [ ] 全部通过。

### 4.2 前端测试

```powershell
cd D:\Desktop\cat\cat-frontend
npm test -- --run
```

- [ ] 全部通过。

### 4.3 Full harness

```powershell
cd D:\Desktop\cat
powershell -NoProfile -ExecutionPolicy Bypass -File harness\run.ps1 -Mode full -ContinueOnFailure
```

- [ ] score 100，pass。

### 4.4 模型健康检查

```powershell
curl http://localhost:8000/api/system/health
```

- [ ] `status` 为 `healthy` 或预期的 `degraded`。
- [ ] `model` 字段无异常。

### 4.5 备份 DryRun

```powershell
cd D:\Desktop\cat
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup.ps1 -DryRun
```

- [ ] 正常预览数据库与 uploads 路径，无报错。
## Request Tracing And Log Safety

- Every response should include `X-Request-ID`.
- If the client sends a valid `X-Request-ID`, the backend should preserve it.
- Structured request logs should include event, request_id, method, path, status_code, duration_ms, client, and user_agent.
- Logs must not record authorization tokens, request bodies, uploaded file contents, or private credentials.
- When debugging an incident, copy only the request_id and high-level route/status information into handoff notes.
