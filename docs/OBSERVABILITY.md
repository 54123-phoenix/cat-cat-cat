# 部署监控、错误追踪与结构化日志

P5-04 的目标是让项目运行状态可见：请求能被追踪，模型健康能被检查，错误和慢请求有统一入口。

## 请求追踪

后端已启用：

```text
cat-backend/app/middleware/request_logging.py
```

每个请求都会：

- 读取或生成 `X-Request-ID`
- 将 `X-Request-ID` 写回响应头
- 记录结构化 JSON 日志
- 记录请求方法、路径、状态码、耗时、客户端地址和 user agent

示例日志：

```json
{"event":"request_completed","request_id":"trace-123","method":"GET","path":"/api/system/health","status_code":200,"duration_ms":12.34,"client":"127.0.0.1","user_agent":"curl/8.0"}
```

日志不会记录：

- Authorization token
- 请求 body
- 上传文件内容
- 密码或密钥

## 健康检查

系统健康：

```text
GET /api/system/health
```

模型 warm check：

```text
GET /api/system/health?warm_model=true
```

推荐发布前检查：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File harness/run.ps1 -Mode full -ContinueOnFailure
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup.ps1 -DryRun
```

## 需要关注的信号

| 信号 | 说明 | 首要排查 |
|------|------|----------|
| 5xx 响应增多 | 后端异常或依赖不可用 | 按 `request_id` 查后端日志 |
| `/api/system/health` unhealthy | 模型、embedding 或阈值异常 | `docs/MODEL_HEALTH.md` |
| 上传失败 | 文件类型、大小或路径校验失败 | `cat-backend/app/api/upload.py` |
| 管理端审核异常 | 权限、审计或数据状态异常 | `docs/PERMISSIONS.md` |
| 数据异常 | SQLite 或 uploads 损坏/缺失 | `docs/BACKUP_RECOVERY.md` |

## 事故处理入口

- 模型不可用：先查 `/api/system/health`，确认是否降级为 `unavailable`。
- 数据恢复：按 `docs/BACKUP_RECOVERY.md` 先 dry run，再显式确认恢复。
- 权限异常：按 `docs/PERMISSIONS.md` 确认角色和接口分级。
- 发布异常：查看 `harness/reports/latest.md` 的失败 gate。

## 验收

P5-04 完成条件：

- [x] 后端响应包含 `X-Request-ID`。
- [x] 请求日志使用结构化 JSON。
- [x] 日志不记录 token、请求 body 或上传内容。
- [x] full harness 通过。
- [x] 监控与排障文档存在。
