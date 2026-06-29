# 两小时 Long Loop 执行任务书：P4-01 校园猫路线推荐

执行者：opencode / GLM-5.2  
规划与验收：Codex

## 运行方式

这是一个约 2 小时的长循环任务。请按“计划 -> 小切片实现 -> 局部测试 -> 下一个切片”的方式推进。不要为了耗满时间而扩大范围。若主目标提前完成并通过 full harness，可以做“允许的补强项”；若遇到不确定或测试失败，应优先修稳定性。

## 当前状态

项目路径：`D:\Desktop\cat`

目前 P0、P1、P2、P3-01、P3-02 均已完成。剩余路线图主线任务：

- P4-01 校园猫路线推荐

注意：当前工作区有大量未提交改动，这是正常状态。不要回滚、不要重置、不要清理未跟踪文件。

## 总目标

完成 P4-01「校园猫路线推荐」MVP：

- 基于最近偶遇、时间段、地点热度推荐 2-4 个校园猫路线点。
- 路线可在前端查看。
- 路线可分享。
- 路线点能跳转到地图或识猫/打卡入口。
- 通过 harness 监督，并同步 README、TODO、roadmap。

## 非目标

不要做这些：

- 不接真实地图路径规划 API。
- 不新增大型依赖。
- 不做复杂 AI 推荐。
- 不做登录/权限体系重构。
- 不重构整个 Map 或 Admin 页面。
- 不改数据库结构，除非真的不可避免。
- 不运行 `git reset --hard`、`git checkout --`、删除未提交文件等破坏性命令。

## 建议实现范围

### 后端

新增或完善一个路线推荐接口，建议：

```text
GET /api/routes/recommendations
```

可选 query：

- `time_slot`: `morning | noon | afternoon | evening | anytime`
- `limit`: 默认 4，范围 2-6
- `days`: 默认 14

返回建议结构：

```json
{
  "title": "午后校园猫路线",
  "time_slot": "afternoon",
  "generated_at": "...",
  "share_path": "/routes?time_slot=afternoon",
  "stops": [
    {
      "name": "图书馆草坪",
      "reason": "近 14 天偶遇活跃",
      "cat_id": 1,
      "cat_name": "橘宝",
      "cat_avatar": "...",
      "latitude": 31.3,
      "longitude": 121.5,
      "sightings_count": 3,
      "latest_sighting_at": "..."
    }
  ]
}
```

后端推荐逻辑应保守、可解释：

- 优先用最近 `days` 天有坐标的 sightings。
- 以地点聚合，统计次数和最近时间。
- 每个地点选最近出现的一只猫作为代表。
- 如果没有足够坐标数据，可退化为有 `location_name` 或 `location` 的 sightings。
- 如果仍无数据，返回空 stops，不报 500。

需要新增测试：

- 有最近 sightings 时能返回推荐 stops。
- 无数据时返回空 stops 且状态正常。
- `limit` 能限制数量。

### 前端

现有路由已有 `ROUTES_PAGE: '/routes'` 和页面 `cat-frontend/src/pages/CatRoutes.tsx`。请优先复用这个页面，不要新增重复页面。

目标体验：

- `/routes` 显示路线推荐。
- 顶部有时间段切换：任意 / 早晨 / 中午 / 下午 / 傍晚。
- 显示路线标题与路线点列表。
- 每个路线点展示地点、推荐理由、代表猫、最近偶遇/热度。
- 每个路线点提供：
  - 查看地图：跳转 `/map`，可带 query 参数也可只跳转。
  - 去识猫/打卡：跳转 `/scan`，可带 point/lat/lng query。
- 有复制分享链接按钮。
- 空数据时有明确空状态：提示先记录偶遇。

请保持移动端窄屏友好，UI 不要做大 hero，不要营销页。

### API Client / Types

在 `cat-frontend/src/api.ts` 增加函数：

```ts
getRouteRecommendations(params)
```

如已有类型文件可补充类型；没有则保持项目现有风格。

### Harness

更新 `harness/checks/api_contract_check.py`，增加 P4-01 静态契约：

- 后端存在 routes 推荐接口或相关函数。
- 前端 api 存在 `getRouteRecommendations`。
- `CatRoutes.tsx` 存在时间段切换、分享、scan/map 跳转相关 token。
- roadmap/TODO 中 P4-01 完成后状态一致。

### 文档状态

完成后同步：

- `harness/roadmap.yml`：P4-01 `status: completed`
- `harness/TODO.md`：P4-01 勾选
- `README.md`：升级路径把 P4-01 记入已完成；下一阶段建议改为生产化补强

## 允许的补强项

只有在 P4-01 已经完成、测试通过、full harness 100 后，才允许做以下小补强：

- 修复明显的中文乱码文案，仅限你触碰过的 UI 附近。
- 给路线推荐加 1-2 个 focused tests。
- 加强 README 中路线推荐说明。
- 增加 harness 契约覆盖。

不要新增 P5，不要继续大规模功能开发。

## 必跑验收命令

建议按顺序运行：

```powershell
cd D:\Desktop\cat\cat-backend
.\.venv\Scripts\python.exe -m pytest tests

cd D:\Desktop\cat\cat-frontend
npm test -- --run
npm run build

cd D:\Desktop\cat
powershell -NoProfile -ExecutionPolicy Bypass -File harness\run.ps1 -Mode full -ContinueOnFailure
```

如果测试失败：

- 先修失败。
- 不要绕过测试。
- 不要降低 harness 标准。

## 进度日志

请在完成后输出：

- 完成的切片。
- 修改文件列表。
- 测试命令与结果。
- full harness 分数。
- 是否更新 README/TODO/roadmap。
- 遗留风险。

## 交付标准

只有同时满足以下条件才算完成：

- P4-01 功能可从 `/routes` 使用。
- 后端有推荐接口且有测试。
- 前端能构建通过。
- full harness `score: 100` 且 `pass`。
- README、TODO、roadmap 状态一致。
