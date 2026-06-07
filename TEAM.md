# 团队协作流程

## 提交后即时看效果

### 方式一：微信开发者工具（推荐，最即时）

```bash
# 1. 在 cat-miniprogram 目录启动 watch 模式
cd cat-miniprogram
npm run dev:weapp
# → 每次保存代码自动编译，模拟器即时刷新

# 2. 微信开发者工具 → 导入项目
#    目录：cat-miniprogram/dist/weapp
#    AppID：测试号（或正式 AppID）

# 3. 点顶部"预览" → 生成二维码 → 队友微信扫码
```

### 方式二：GitHub Actions 自动构建

推送代码后自动验证。3 个 CI 任务：
- `build-web` → React 前端构建
- `build-miniprogram` → Taro 小程序编译
- `check-backend` → Python 语法检查

构建产物可在 Actions → 对应 job → Artifacts 下载。

### 方式三：Web 版 Docker 预览

```bash
docker compose up -d
# 前端 http://localhost:5173
# 后端 http://localhost:8000/docs
```

Vite HMR 即时刷新，改代码自动生效。

## 队友加入

```bash
git clone https://github.com/54123-phoenix/cat-cat-cat.git
cd cat-cat-cat

# 前端（React Web）
cd cat-frontend && npm install

# 小程序
cd cat-miniprogram && npm install

# 后端
cd cat-backend && pip install -r requirements.txt
```
