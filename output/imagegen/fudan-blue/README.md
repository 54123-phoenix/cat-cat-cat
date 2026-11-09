# 复旦蓝校园猫形象方案

2026-11-09 已通过 Black Forest Labs 的 [FLUX.1-schnell 官方公开演示](https://huggingface.co/spaces/black-forest-labs/FLUX.1-schnell)可见页面，实际生成并保存三种校园猫形象。原图均为 1024×1024 WebP。

用户随后选择“第一张的具体形象 + 第二张的插画风格，并加强立体感”。现已通过独立本地 SDXL 图像编辑流程完成 [融合版原图、前后对比与记录](hybrid/README.md)，去掉胸饰并增加柔和毛发和光影。用户已确认融合版，透明插画和头像裁切已接入本地 Web。

## 已生成方案

| 方案 | 原图 | 当前状态 |
|---|---|---|
| A · 蓝白校园猫 | [01-campus-cat-v1.webp](flux/01-campus-cat-v1.webp) | 平面概念草图；存在额外胸饰，待精修后再评估导航头像和小尺寸标记 |
| B · 图书馆的猫 | [02-library-cat.webp](flux/02-library-cat.webp) | 已生成完整方案，供欢迎区和空状态方向选型 |
| C · 立体校园猫 | [03-ceramic-cat.webp](flux/03-ceramic-cat.webp) | 已生成完整方案，供较大尺寸形象展示选型 |

比较预览见 [contact-sheet.png](flux/contact-sheet.png)。本次实际提示集与生成记录分别为 [prompts.jsonl](flux/prompts.jsonl)、[generation-manifest.json](flux/generation-manifest.json)。原始构思提示保留在 [concepts.jsonl](concepts.jsonl)，不覆盖为 FLUX 执行记录。

三种方案以复旦蓝 `#0E419C`、深蓝 `#0B337B` 和蓝白配色为探索方向，均使用白底方便比较；生成图的实际像素颜色仍需在选型后校正。角色用于本社区形象探索，不作为学校官方标志。

第 4 次公开演示尝试针对 A 进行平面精修时，页面返回 **Guest quota reached**，未产出修订图；该路径未继续重试。后续融合版由本地模型生成，是独立的执行结果。

## 保留的 API 失败历史

在公开演示生成成功之前，曾使用 imagegen 技能原版 CLI，经 Emagen 对第一份提示调用 `gpt-image-2`（1024×1024，medium）。接口返回 **HTTP 403**，该 API 路径没有产出图片，另外两份也没有重复提交。FLUX 公开演示的成功不改变原 API 的授权结果。

导航、登录、欢迎区、空状态与分享已采用确认后的融合版；真实猫照片和语义图标继续保留。当前完成本地接入与隔离验收，不表示服务器已部署。
