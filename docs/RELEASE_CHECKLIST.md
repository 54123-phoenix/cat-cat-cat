# 发布清单

本清单用于校园猫项目正式发布前的逐项确认。按顺序勾选，全部通过后方可发布。

---

## 一、发布前准备

- [ ] 确认当前分支干净，无未提交的实验性改动。
- [ ] 确认 `harness/TODO.md` 中本轮目标已勾选。
- [ ] 确认 `harness/roadmap.yml` 中对应任务状态为 `completed`。
- [ ] 确认 `README.md` 升级路径已更新。
- [ ] 确认本次变更不引入新的大型依赖（未改动 `package.json` / `requirements.txt` 的依赖行）。

## 二、Harness 监督命令

必跑，不可跳过：

```powershell
cd D:\Desktop\cat
powershell -NoProfile -ExecutionPolicy Bypass -File harness\run.ps1 -Mode quick -ContinueOnFailure
powershell -NoProfile -ExecutionPolicy Bypass -File harness\run.ps1 -Mode full -ContinueOnFailure
```

- [ ] quick harness 通过。
- [ ] full harness `score: 100` 且 `pass`。
- [ ] `harness/reports/latest.md` 无新增失败项。

## 三、后端 / API 检查

```powershell
cd D:\Desktop\cat\cat-backend
.\.venv\Scripts\python.exe -m pytest tests -q
```

- [ ] 全部测试通过（当前基线 62 passed）。
- [ ] 无新增 deprecation warning 影响运行。
- [ ] 识别接口 `/api/recognize` 在无模型时返回 `unavailable`，不抛 500。
- [ ] 管理端 `/api/admin/dashboard` 需 `require_admin`，未登录返回 401。
- [ ] 路线推荐 `/api/routes/recommendations` 无数据时返回空 `stops`，不报错。

## 四、前端 / 构建检查

```powershell
cd D:\Desktop\cat\cat-frontend
npm test -- --run
npm run build
```

- [ ] `npm test` 全部通过（当前基线 25 passed / 4 files）。
- [ ] `npm run build` 成功，无类型错误。
- [ ] 构建产物体积无异常膨胀（`dist/assets/index-*.js` gzip < 160 kB）。
- [ ] 移动端窄屏（≤ 480px）下主要页面无横向溢出。

## 五、数据与上传安全

- [ ] 上传接口限制文件类型为图片，限制大小。
- [ ] 上传路径不可越权写出到项目目录外。
- [ ] SQLite 数据库文件不在 git 跟踪中。
- [ ] `.env` / 密钥文件不在 git 跟踪中。
- [ ] 模型健康接口不泄露密钥、token 或私有凭据。
- [ ] `/api/system/health` 能检查模型权重、embedding、阈值和可选 warm model load。

## 六、管理端工作流检查

- [ ] 管理员登录后默认进入「总览」tab。
- [ ] 总览展示待审线索 / 举报 / 偶遇、近 7 天热区、活跃贡献者、审计动态。
- [ ] 猫档案创建 / 更新 / 删除写入 AuditLog。
- [ ] 线索审核通过 / 拒绝写入 AuditLog。
- [ ] 举报处理（驳回 / 隐藏）状态流转正确。

## 七、回滚备注

- 本项目使用 SQLite 单文件数据库，回滚前先备份 `cat-backend/*.db`。
- 前端为纯静态产物，回滚只需替换 `dist/` 目录或重新 `npm run build`。
- 后端无自动迁移脚本，schema 变更需手动 `Base.metadata.create_all` 或手写迁移。
- 若发布后识别接口异常，先检查 `/api/system/health`；模型不可用时识别接口应降级到 `unavailable` 或 `unknown`，不影响主闭环。
- 回滚不使用 `git reset --hard`；优先 `git revert` 保留历史。

## 八、最终签收

- [ ] quick harness pass
- [ ] full harness score 100 pass
- [ ] 后端测试全通过
- [ ] 前端测试 + build 通过
- [ ] 管理端总览与审核流人工冒烟通过
- [ ] `/routes` 路线推荐页人工冒烟通过
- [ ] 发布说明已写入 `README.md` 升级路径段

全部勾选后，可标记本轮发布完成。
