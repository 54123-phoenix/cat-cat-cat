# P3-02 管理端数据看板执行任务书

执行者：opencode / GLM-5.2

## 背景

当前项目位于 `D:\Desktop\cat`。已有大量未提交改动，这是正常状态，请不要回滚、重置或删除已有变更。当前任务是继续完成 P3-02「管理端数据看板」。

我（Codex）已经开始了部分实现，请优先收口而不是重做：

- `cat-backend/app/api/admin.py` 已新增 `/api/admin/dashboard` 的初稿。
- `cat-backend/tests/test_admin_dashboard.py` 已新增 dashboard 后端测试。
- `cat-frontend/src/api.ts` 已新增 `getAdminDashboard()`。
- `cat-frontend/src/pages/Admin.tsx` 已部分接入 dashboard import、`dashboard` state、`overview` tab、`loadDashboard()`，但 UI 还未完成，可能需要修复 build 语法/类型问题。

## 目标

完成 P3-02 管理端数据看板，让管理员登录后能在「总览」tab 中看到：

- 待审核新猫线索数量。
- 待处理举报数量。
- 待审核偶遇数量。
- 近 7 天偶遇数量。
- 当前猫档总数与用户数。
- 近 7 天偶遇热区。
- 活跃贡献者。
- 最近审计动态。

## 实现要求

### 后端

保留并完善 `GET /api/admin/dashboard`：

- 必须走 `require_admin` 权限。
- 返回结构包含：
  - `summary`
  - `hot_locations`
  - `active_contributors`
  - `recent_audit_logs`
- `summary` 至少包含：
  - `pending_discoveries`
  - `pending_reports`
  - `pending_sightings`
  - `recent_sightings`
  - `total_cats`
  - `total_users`
- 尽量不要新增数据库表。
- 若能复用 `crud` 里的统计逻辑就复用。
- 保持已有测试通过。

### 前端

完善 `cat-frontend/src/pages/Admin.tsx`：

- `TABS` 中保留 `overview` 总览 tab，并使其成为默认 tab。
- 登录后加载 dashboard 数据。
- 在 `adminTab === 'overview'` 时渲染总览 UI。
- UI 风格要贴合现有管理端：移动端窄屏、卡片式、紧凑、可扫描。
- 不要做营销页，不要加大 hero。
- 使用已导入或可新增的 lucide-react 图标。
- 空数据要有合理展示，不要空白。
- 不要破坏已有 cats / health / feeding / reports / sightings tab。

建议 UI 结构：

- 顶部 2x3 指标卡：
  - 待审线索
  - 待处理举报
  - 待审偶遇
  - 近 7 天偶遇
  - 猫档总数
  - 用户数
- 下方三块：
  - 近 7 天热区列表
  - 活跃贡献者列表
  - 最近审计动态列表

### Harness

更新 `harness/checks/api_contract_check.py`，增加 P3-02 静态契约：

- 后端 `admin.py` 应包含 `/dashboard`、`pending_discoveries`、`hot_locations`、`active_contributors`。
- 前端 `api.ts` 应包含 `getAdminDashboard`。
- 前端 `Admin.tsx` 应包含 `overview`、`dashboard`、`active_contributors` 或等价字段。

完成后同步：

- `harness/roadmap.yml`：P3-02 状态改为 `completed`。
- `harness/TODO.md`：P3-02 勾选。
- `README.md`：升级路径中把 P3-02 管理看板记为已完成，下一阶段只剩 P4-01 和生产化补强。

## 验收命令

请至少运行：

```powershell
cd D:\Desktop\cat\cat-backend
.\.venv\Scripts\python.exe -m pytest tests\test_admin_dashboard.py
.\.venv\Scripts\python.exe -m pytest tests

cd D:\Desktop\cat\cat-frontend
npm test -- --run
npm run build

cd D:\Desktop\cat
powershell -NoProfile -ExecutionPolicy Bypass -File harness\run.ps1 -Mode full -ContinueOnFailure
```

如果耗时较长，至少保证针对性测试、前端 build 和 full harness 通过。

## 非目标

- 不实现 P4-01 校园猫路线推荐。
- 不重构整个管理端。
- 不修改认证模型。
- 不新增大型依赖。
- 不运行 destructive git 命令，例如 `git reset --hard`、`git checkout --`、清理未提交文件等。

## 完成后输出

请简短说明：

- 改了哪些文件。
- P3-02 的功能入口在哪里。
- 跑了哪些测试，结果如何。
- 如果有未完成或风险点，明确列出。
