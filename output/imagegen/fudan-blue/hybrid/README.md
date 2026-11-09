# 蓝白猫融合版

2026-11-09 根据用户选择完成一版：保留 A 的蓝白额纹、大耳朵、大蓝眼睛和坐姿，参考 B 的细腻插画质感，增强毛发、脸颊和前爪的柔和明暗，去掉原图多余胸饰。

- [最终原图（1024×1024 PNG）](mascot-hybrid-v1.png)
- [前后对比](before-after.png)
- [最终生成与处理记录](final-manifest.json)
- [设计约束](BRIEF.md)

用户已确认这版形象，现已接入本地 Web；尚未部署服务器。尾巴比 A 更蓬松，并出现白色毛发段；它保留的是 A 的主要形象特征，不是逐像素复制。

## Web 素材

[prepare_web_assets.py](prepare_web_assets.py) 对确认图做 IS-Net 前景分割与 alpha matting，保留白色毛发，清除白底边缘。原图未改动。[透明原图](mascot-transparent-v1.png)、[明暗底色与小尺寸检查](web-asset-preview.png) 和 [静态资产哈希](web-asset-manifest.json) 可直接复核。

WebP 全身图、头像裁切、PNG 备用图及 favicon 位于 `cat-frontend/public/brand/`。独立环境新增 [rembg](https://github.com/danielgatis/rembg) 2.0.67 和 [IS-Net](https://github.com/xuebinqin/DIS) 模型；模型缓存保存在 `D:\.cache\imagegen-models\rembg`，不会进入网站运行依赖。运行 `prepare_web_assets.py --reuse-mask` 可使用已保存的蒙版重建资产。

## 生成过程

本轮使用本机 GPU 运行 [Stability AI SDXL Base 1.0](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0)，模型版本固定为 `462165984030d82259a11f4367a4eed129e94a7b`，模型许可见上游的 Open RAIL++ 文件。执行时设置离线模式，参考图没有上传到外部服务。

A 是模型真实图像输入；B 是人工视觉分析后转写为提示词的风格参考，未作为模型图像输入。先局部修复胸饰，再比较重绘强度：低强度版本仍偏平涂，选用 768px、强度 0.82 的柔和版本，最后以强度 0.26 精修为 1024px。最终只对饱和蓝色区域作轻微色相和饱和度校正，保留光影；AI 原始输出仍单独保存。

参数与完整提示词见 [768px 方案记录](run-768-seed1109-volume-s72-82.json) 和 [1024px 精修记录](run-1024-seed1109-volume-s26-34-refined.json)。未选中的中间图保留作过程记录；其中直接生成的 1024px 版本有风格、阴影或伪文字问题，不作为交付图。

## 本地复用

独立运行环境：`D:\Desktop\fdmm\cat-cat-cat-review\imagegen-local\.venv`。模型：`D:\.cache\imagegen-models\sdxl-base-1.0`。项目 Web/API 依赖没有改动。CUDA 基础运算和实际生图均已通过，生成进程已正常退出。

[generate_local.py](generate_local.py) 记录局部修复、参考图重绘和精修流程；[finalize.py](finalize.py) 生成交付副本与对比图。Python 依赖见 [requirements-local.txt](requirements-local.txt)，另使用官方 CUDA 12.8 构建的 PyTorch 2.7.1、TorchVision 0.22.1。后续使用不同种子、参数或 `--tag` 保存新版本，保留此次原始结果。
