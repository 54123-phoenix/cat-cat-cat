# 权限矩阵与审计规则

P5-03 的目标是把管理端从单一管理员口令推进到轻量角色分级。当前不引入复杂 RBAC 框架，优先复用 `users.role`。

## 角色

| 角色 | 说明 |
|------|------|
| `user` | 普通用户，可以识猫、记录偶遇、发帖、关注、贡献数据。 |
| `reviewer` | 审核员，可以处理新猫线索、偶遇审核、举报处理和查看管理总览。 |
| `admin` | 管理员，可以管理猫档案、健康记录、喂食点、用户状态、审计日志和全部审核流。 |

## 后端权限入口

统一权限 helper 位于：

```text
cat-backend/app/api/auth.py
```

核心依赖：

- `require_auth`
- `require_admin`
- `require_roles(...)`
- `require_reviewer_or_admin`

权限判断必须在后端执行，前端只能做显示层收敛，不能作为唯一防线。

## 能力矩阵

| 能力 | user | reviewer | admin |
|------|------|----------|-------|
| 使用识别、偶遇、社区、关注 | yes | yes | yes |
| 查看管理端总览 | no | yes | yes |
| 查看待审线索、举报、偶遇 | no | yes | yes |
| 审核新猫线索 | no | yes | yes |
| 审核偶遇 | no | yes | yes |
| 处理举报 | no | yes | yes |
| 创建、更新、删除猫档案 | no | no | yes |
| 上传猫档案参考照片 | no | no | yes |
| 管理健康记录 | no | no | yes |
| 管理喂食点 | no | no | yes |
| 查看完整审计日志 | no | no | yes |
| 撤销用户 token | no | no | yes |

## 接口分级

`reviewer` 或 `admin`：

- `GET /api/admin/me`
- `GET /api/admin/dashboard`
- `GET /api/admin/sightings`
- `POST /api/admin/sightings/{id}/review`
- `GET /api/discoveries`
- `POST /api/discoveries/{id}/review`
- `GET /api/posts/reports`
- `POST /api/posts/reports/{id}/handle`

仅 `admin`：

- `POST /api/cats`
- `PUT /api/cats/{id}`
- `DELETE /api/cats/{id}`
- `POST /api/cats/{id}/images`
- `POST /api/cats/{id}/health`
- `DELETE /api/cats/{id}/health/{record_id}`
- `POST /api/feeding/points`
- `DELETE /api/feeding/points/{id}`
- `GET /api/audit/logs`
- `POST /api/admin/users/{id}/revoke`

## 审计规则

关键管理动作必须写入 `AuditLog`：

- 猫档案创建、更新、删除。
- 新猫线索审核。
- 偶遇审核。
- 举报处理。

审计日志应包含：

- `action`
- `entity_type`
- `entity_id`
- `old_value`
- `new_value`
- `performed_by`
- `created_at`

## 验收清单

- [ ] `user` 不能访问管理端总览、审核、举报处理、审计日志。
- [ ] `reviewer` 可以查看总览和处理审核/举报。
- [ ] `reviewer` 不能删除猫档案、管理健康记录、撤销用户 token。
- [ ] `admin` 保留全部管理能力。
- [ ] 新猫线索审核写入 `AuditLog`。
- [ ] 偶遇审核写入 `AuditLog`。
- [ ] 举报处理写入 `AuditLog`。
- [ ] full harness 通过。
