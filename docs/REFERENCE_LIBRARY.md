# 参考库构建、发布与恢复

更新：2026-10-31。B1—B4 的身份校验、任务、发布回滚、多进程刷新和管理可见性已有本地控制流验收。真实模型质量仍待 VER-001。证据见 [B1](validation/OPTIMIZATION_B1.md)、[B2/B3](validation/OPTIMIZATION_B23.md)、[B4](validation/OPTIMIZATION_B4.md)。

## 身份和兼容条件

- `reference_catalog.database_id` 标识数据集沿袭关系，迁移生成一次。完整备份/克隆保留身份；复制文件不会自动建立新身份。
- `cats.reference_id` 是不可修改的猫身份，保留数字 ID 的 API。删除后复用数字 ID 或名字不能继承原猫的识别身份。
- `reference_catalog.generation` 是持久递增计数器。SQLite 触发器在增删猫/参考图、修改身份或参考图 ID/归属/路径的同一事务中递增；回滚也回滚计数。改名和字段值未变化的更新不递增。
- `catalog_revision` 是数据库身份、猫映射、所有参考图 ID/路径/内容 SHA256 的摘要。直接覆盖图片不触发 SQL 计数，但内容校验会让旧快照失效。改名不改变摘要，识别读取当前名称。
- 参考照片来自 CatImage，必须是上传根目录内的 `/uploads/...` 文件。所有登记参考图都是必需输入；失败中止构建并记录原因，逐图提取阶段还记录失败照片 ID/路径。修正或显式删除错误记录后重建。

每个版本包含 manifest.json 和 vectors.json。**当前清单为 v2，新增必需的 catalog_generation；B1 v1 清单须重新构建。** 清单包含快照、数据库、目录摘要/计数、模型 SHA256、预处理/检测器版本及 SHA256、维度、猫身份、源图和产物 SHA256、带时区时间。每张图须有一个归属正确、有限、256 维且 L2 归一化的向量。哈希用于一致性检查，不是数字签名，也不证明模型效果。

## 迁移与配置

升级真实数据库前先备份并停写，在后端目录使用正确的 DATABASE_URL 执行 `python -m alembic upgrade head`。当前 head 为 **j20261031**，保留身份与数据，并恢复用户名等四个唯一索引；重复记录会阻止升级，须单独审核处理。只有 SQLite 已验收；迁移拒绝破坏性 downgrade。回退须保留数据库、照片、模型、参考库与代码的兼容组合。

提供来源与许可可核实的 models/finetuned_best.pt、models/yolov8m.pt，安装推理依赖。在 cat-backend/.env 或进程环境中配置 DATABASE_URL、UPLOAD_DIR、REFERENCE_STORE。本地 REFERENCE_STORE 使用绝对路径；HTTP 后端与构建 worker 必须共享同一数据库、上传目录、模型和 store。配置 store 后不回退到 REFERENCE_DIR。

Compose 默认启用容器内 /app/reference-store，映射到宿主机 cat-backend/reference-store；后端和 reference-worker 共用环境与挂载。根 .env 的覆盖值须为共享挂载中的容器路径。只有后端迁移数据库，构建 worker 等待结构就绪。当前只验证 Compose 配置解析，容器运行和持久化待 VER-003。

未配置 REFERENCE_STORE 的本地进程保留独立模式：REFERENCE_DIR 指向 v2 版本目录，空值使用后端 embeddings。该模式没有任务/指针发布，提交任务返回 503。

## 操作命令

以下命令在后端目录运行，继承同一配置。API 与 CLI 提交只写队列，推理由独立 worker 执行。

```bash
# 提交全量重建，成功后自动发布
python scripts/reference_jobs.py enqueue
# 持续执行；另一个终端提交和查询任务
python scripts/reference_jobs.py worker --wait-schema 60
python scripts/reference_jobs.py status
```

只生成候选使用 `enqueue --no-publish`；成功任务返回 snapshot_id，当前指针不变。之后使用 `publish <snapshot_id>` 或 `rollback <snapshot_id>` 入队，均需 worker 执行。发布与回滚执行相同的当前兼容性校验；计数已变化时，即使又改回旧内容，旧版本也被拒绝，应重新构建。

`worker --once` 处理一个任务或仅做恢复核对：成功/无任务退出 0，任务失败退出 1，锁忙退出 2。持续 worker 记录失败后继续等新任务；不自动重试失败输入。修正原因后重新 enqueue 获得新任务 ID。进程终止后 OS 释放锁，下一次 worker/enqueue 在锁内核对遗留状态。

`--no-crop` 是无检测器流水线，仅适用于已裁剪输入及 crop=False 评测，与默认 HTTP 识别不兼容，不能用来绕过线上检测器准备。

独立工具 `python scripts/build_reference_snapshot.py --output embeddings/candidate-01` 只生成新目录，不入托管队列、不发布、不覆盖。托管候选通过 enqueue --no-publish 生成，不手动复制或修改版本。旧 build_reference_db.py 已停用；旧名称导入不建立来源证明，不要给旧向量手写清单。

## 管理 API

管理台新增“识别参考库”栏目，管理员可直接点击“重建并发布”，失败或中断后点击对应任务的重试按钮。审核员只读。档案与照片保存成功不会直接显示为可识别；参考库页面分别展示当前资料数量、尚无参考照片的猫、最近发布版本、待发布变化与当前兼容性。模型缺失不会隐藏档案/版本/任务信息，照片缺失会显示诊断；无法完成对照时待发布状态为“未知”，不会显示没有变化。

页面每 5 秒刷新当前状态和最近 20 个任务；切走栏目或隐藏页面后不继续后台轮询。进度 100% 只表示照片处理完成，仍需等待校验和发布。请求失败时保留上次数据、明确标为待确认并暂停提交；提交响应丢失时先重新查询任务，避免自动重复提交。重试保留原任务的种类、裁剪和是否发布选项，按当前资料计数建立新任务。历史成功不代表该版本当前仍可用。

版本选择、独立候选发布和主动回滚仍使用下列 API 或 CLI；管理页面本轮提供重建及失败任务重试入口，没有新增任意版本切换控件。

| 接口 | 权限与行为 |
|---|---|
| POST /api/admin/reference/jobs | 仅 admin；202 与 queued 任务，不执行推理 |
| GET /api/admin/reference/jobs | admin/reviewer；最近 20 个任务 |
| GET /api/admin/reference/jobs/{job_id} | admin/reviewer；详情 |
| GET /api/admin/reference/status | admin/reviewer；当前兼容性、快照/发布 ID、照片数及最近任务；支持 ?crop=false |

状态响应由明确的 Pydantic schema 描述，保留原有字段并新增 `current_catalog`、`published`、可空的 `pending_changes`、`jobs`、`checked_at` 与分区诊断。`published` 是可核对的版本元信息，并不单独证明模型/向量可用；要结合顶层 status。Web 从 unknown JSON 校验新字段后渲染，格式异常时暂停操作。

请求体：`{}` 默认重建并发布；`{"publish":false}` 仅构建；`{"kind":"rollback","snapshot_id":"32位小写十六进制ID"}` 请求回滚。默认 crop=true；提交者从认证获得，不接受伪造 requested_by。

任务状态为 queued/running/succeeded/failed/interrupted，记录提交者、输入计数/摘要、模型哈希、完成/总图片数、快照/发布 ID、原因码和时间。历史任务成功不代表版本仍兼容，也不代表模型质量达标。compatible 只表示资产与当前输入一致。

并发提交/锁忙返回 409，缺失任务/版本返回 404，未配置 store 或损坏任务日志返回 503，无效请求体返回 422。损坏日志阻止继续排队；状态接口仍提供参考状态并附 job_error，保留损坏文件供排查。

## 发布、读取与恢复

```text
REFERENCE_STORE/
  store.json                 数据库身份绑定
  .writer.lock               OS 锁文件，运行期间禁止删除
  jobs/<job_id>.json          原子更新的持久任务日志
  staging/<job_id>/           未发布构建产物
  versions/<snapshot_id>/    完整、发布后不可修改的版本
  current.json               唯一发布依据
```

同一 store 同时只有一个写入者，可有一个排队任务。锁覆盖构建与发布，不依赖租约过期。完整产物校验后从 staging 提升到 versions，最后以临时文件写入、fsync、原子替换更新 current.json。SQLite BEGIN IMMEDIATE 在最后校验/指针交换期间阻止目录事务写入；推理期间不持有此写锁。

读者核对当前指针、实际加载清单的哈希、数据库计数和文件内容，加载后再检查指针。已验证快照及 FAISS/NumPy 索引在进程内缓存，以短锁替换引用；缓存命中仍完整校验模型、源图与产物哈希。推理结束再核对发布 ID；切换期间可能保守返回 unavailable，客户端可重试。失配不会继续使用旧猫身份，也不误报 unknown。

失败构建不替换当前版本；仍兼容的旧版本才能继续服务。若进程死在指针替换前，遗留任务恢复为 interrupted；若指针已换而成功日志未写，下一次持锁核对根据指针/清单恢复为 succeeded/recovered。恢复确认历史发布是否完成，当前可用性由读取路径另行校验。数据库与文件系统没有跨系统事务，不能只看任务日志推断当前版本。

不依赖 Redis 通知，读者每次请求核对权威指针。当前证据是 **Redis 禁用** 时两个真实 HTTP 进程的行为，不能计作真实 Redis 中断/恢复或其它 Pub/Sub 功能验收。

## 运维限制与回退

- 范围是共享同一本地文件系统的单机部署。多主机、NFS、Windows 网络共享未支持/验收；内存、哈希 I/O、构建耗时及发布期间数据库等待仍需测量。
- Windows 已验证进程终止恢复与原子替换，未做断电/磁盘故障验收，不能把 fsync 等同于所有存储介质的持久性保证。
- 当前不自动清理旧版本、失败 staging、历史日志，也没有取消任务功能。人工清理须停止构建 worker，保留当前版本、回滚候选与诊断证据；运行中禁止删除锁文件或改写版本。
- PowerShell 备份脚本仍只覆盖数据库与默认 uploads。store 与模型须在统一停写/停止构建窗口另行备份；恢复到独立目录后重验兼容性。仅恢复数据库不等于恢复参考库，见 [备份恢复](BACKUP_RECOVERY.md)。
- ISS-028 按“管理员触发全量重建”的本地控制流范围验收；审核或上传不会自动执行长时间推理。真实模型、真实 Redis、Docker 和容量验收仍分别记录，不随该问题关闭而视为通过。
