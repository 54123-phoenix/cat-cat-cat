# 备份与恢复

当前使用 SQLite + uploads，识别另依赖 models 与 reference-store。数据库结构由 Alembic 管理；一致数据库快照通过 Python `sqlite3.Connection.backup` 生成，不能直接复制正在写入的 `.db` 主文件。已通过 WAL 快照、PowerShell 包装脚本、真实 API 附件恢复及完整推理资产的隔离新卷恢复。2026-11-08 新增显式四类资产包与哈希校验、全新目录恢复；工具不会自动停止服务，也没有替实际业务挂载完成生产演练，VER-003 仍须在目标环境验收，见 [C 验收](validation/OPTIMIZATION_C.md)及[完整推理](validation/INFERENCE_20261101.md)。

## 完整资产模式（2026-11-08）

`scripts/asset_bundle.py` 仅使用 Python 标准库；PowerShell 的 `-FullAssets` 模式调用同一实现。四个来源必须显式指定，不读取 `.env`、不猜测数据库，不下载模型或图片。数据库路径必须是 SQLite 文件；uploads、models、reference-store 必须是三个不互相嵌套的现有目录，允许空目录。空目录被完整保存，但不代表模型或参考库已就绪。

执行前停止所有 API/业务写入、上传、审核、附件清理任务及 reference-worker，再传 `-WritersStopped`。这是操作者对停写状态的声明，工具不会代替操作者停止进程；SQLite 快照与其他目录之间不是在线原子事务。工具比对复制前后的源文件哈希与目录清单，发现变化会失败，仍不能以此代替停写窗口。

从项目根目录预演。来源相对路径相对于 `cat-backend`；`-BundlePath` 相对于项目根目录，也可使用绝对路径。目标必须尚不存在，且其父目录必须已存在。备份输出不得与任何来源或数据库的预留 `-wal`、`-shm`、`-journal` 路径重叠，即便这些日志文件尚不存在；例如数据库为 `active.db` 时，不可将输出设为 `active.db-wal` 或其子目录，以免占用 SQLite 后续运行需要的路径。以下命令只展示操作方法，不应在未核对实际来源路径时直接用于业务数据。

```powershell
./scripts/backup.ps1 -FullAssets -Python python `
  -DatabasePath data/cat_community.db -UploadsPath uploads `
  -ModelsPath models -ReferenceStorePath reference-store `
  -BundlePath full-assets-20261108 -DryRun

# 已完成停写后，使用相同参数，将 -DryRun 改为 -WritersStopped。
./scripts/backup.ps1 -FullAssets -Python python `
  -DatabasePath data/cat_community.db -UploadsPath uploads `
  -ModelsPath models -ReferenceStorePath reference-store `
  -BundlePath full-assets-20261108 -WritersStopped

python scripts/asset_bundle.py verify --bundle full-assets-20261108
```

包固定包含 `database/cat_community.db`、`uploads/`、`models/`、`reference-store/` 和 `asset-manifest.json`。清单保留来源路径、UTC 时间、目录、每个文件的大小与 SHA-256；数据库快照包含已提交 WAL 数据，并执行 SQLite 完整性检查。SHA-256 用于发现损坏，不是来源签名或授权证明。跨机器搬运整个目录后应再次执行 `verify`。

完整恢复始终只创建**全新隔离目录**，即使传 `-ConfirmRestore` 也拒绝覆盖现有目录。缺少确认、或传入 `-DryRun` 时默认预演；预演会读取并验证包的全部哈希和数据库，但不创建目录或修改文件。`-BackupPath` 与 `-RestoreDir` 的相对路径相对于项目根目录。

```powershell
./scripts/restore.ps1 -FullAssets -Python python `
  -BackupPath full-assets-20261108 -RestoreDir restore-validation-20261108

# 在停写窗口内明确执行；只落到新的隔离目录，不接管正在运行的服务。
./scripts/restore.ps1 -FullAssets -Python python `
  -BackupPath full-assets-20261108 -RestoreDir restore-validation-20261108 `
  -ConfirmRestore -WritersStopped
```

不用 PowerShell 时的等价接口：

```text
python scripts/asset_bundle.py backup --database <文件> --uploads <目录> --models <目录> --reference-store <目录> --output <全新目录> --dry-run
python scripts/asset_bundle.py backup --database <文件> --uploads <目录> --models <目录> --reference-store <目录> --output <全新目录> --writers-stopped
python scripts/asset_bundle.py restore --bundle <包目录> --destination <全新目录>
python scripts/asset_bundle.py restore --bundle <包目录> --destination <全新目录> --confirm-restore --writers-stopped
```

直接调用 Python 时，相对路径都相对于当前工作目录。源目录、包目录、目标父目录中的符号链接、Windows junction/reparse point 均拒绝；清单中的绝对路径、`..`、路径碰撞、遗漏/额外文件及哈希不符均拒绝。恢复先验证整个包，再创建目标，不修改已有业务数据；新操作中途因 I/O 或来源变化失败时可能留下 `.bundle-incomplete` 标记目录，不可使用、恢复或配置启用，应排查后换一个全新目录重试。完整包不能通过旧模式恢复，避免只恢复照片而漏掉数据库和模型。

成功恢复证明字节与数据库完整性。随后仍需在隔离服务核对实际 schema、用户/猫/偶遇数量、附件 HTTP、模型与参考库兼容、识别结果，并在目标硬件记录恢复耗时；工具不执行迁移、不切换业务配置、不证明模型准确率。确认后再按运维方案启用新目录。原业务路径、完整包及回退配置在验收前保留。

定向回归：`python -m pytest cat-backend/tests/test_asset_bundle.py cat-backend/tests/test_sqlite_backup.py -q`。所有数据库、图片、模型与 store 均为临时夹具，覆盖自定义路径往返、空目录、WAL、预演无写入、坏包/链接/越界拒绝、来源中途变化及新旧 PowerShell 模式；不涉及业务资产。

## 原有数据库与附件模式

不传 `-FullAssets` 时保留原合同，仅处理数据库和默认 uploads，不是完整识别资产包。下面的路径、备份与原位恢复说明均针对该模式。

### 数据路径

- Compose：宿主机 `cat-backend/data/cat_community.db`，容器 `/app/data/cat_community.db`。
- 原有本地开发默认：`cat-backend/cat_community.db`。以实际 `DATABASE_URL` 为准。
- 脚本自动检测上述两个位置，同时存在时拒绝猜测，必须传 `-DatabasePath`。相对路径相对于 `cat-backend`，绝对路径按原值使用。
- 附件：`cat-backend/uploads/`。自定义 `UPLOAD_DIR` 时需要另行备份该目录，当前脚本不会读取任意 `.env` 路径。
- 识别资产：保留模型和托管 `REFERENCE_STORE`（Compose 宿主机默认 `cat-backend/reference-store`），包括 store.json、current.json、versions 和 jobs。原模式不复制 store 或模型；需要完整识别资产时使用上述 `-FullAssets` 模式。恢复时使用独立目录，连同数据库/照片核对后再配置启用，禁止把旧 current.json 直接覆盖到运行中的 store。B2/B3 会拒绝数据库身份、计数、模型或照片不匹配的版本；任意旧向量文件不能直接恢复识别。

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

当前 head 为 `k20261108`，在 `j20261031` 之后新增偶遇请求标识、摘要与用户级唯一索引，旧记录保持原样。此前 C 复验恢复了用户名、openid、校园 slug 和邀请码唯一约束。有重复记录时迁移拒绝，不删除/合并原记录；须另行审核身份和关联数据后处理。升级前停写、备份；不要通过跳过修订或撤掉约束强行启动。

## 可重复的隔离测试

在后端测试环境中运行 `python -m pytest tests/test_sqlite_backup.py tests/test_migrations.py -q`。PowerShell 脚本测试复制脚本到临时项目，不恢复真实工作区数据库。无 PowerShell 的平台会跳过包装脚本测试，SQLite 测试仍执行。

从仓库根目录运行 `python scripts/verify_sqlite_recovery.py`，可复跑实际 HTTP、旧库升级、重启、附件损坏后恢复及哈希/解码核对。该脚本需要 PowerShell 与后端依赖，只创建临时项目，结果默认输出到 `artifacts/optimization-c-sqlite`。全程不接收真实业务库作为输入。

## 完整推理资产的隔离恢复验收（2026-11-01）

完整 CPU inference 镜像已在停止 API/构建 worker 后，将数据库、uploads、models、reference-store 一起复制并恢复到全新命名卷；身份、发布指针、各资产哈希和真实识别结果一致。另验证了资产损坏时拒绝识别，见 [推理验收](validation/INFERENCE_20261101.md)。

复跑：先执行 `python scripts/inference_assets.py --output-dir artifacts/inference-models`，再执行 `python scripts/verify_docker_runtime.py --models-dir artifacts/inference-models`。脚本只创建测试项目，不能传入生产数据作为恢复目标。上述结果不改变原模式只自动备份数据库与默认 uploads 的边界；新的 `-FullAssets` 模式可在统一停写窗口将四类资产一起备份并校验，实际业务挂载仍须单独完成恢复验收。
