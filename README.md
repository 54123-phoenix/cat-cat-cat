# 复旦校园猫猫数字档案与社区

一个面向校园猫猫记录、识别、地图追踪和社区互动的移动端 Web 应用原型。项目以“拍照识猫 + 猫猫档案 + 偶遇地图 + 猫协管理 + 社区互助”为核心闭环，适合科创竞赛展示和后续真实模型接入。

## 功能亮点

- 拍照识猫：支持上传/拍照、本地预览、识别等待态和三种识别结果。
- 三态识别契约：`confirmed`、`uncertain`、`unknown`，方便后续接入 YOLO/CLIP/FAISS 等真实模型。
- 猫猫档案：展示猫猫基础信息、性格、故事、照片和最近偶遇。
- Cat-egorize 档案管理：支持猫档案新增、编辑、删除接口和管理员上传参考照片。
- 照片墙：聚合展示所有已上传的猫咪参考照片，为后续 AI 训练/检索准备数据雏形。
- 偶遇动态：记录并展示校园猫咪时间线。
- 高德地图热力图：基于偶遇记录展示猫猫出没热点。
- 社区模块：广场、寻猫、日常、健康、建议等话题，支持发帖、标签、关联猫猫和点赞。
- 猫协管理端：维护猫档案、上传参考照片、查看最近偶遇。
- 移动端优先：以 375px 宽度为基准设计，底部五栏导航。

## 技术栈

### Frontend

- React 18
- React Router
- Vite
- Tailwind CSS
- 高德地图 JS API

### Backend

- FastAPI
- SQLAlchemy
- MySQL 8
- PyMySQL

### DevOps

- Docker Compose
- Makefile

## 项目结构

```text
.
├── cat-backend/          # FastAPI 后端
│   ├── app/
│   │   ├── api/          # cats / sightings / recognize / user 路由
│   │   ├── crud.py       # CRUD 和演示数据初始化
│   │   ├── database.py   # 数据库连接
│   │   ├── main.py       # FastAPI 入口
│   │   ├── models.py     # SQLAlchemy 模型
│   │   └── schemas.py    # Pydantic Schema
│   ├── Dockerfile
│   └── requirements.txt
├── cat-frontend/         # React 前端
│   ├── src/
│   │   ├── components/   # 通用组件
│   │   ├── pages/        # Home / Feed / Scan / Map / Community / Profile / Admin
│   │   ├── api.js        # 前端接口封装
│   │   └── main.jsx
│   ├── Dockerfile
│   └── package.json
├── docx/                 # 项目文档材料
├── Makefile              # 常用开发命令
├── .env.example          # 环境变量样例
├── docker-compose.yml
└── README.md
```

## 快速启动

确保本机已安装并启动 Docker Desktop。

```bash
docker compose up -d --build
```

也可以使用 Makefile：

```bash
make up
```

启动后访问：

- 前端：http://localhost:5173
- 后端：http://localhost:8000
- API 文档：http://localhost:8000/docs
- MySQL：localhost:3306

查看容器状态：

```bash
docker compose ps
```

或：

```bash
make ps
```

停止服务：

```bash
docker compose down
```

或：

```bash
make down
```

常用 Make 命令：

```bash
make up              # 构建并启动服务
make down            # 停止服务
make restart         # 重启服务
make logs            # 查看日志
make test            # 前端构建 + 后端语法检查
make frontend-build  # 仅检查前端构建
make backend-check   # 仅检查后端语法
```

## 本地开发

### 前端

```bash
cd cat-frontend
npm install
npm run dev
```

构建检查：

```bash
npm run build
```

### 后端

```bash
cd cat-backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

语法检查：

```bash
python -m compileall app
```

## 演示路径

- `/`：首页，猫猫列表、统计、地图入口。
- `/scan`：拍照识别页。
- `/feed`：偶遇动态时间线。
- `/map`：高德地图热力图。
- `/gallery`：猫猫照片墙。
- `/community`：社区讨论页。
- `/profile`：个人页和勋章墙。
- `/admin`：猫协管理端。
- `/cats/:catId`：猫猫详情页。

## 识别接口说明

当前项目保留 AI 图像识别接口，真实模型由后续团队接入。现阶段 `/api/recognize` 使用 mock 逻辑，返回统一三态结构：

```json
{
  "status": "confirmed | uncertain | unknown",
  "confidence": 0.92,
  "cat_id": 1,
  "cat_name": "小白",
  "candidates": []
}
```

演示触发规则：

- 普通文件名：高置信度识别成功。
- 文件名包含 `uncertain`：返回 Top3 候选。
- 文件名包含 `unknown`：返回新猫状态。

## 地图说明

地图页使用高德地图 JS API，并在 `/map` 页面按需异步加载，避免地图脚本影响其他页面启动。

如果地图无法加载，请检查：

- 高德 Key 是否开通 Web 端 JS API。
- Key 白名单是否允许 `localhost`。
- 浏览器是否能访问 `https://webapi.amap.com`。

## 社区模块说明

新版社区模块预留了后端帖子接口：

```text
GET  /posts?topic=all&limit=20
POST /posts
POST /posts/{id}/like
GET  /posts/{id}/comments
POST /posts/{id}/comments
```

当前后端尚未实现这些接口，前端会自动使用本地种子数据和 `localStorage` 兜底，保证演示时社区页可用。

## Cat-egorize 档案管理

当前阶段重点夯实猫猫档案管理系统，为 AI 识别上线前准备可维护的数据基础。

已具备能力：

- `GET /api/cats`：猫档案列表。
- `GET /api/cats/{cat_id}`：猫档案详情。
- `POST /api/cats`：新增猫档案。
- `PUT /api/cats/{cat_id}`：编辑猫档案。
- `DELETE /api/cats/{cat_id}`：删除猫档案。
- `POST /api/cats/{cat_id}/images`：上传猫咪参考照片。
- `GET /api/cats/{cat_id}/images`：查看单只猫的参考照片。
- `GET /api/cats/images`：照片墙聚合接口。

前端入口：

- `/admin`：管理员维护猫档案和上传参考照片。
- `/gallery`：展示所有上传的参考照片。

## 数据与上传文件

- MySQL 数据保存在 Docker volume `mysql_data` 中。
- 上传文件保存到本地 `uploads/`，该目录已被 `.gitignore` 排除。
- `.env`、缓存、构建产物和依赖目录不会提交到 Git。

## GitHub

仓库地址：

https://github.com/54123-phoenix/cat-cat-cat

## 当前限制

- 真实 AI 识别模型未接入，仅保留稳定接口契约。
- 社区帖子后端接口未实现，当前为前端本地兜底。
- `/admin` 是演示版猫协管理端，暂未加入登录鉴权。
- 高德地图点位为演示级校园坐标。
