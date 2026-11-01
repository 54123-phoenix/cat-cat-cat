# Docker 独立验收

日期：2026-11-01。前置 CI 的两条失败已修复，见 [CI 复验](CI_REPAIR_20261101.md)。

## Windows Desktop 阻塞

本机 Docker Desktop 4.92.0 仍无法启动。对照 [上游问题 15064](https://github.com/docker/for-win/issues/15064)，确认进程停止、运行目录为普通目录且只含残留 socket 后，将 `%LOCALAPPDATA%/Docker/run` 完整保留为 `run.cat-acceptance-preserved-20261101-161317`，创建空替代目录。经 CLI 和直接启动两种方式均失败，最新错误为：

```text
initializing Ingest server ... sailor-ingest.sock:
mkdir ...\Docker\run: Cannot create a file when that file already exists.
(listener: The system cannot find the path specified.)
```

Shell 与 Desktop 对该路径的可见性/属性异常，尚未确定宿主机根因。正常停止命令超时后终止了本轮启动且处于失败状态的 Desktop 进程；引擎始终没有就绪。旧运行目录保留，未重置 Docker、删除镜像/容器/卷或安装更新。该上游报告提供排查思路，不作为本机已修复的证据。

## 隔离脚本与 Linux CI

新增 `scripts/verify_docker_runtime.py` 与独立 `docker-runtime` job。脚本读取仓库 Compose 配置并保留服务命令、依赖和网络关系，只为验收替换镜像阶段、测试凭据、挂载与端口：

- 构建后端 `api` 阶段和 Web/nginx 镜像；模型目录为空。
- 每次生成独立项目名、全新命名卷和回环动态端口；Redis 不暴露宿主机端口，不使用仓库业务挂载。
- 检查空库迁移、Gunicorn 四 worker、Redis、nginx/API/图片链路、真实 HTTP 写入经 Redis/nginx 推送 SSE。
- 启动真实 reference-worker，确认缺模型任务记录 `model_unavailable` 且不发布假版本。
- 验证容器重启后记录、图片和任务日志持久；停掉两个写入服务后复制数据库/附件/store，恢复到第二个全新项目与卷，核对完整性、外键、身份、计数和图片哈希。
- 最后仅清理本轮两个独立项目及其卷；原始备份和命令日志留在 CI artifact。

本地已通过 `--prepare-only` 配置解析与 Python 编译检查；首次准备脚本错误假定关闭的 postgres profile 仍在解析结果中，已改为允许缺省。

## 真实容器结果

提交 `1636f5b` 的 [运行 41288336214](https://github.com/54123-phoenix/cat-cat-cat/actions/runs/41288336214) 中，`docker-runtime` **7 组全部通过**。Linux/amd64、Docker Engine 28.0.4，Gunicorn worker PID 为 8、9、10、11。源卷与新恢复卷均为迁移 `j20261031`，用户/猫/照片/帖子各 1 条；database_id、generation=2、图片 SHA256 及 reference-worker 失败日志一致。见 [首次完整结果](docker-api-first.json)。

同一次运行的 Redis 独立任务在 API 启动阶段暴露 SQLite WAL 锁竞争，因此整个工作流失败，不能把 Docker job 成功写成整套 CI 成功。后续生产连接修复及全量复验见 [SQLite 启动记录](SQLITE_STARTUP_20261101.md)。

WAL 修复提交 `ec8ad5a` 的 [运行 41288904972](https://github.com/54123-phoenix/cat-cat-cat/actions/runs/41288904972) 中，Docker 七组再次全部通过，且同次工作流六个任务全部成功。见 [最终容器结果](docker-api-final.json) 与 [任务汇总](ci-docker-final.json)。该结果只关闭本文件列出的 API 阶段容器范围。

复跑：`python scripts/verify_docker_runtime.py --output-dir artifacts/docker-rerun`。需要 Linux Docker 引擎与 Compose，宿主机 Python 依赖 `httpx==0.27.0` 和 Pillow。`--prepare-only` 不连接引擎。

此脚本不会验证完整 inference 镜像、模型推理质量、有已发布向量版本的 store 恢复、生产宿主机挂载或容量。Windows 业务运维 PowerShell 备份/恢复脚本的实测继续参见 [C](OPTIMIZATION_C.md)；这里的容器快照演练不替代生产停写与备份方案。
