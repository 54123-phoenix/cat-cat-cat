# 蓝白校园猫 Web 素材

2026-11-09 用户确认的 A 形象 + B 插画质感融合版。角色是社区吉祥物，不是复旦大学官方校徽，也不用作真实猫档案的替代照片。

- `mascot-{192,384,768}.webp`：透明全身图，欢迎区、空状态与分享插画。
- `mascot-head-{96,192}.webp`：专用头像裁切，导航与登录页。
- 两张 PNG：WebP 加载失败的备用图。
- `icon-{32,64,180}.png`：浏览器图标和 Apple touch icon。
- `mascot-social.png`：社交预览图，页面默认不加载。

完整源图、提示词、模型许可来源、透明蒙版与可复现处理脚本见仓库 `output/imagegen/fudan-blue/hybrid/`。源图由 FLUX.1-schnell 参考方案与本地 SDXL 流程制作，本轮没有重新生成角色。使用 rembg 2.0.67 的 IS-Net 分割，再以 alpha matting 清除白底边缘；未对整个图像做白色抠色，保留白毛和光影。

处理脚本：`output/imagegen/fudan-blue/hybrid/prepare_web_assets.py`；文件哈希与尺寸：同目录 `web-asset-manifest.json`。

运行时只加载这些静态图片，不依赖 Python、生成模型、外部图床或 API 密钥。字体沿用项目中的 Noto Sans SC。
