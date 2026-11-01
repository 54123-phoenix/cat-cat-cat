# 备份与恢复

当前使用 SQLite + uploads，识别另依赖 models 与 reference-store。数据库结构由 Alembic 管理；一致数据库快照通过 Python `sqlite3.Connection.backup` 生成，不能直接复制正在写入的 `.db` 主文件。已通过 WAL 快照、PowerShell 包装脚本、真实 API 附件恢复及完整推理资产的隔离新卷恢复；实际业务挂载与生产备份流程仍待 VER-003，见 [C 验收](validation/OPTIMIZATION_C.md)及[完整推理](validation/INFERENCE_20261101.md)。

## 数据路径

- Compose：宿主机 `cat-backend/data/cat_community.db`，容器 `/app/data/cat_community.db`。
- 原有本地开发默认：`cat-backend/cat_community.db`。以实际 `DATABASE_URL` 为准。
- 脚本自动检测上述两个位置，同时存在时拒绝猜测，必须传 `-DatabasePath`。相对路径相对于 `cat-backend`，绝对路径按原值使用。
- 附件：`cat-backend/uploads/`。自定义 `UPLOAD_DIR` 时需要另行备份该目录，当前脚本不会读取任意 `.env` 路径。
- 识别资产：保留模型和托管 `REFERENCE_STORE`（Compose 宿主机默认 `cat-backend/reference-store`），包括 store.json、current.json、versions 和 jobs。原有脚本不复制 store 或模型；须在统一停写、停止构建窗口另行备份。恢复时使用独立目录，连同数据库/照片核对后再配置启用，禁止把旧 current.json 直接覆盖到运行中的 store。B2/B3 会拒绝数据库身份、计数、模型或照片不匹配的版本；任意旧向量文件不能直接恢复识别。

## 备份

在项目根目录运行。`-Python` 选择包含标准库 sqlite3 的 Python 3。

```powershell
./scripts/backup.ps1 -DatabasePath data/cat_community.db -Python python -DryRun
./scripts/backup.ps1 -DatabasePath data/cat_community.db -Python python
```

快照输出到 `backups/<时间戳>/cat_community.db`，同时保存源路径清单和默认 uploads 副本。`-BackupDir` 可选择目标目录；`-SkipUploads` 只备份数据库。数据库快照包含已提交 WAL 数据，并执行 `PRAGMA integrity_check`。

数据库、附件和参考库并非一个原子事务：需要可部署的一致备份时，暂停业务写入、上传、审核、附件清理和 reference-worker，完成数据库/附件/store/模型快照后再恢复服务。上述脚本只自动处理数据库与默认 uploads，不应把脚本成功误认为完整识别资产备份已经完成。

## 恢复与迁移

先在隔离副本演练。正式恢复需停掉所有应用 worker 和写入任务，确认目标库及附件路径。

```powershell
./scripts/restore.ps1 -BackupPath backups/<时间戳> -DatabasePath data/cat_community.db -Python python -DryRun
./scripts/restore.ps1 -BackupPath backups/<时间戳> -DatabasePath data/cat_community.db -Python python -ConfirmRestore
```

未提供 `-ConfirmRestore` 时仅预演。恢复前自动制作 `backups/pre-restore-<时间戳>/` 快照；数据库通过 SQLite backup API 恢复，保留回滚副本。目标数据库必须位于 `cat-backend` 内；不要把链接目录用作恢复目标。备份目录只能包含一个 `.db`。附件为覆盖复制，额外文件保留，不执行同步删除。

恢复后核对完整性、用户/猫/偶遇/帖子数量以及附件可读性，再按目标代码版本升级：

```powershell
cd cat-backend
python -m alembic upgrade head
```

2026-10-30 修复迁移支持空 SQLite、原有未标记 create_all 数据库，以及 `e20261030` 到当前 head。不会推测历史时间或 user_id，不扣改历史 XP。保留备份作为回滚路径；新奖励流水和归属字段的 downgrade 故意拒绝删除数据。PostgreSQL 和未知历史变种没有通过验收。

当前 head 为 `j20261031`。C 复验发现此前 schema 采纳过程丢失四个唯一索引，新增迁移恢复用户名、openid、校园 slug 和邀请码约束。有重复记录时迁移拒绝，不删除/合并原记录；须另行审核身份和关联数据后处理。升级前停写、备份；不要通过跳过修订或撤掉约束强行启动。

## 可重复的隔离测试

在后端测试环境中运行 `python -m pytest tests/test_sqlite_backup.py tests/test_migrations.py -q`。PowerShell 脚本测试复制脚本到临时项目，不恢复真实工作区数据库。无 PowerShell 的平台会跳过包装脚本测试，SQLite 测试仍执行。

从仓库根目录运行 `python scripts/verify_sqlite_recovery.py`，可复跑实际 HTTP、旧库升级、重启、附件损坏后恢复及哈希/解码核对。该脚本需要 PowerShell 与后端依赖，只创建临时项目，结果默认输出到 `artifacts/optimization-c-sqlite`。全程不接收真实业务库作为输入。

## 完整推理资产的隔离恢复验收（2026-11-01）

完整 CPU inference 镜像已在停止 API/构建 worker 后，将数据库、uploads、models、reference-store 一起复制并恢复到全新命名卷；身份、发布指针、各资产哈希和真实识别结果一致。另验证了资产损坏时拒绝识别，见 [推理验收](validation/INFERENCE_20261101.md)。

复跑：先执行 `python scripts/inference_assets.py --output-dir artifacts/inference-models`，再执行 `python scripts/verify_docker_runtime.py --models-dir artifacts/inference-models`。脚本只创建测试项目，不能传入生产数据作为恢复目标。上述结果不改变 PowerShell 运维脚本只自动备份数据库与默认 uploads 的边界；实际业务模型和 store 仍须在统一停写窗口另行备份与校验。
