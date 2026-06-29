# 🐱 复旦校园猫猫数字档案与社区

<div align="center">

**🏆 课程中期评审 · 优秀奖**

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)](https://sqlite.org)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**拍照识猫 → AI 识别 → 猫猫档案 → 偶遇记录 → 社区沉淀**

用 AI 让每一只校园猫被看见、被记录、被记住。

</div>

---

## 目录

- [功能亮点](#功能亮点)
- [UI 预览](#ui-预览)
- [技术栈](#技术栈)
- [快速启动](#快速启动)
- [项目结构](#项目结构)
- [演示路径](#演示路径)
- [核心功能文档](#核心功能文档)
- [项目路线图](#项目路线图)
- [升级路径与监督机制](#升级路径与监督机制)
- [当前限制](#当前限制)
- [团队](#团队)

---

## 功能亮点

### 🧠 AI 识别 · 三态识别契约
拍照上传猫咪照片，AI 返回三种结果：
- **confirmed** — 高置信度，自动记录偶遇
- **uncertain** — 返回 Top3 候选，用户手动确认
- **unknown** — 引导提交新猫线索，进入猫协审核流程

后端已内置 DINOv2-style 本地模型加载与 embedding 匹配链路；当模型权重、依赖或参考向量不可用时，会降级到 `unavailable` / `unknown`，保证主流程不崩。

### 🤝 AI + 人协同审核
未知猫线索先由 AI 初审（生成建议名称、花色），再经管理员终审。通过后自动建档并给提交者发放 **新猫发现者** 勋章。

### 🗺 校园猫猫地图
基于高德地图 API，展示猫猫出没热力图 + 猫猫点位标记。支持 24小时 / 7天 / 全部 时间筛选，点击标记可查看猫猫详情。

### 📸 拍照识猫体验
扫描页配有猫眼扫描动画，识别结果带置信度条展示。确认后可快速打卡记录偶遇（选择地点 + 备注）。

### 📖 猫猫档案
每只猫展示基本档案（名字、性别、年龄、毛色、性格标签）、猫猫故事、健康记录、照片墙和最近偶遇记录。支持关注猫猫。

### 🏘 社区模块
多话题社区（广场 / 寻猫 / 日常 / 健康 / 建议），支持发帖、评论、点赞（带小鱼飞出动画）。帖子可关联猫猫、上传图片。

### 🎖 勋章激励系统
偶遇、发帖、发现新猫等行为可解锁勋章（初次偶遇 / 观察员 / 社区之星 / 新猫发现者等）。勋章墙展示已获得与未获得徽章。

### 🖼 照片墙
全屏图片查看器，支持左右滑动导航、键盘操作（← → ESC）。所有猫猫参考照片聚合展示。

### 🛠 猫协管理端
管理员登录后可管理猫档案（增删改查）、上传参考照片、管理健康记录、维护喂食点、审核举报内容。

---

## UI 预览

| 首页 | 拍照识猫 | 猫猫档案 | 猫猫地图 |
|------|---------|---------|---------|
| 问候 banner + 统计 + 快捷入口 + 猫猫横滑 | 猫眼扫描动画 + 结果卡片 + 快速打卡 | 渐变遮罩卡片 + 档案 + 照片墙 + 偶遇记录 | 高德地图 + 热力图 + 猫猫标记 + 时间筛选 |
| 登录页 | 个人中心 | 社区 | 管理台 |
| 渐变 hero + slogan + 毛玻璃登录卡 | 渐变 banner + 骑跨头像 + 勋章墙 + 关注猫猫 | 多话题 + 发帖 + 评论 + 点赞动画 | 5 tab 切换（档案/健康/喂食/举报/偶遇） |

*（截图可放置于 assets/screenshots/ 目录）*

---

## 技术栈

### 前端

| 技术 | 用途 |
|------|------|
| React 18 | 框架 |
| React Router v6 | 路由 |
| Vite | 构建工具 |
| Tailwind CSS | 样式 |
| Lucide React | 图标库 |
| 高德地图 JS API | 地图 |
| Taro 4 | 小程序跨端（预留） |

### 后端

| 技术 | 用途 |
|------|------|
| FastAPI | Web 框架 |
| SQLAlchemy | ORM |
| SQLite | 数据库 |
| Python 3.11 | 运行环境 |
| Docker Compose | 容器化部署 |

---

## 快速启动

### 方式一：Docker（推荐）

确保已安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) v4.0+。

```bash
docker compose up -d --build
```

启动后访问：

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| 后端 API | http://localhost:8000 |
| API 文档 | http://localhost:8000/docs |

> 数据库使用 SQLite，无需单独启动数据库服务。数据文件位于 `cat-backend/cat_community.db`，已预置 20 只复旦名猫档案与 200 张参考照片。

### 方式二：本地开发

```bash
# 后端
cd cat-backend
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 前端
cd cat-frontend
npm install
npm run dev
```

演示账号：`demo`（口令由环境变量 `DEMO_PASSWORD` 提供，需设 `INIT_DEMO_USER=1`）  
管理员口令：由环境变量 `ADMIN_PASSWORD` 提供

---

## 项目结构

```
.
├── cat-backend/              # FastAPI 后端
│   ├── app/
│   │   ├── api/              # 路由（cats / sightings / recognize / posts 等）
│   │   ├── services/         # AI 识别服务（DINOv2）
│   │   ├── crud.py           # 数据库操作
│   │   ├── models.py         # SQLAlchemy 模型
│   │   └── schemas.py        # Pydantic 数据模型
│   ├── uploads/cats/         # 猫猫参考照片（200 张）
│   ├── cat_community.db      # SQLite 数据库（20 只猫数据）
│   └── Dockerfile
├── cat-frontend/             # React 前端
│   ├── src/
│   │   ├── components/       # 通用组件（CatCard / PhotoViewer / EmptyState / ScanAnimation 等）
│   │   ├── pages/            # 页面（Home / Scan / Map / Community / Profile / Admin 等）
│   │   ├── api.js            # API 封装
│   │   └── index.css         # 全局样式 + 动画
│   └── Dockerfile
├── cat-miniprogram/          # Taro 小程序端（预留）
├── docker-compose.yml        # Docker 编排（SQLite 模式）
└── README.md
```

---

## 演示路径

| 路径 | 功能 |
|------|------|
| `/` | 首页：问候 + 统计 + 快捷操作 + 猫猫横滑 |
| `/scan` | 拍照识别页：上传 + AI 识别动画 + 结果展示 + 快速打卡 |
| `/feed` | 偶遇动态时间线 |
| `/map` | 高德地图：热力图 + 猫猫标记 + 时间筛选 |
| `/gallery` | 猫猫照片墙 |
| `/community` | 社区：广场 / 寻猫 / 日常 / 健康 / 建议 |
| `/profile` | 个人中心：勋墙 + 关注猫猫 |
| `/cats/:id` | 猫猫详情：档案 + 照片墙 + 健康记录 + 偶遇 |
| `/admin` | 猫协管理端（5 tab） |
| `/badges` | 勋章库 |
| `/weekly-report` | 本周报告 |

---

## 核心功能文档

- **识别接口契约**：[docs/AI_INTEGRATION.md](docs/AI_INTEGRATION.md)
- **模型健康检查**：[docs/MODEL_HEALTH.md](docs/MODEL_HEALTH.md)
- **协作交接规范**：[docs/COLLABORATION.md](docs/COLLABORATION.md)
- **发布清单**：[docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)
- **演示脚本**：[docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)
- **备份与恢复**：[docs/BACKUP_RECOVERY.md](docs/BACKUP_RECOVERY.md)
- **权限矩阵**：[docs/PERMISSIONS.md](docs/PERMISSIONS.md)
- **运行观测**：[docs/OBSERVABILITY.md](docs/OBSERVABILITY.md)
- **可观测性运维手册**：[docs/OBSERVABILITY_RUNBOOK.md](docs/OBSERVABILITY_RUNBOOK.md)
- **技术架构设计**：[docx/猫猫社区技术文档.md](docx/猫猫社区技术文档.md)

### 识别接口说明

当前 `/api/recognize` 通过 `cat-backend/app/services/ai.py` 调用 `model_loader.py`，加载 `models/finetuned_best.pt` 并对比 `embeddings/cat_embeddings.json` 中的参考向量。AI 边界已抽象在 service 层，路由层只消费稳定响应。

```json
{
  "status": "confirmed | uncertain | unknown | unavailable",
  "confidence": 0.92,
  "cat_id": 1,
  "cat_name": "皮球",
  "candidates": []
}
```

### 社区模块

```text
GET  /api/posts?topic=all&limit=20
POST /api/posts
POST /api/posts/{id}/like
GET  /api/posts/{id}/comments
POST /api/posts/{id}/comments
```

### 勋章规则

| 勋章 | 条件 |
|------|------|
| 🏅 初次偶遇 | 记录 1 次偶遇 |
| 🏅 观察员 | 记录 5 次偶遇 |
| 🏅 专家 | 记录 20 次偶遇 |
| 🏅 首帖 | 发布 1 条帖子 |
| 🏅 热心人 | 发布 3 条帖子 |
| 🏅 社区之星 | 发布 10 条帖子 |
| 🏅 收藏家 | 认识 5 只猫 |
| 🏅 大师 | 认识所有猫 |
| 🏅 发现者 | 提交的新猫线索被猫协审核通过 |

---

## 项目路线图

### ✅ 已完成
- [x] 猫猫档案 CRUD + 照片墙
- [x] 拍照识别全流程（上传 → 识别 → 结果展示 → 打卡）
- [x] 高德地图热力图 + 猫猫标记
- [x] 社区模块（发帖 / 评论 / 点赞 / 举报）
- [x] 勋章激励系统
- [x] AI + 人协同新猫审核
- [x] 全屏图片查看器
- [x] 统一空状态组件
- [x] 首页三层排版优化
- [x] 管理台五 tab 拆分
- [x] 登录页品牌区重设计
- [x] 20 只复旦名猫数据入库（200 张照片）
- [x] Docker Compose 一键部署（SQLite 模式）

### 🔄 进行中 / 规划中
- [x] DINOv2-style 模型加载与 embedding 匹配链路
- [x] 模型健康检查、权重/embedding 完整性校验与阈值校准入口
- [ ] 微信小程序上线
- [ ] 用户登录系统（微信 OpenID）
- [ ] 推送通知（点赞 / 评论 / 发现审核结果）
- [ ] 多学校支持（架构扩展）

---

## 升级路径与监督机制

### 项目评价

当前项目已经形成了完整的校园猫社区闭环：拍照识别、偶遇记录、猫猫档案、社区互动、个人成长与管理端协作都具备雏形。结构上采用 FastAPI + React + Taro 的三端分层，后端 API、模型、服务和前端页面边界较清晰，适合继续做纵向功能切片。

可拓展性方面，项目已有 `schemas`、`crud`、`api`、前端 `api.ts` 和页面层的稳定路径，新功能可以按“数据契约 -> 后端接口 -> 前端体验 -> harness gate”的方式推进。需要注意的是，部分历史逻辑仍集中在 `crud.py` 和大型页面中，后续进入多校区、审核流、运营看板时应逐步拆出领域服务和更细的前端组件。

稳健性方面，本轮已经补强识别降级、上传校验、关注猫猫动态通知、贡献体系和 full harness。项目成熟度从“可演示原型”提升到“可内测迭代版本”：主链路更稳定，失败状态更清楚，也有了自动化监督入口。但生产化仍需继续加强模型健康检查、权限分层、审计、迁移策略和部署监控。

### 交互、功能与传播价值

优势：

- 交互性强：拍照识猫、偶遇打卡、地图热力、徽章和贡献画像能形成连续反馈。
- 功能多样：档案、社区、照片墙、健康记录、喂食点、通知、排行榜覆盖了校园猫项目的主要场景。
- 传播价值明确：公开猫猫主页、偶遇分享页和个人贡献体系让内容可以自然外传，也能把外部访问带回档案和社区。

不足：

- 模型链路已经存在，但仍需要健康检查、权重/embedding 完整性校验、阈值校准和推理性能观测。
- 管理端审核、变更记录和多角色权限还不够成熟，真实猫协运营会需要更强的可追踪性。
- 前端部分页面承载较重，后续功能继续增加时需要拆组件，避免维护成本变高。
- 传播链路已有页面，但海报、站外预览、分享来源统计还可以继续增强。

### 激情而稳健的升级路径

已完成：

- P0 稳住主闭环：识别状态统一、上传安全校验、核心 smoke harness、full harness 测试环境修复。
- P1 做出传播尖刀：公开猫猫主页、偶遇分享页、识别后直达分享。
- P2 回流机制：关注猫猫动态通知、猫猫贡献画像、分类型排行榜。
- P3-01 审核与变更记录：猫档创建/更新/删除、线索审核通过/拒绝写入 AuditLog。
- P3-02 管理端数据看板：总览 tab 展示待审线索/举报/偶遇、近 7 天偶遇热区、活跃贡献者与最近审计动态。
- P4-01 校园猫路线推荐：基于近 14 天偶遇热度与时间段生成 2-4 个路线点，可分享并跳转地图与识猫打卡。
- P5-01 模型健康检查与阈值校准：新增 `/api/system/health`，检查 PyTorch、模型权重、reference embedding、阈值配置与可选 warm model load。
- P5-02 数据库备份与恢复演练：新增 `scripts/backup.ps1`、`scripts/restore.ps1` 与恢复演练文档，支持 dry run、DB-only、uploads 可选和恢复前预备份。
- P5-03 权限矩阵与多管理员审计：新增 `user/reviewer/admin` 三级角色约束，审核与举报处理支持 reviewer/admin，高危管理动作保留 admin，并补充举报处理审计。
- P5-04 部署监控、错误追踪与结构化日志：新增 `X-Request-ID`、结构化请求日志、请求失败日志和观测文档。
- P5-05 协作交接、发布清单与演示脚本：新增发布 checklist、6 分钟演示路径和 opencode 任务模板。

下一阶段建议：

- 发布候选（P6）：冻结广泛功能开发，按 `docs/FINAL_ACCEPTANCE.md` 验收，保持 README/roadmap/TODO/docs/harness 对齐。
- 协作化补强：用 `docs/COLLABORATION.md` 约束多模型/多人交接，外部实现后由维护者复核 diff、测试与 harness。

P5 进阶路径：

- P5-01 模型健康检查与阈值校准：已提供健康接口、阈值有效性检查、embedding 完整性检查和维护文档；后续可继续扩充真实样本集指标。
- P5-02 数据库迁移、备份与恢复演练：已完成文件级备份/恢复第一版；后续若进入真实生产库，再补正式 schema migration 策略。
- P5-03 权限矩阵与多管理员审计：已完成轻量角色分级、后端权限 helper、举报/线索/偶遇审核权限拆分与权限文档。
- P5-04 部署监控、错误追踪与结构化日志：已完成第一版请求追踪、结构化日志、健康检查联动与排障文档；后续可接入外部 APM/日志平台。
- P5-05 协作交接、发布清单与演示脚本：已完成基础文档，后续每次发布前按清单复核即可。

### Harness 监督

升级监督入口位于 `harness/`：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File harness/run.ps1 -Mode quick -ContinueOnFailure
powershell -NoProfile -ExecutionPolicy Bypass -File harness/run.ps1 -Mode full -ContinueOnFailure
```

规则：

- 每完成一个任务，至少运行 quick harness。
- 阶段验收或合并前运行 full harness。
- 分数低于 80 时暂停新增功能，优先修复稳定性。
- 最新报告写入 `harness/reports/latest.md`，报告目录已加入 `.gitignore`。

## 当前限制

- AI 识别模型链路已存在，但生产运行仍需补齐健康检查、权重/embedding 完整性校验、阈值校准和性能观测
- 社区用户身份当前使用默认用户 `demo`，后续可接入真实登录系统
- 管理员端已加入轻量口令鉴权，但尚未实现完整多账号和角色体系
- 高德地图点位为演示级校园坐标
- 数据库预置的 20 只猫数据来自 `meowzart_scraper` 公开图片

---

## 团队

- **指导教师：** 复旦大学计算机科学技术学院
- **仓库地址：** [github.com/54123-phoenix/cat-cat-cat](https://github.com/54123-phoenix/cat-cat-cat)

---

<div align="center">
  <sub>📸 用 AI 让每一只校园猫被看见 · 课程项目 · 2026</sub>
</div>
---

## P6 Release Candidate Closeout

The project has now entered a release-candidate closeout stage after P0-P5. Broad feature work should pause until the acceptance pack is reviewed and the full harness remains green.

New release-candidate references:

- [Final acceptance pack](docs/FINAL_ACCEPTANCE.md)
- [P6 opencode audit guardrails](harness/opencode/P6-release-candidate-audit.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Collaboration playbook](docs/COLLABORATION.md)

Recommended next upgrade path after this closeout:

- Deployment: production environment matrix, secret handling, process/container deployment, and external log/APM sink.
- Data: migration discipline, disposable restore drill, seed reset path, and optional PostgreSQL migration plan.
- Model: labeled evaluation set, threshold calibration, inference latency budget, and unavailable/degraded monitoring.
- Product: share-card previews, source analytics, richer route storytelling, and stronger admin triage filters.
- Collaboration: issue templates, release notes, version tags, and one acceptance report per milestone.
