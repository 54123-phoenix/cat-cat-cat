# 上线步骤清单

## 第一阶段：账号准备（1-3 天）

### 1.1 注册微信小程序
- [ ] 访问 https://mp.weixin.qq.com
- [ ] 右上角「立即注册」→ 选择「小程序」
- [ ] 主体类型选「个人」（免费，无需营业执照）
- [ ] 填写邮箱 → 邮箱激活 → 身份认证（扫码 + 身份证）
- [ ] 审核约 1 个工作日

### 1.2 获取 AppID 和 AppSecret
- [ ] 登录 https://mp.weixin.qq.com
- [ ] 左侧菜单：开发 → 开发管理 → 开发设置
- [ ] 复制 **AppID**（小程序 ID）→ 填到 `cat-miniprogram/project.config.json` 第 5 行，替换 `"touristappid"`
- [ ] 点击「生成」获取 **AppSecret**（用管理员微信扫码获取）
- [ ] 记下这两个值，**绝对不要提交到 Git**

### 1.3 安装微信开发者工具
- [ ] 下载：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
- [ ] 安装后，导入项目 → 目录选 `cat-miniprogram/dist/weapp`
- [ ] AppID 填你的正式 AppID
- [ ] 首次编译验证能否在模拟器中运行

---

## 第二阶段：后端部署（选择一种）

### 选项 A：云服务器部署（推荐，队友都能访问）

1. 买一台云服务器（阿里云/腾讯云，最低 2核2G，约 ¥60/月）
2. SSH 登录，安装 Docker：
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. 克隆项目 + 创建 `.env` 文件：
   ```bash
   git clone https://github.com/54123-phoenix/cat-cat-cat.git
   cd cat-cat-cat
   cp .env.example .env
   ```
4. 编辑 `.env`，填入你的值：
   ```ini
    DATABASE_URL=sqlite:///./cat_community.db
   UPLOAD_DIR=./uploads
   VITE_API_TARGET=http://backend:8000
   ADMIN_PASSWORD=你的管理员密码
   JWT_SECRET=随机字符串
   CORS_ORIGINS=https://你的域名.com
   WECHAT_APPID=wx开头的那串
   WECHAT_SECRET=申请到的Secret
   ```
5. 启动：
   ```bash
   docker compose up -d --build
   ```
6. 确认后端可访问：`curl http://你的域名:8000/`

### 选项 B：本机开发测试（队友无法远程访问）

已有 Docker Desktop 即可，在 `D:\Desktop\Cat-new` 目录下：
```bash
# 创建 .env（从 .env.example 复制），填入 AppID/Secret
docker compose down -v
docker compose up -d --build
```
验证：浏览器打开 `http://localhost:8000/docs`

---

## 第三阶段：配置小程序服务器域名

- [ ] 登录 mp.weixin.qq.com
- [ ] 左侧：开发 → 开发管理 → 开发设置 → 服务器域名
- [ ] 点击「修改」：
  - **request 合法域名**：填 `https://你的域名.com`（必须 HTTPS，端口 443）
  - **uploadFile 合法域名**：同上
  - **downloadFile 合法域名**：同上
- [ ] 保存（每月可修改 5 次）
- [ ] 注意：域名必须已备案 + 有 SSL 证书

  > 开发测试阶段可用「不校验合法域名」绕过（微信开发者工具 → 详情 → 本地设置 → 取消勾选）

---

## 第四阶段：小程序视觉收尾

### 4.1 替换 Tab 图标
- [ ] 当前 `cat-miniprogram/src/assets/tab/*.png` 是 1x1 像素占位图
- [ ] 需要 10 个 PNG（48x48 px），每个图标 2 个版本（灰色默认 + 橙色选中）：
  | 文件 | 内容 |
  |------|------|
  | `home.png` / `home-active.png` | 首页图标 |
  | `map.png` / `map-active.png` | 地图图标 |
  | `scan.png` / `scan-active.png` | 识猫图标 |
  | `community.png` / `community-active.png` | 社区图标 |
  | `profile.png` / `profile-active.png` | 我的图标 |
- [ ] 用 Figma/Canva/即时设计 画，或用 iconfont 下载

### 4.2 修改小程序名称
- [ ] `project.config.json` 第 4 行 `"projectname"` 改为你的名字
- [ ] `app.config.ts` 第 18 行 `navigationBarTitleText` 改为你的名字

---

## 第五阶段：真机测试

- [ ] 微信开发者工具 → 顶部「预览」→ 生成二维码
- [ ] 手机微信扫码 → 测试以下流程：
  - [ ] 微信登录能否成功获取用户信息
  - [ ] 拍照识猫：选图 → 识别 → 显示结果
  - [ ] 地图：定位 + 显示标记
  - [ ] 社区：发帖 + 评论 + 点赞
  - [ ] 我的：显示个人资料
  - [ ] 拉取刷新是否正常
- [ ] 记录所有问题 → 在 GitHub Issues 建任务

---

## 第六阶段：提交审核

### 6.1 上传代码
- [ ] `npm run build:weapp`（最终构建）
- [ ] 微信开发者工具 → 右上角「上传」→ 填写版本号（如 1.0.0）
- [ ] 上传后代码进入「版本管理」

### 6.2 提交审核材料
- [ ] 登录 mp.weixin.qq.com → 管理 → 版本管理
- [ ] 开发版本 → 选为「体验版」→ 配置体验成员（加队友微信）
- [ ] 提交审核，需填写：
  - 服务类目：工具 → 信息查询
  - 功能页面：pages/index/index
  - 测试账号（如需要登录才能体验）
- [ ] 审核通常 1-7 个工作日

### 6.3 审核合规要点
- [ ] 隐私协议：用户首次登录需弹出同意框（参考中大猫谱）
- [ ] 内容安全：社区发帖需有举报 + 审核机制（已有）
- [ ] 位置权限：仅在使用地图时申请（app.config.ts 已配置）
- [ ] 相机权限：仅在使用拍照时申请

---

## 上线后迭代

- [ ] 微信后台 → 版本管理 → 提交新版（审核 1-2 天）
- [ ] 用户端自动更新，无需重新下载
- [ ] 灰度发布：可先推 5% 用户测试

---

## 当前状态速查

| 项目 | 状态 |
|------|------|
| 小程序代码 | ✅ 13 页面完成，编译通过 |
| 后端 API | ✅ 微信登录 + 审核流 + 社区已就绪 |
| Web 版 | ✅ React + Docker 运行中 |
| 微信账号 | ⬜ 需注册 |
| 服务器 | ⬜ 需购买/配置 |
| Tab 图标 | ⬜ 占位图需替换 |
| 真机测试 | ⬜ 未测 |
| 审核提交 | ⬜ 未提交 |
