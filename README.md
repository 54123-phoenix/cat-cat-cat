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
- [当前限制](#当前限制)
- [团队](#团队)

---

## 功能亮点

### 🧠 AI 识别 · 三态识别契约
拍照上传猫咪照片，AI 返回三种结果：
- **confirmed** — 高置信度，自动记录偶遇
- **uncertain** — 返回 Top3 候选，用户手动确认
- **unknown** — 引导提交新猫线索，进入猫协审核流程

支持 DINOv2 真实模型接入（接口已预留），现阶段使用 mock 逻辑演示全链路。

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

演示账号：`demo / demo123`  
管理员口令：`cat-admin`

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
- **技术架构设计**：[docx/猫猫社区技术文档.md](docx/猫猫社区技术文档.md)

### 识别接口说明

当前 `/api/recognize` 使用 mock 逻辑演示全链路。AI 接入边界已抽象到 `cat-backend/app/services/ai.py`。

```json
{
  "status": "confirmed | uncertain | unknown",
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
- [ ] 真实 DINOv2 模型接入
- [ ] 微信小程序上线
- [ ] 用户登录系统（微信 OpenID）
- [ ] 推送通知（点赞 / 评论 / 发现审核结果）
- [ ] 多学校支持（架构扩展）

---

## 当前限制

- 真实 AI 识别模型未接入，当前使用 mock 逻辑演示全链路
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
