# 复旦校园猫猫数字档案与社区

<div align="center">

**5 人校园团队项目 · Web / API / 微信小程序 · 修复与验收中**

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)](https://sqlite.org)
[![Taro](https://img.shields.io/badge/Taro-4-1677FF)](https://taro.zone)

校园猫档案、拍照识别、偶遇记录、社区交流与猫协审核。

</div>

## 项目状态

**更新于 2026-11-01：工程门禁通过；新识别候选在留出集降低了误确认，但已知猫正确确认率 77.78% 未达到 80%，质量验收未通过，尚未达到正式发布条件。**

当前台账共 42 项：**32 项本地验收通过、7 项待专项验收、3 项部分完成**，另有 7 个环境/质量/许可专项。详细现象、修复范围和剩余条件见 [已知问题台账](docs/KNOWN_ISSUES.md)；测试数量不用于计算项目完成率。

| 验证范围 | 最近结果 | 证据与限制 |
|---|---|---|
| 后端完整回归 | 最新代码 CI 273 passed，69 warnings | [校准与验收记录](docs/validation/RECOGNITION_CALIBRATION_20261101.md)；本地初版全量 271 项及后续定向检查通过，保留弃用警告 |
| Web 回归 | 78 passed；类型检查、lint、构建通过 | [重连验收](docs/validation/RECONNECT_20261101.md)；包含会话/断线生命周期、迟到响应、草稿和点赞/投票状态同步 |
| 真实浏览器 | B4 管理端 8 组、核心流程 6 组通过 | Chromium；测试数据库，参考库推理使用合成向量 |
| 浏览器断线恢复 | 本机与 Linux CI 各 10 组通过 | [重连验收](docs/validation/RECONNECT_20261101.md)；实际切断 Redis TCP 与浏览器网络，自动补回当前状态并保留输入 |
| 参考库生命周期 | B1—B4 本地通过 | 持久身份、构建任务、独立 worker、原子发布、兼容回滚、管理状态和失败重试；不代表识别质量达标 |
| Redis 多进程 | 本机与远端各 4 个独立 API 进程，10 项通过 | [SSE 复验](docs/validation/SSE_KEEPALIVE_20261101.md)；跨进程广播、缓存、撤销、断线清理与恢复 |
| SQLite 与附件恢复 | 4 组通过 | 旧库升级、重启持久性、备份/预演/恢复、HTTP 与图片哈希/解码核对 |
| 微信小程序 | 构建、类型检查、5 项请求合同通过 | [优化 A](docs/validation/OPTIMIZATION_A.md)；未完成正式登录与真机验收 |
| Docker API 阶段 | Linux CI 与本机 Desktop 均七组通过 | [容器验收](docs/validation/DOCKER_ACCEPTANCE_20261101.md)；镜像、四 worker、SSE、重启和新卷恢复，模型目录为空 |
| 完整 CPU 推理与恢复 | 本机与远端十二组通过 | [完整推理](docs/validation/INFERENCE_20261101.md)；真实权重、两张参考照片自匹配、模型/store 新卷恢复及资产损坏拒绝 |
| 首次公开识别预评测 | 本机与 CI 指标一致，旧默认质量未通过 | [62 张查询](docs/validation/RECOGNITION_PILOT_20261101.md)：已知猫 Top-1 33/36；未知猫误确认 9/18；简单无猫误确认 0/8，不代表校园效果 |
| 保守识别策略留出验收 | 未同时达到预设目标，候选未设为默认 | [校准/留出各 116 张](docs/validation/RECOGNITION_CALIBRATION_20261101.md)：留出未知猫误确认 2/60，已知猫正确确认 28/36（77.78%，低于 80%），狗图误确认 0/20 |
| 识别质量 / 外部服务 | 待专项验收 | 跨场景参考与新留出集、校园数据、微信、地图、外部 LLM 和资源许可仍需各自证据 |

本轮代码的 [常规 CI / 48eb952](https://github.com/54123-phoenix/cat-cat-cat/actions/runs/41301858484) **七个任务全部通过**：后端 273 项（69 条警告）、Web 78 项、小程序、浏览器核心 6 组/参考库 8 组/重连 10 组、真实 Redis 10 项、Docker API 阶段 7 组、完整推理阶段 12 组。[留出质量专项](https://github.com/54123-phoenix/cat-cat-cat/actions/runs/41301860164)完整执行了 116 张查询，但已知猫正确确认率未达标，按预设门槛返回失败；这不是 Docker 或推理运行故障。实验候选保持冻结，业务默认参数未替换。历史 P0—P6 的 completed 标记不等于当前发布验收通过。

## 已实现的功能

- **猫猫档案与社区：** 档案、照片墙、健康记录、关注、帖子、评论、点赞、举报、勋章和个人统计。
- **偶遇与审核：** 登录用户保存偶遇后进入待审状态，审核通过后进入公开列表和热力图；撤回后热力图直接按当前数据库状态查询。分享页同样受公开状态约束。
- **识别四态：** YOLO 检测 → DINOv3 特征 → FAISS 检索，返回 `confirmed`、`uncertain`、`unknown` 或 `unavailable`。缺模型、参考资料不兼容或推理失败时保留手动线索和重试入口；相似度分数不是经过校准的正确概率。
- **参考库管理：** 管理员维护档案和照片后手动发起全量重建，查看待发布变化、任务进度和失败原因，支持重试与兼容回滚。审核员可查看状态；档案保存成功与识别参考发布成功分别显示。
- **角色与运维：** `user` / `reviewer` / `admin` 权限、审计、token 撤销、速率限制、结构化请求日志、健康检查、备份预演与恢复前快照。
- **地图与路线：** 高德地图接入、校园点位、热力图、按偶遇热度推荐路线和路线打卡。真实坐标与定位尚待核验；站名打卡不证明实际到访，热度路线不代表路网最优。
- **猫情报 Agent：** 已实现查询 API、工具调用和数据库/规则回退，真实外部 LLM 尚未验收。课表规划、课间路线规划、辅助审核与学习复盘仍是 [后续任务](tasks/agent_student_schedule_task.md)。

新猫线索支持通过/拒绝和档案关联；独立的新猫合并工作流、发现者勋章、审核后自动重建参考库尚未实现。

## 界面预览

截图来自 2026-10-30 的实际 Web 页面，使用临时库演示数据。地图截图为无 Key、未授权定位时的回退界面；不是模型或地图服务的验收证明。见 [截图来源](showcase/README.md)。

| 首页 | 识猫 | 地图 |
|---|---|---|
| ![首页](showcase/home.png) | ![识猫](showcase/scan.png) | ![地图](showcase/map.png) |

| 社区 | 勋章 |
|---|---|
| ![社区](showcase/community.png) | ![勋章](showcase/badges.png) |

## 技术栈

| 层级 | 主要技术 |
|---|---|
| Web | React 18、TypeScript、Vite 5、React Router 6、Tailwind CSS、TanStack Query、Lucide |
| API / 数据 | Python 3.11、FastAPI、Pydantic、SQLAlchemy、Alembic、SQLite |
| 事件与缓存 | Redis Pub/Sub、SSE、有界内存 TTL 回退；无 Redis 时只适用于单进程事件流 |
| 识别 | PyTorch、YOLOv8m、DINOv3、FAISS |
| 微信小程序 | Taro 4、React、TypeScript、SCSS；17 个页面、5 个 tab |
| 测试与运行 | pytest、Vitest、Testing Library、Playwright、GitHub Actions、Uvicorn / Gunicorn、Docker Compose |

PostgreSQL 仅作为 Compose 的可选 `postgres` profile 保留，当前业务和已验收迁移使用 SQLite，尚未验收 PostgreSQL 迁移。

## 快速启动

### 本地开发

使用 **Python 3.11、Node.js 24、npm 与 Git LFS**。模型不是启动档案、社区和管理功能的前提；缺少模型时识别返回 `unavailable`。

```bash
git clone https://github.com/54123-phoenix/cat-cat-cat.git
cd cat-cat-cat
git lfs pull

cd cat-backend
python -m venv .venv
# macOS / Linux
source .venv/bin/activate
# Windows PowerShell 改用：.\.venv\Scripts\Activate.ps1

python -m pip install -r requirements-dev.txt
cp ../.env.example .env
# 编辑 .env，至少设置自己的 JWT_SECRET、ADMIN_PASSWORD
# 单进程本地开发不设置 REDIS_URL；不用外部 Agent 时设置 AGENT_ENABLED=0
# 默认 DATABASE_URL=sqlite:///./cat_community.db

python -m alembic upgrade head
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

在另一个终端启动 Web：

```bash
cd cat-cat-cat/cat-frontend
cp .env.example .env.local
npm ci
npm run dev
```

Web：[http://localhost:5173](http://localhost:5173)；API 文档：[http://localhost:8000/docs](http://localhost:8000/docs)。Vite 默认代理到本机 8000 端口；自定义目标需向启动进程注入 `VITE_API_TARGET`。

普通用户可注册账号；管理员启动时按 `ADMIN_PASSWORD` 创建。已有管理员密码不会因更改环境变量而被覆盖。演示账号仅在 `INIT_DEMO_USER=1` 且设置 `DEMO_PASSWORD` 时创建。

当前迁移 head 是 **`j20261031`**。应用启动检查结构，不自动迁移；旧库升级前先停写并备份。发现重复用户名、openid、校园 slug 或邀请码时，迁移会拒绝继续，不会自动删除或合并身份。见 [备份与恢复](docs/BACKUP_RECOVERY.md)。

### 启用识别与托管参考库

先核对模型、图片和数据的来源及使用许可，再安装推理依赖和准备资源。在后端虚拟环境中：

```bash
python -m pip install -r requirements-torch.txt huggingface-hub
python scripts/download_model.py
```

将后端 `.env` 中的 `REFERENCE_STORE` 设为独立目录的**绝对路径**，重启 API，再从同一后端目录启动构建 worker：

```bash
python scripts/reference_jobs.py worker --wait-schema 60
```

通过管理页面创建猫档案、上传参考照片，再在“识别参考库”中重建；也可在另一终端执行：

```bash
python scripts/reference_jobs.py enqueue
python scripts/reference_jobs.py status
```

API 和 worker 必须使用相同数据库、照片、模型与 store 配置。旧 `cat_embeddings.json` / FAISS 文件不能自动作为可信身份参考库使用；清单为 v2，旧候选需重建。失败构建不替换当前版本，回滚需通过当前数据库兼容性检查。完整操作见 [参考库说明](docs/REFERENCE_LIBRARY.md)。

### Docker Compose（API 与完整 CPU 推理已完成隔离验收）

需要可用的 Docker 引擎。在仓库根目录配置环境后启动：

```bash
cp .env.example .env
# 设置 JWT_SECRET、ADMIN_PASSWORD；按需配置模型和外部服务
docker compose up -d --build
```

默认启动 frontend、backend、reference-worker、Redis。后端等待 Redis 健康检查，先迁移再启动四个 Gunicorn worker；reference-worker 等待结构就绪。Web 为 [http://localhost](http://localhost)，API 为 [http://localhost:8000](http://localhost:8000)。

| 资源 | 宿主机 | 容器 |
|---|---|---|
| SQLite | `cat-backend/data/cat_community.db` | `/app/data/cat_community.db` |
| 上传图片 | `cat-backend/uploads/` | `/app/uploads/` |
| 模型 | `cat-backend/models/` | `/app/models/` |
| 托管参考库 | `cat-backend/reference-store/` | `/app/reference-store/` |

本地开发默认数据库是 `cat-backend/cat_community.db`，与 Compose 路径不同。数据库、附件、模型和参考库不打进镜像；模型和参考照片需要另行准备。默认构建包含系统图形库、固定关键推理依赖的 CPU inference 阶段，`docker build --target api cat-backend` 可构建不含 Torch 的 API 阶段。

Linux CI 与本机 Docker Desktop 4.97.0 均已用临时命名卷通过 `api` 阶段镜像构建、四 worker、nginx/Redis、容器重启和新卷恢复。本机曾遇到的启动阻塞在用户重新登录、更新后解除；原始根因未能独立确认。完整 CPU `inference` 阶段也已通过本机十二组真实模型与整体恢复验收，见 [推理记录](docs/validation/INFERENCE_20261101.md)；这不等于独立样本识别质量已达标。详见 [容器范围与结果](docs/validation/DOCKER_ACCEPTANCE_20261101.md) 和 [DEPLOY.md](DEPLOY.md)。

## 开发检查与复验

后端测试使用隔离数据库；以下命令在已激活后端虚拟环境的仓库根目录执行：

```bash
python scripts/check_assets.py cat-frontend/public cat-miniprogram/src/assets showcase
python -m pytest cat-backend/tests -q
python scripts/verify_browser.py
python scripts/verify_reference_browser.py
```

浏览器脚本另需安装 `cat-backend/requirements-browser.txt` 和 Playwright Chromium：

```bash
python -m pip install -r cat-backend/requirements-browser.txt
python -m playwright install chromium
```

Web 与小程序各自目录：

```bash
# cat-frontend
npm ci
npm run typecheck
npm test
npm run lint
npm run build

# cat-miniprogram
npm ci
npm run typecheck
npm test
npm run build:weapp
```

专项复验：

```bash
# 原生 Redis；脚本创建自己的实例和测试数据
python scripts/verify_redis_runtime.py --redis-server redis-server
# 完整 CPU 推理与模型/store 新卷恢复；固定公开权重约 396 MB
python scripts/inference_assets.py --output-dir artifacts/inference-models
python scripts/verify_docker_runtime.py --models-dir artifacts/inference-models
# 浏览器断线恢复；需要 Linux Docker 引擎，自动创建临时 Redis
python scripts/verify_reconnect_browser.py
# 需要 PowerShell；只操作临时项目和隔离数据库/附件
python scripts/verify_sqlite_recovery.py
```

Windows 的 WSL Redis 用法见 [C 验收](docs/validation/OPTIMIZATION_C.md)。Windows 可从仓库根目录执行 `powershell -NoProfile -File harness/run.ps1 -Mode quick -ContinueOnFailure` 检查项目合同；harness 分数不能替代功能、环境和模型质量验收。

## 项目结构

```text
cat-backend/
  app/api/                 # 业务接口、认证、管理和事件流
  app/agents/              # 猫情报工具与运行时
  app/services/            # 识别、参考库生命周期、奖励结算
  app/models.py            # 数据模型
  app/schemas.py           # 请求与响应
  alembic/                 # 显式迁移
  scripts/                 # 参考库构建、任务 worker、识别评测
  tests/                   # 单元、API、迁移和多进程回归
cat-frontend/src/
  pages/                   # 页面
  features/                # 管理认证、参考库面板等业务模块
  components/              # 通用 UI
  hooks/                   # 请求与事件订阅
cat-miniprogram/           # Taro 微信小程序
scripts/                   # 资源检查、浏览器/Redis/恢复验收
docs/validation/           # 各轮验收结果与历史文件指纹
harness/                   # 检查入口、历史阶段计划
showcase/                  # 实际页面演示截图
```

## 关键接口

完整请求模型与鉴权要求以运行后的 `/docs` 为准。管理接口需相应角色，创建记录需有效用户 token。

| 用途 | 接口 |
|---|---|
| 认证 | `POST /api/auth/register`、`POST /api/auth/login`、`POST /api/admin/login` |
| 猫档案 | `GET /api/cats`、`POST /api/cats`、`POST /api/cats/{id}/images` |
| 识别 / 偶遇 | `POST /api/recognize`、`POST /api/sightings`、`GET /api/sightings` |
| 审核 | `POST /api/admin/sightings/{id}/review`、`POST /api/discoveries/{id}/review` |
| 参考库 | `GET /api/admin/reference/status`、`GET/POST /api/admin/reference/jobs` |
| 社区 | `GET/POST /api/posts`、`POST /api/posts/{id}/like`、`POST /api/posts/{id}/comments` |
| 猫情报 | `POST /api/agents/cat-intel/messages` |
| 事件 / 健康 | `GET /api/events/stream`、`GET /api/system/health` |

Redis Pub/Sub 不保存离线事件；Web 通过统一 SSE 连接在首次打开、重连和业务事件后重新查询当前数据。断线自动重试，浏览器恢复联网后重连，明确会话失效时退出。帖子、评论、通知、图鉴、首页及草稿保留已完成真实浏览器验收；不表示能逐条重放离线事件，生产网络和容量仍需验证。

## 后续工作与限制

1. 完成实际部署业务挂载、通用模型/store 备份流程、生产网络和容量验收。完整 CPU 推理与隔离新卷恢复、API 阶段及核心浏览器重连已通过列明范围内的验收。
2. 同时处理检索错误与确认覆盖不足：补跨角度/跨时段参考图、校园实拍和困难负样本，在校准集上改进后使用新留出集验收。已查看的首次 62 张查询和本轮留出集只用于回归与诊断。
3. 完成微信正式 AppID / HTTPS 合法域名 / 真机流程，以及真实地图坐标、定位和外部 LLM 验收。小程序图标已替换，仍需检查设备显示。
4. 继续收紧接口类型、拆分业务模块、治理遗留告警；按目标数据量与并发测量容量，再决定数据库或检索方案升级。
5. 确认代码、图片、档案和模型的许可。仓库尚无 LICENSE，公开可见不代表已授予开源使用许可。

执行顺序与退出条件见 [下一阶段优化路径](docs/NEXT_OPTIMIZATION_PATH.md)。

## 文档入口

| 文档 | 内容 |
|---|---|
| [已知问题台账](docs/KNOWN_ISSUES.md) | 当前状态、证据、关闭条件 |
| [连续修复](docs/validation/REPAIR_PROGRESS.md) / [优化 A](docs/validation/OPTIMIZATION_A.md) | 核心修复、资源与交付门禁 |
| [B1](docs/validation/OPTIMIZATION_B1.md) / [B2—B3](docs/validation/OPTIMIZATION_B23.md) / [B4](docs/validation/OPTIMIZATION_B4.md) | 参考库身份、任务、发布回滚和管理可见性 |
| [C 验收](docs/validation/OPTIMIZATION_C.md) | Redis 多进程、SQLite/附件恢复、Docker 阻塞 |
| [CI 修复](docs/validation/CI_REPAIR_20261101.md) / [SQLite 启动](docs/validation/SQLITE_STARTUP_20261101.md) | 测试环境问题、WAL 锁竞争、远端六项门禁结果 |
| [Docker 验收](docs/validation/DOCKER_ACCEPTANCE_20261101.md) | API/nginx 镜像、四 worker、事件、重启与新卷恢复及剩余边界 |
| [浏览器重连](docs/validation/RECONNECT_20261101.md) | 丢失更新补回、长断线恢复、草稿保留和会话清理 |
| [完整 CPU 推理](docs/validation/INFERENCE_20261101.md) | 固定真实权重、依赖修复、自匹配与模型/store 新卷恢复 |
| [公开识别预评测](docs/validation/RECOGNITION_PILOT_20261101.md) | 评测口径修复、冻结样本、两环境结果与未知猫误确认问题 |
| [识别校准与留出验收](docs/validation/RECOGNITION_CALIBRATION_20261101.md) | 预设目标、分差策略、冻结数据与候选，以及未通过的质量验收 |
| [参考库操作](docs/REFERENCE_LIBRARY.md) / [备份恢复](docs/BACKUP_RECOVERY.md) | 配置、迁移、构建、恢复边界 |
| [部署](DEPLOY.md) / [发布清单](docs/RELEASE_CHECKLIST.md) | 待完成的发布步骤 |
| [权限矩阵](docs/PERMISSIONS.md) / [观测手册](docs/OBSERVABILITY_RUNBOOK.md) | 角色边界与排障 |
| [贡献说明](CONTRIBUTIONS.md) | 团队职责与代表性提交 |

验收文件中的“未提交/未推送”及 SHA256 描述的是当轮验收时点，保留为历史记录；当前仓库状态以 Git 提交和 Actions 为准。早期审查报告在仓库外的本地目录，台账已注明这些链接的适用范围。

## 项目归属与个人贡献

这是 **5 人校园团队项目，不是个人独立作品**。职责边界、代表性提交和团队成员贡献见 [CONTRIBUTIONS.md](CONTRIBUTIONS.md)。

- **指导教师：** 复旦大学计算机科学技术学院
- **仓库：** [54123-phoenix/cat-cat-cat](https://github.com/54123-phoenix/cat-cat-cat)

<div align="center">
  <sub>用 AI 让每一只校园猫被看见 · 课程项目 · 2026</sub>
</div>
