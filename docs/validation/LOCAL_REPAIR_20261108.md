# 本地修复与隔离验收（2026-11-08）

本轮按用户授权补齐本地实现和可重复验证；微信真机、目标服务器及真实校园资料由用户后续提供。**未部署、未迁移业务数据库、未运行真实校园评测、未切换识别默认策略，也不据此确认发布通过。** 历史实验和失败证据保留。

## 本轮实现

| 范围 | 入口与行为 | 验收边界 |
|---|---|---|
| 明确提交偶遇 | `cat-frontend/src/pages/Scan.tsx`、`cat-miniprogram/src/pages/scan/index.tsx`：识别命中或选择候选后仍需用户提交；成功前不显示已保存，失败可重试 | 本地 Web 浏览器与小程序隔离合同；手机拍照/正式微信网络待验 |
| 幂等与上传清理 | `cat-backend/app/services/sighting_submission.py`：UUID `client_request_id` 按用户隔离，内容哈希校验；相同请求返回原记录，改内容复用键返回 409；记录与一次 XP 同事务，失败安全清理新建且无引用附件 | 保留不传键的旧客户端合同，但旧路径不承诺重试幂等；不自动修复历史重复记录 |
| 地图和相似度文案 | 小程序地图分有数据、空态、部分失败、全失败并支持重试，不生成伪猫点位；两端明确相似度不是识别正确概率 | 真实坐标、定位、地图 SDK 与设备显示另验 |
| 完整资产备份 | `scripts/asset_bundle.py`、`backup.ps1`/`restore.ps1 -FullAssets`：数据库、自定义 uploads、models、reference-store、清单及 SHA-256；恢复默认预演，只落新目录 | 必须显式声明已停业务写入和 reference-worker；工具不会停止进程，不提供在线跨资源原子事务。命令见[备份说明](../BACKUP_RECOVERY.md) |
| 校园协议门禁 | `prepare_campus_dataset.py freeze`、`campus_protocol.py`、`eval_recognition.py`：绑定准备清单与协议的规范 JSON 哈希、完整实际图库身份/源图、场次、权利依据、最低数量、策略和目标；推理前重验 | 合成夹具仅证明拒绝/执行合同。填写模板和命令见[校园准备](../CAMPUS_DATA_PREPARATION.md)；真实审核资料仍缺 |
| 部署配置 | Compose 取消 Redis 宿主 6379 映射，API/worker 继续走内部 `redis://redis:6379/0` | 本轮只检查配置解析，未运行新容器或验证服务器防火墙 |

迁移 head 为 `k20261108`，入口 `cat-backend/alembic/versions/k20261108_sighting_requests.py`。从 `j20261031` 添加可空回执字段和 `(user_id, client_request_id)` 唯一索引，保留旧记录与原有积分；downgrade 拒绝丢弃回执。本轮只在临时 SQLite 演练；业务升级须先按完整备份流程预演并另行执行，不能把测试迁移当成业务库已更新。

校园入口保持通用评测 `evaluation_scope=general` 与校园 `evaluation_scope=campus` 区分；有校园证据却降为 general 会拒绝。退出码 0 表示执行完整（校园还需经验门槛通过），2 表示无效或不完整，3 表示校园经验目标失败。`release_quality_passed=false` 始终保留，输出文件不可覆盖；本轮没有产生校园准确率结果。

## 本地验证

| 验证 | 本轮结果 | 能证明的范围 |
|---|---|---|
| Web | 87 项通过；typecheck、lint、build 通过 | 组件/API合同与可打包性 |
| 小程序 | 14 项通过；typecheck、build:weapp 通过 | 隔离 JS 合同与微信目标编译，不是设备结果 |
| 偶遇提交与上传 | 49 项定向通过 | 校验、重试、隔离、冲突及附件清理行为 |
| 完整资产工具 | 首轮资产包与 SQLite 共 23 项通过；最后路径保护补齐后资产包 27 项通过 | 新增 6 项覆盖数据库尚不存在的 `-wal` / `-shm` / `-journal` 目标及其子目录，拒绝创建并保持源资产不变；另覆盖自定义目录往返、WAL、预演、损坏/链接/越界及新旧包装模式 |
| 校园准备/评测 | 最新定向 34 项通过 | 冻结证据、畸形输入、禁止 scope 降级、策略校验与失败退出；合成像素不代表识别质量 |
| 旧库迁移补充 | `j20261031 → k20261108` 定向 1 项通过，也已纳入第二次全量回归 | 临时旧库记录、积分与唯一约束保留 |
| 核心真实浏览器 | 最终复跑 8 组通过 | 包括明确提交、服务器已保存而响应丢失后重试、候选保存；真实 multipart HTTP/SQLite/上传，识别响应为测试替身 |
| 参考库浏览器 | 8 组通过，page_errors 为 0 | 360/390/1280 宽度与对比度、管理权限/进度/失败恢复；推理仍用合成替身 |
| 图片资源 | 30 张图片，0 失败 | 资源可解码 |
| Compose | 配置解析通过；Redis 宿主端口 0 | 静态配置，不是新镜像或线上验证 |
| 首次 full harness 的后端回归 | 394 项通过 | 收集后新增的迁移/校园测试另以定向结果记录，不声称这次已包含全部新测试 |
| quick harness | 修正 G0 后 100 分、pass | 快速门禁，不替代完整回归或环境验收 |
| full harness 重跑 | **100 分，6/6 通过；后端 396 项通过，84 条弃用警告** | 已包含新增迁移和校园阈值测试；最后 6 项备份路径用例在收集后补入，由上述 27 项资产包定向回归覆盖，不声称本次全量已包含它们 |

首次 full harness 的 G0 失败：旧字符串合同要求 `Scan.tsx` 出现 `/sightings/share/`，与待审核记录不能直接公开分享的新流程冲突；其他门禁通过。已改为实际执行 Scan 交互和请求行为测试，快速复验通过。该失败和修复原因保留；没有把第一次 full harness 写成全部通过。

第二次 full harness 于 2026-11-08 21:41（本地 UTC+8）完成，六项全部通过。末轮交叉检查另发现备份目标可能占用 SQLite 预留日志路径，已补保护并通过 27 项资产包定向测试。后端 84 条警告来自现有 Pydantic 类式配置和 HTTPX `app` 快捷参数弃用；本轮未升级依赖。Web 用例含有刻意触发错误边界的控制台输出，浏览器验收无页面异常。

本机原始证据保存在 Git 忽略的 `artifacts/repair-20261108/`：首次 `full-harness-first.json/.md`、重跑 `full-harness-final.json/.md/.log`、核心浏览器 `browser-final/result.json`、参考库浏览器 `reference-browser/result.json`。本报告保留摘要；这些本机原始文件不会随普通 Git 检出带出。

本轮状态更新为 **45 项：32 本地通过、9 待专项、3 部分完成、1 未解决**，另有 7 个 VER 专项；新增 ISS-044 地图伪点位、ISS-045 提交时机和重试重复。两项代码已有修复，本地通过但真机尚待验收，保留为专项待验。照片备份截断 ISS-043、校园身份/场次、正式微信、生产恢复、容量、地图/LLM 和许可仍按原条件跟踪。

复验入口：先在独立 PowerShell 终端激活项目测试环境，并执行[发布清单的隔离环境设置](../RELEASE_CHECKLIST.md#自动检查)，再在仓库根目录运行：

```powershell
python -m pytest cat-backend/tests -q
python scripts/verify_browser.py --output-dir artifacts/browser-local-20261108
python scripts/verify_reference_browser.py --output-dir artifacts/reference-browser-local-20261108
powershell -NoProfile -File harness/run.ps1 -Mode full -ContinueOnFailure
```

脚本均应使用已安装的测试环境；浏览器脚本创建自己的临时数据库和凭据。只有执行并保存对应回执后才更新结果，不能以本文命令列表当作已执行证据。后续环境准备及发布条件见[发布清单](../RELEASE_CHECKLIST.md)。
