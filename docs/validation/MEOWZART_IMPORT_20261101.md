# 已有照片更新与参考库验证

2026-11-01。用户要求将上次已获取的照片更新到项目，此后不再获取新图片。本项沿用参考库管理与 P5-01 的工程验证范围，不开展训练或校园准确率验收。

## 范围与结果

输入是[已归档的 94 张照片](https://github.com/54123-phoenix/cat-cat-cat/releases/tag/meowzart-catalog-20261101)，共 49,474,548 字节，分别属于 94 个不同原站 petId。727 条目录中未下载图片的其他档案没有导入。没有再次访问原站或下载图片、模型、Docker 镜像。

当前主检出目录没有已配置的业务数据库，因此在 `cat-backend/data/cat_community.db` 初始化 Alembic `j20261031`，导入 94 个档案和头像。原站名字原样保存；没有给历史同名向量推定身份，也没有填写猜测的性别、年龄、绝育、地点或性格。

- 92 张非拼图登记为 `CatImage`，用于照片墙与识别参考构建。
- 豆腐（10097）、豆花（10098）两张拼图只设为档案头像，没有登记参考图。
- 94 张图通过大小、SHA256、格式、尺寸、单帧和完整解码检查。逐图决策绑定到目录/图片清单哈希，见[审核清单](meowzart-image-review-20261101.json)。审核范围是既有缩略图初筛，不是独立个体身份或拍摄场次认证。
- 第一次正式导入新增 94 个档案、92 个参考图；第二次执行新增均为 0，数据库 generation 保持 186。
- 使用同盘硬链接复用 94 张图片和两份模型，不另复制约 47 MiB 图片与约 377 MiB 权重。新数据库、备份、回执和向量单独保存。

参考构建与 HTTP 验证均已通过，完整计数、来源绑定和版本标识见[机器记录](meowzart-import-20261101.json)。默认 `center224`、确认阈值 0.57、待确认阈值 0.49、分差 0 保持原值。

| 检查 | 实际结果 |
|---|---|
| 离线导入定向测试 | 19 passed，无失败、无跳过 |
| 数据库 | integrity_check 为 ok，外键问题 0，94 个档案/92 个参考图/generation 186 |
| 真实模型参考构建 | 92/92，256 维向量；已发布，状态 compatible，pending_changes=false |
| 构建开销 | 280.294 秒；Linux 进程峰值 RSS 1559.21 MiB，不包含 Docker Desktop/主机开销 |
| 资源约束与模型 | 现有镜像，2 CPU / 4 GiB 上限，构建容器无网络；两份权重 SHA256 前后一致 |
| HTTP 图库与文件 | 94 个头像全部 200、SHA256 与解码通过；94 个详情与图片归属一致，照片墙 92 张 |
| HTTP 真实识别 | 3/3 自身参考照返回正确档案；仅验证工程链路，不是独立准确率 |
| Quick harness | 3/3 通过，100 分；API 契约、安全与文档检查 |

发布版本为 `16e456d912124df3bf5e869af8aba11c`，数据库身份为 `b5449d89908848a0b7be5388c125d9c2`。只用于此次本机数据库，不可将该版本直接套用到另一份独立数据库。验证结束已停止两次临时推理容器，不常驻占用个人电脑资源。

## 离线导入与重复执行

入口是 `cat-backend/scripts/import_meowzart_archive.py`。工具只读取本机归档；显式指定数据库和上传目录，默认仅预览，加 `--apply` 才写入。不运行旧的 `scripts/import_cats_from_meowzart.py`，后者生成的是演示档案字段。

在仓库根目录、已安装后端依赖的 Python 环境中运行：

```powershell
python cat-backend/scripts/import_meowzart_archive.py --archive artifacts/meowzart/archive-20261101 --review docs/validation/meowzart-image-review-20261101.json --database cat-backend/data/cat_community.db --uploads cat-backend/uploads
# 检查预览，确认目标目录后执行同一命令并追加 --apply。
# 跨磁盘不能硬链接时显式使用 --storage copy；默认 hardlink。
```

新机器需要先取得已有 Release 归档并校验/解压，不需要再次采集原站。若使用其他路径，以实际解压目录替换 `--archive`。数据库必须先按[参考库说明](../REFERENCE_LIBRARY.md)迁移；工具不会隐式创建另一份空业务库。本轮本机后端 `.env` 已指向上述数据目录、上传目录和托管参考目录，密钥仅保存在本机忽略文件中。

工具以 `UUIDv5(NAMESPACE_URL, meowzart:society:1:pet:<原站ID>)` 生成稳定 `reference_id`。同名但不同来源 ID 的猫保留独立档案；已有同名且没有这项绑定的记录不会被自动合并。数字 API ID 不从来源 ID 猜测。回执逐张记录原站 ID/名字/URL、应用 ID、不可变身份、文件哈希和用途。

先检查整批输入与现有文件/归属，再持有 SQLite 写锁、生成包含 WAL 的一致备份，事务内写入。已有档案的名字、头像及人工编辑字段保留，已有相同路径/内容复用，不同内容或归属冲突时拒绝写入。默认图片复用是硬链接，之后应按不可变文件对待：新图使用新文件名，不直接覆写共享字节。

## 保存与回退

本地运行数据不提交 Git：

| 内容 | 项目内位置 |
|---|---|
| 业务数据库 | `cat-backend/data/cat_community.db` |
| 94 张可访问头像 | `cat-backend/uploads/cats/meowzart/` |
| 原站到应用的绑定、执行回执 | `cat-backend/data/imports/<run_id>/receipt.json` |
| 写入前的 SQLite 备份与计划 | 同一执行目录的 `before.db`、`plan.json` |
| 已有模型硬链接 | `cat-backend/models/` |
| 参考版本、发布指针和任务日志 | `cat-backend/reference-store/` |

如果数据库写入失败，整批数据库变更与 generation 回滚；已写入但未引用的文件保留，重跑时复用，不自动删除素材。已提交但回执写入失败会明确报错，可重跑恢复回执，不重复建档。需要回退已完成更新时，先停止本项目 API/worker 并按[备份恢复流程](../BACKUP_RECOVERY.md)恢复 `before.db`，保留所有素材和证据；参考版本必须重新验证与数据库是否匹配，不能只拷回数据库便声称识别已恢复。

原照片继续保存在已验证的 GitHub Release，Git 仅加入代码、审核清单和统计证据，不把图片或含账户的业务库塞入历史。上轮本地归档清理遭自动审批拒绝，本轮没有重试删除该目录；现有约 96.5 MiB 原图/ZIP 存档仍在，通过硬链接复用未再复制一套。

## 验收与后续

定向测试覆盖只读预览、同名不同 ID、重复导入与人工编辑保护、硬链接/复制、坏哈希、路径越界、物种冲突、审核清单绑定、拼图排除、文件/照片归属冲突以及中途失败的数据库回滚。真实照片另做全量 HTTP 文件哈希与档案关联核对，参考库使用现有 YOLOv8m + DINOv3 权重构建。可在后端目录复跑 `python -m pytest tests/test_meowzart_import.py -q`；本轮没有改动线上 API 合同或数据库结构，也没有重复运行全部前端/后端回归。

本批完成后停止新图片采集，暂不重训。92 张参考图分别属于 92 个来源档案，每猫只有一张，不能据此证明跨角度、跨光照或未知猫识别效果。自身照片命中只验证导入与推理链路；校园准确率与历史备份缺口继续保持未验收，不将这批图兼作独立留出集。
