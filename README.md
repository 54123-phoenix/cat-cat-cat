# 复旦校园猫猫数字档案、社区与 Agent 实践规划

<div align="center">

**课程中期评审优秀奖 · P6 发布候选收尾版 · Agent 训练营优化待实现**

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)](https://sqlite.org)
[![Taro](https://img.shields.io/badge/Taro-4-1677FF)](https://taro.zone)

**首页寻猫入口 -> 拍照识猫 -> AI 识别 -> 偶遇纪念卡 -> 地图路线 -> 社区回流 -> 猫协审核**

**下一阶段方向：学生课表 / 校园活动 -> 多 Agent 生成实践计划 -> 识猫、路线、审核与课程复盘**

用 AI 让每一只校园猫被看见、被记录、被记住。

</div>

---

## 目录

- [项目状态](#项目状态)
- [功能亮点](#功能亮点)
- [界面预览](#界面预览)
- [技术栈](#技术栈)
- [快速启动](#快速启动)
- [提交前检查](#提交前检查)
- [演示路径](#演示路径)
- [核心文档](#核心文档)
- [项目结构](#项目结构)
- [关键接口](#关键接口)
- [小程序端](#小程序端)
- [发布候选说明](#发布候选说明)
- [当前限制](#当前限制)
- [团队](#团队)

---

## 项目状态

当前仓库已经完成 P0-P6 主线，定位是 **feature-complete internal-trial build -> maintainable release candidate**。P6 阶段不再扩大功能面，重点是验收、文档一致性、harness 监督和可交接性。

| 维度 | 当前状态 |
|------|----------|
| Web 端 | React + Vite，覆盖首页寻猫入口、识猫、偶遇纪念卡、地图、社区、档案、个人中心、管理端、路线推荐等主流程 |
| 后端 API | FastAPI + SQLAlchemy，默认 SQLite 文件库，已补权限、审计、速率限制、结构化日志和健康检查 |
| AI 识别 | DINOv2-style 本地模型加载 + embedding 匹配链路，支持 `confirmed` / `uncertain` / `unknown` / `unavailable` 四态降级 |
| 游戏化与回流 | 已有每日胶囊、每日抽签、贡献称号、收藏品、路线故事、路线打卡和路线印章等回流能力 |
| Agent 训练营方向 | 已新增 [tasks/agent_student_schedule_task.md](tasks/agent_student_schedule_task.md) 作为交接实现文件，规划课表规划 Agent、课间寻猫路线 Agent、猫协审核 Agent 和学习复盘 Agent；当前尚未实现产品代码 |
| 小程序端 | Taro 4，已保留 17 个页面和 5 个 tab，提交微信审核前仍需正式 AppID、服务域名、图标和真机测试 |
| 运维与验收 | 已有发布清单、最终验收包、备份恢复、权限矩阵、观测手册和 quick/full harness |
| 生产状态 | 适合作为课程展示、内测和发布候选审查；真实生产部署前仍需完成域名、密钥、恢复演练和模型校准 |

---

## 功能亮点

### 首页黄金链路与偶遇纪念卡

首页第一屏会根据最近偶遇、猫猫档案和用户偏好生成「今日校园寻猫入口」，直接给出推荐起点、推荐猫猫、拍照识猫、路线和地图入口。评审或新用户不用先理解全部功能，就能沿着一条完整路径走完：

```text
从今日起点出发 -> 拍照识猫 -> 生成偶遇纪念卡 -> 查看路线或地图 -> 分享公开页 -> 回到社区和档案
```

识别成功后，`/scan` 会把结果呈现为「已记入偶遇」的纪念卡状态，并提供一键生成分享卡。猫猫详情页也提供猫猫身份卡，可指向免登录公开主页 `/cats/public/:id`，让每只猫和每次偶遇都能自然传播。

### AI 识别与安全降级

用户上传猫咪照片后，后端通过 `cat-backend/app/services/ai.py` 调用模型适配层，统一返回四态结果：

- `confirmed`：高置信度命中已知猫，可继续记录偶遇。
- `uncertain`：返回候选列表，由用户手动选择。
- `unknown`：没有可靠匹配，引导提交新猫线索。
- `unavailable`：模型资产、依赖或推理失败，页面保留重试和手动线索入口。

模型权重、reference embedding、阈值配置和可选 warm load 由 `/api/system/health` 检查。

### Agent 训练营优化路径（待实现）

项目参加 Agent 训练营时，当前“AI 识猫社区”的表达还不够突出 Agent 的目标驱动、工具调用、记忆、规划、执行轨迹和人类确认。下一阶段建议把现有能力升级为「面向学生校园生活的多 Agent 实践平台」：

```text
学生课表 / 校园活动 -> Agent 生成今日实践计划 -> 学生执行识猫、路线、记录任务 -> 猫协审核 Agent 辅助复核 -> 学习复盘 Agent 生成课程实践总结
```

已新建交接任务 [tasks/agent_student_schedule_task.md](tasks/agent_student_schedule_task.md)，供后续实现者按范围落地。第一版建议不接真实教务系统，先用手动录入或 demo 课表，重点展示：

- 课表规划 Agent：识别课程间空闲窗口，生成可执行校园实践计划。
- 课间寻猫路线 Agent：复用路线推荐和路线故事，解释推荐依据、预计耗时和下一步行动。
- 猫协审核 Agent：辅助未知猫线索复核，但最终通过、合并、拒绝仍由管理员确认。
- 学习复盘 Agent：把识猫、路线、活动和贡献记录整理为课程实践总结。

### 猫猫档案与偶遇闭环

每只猫拥有档案、头像、性格标签、故事、健康记录、照片墙、最近偶遇、猫猫身份卡和公开主页。用户可从识别结果、首页寻猫入口、地图、路线或社区进入档案，并通过偶遇记录沉淀真实活动轨迹。

### 地图、热力与路线推荐

地图页基于高德地图 JS API 展示校园点位、热力图和猫猫标记。路线推荐页 `/routes` 基于近 14 天偶遇热度和时间段生成校园猫路线，可分享路线卡，并可跳转到地图与识猫打卡。路线故事能力还支持路线站点、线索、打卡进度和完成后的路线印章，为后续“课间寻猫路线 Agent”提供基础。

### 社区、分享与回流

社区支持发帖、评论、点赞、举报和帖子详情页；偶遇分享页 `/sightings/share/:id`、猫猫身份卡和公开猫猫主页 `/cats/public/:id` 可免登录访问，用于展示和外部传播。

### 勋章、贡献与个人画像

系统记录识别、偶遇、发帖、发现新猫、关注等行为，形成贡献分、分类排行榜、勋章墙、收藏和周报，帮助用户持续回流。当前还包含每日胶囊、每日抽签、贡献称号、收藏品和路线印章，可作为后续学习复盘 Agent 的输入数据。

### 猫协管理端

管理端包含总览、猫档案、健康/喂食、举报、偶遇和审核相关能力。当前已区分 `user`、`reviewer`、`admin` 三类角色；新猫线索、偶遇审核、举报处理和猫档案变更会写入审计日志。

### 运维可见性

后端响应包含 `X-Request-ID`，请求日志使用结构化 JSON，且不记录 token、请求 body、上传文件内容或私有凭据。备份和恢复脚本支持 dry run，真实恢复必须显式确认。

---

## 界面预览

| 首页 | 识猫 | 地图 |
|------|------|------|
| ![首页](showcase/home.png) | ![识猫](showcase/scan.png) | ![地图](showcase/map.png) |

| 社区 | 勋章 |
|------|------|
| ![社区](showcase/community.png) | ![勋章](showcase/badges.png) |

---

## 技术栈

### 前端

| 技术 | 用途 |
|------|------|
| React 18 | Web UI |
| React Router v6 | Web 路由 |
| Vite | 本地开发与构建 |
| Tailwind CSS | 样式系统 |
| TanStack Query | 前端数据请求状态 |
| Lucide React | 图标 |
| 高德地图 JS API | 地图、点位与热力展示 |
| Vitest + Testing Library | 前端测试 |

### 后端

| 技术 | 用途 |
|------|------|
| FastAPI | API 服务 |
| SQLAlchemy | ORM |
| SQLite | 默认业务数据库 |
| Redis | 事件流、缓存和部署辅助服务 |
| PostgreSQL | Compose 中保留的后续迁移/部署辅助服务，默认业务仍走 SQLite |
| SlowAPI | 速率限制 |
| Python 3.11 | 后端运行环境 |
| Docker Compose | 本地容器化启动 |

### 小程序

| 技术 | 用途 |
|------|------|
| Taro 4 | 微信小程序跨端工程 |
| React 18 | 小程序页面层 |
| SCSS | 小程序样式 |

---

## 快速启动

### 方式一：Docker Compose（推荐演示方式）

准备环境：

- Docker Desktop v4.0+
- 复制 `.env.example` 为 `.env`
- 至少修改 `JWT_SECRET`、`ADMIN_PASSWORD`
- 如需初始化演示用户，设置 `INIT_DEMO_USER=1` 和 `DEMO_PASSWORD`

启动：

```powershell
docker compose up -d --build
```

访问：

| 服务 | 地址 |
|------|------|
| Web 前端 | http://localhost |
| 后端 API | http://localhost:8000 |
| API 文档 | http://localhost:8000/docs |
| 系统健康 | http://localhost:8000/api/system/health |

说明：

- Compose 中前端映射到 `80:80`，不是 Vite 开发端口 `5173`。
- 默认业务数据库为 SQLite，挂载到 `cat-backend/cat_community.db`。
- Compose 中的 Redis 用于事件/缓存链路；PostgreSQL 服务为后续迁移和部署预留，当前默认 `DATABASE_URL` 仍是 SQLite。

### 方式二：本地开发

后端：

```powershell
cd cat-backend
Copy-Item ..\.env.example .env
# 编辑 .env，至少填写 JWT_SECRET 和 ADMIN_PASSWORD
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

前端：

```powershell
cd cat-frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

本地开发访问：

| 服务 | 地址 |
|------|------|
| Vite 前端 | http://localhost:5173 |
| 后端 API | http://localhost:8000 |

演示账号：

- 普通用户：`demo`，需 `INIT_DEMO_USER=1` 且由 `DEMO_PASSWORD` 设置口令。
- 管理员：启动时根据 `ADMIN_PASSWORD` 创建或使用已有 `admin` 用户。

---

## 提交前检查

发布清单见 [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)。提交前至少完成下面几组检查。

### 1. 文档与 harness 合同

```powershell
python harness\checks\docs_check.py
powershell -NoProfile -ExecutionPolicy Bypass -File harness\run.ps1 -Mode quick -ContinueOnFailure
```

阶段验收或合并前运行 full harness：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File harness\run.ps1 -Mode full -ContinueOnFailure
```

### 2. 后端测试

```powershell
cd cat-backend
.\.venv\Scripts\python.exe -m pytest tests -q
```

### 3. 前端测试与构建

```powershell
cd cat-frontend
npm test -- --run
npm run build
```

### 4. 备份 dry run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup.ps1 -DryRun
```

提交前还需要确认：

- `README.md`、`harness/TODO.md`、`harness/roadmap.yml`、`docs/FINAL_ACCEPTANCE.md` 的发布状态一致。
- `.env`、真实 AppSecret、JWT secret、管理员口令不进入 git。
- 不降低 harness 检查标准，不用 hard reset 处理发布回滚。
- 真实恢复操作只在明确确认后执行，优先先做 dry run。

---

## 演示路径

完整 5-8 分钟话术见 [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)。推荐现场演示顺序：

1. `/` 首页：今日校园寻猫入口，说明从推荐地点开始的黄金链路。
2. `/scan` 识猫：展示 confirmed / uncertain / unknown / unavailable 的兜底设计，confirmed 后生成偶遇纪念卡。
3. `/cats/:catId` 与 `/cats/public/:catId`：档案、照片墙、猫猫身份卡、公开传播页。
4. `/map` 与 `/routes`：地图热力、时间段路线推荐、路线分享卡、跳转打卡。
5. `/community` 与 `/posts/:postId`：帖子、评论、点赞、举报。
6. `/profile`、`/league`、`/weekly-report`：贡献画像、排行、周报。
7. `/admin`：总览、审核、举报处理、审计闭环。
8. `/api/system/health`：健康检查和模型状态说明。

Agent 训练营方向当前是交接任务，不属于已上线演示路径。后续实现时建议新增 `/agents`，把“课表规划、路线规划、猫协审核、学习复盘”放在同一工作台中展示。

---

## 核心文档

| 文档 | 用途 |
|------|------|
| [docs/FINAL_ACCEPTANCE.md](docs/FINAL_ACCEPTANCE.md) | P6 发布候选目标、验收清单、人工冒烟路径和风险登记 |
| [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) | 发布前逐项检查清单 |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | 5-8 分钟评审/新成员演示路线 |
| [docs/AI_INTEGRATION.md](docs/AI_INTEGRATION.md) | AI 识别适配层、四态契约和新猫线索边界 |
| [docs/MODEL_HEALTH.md](docs/MODEL_HEALTH.md) | 模型健康检查、阈值校准和 warm load 说明 |
| [docs/PERMISSIONS.md](docs/PERMISSIONS.md) | `user` / `reviewer` / `admin` 权限矩阵与审计规则 |
| [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md) | 请求追踪、结构化日志和健康检查入口 |
| [docs/OBSERVABILITY_RUNBOOK.md](docs/OBSERVABILITY_RUNBOOK.md) | 事故排查、模型不可用、上传失败、恢复流程 |
| [docs/BACKUP_RECOVERY.md](docs/BACKUP_RECOVERY.md) | SQLite 与 uploads 的备份、恢复、dry run 和演练说明 |
| [docs/COLLABORATION.md](docs/COLLABORATION.md) | Codex / opencode / 外部代理的协作边界与交接规范 |
| [docs/GAMIFICATION_PATH.md](docs/GAMIFICATION_PATH.md) | 勋章、贡献、分享卡和后续游戏化路径 |
| [tasks/agent_student_schedule_task.md](tasks/agent_student_schedule_task.md) | Agent 训练营优化交接任务：学生课表、校园活动、路线、审核和课程复盘 |
| [docx/猫猫社区技术文档.md](docx/猫猫社区技术文档.md) | MVP 技术架构、数据流和 AI 识别模块设计 |

---

## 项目结构

```text
.
├── cat-backend/              # FastAPI 后端
│   ├── app/
│   │   ├── api/              # cats / sightings / recognize / posts / admin / system 等路由
│   │   ├── middleware/       # 请求日志、安全响应头
│   │   ├── services/         # AI 识别、模型加载、微信服务
│   │   ├── config/           # 后端配置
│   │   ├── crud.py           # 数据访问与业务辅助
│   │   ├── models.py         # SQLAlchemy 模型
│   │   └── schemas.py        # Pydantic 数据模型
│   ├── tests/                # 后端测试
│   ├── uploads/              # 用户上传与猫猫图片
│   ├── embeddings/           # 猫猫 reference embedding
│   ├── models/               # 本地模型权重
│   └── Dockerfile
├── cat-frontend/             # React Web 前端
│   ├── src/
│   │   ├── components/       # 通用组件、插画、反馈组件
│   │   ├── pages/            # Home / Scan / Map / Community / Admin / Routes 等页面
│   │   ├── constants/        # 路由、徽章、活动、猫路线常量
│   │   ├── hooks/            # API 与事件流 hooks
│   │   ├── api.ts            # API 封装
│   │   └── index.css         # 全局样式与动画
│   └── Dockerfile
├── cat-miniprogram/          # Taro 4 微信小程序端
├── docs/                     # 发布、验收、权限、观测、备份等文档
├── harness/                  # quick/full gate、roadmap、TODO、opencode 任务
├── scripts/                  # 备份、恢复、数据导入与 UI 辅助脚本
├── showcase/                 # README 与展示用截图
├── tasks/                    # 分阶段实现任务与 Agent 训练营优化交接
├── docker-compose.yml
└── README.md
```

---

## 关键接口

### 识别

```text
POST /api/recognize
Content-Type: multipart/form-data
file: image
```

返回：

```json
{
  "status": "confirmed | uncertain | unknown | unavailable",
  "confidence": 0.92,
  "cat_id": 1,
  "cat_name": "小白",
  "candidates": []
}
```

### 社区

```text
GET  /api/posts?topic=all&limit=20
POST /api/posts
GET  /api/posts/{id}
POST /api/posts/{id}/like
GET  /api/posts/{id}/comments
POST /api/posts/{id}/comments
POST /api/posts/{id}/reports
```

### 管理与审核

```text
GET  /api/admin/dashboard
GET  /api/discoveries
POST /api/discoveries/{id}/review
GET  /api/posts/reports
POST /api/posts/reports/{id}/handle
GET  /api/audit/logs
```

`reviewer` 可处理线索、偶遇和举报；`admin` 保留猫档案、健康记录、喂食点、用户状态和完整审计能力。

### 游戏化、路线故事与收藏

```text
GET  /api/daily-capsule
POST /api/daily-capsule/claim
GET  /api/gacha/today
POST /api/gacha/draw
GET  /api/users/me/titles
GET  /api/users/me/collectibles
GET  /api/routes/story
POST /api/routes/story/check-in
GET  /api/routes/story/progress
```

这些接口支撑每日回流、贡献称号、收藏品、路线故事、路线打卡和路线印章，也可作为后续 Agent 工作台的工具调用与记忆输入。

### 健康检查

```text
GET /api/system/health
GET /api/system/health?warm_model=true
```

默认健康检查保持轻量；发布前、部署后首轮验收或模型排障时再使用 `warm_model=true`。

---

## 小程序端

小程序工程位于 `cat-miniprogram/`，当前页面包括首页、地图、识猫、社区、我的、猫详情、帖子详情、动态、照片墙、管理端、勋章、通知、周报、排行榜、每日任务、收藏、年度回顾。

构建：

```powershell
cd cat-miniprogram
npm install
npm run build:weapp
```

提交微信审核前仍需完成：

- 注册微信小程序并替换 `cat-miniprogram/project.config.json` 中的 AppID。
- 配置 `cat-miniprogram/config/prod.ts` 的线上 `API_BASE`。
- 配置 HTTPS 合法域名、uploadFile/downloadFile 域名。
- 替换 `cat-miniprogram/src/assets/tab/*.png` 的占位图标。
- 在微信开发者工具和真机上测试登录、识猫、地图、社区、个人中心、下拉刷新。

详细上线步骤见 [DEPLOY.md](DEPLOY.md)。

---

## 发布候选说明

P6 当前目标是冻结广泛功能开发，证明项目可交接、可演示、可继续维护。发布候选验收关注：

- 核心产品闭环稳定：首页寻猫入口、识别、偶遇纪念卡、档案、公开分享、社区、个人中心、管理审核、管理看板、路线推荐。
- 失败路径可理解：模型不可用、空数据、上传失败、未授权访问、审核/审计状态异常。
- 运维第一版可用：系统健康、模型健康、request id、结构化日志、备份、恢复 dry run、权限矩阵、协作手册、发布清单、演示脚本。
- README、roadmap、TODO、docs 和 harness 报告状态一致。

下一阶段建议按五条线推进：

- 部署：生产环境矩阵、密钥管理、进程/容器部署、外部日志或 APM。
- 数据：正式迁移纪律、一次性恢复演练、种子数据重置、可选 PostgreSQL 迁移。
- 模型：真实校园样本集、阈值校准报告、推理延迟预算、不可用/降级监控。
- 产品：来源统计、路线完成记录、更强路线叙事、更细管理端筛选。
- Agent：按 [tasks/agent_student_schedule_task.md](tasks/agent_student_schedule_task.md) 落地 Agent 工作台、学生课表/活动输入、课间路线规划、猫协审核建议和学习复盘报告。
- 协作：issue 模板、release notes、版本 tag、每个里程碑一份验收报告。

---

## 当前限制

- 真实生产部署前仍需正式密钥、域名、HTTPS、CORS 白名单和外部日志策略。
- SQLite 适合课程展示和轻量内测；多人长期使用前应补正式迁移和恢复演练。
- 模型链路已经接入，但识别质量仍依赖当前权重、reference embedding 和演示数据；真实上线前需要固定样本集与阈值校准。
- 小程序端已具备页面结构，但仍需 AppID、服务域名、图标替换和真机测试。
- 高德地图坐标仍以演示级校园点位为主，真实运营时需要验证位置来源。
- Agent 训练营优化目前只有交接任务文件，尚未实现 `/agents` 页面、Agent API、课表/活动输入或审核建议接口。
- 本仓库当前没有单独的 `LICENSE` 文件；如要公开开源发布，需要补齐许可证。

---

## 团队

- **指导教师：** 复旦大学计算机科学技术学院
- **仓库地址：** [github.com/54123-phoenix/cat-cat-cat](https://github.com/54123-phoenix/cat-cat-cat)

<div align="center">
  <sub>用 AI 让每一只校园猫被看见 · 课程项目 · 2026</sub>
</div>
