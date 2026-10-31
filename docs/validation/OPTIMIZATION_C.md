# 优化 C：Redis 多进程与 SQLite 恢复

日期：2026-10-31。此轮完成本机真实 Redis / SQLite / HTTP 验收；Docker Desktop 启动失败，容器验收未完成。没有提交、推送、部署或修改真实业务数据库。此前 B4 的证据和指纹保留。

## 复现与修复

1. **ISS-036：迁移丢失唯一约束、并发初始化重复账号。** 实际 Redis 加四个独立 API 进程的空库启动产生了两个 `admin`；`PRAGMA index_list(users)` 显示 `ix_users_username` 的 unique 为 0。根因是此前修复中的冻结 schema 采纳工具只按列创建索引，丢失 UNIQUE 信息；原迁移测试只核对表和列。新增 `j20261031`，恢复用户名、openid、校园 slug、邀请码四个唯一索引。先检查全部重复记录，再在 savepoint 内替换索引；重复数据导致明确失败，记录和旧修订号保持不变，不猜测账号合并规则。启动只读检查补充唯一索引。初始账号/校园创建能处理其它进程先提交的自然键冲突，保留既有密码，不吞掉其它约束错误。另移除重复的 demo 初始化入口，缺 demo 密码时真正跳过。
2. **ISS-037：Redis 中断后已撤回的热力图点位重新出现。** 测试先通过审核并预热热力图，再切断客户端到 Redis 的代理，撤回审核后恢复连接；旧缓存重新返回 total=1。Redis 服务和数据始终保留，故障不是清空缓存。现在热力图每次按数据库当前审核状态查询，不依赖广播或缓存失效；旧缓存无法重新公开已撤回点位。代价是增加数据库读请求，容量另行验证。
3. **SSE 故障边界。** Redis 连接/命令设置 2 秒超时，订阅在 HTTP 200 前确认，失败返回 503 + Retry-After。已建立的流在 Redis 断连时正常结束，发布失败写日志；注销在取消屏蔽区内执行，响应头发送失败也能清理订阅。关闭流程限制未完成发布的等待时间。撤销 token 后最迟下一次心跳检查终止活动流，重新连接返回 401。
4. **运行和恢复准备。** Compose 等待 Redis 健康检查，SQLite 后端不再强制启动无用途的 PostgreSQL；PostgreSQL 设为显式 profile。Docker 上下文排除数据库、附件、模型、参考库、测试、环境文件和日志。镜像增加 `api` 阶段方便无模型环境验收，默认仍是 `inference`。SQLite backup helper 明确关闭连接；新增数据库与附件恢复脚本，使用真实 API 创建记录和 JPEG，整个备份/恢复窗口停掉测试 API。

复现证据：[重复账号结果](optimization-c-redis-before.json)、[修复启动后复现热力图失败](optimization-c-heatmap-before.json)。更早的 Redis 启动失败是测试运行时放在 WSL 临时目录后丢失，未执行功能断言；源码重新构建到 WSL 用户目录后完成测试。首次恢复脚本的手写旧猫夹具未提供 created_at，API 返回 500；补齐明确的夹具时间并关闭 SQLite 连接后重跑，没有在业务迁移中编造历史时间。

## 验证证据

环境：Windows、Python 3.11.9、Redis 7.4.2（Ubuntu WSL 内官方源码编译）、四个独立 Uvicorn 进程，数量与配置中的四个 Gunicorn worker 一致。Redis 通过 Windows 回环 TCP 代理注入中断；HTTP、Redis、SQLite 和文件均实际运行，未使用 Redis 模拟实现。未运行 Linux Gunicorn 容器或真实模型推理。

| 检查 | 结果及边界 |
|---|---|
| Redis / 多进程 | 10 项通过；[最终结果](optimization-c-redis.json)，四个 PID 及唯一索引信息可核对 |
| 数据库 / 附件恢复 | 4 组通过；[结果](optimization-c-sqlite.json)。e20261030 升级到 j20261031，恢复前后 2 用户、2 猫、1 图片、1 偶遇、1 帖子、2 审计；database_id、generation、JPEG SHA256 一致，完整性与外键检查通过 |
| 关联回归 | 16 passed，24 warnings；[日志](optimization-c-focused.log)，包含响应头前断连、订阅失败、活动流撤销和公开审核状态 |
| 后端全量回归 | **238 passed，66 warnings，226.02 秒**；[日志](optimization-c-backend-final.log)。覆盖新唯一约束、四线程确定性交错、旧库重复记录拒绝及改正后升级、原参考库多进程故障测试 |
| Compose / Python | Compose 配置解析、默认服务清单、compileall、git diff --check 通过；[配置清单](optimization-c-compose.log) |
| Docker 镜像 / 容器 | 未运行，见下方宿主机阻塞；配置解析不等于镜像构建或容器验收 |
| Web / 小程序 | 此轮未修改或重跑；不把 B4 结果记作本轮复验 |

Redis 十项依次覆盖：四进程初始化、共享缓存读写/失效、异步路由广播、同步路由广播、客户端断开释放订阅、审核撤回在恢复后仍生效、token 撤销终止与拒绝重连、离线新连接 503、丢失事件后重新查询数据库状态、Redis 恢复后订阅新事件。在线广播在两个独立进程各收到一个指定事件；断连后 `PUBSUB NUMSUB` 回到 0。离线写帖仍落库，发布错误可观察，重连后的查询能取回该帖子。它不证明离线消息重放，Web `onopen` 目前也不会自动刷新全部页面数据。

恢复四组覆盖：迁移和进程重启持久性、仅预演不修改、恢复与恢复前副本、恢复后的真实 HTTP/图片解码。附件额外文件按原脚本合同保留。测试数据完全合成，未拷贝真实用户数据；未验证模型/store 整体恢复，未验证 Docker 挂载卷或多机文件系统。独立 WAL 在线快照测试仍在后端套件中。

第一次全量运行的旧测试仍要求“消费生成器时才订阅”，因新的 503 合同而失败（236 passed / 1 failed）；已更新断言，并增加响应头尚未成功发送时的清理测试。最终全量单独重跑，失败日志 [保留](optimization-c-backend.log)。未关闭警告规则来改变结果。

## Docker 阻塞与剩余验收

Docker CLI 29.8.0，Desktop 4.92.0，context `desktop-linux`。启动及一次完整停止/重启后都在初始化 Ingest server 时失败；[诊断记录](optimization-c-docker.json)：

```text
sailor-ingest.sock: AF_UNIX listen ... bind:
Only one usage of each socket address (protocol/network address/port) is normally permitted.
(listener: The system cannot find the file specified.)
```

`docker info` 无法连接 `dockerDesktopLinuxEngine` 管道，Desktop 已停止。未执行恢复出厂设置、删除 Docker 数据或安装更新。下一次容器验收需先修复此宿主机条件，再使用独立项目名、临时挂载目录/卷和端口验证空库启动、四 worker、reference-worker、重启持久性和恢复；不要直接对仓库默认业务挂载执行演练。先测 `api` 阶段只证明 API 能力，仍须另测完整 inference 镜像及授权模型。

Redis 的本机后端范围已通过，部署网络、真实浏览器重连后的状态同步和容量仍需验证。Pub/Sub 不保留离线事件；普通排行榜缓存仍允许 TTL 范围内陈旧。模型、微信、地图、LLM、资源许可专项保持原状。

## 复跑、升级与回退

在已有后端依赖的 Python 3.11 环境中，从仓库根目录运行：

```powershell
python scripts/verify_redis_runtime.py --wsl Ubuntu --redis-server /home/phoenix_fdu/cat-c-redis-runtime/redis-7.4.2/src/redis-server --output-dir artifacts/redis-rerun
python scripts/verify_sqlite_recovery.py --output-dir artifacts/sqlite-rerun
```

原生 Linux Redis 可省略 `--wsl`，指定 `--redis-server redis-server`。每次 Redis 验收自行启动临时端口的实例，验证其 run_id 后才停止，不清空其它 Redis。恢复脚本需要 PowerShell，复制项目运维脚本到临时目录执行，不接受业务数据库参数。Redis 已接入独立 CI job；远端未运行。完整输出在对应 artifacts 目录，关键结果复制到此目录。

真实数据库升级须先停写并备份，再以正确 DATABASE_URL 执行 Alembic；j20261031 不删除或合并重复身份。若报重复，保留原库和失败证据，单独审核业务归属后处理。该迁移拒绝降级删除唯一约束；回退需使用匹配的数据库备份和代码，不撤掉约束恢复重复账号行为。

台账新增 ISS-036/037，ISS-019 在本机真实 Redis 范围通过：25 项本地通过、9 项待专项、3 项部分完成；7 个 VER 项继续分范围跟踪。源码及关键证据指纹见 [SHA256 清单](optimization-c-files.sha256)。
