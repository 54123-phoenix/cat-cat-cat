# ISS-038：多进程启动的 SQLite WAL 锁竞争

日期：2026-11-01。生产基线 `1636f5b`。

## 复现与修复

[CI 运行 41288336214](https://github.com/54123-phoenix/cat-cat-cat/actions/runs/41288336214) 中，Redis 任务的四个 API 同时启动，一个进程在 `app/database.py` 执行 `PRAGMA journal_mode=WAL` 时立即抛出 `sqlite3.OperationalError: database is locked`，应用启动失败。失败发生在任何 Redis 功能断言之前。见 [进程日志](sqlite-startup-ci-before.log)。这是一项生产连接初始化缺陷，重跑成功不能将其关闭。

连接初始化现在先读取已有 journal mode；文件库尚未启用 WAL 时，针对 `SQLITE_BUSY` / `SQLITE_LOCKED` 在最多 5 秒内重试模式切换。此阶段临时禁用 SQLite 内置 busy handler，避免两层等待叠加；成功后恢复 5 秒业务 busy_timeout 并开启外键检查。已是 WAL 或内存库时保持相应模式。只读、权限、损坏等其它错误立即传播，不重放业务写入，不无限重启进程。

## 验证

- **旧代码确定性复现：** 使用真实 SQLite 文件、一个持有读事务的连接和一个初始化连接；在同一新回归中替换为 Git 中的旧函数，得到 `database is locked`，1 项失败。见 [旧实现日志](sqlite-startup-local-before.log)。
- **修复后定向验证：** 三项通过。释放真实读锁后连接成功且外键实际拒绝非法记录；持续持锁在配置的截止时间内失败；只读数据库错误立即传播。见 [日志](sqlite-startup-focused.log)。
- **真实 Redis 与四 API：** Windows + WSL Redis 7.4.2 十项通过，只有一个 admin 和一个校园；见 [结果](sqlite-startup-redis.json)。
- **后端全量：243 passed、68 warnings、199.29 秒**，保留 CI 的不同管理员密码配置和全部弃用警告。见 [日志](sqlite-startup-backend.log)。
- 修复后的远端复验完成后补充结果。

Docker API 阶段此前已实际通过七组；由于本次改动涉及连接初始化，后续远端还会再次运行容器验收，见 [Docker 记录](DOCKER_ACCEPTANCE_20261101.md)。测试只使用临时数据库，未修改业务库，也未新增迁移。

长期写入压力、超过等待预算的锁争用和生产宿主机 I/O 条件仍属于容量与部署验证；本次不能证明 SQLite 适合任意并发规模。
