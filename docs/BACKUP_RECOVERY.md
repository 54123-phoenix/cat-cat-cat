# 备份与恢复

校园猫项目的数据备份、恢复与演练说明。本项目使用 SQLite 单文件数据库 + 本地 uploads 目录，无自动迁移框架，备份恢复以文件复制为主。

---

## 一、哪些数据必须备份

| 数据 | 路径 | 说明 |
|------|------|------|
| 主数据库 | `cat-backend/*.db` | 用户、猫档案、偶遇、帖子、举报、审计日志等全部业务数据 |
| 上传文件 | `cat-backend/uploads/` | 猫猫照片、偶遇照片、帖子图片，无法从数据库重建 |

## 二、哪些数据可再生成

| 数据 | 路径 | 说明 |
|------|------|------|
| 前端构建产物 | `cat-frontend/dist/` | `npm run build` 重新生成 |
| harness 报告 | `harness/reports/` | 每次运行重新生成 |
| `__pycache__` / `node_modules` | 可重新安装 |

### 关于 `cat-backend/embeddings/cat_embeddings.json`

这是识别用的猫猫 embedding 参考数据。项目提供 `cat-backend/compute_embeddings.py` 可从当前猫档案与图片重新计算生成。**如果模型与图片未变，可视为可再生成**；但重新计算依赖模型运行环境且较慢，建议：

- 日常备份：可选包含（体积小，顺手备份无妨）。
- 模型升级或图片大批更新后：重新 `compute_embeddings.py` 生成，无需从备份恢复。

## 三、什么时候备份

- 每次发布前（参考 `docs/RELEASE_CHECKLIST.md`）。
- 执行恢复操作前（脚本自动预备份）。
- 重大数据变更（批量导入猫档案、清理举报）前。
- 定期（建议每日一次，可接入 cron / 任务计划）。

## 四、如何运行备份

基本用法：

```powershell
cd D:\Desktop\cat
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup.ps1
```

预览（不实际复制）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup.ps1 -DryRun
```

仅备份数据库，不含 uploads：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup.ps1 -SkipUploads -DryRun
```

自定义备份根目录（相对路径在项目根下解析，绝对路径直接使用）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup.ps1 -BackupDir D:\cat-backups -DryRun
```

输出结构：

```text
backups/
  20250101-120000/
    cat_community.db
    uploads/
      cats/
      sightings/
      ...
    manifest.txt
```

## 五、如何运行恢复

恢复必须显式指定备份目录并确认：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/restore.ps1 -BackupPath backups\20250101-120000 -ConfirmRestore
```

预览（不实际恢复）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/restore.ps1 -BackupPath backups\20250101-120000 -DryRun
```

恢复行为：

- 恢复前自动把当前数据库备份到 `backups/pre-restore-<timestamp>/`。
- 数据库文件直接覆盖到 `cat-backend/`，恢复目标始终在当前项目根目录内。
- uploads 只覆盖备份中存在的文件，**不删除**当前 uploads 中的其他文件。
- `-BackupPath` 可指向项目目录外的备份，但恢复目标始终写入当前项目的 `cat-backend/`。
- 跳过 uploads 恢复：加 `-SkipUploads`。

## 六、恢复演练步骤

建议在非生产环境演练一次完整恢复流程：

1. **创建基准备份**

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backup.ps1
   ```

2. **记录当前数据快照**
   - 管理端总览记录待审数量、猫档总数、用户数。
   - 首页确认猫猫列表正常加载。

3. **模拟数据损坏**
   - 手动重命名 `cat-backend/cat_community.db` 为 `.db.bak`。
   - 确认后端启动失败或返回空数据。

4. **执行恢复**

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/restore.ps1 -BackupPath backups\<最新> -ConfirmRestore
   ```

5. **验证恢复结果**（见下一节）。

6. **清理演练痕迹**
   - 确认无误后删除 `.db.bak`。
   - pre-restore 备份可保留或手动清理。

## 七、恢复后验证清单

### 7.1 后端测试

```powershell
cd D:\Desktop\cat\cat-backend
.\.venv\Scripts\python.exe -m pytest tests -q
```

- [ ] 全部通过。

### 7.2 Full harness

```powershell
cd D:\Desktop\cat
powershell -NoProfile -ExecutionPolicy Bypass -File harness\run.ps1 -Mode full -ContinueOnFailure
```

- [ ] score 100，pass。

### 7.3 管理端总览

- [ ] 登录 `/admin`，总览 tab 数据与恢复前快照一致。
- [ ] 待审线索 / 举报 / 偶遇数量匹配。
- [ ] 审计日志可查到恢复前的记录。

### 7.4 核心路径冒烟

- [ ] 识别 `/scan`：上传照片能走通识别流程。
- [ ] 偶遇：确认偶遇后出现在猫档案偶遇历史。
- [ ] 社区 `/community`：帖子列表与图片正常加载。
- [ ] 猫档案照片墙：图片正常显示（验证 uploads 恢复成功）。
- [ ] 路线推荐 `/routes`：能基于恢复后的偶遇数据生成路线。

## 八、注意事项

- 备份脚本不删除任何文件，可安全重复运行。
- 恢复脚本不删除整个 uploads 目录，只覆盖备份中存在的文件。
- 恢复后建议重启后端进程，确保数据库连接刷新。
- SQLite 备份期间若有写入，可能拿到不一致快照；建议在低峰期或暂停后端后备份。
- 本文档不涉及 schema 迁移；如需改表结构，参考 P5-02 后续迁移方案。
