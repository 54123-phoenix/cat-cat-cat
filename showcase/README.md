# 界面截图来源

2026-10-30，修复工作区，基线 `f350468e` 加本轮未提交变更。截图由 `scripts/verify_browser.py` 使用本机 Edge 无头浏览器生成，390×844，真实 Vite→FastAPI→临时 SQLite 请求，没有替换网络响应。

临时库只有演示用户、3 只演示猫、1 条已审核偶遇和 1 条帖子，非线上数据。截图分别对应 `/`、`/scan`、`/map`、`/community`、`/badges`。地图没有配置服务 Key，截图仅展示回退状态；识猫页没有运行真实模型。截图不是完整功能验收证明。

小程序 tab 图标使用同一 Web `TabBar.tsx` 中的 Lucide Home / MapPin / Camera / MessageSquare / User，由 `scripts/generate_tab_icons.py` 生成灰色与橙色 48×48 透明 PNG；对应许可保存在资源目录 `LICENSE-lucide`。微信真机显示尚待 VER-002 验收。
