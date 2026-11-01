# 校园照片整理与验收准备

2026-11-01：已从项目历史指向的 Hugging Face 备份找回部分照片，详见[盘点证据](validation/CAMPUS_ASSETS_20261101.md)。用户现有照片缺少详细说明，因此先保留原图与可追溯信息，再逐批核对身份和场次。当前不能开始校园质量验收，也没有把公开数据候选设为业务默认。

来源补充：已通过正常小程序响应采集复旦猫协完整当前目录，37 页、727 个不同 petId；受个人电脑资源限制，图片只下载 94 张（约 47.2 MiB），其余保留地址索引。旧 91 个名称中 90 个完全同名，仍需核实身份；至少 4 个源站 cat 档案显示犬类。远端样本、回下载校验和剩余条件见[原站核对记录](validation/MEOWZART_SOURCE_20261101.md)。这不关闭历史备份缺口或校园质量验收。

按用户最新决定，现有 94 张照片已[离线更新到本地主图库](validation/MEOWZART_IMPORT_20261101.md)：94 个头像，其中 92 张登记参考，豆腐/豆花两张拼图仅展示。此后停止新图片采集，不重新训练模型；以下身份/场次整理要求仍适用于未来使用现有材料进行独立质量验收，不能把本轮参考图自匹配当作留出评测。

## 已有材料怎样使用

| 材料 | 可以用于 | 不能据此认定 |
|---|---|---|
| 找回的原图、SHA256 | 建立候选清单，核对是否同一文件 | 猫身份、拍摄地点、使用授权 |
| EXIF DateTimeOriginal | 找摄影者核对日期，辅助划分场次 | 自动认定日期正确、不同文件就是不同场次 |
| 目录名、数字文件名、旧猫名 | 寻找原始档案和投稿记录的线索 | 已核实个体身份；文件名中数字的语义尚未确认 |
| 旧 `cat_embeddings.json` | 盘点旧猫名、向量数量 | 当前数据库或图片与身份的可信映射 |
| 导入脚本生成的档案 | 演示数据来源追溯 | 校园地点、性别、年龄、绝育状况或拍摄时间 |

历史照片备份的三个分卷均只有 500 MiB，拼接后压缩流提前结束（ISS-043）。本轮恢复了可完整读取的前缀，不视为完整备份。`scripts/sync_assets.ps1` 现在明确失败并指向本文，避免继续调用已删除脚本后输出“完成”。真实模型下载使用 `scripts/inference_assets.py`，与恢复业务照片分别处理。

## 准备工具

在仓库根目录，用后端 Python 3.11 环境执行；只需已有 Pillow 依赖，不加载 Torch、不连接业务库。示例输出必须是新文件，工具拒绝覆盖。

```powershell
python cat-backend/scripts/prepare_campus_dataset.py inventory --root artifacts/campus/source-audit --source-ref https://huggingface.co/datasets/echophoenix/cat-cat-data/tree/61e619ea06bba63f48d03f470794ae8d24870bcc --output artifacts/campus/inventory-new.json
python cat-backend/scripts/prepare_campus_dataset.py check --root artifacts/campus/source-audit --manifest artifacts/campus/source-audit/review-manifest.json --output artifacts/campus/readiness-new.json
```

本轮本机候选材料在 `artifacts/campus/source-audit/`，受 Git 忽略规则保护；Git 仓库只提交代码、统计与证据，不再次发布原图。新检出的仓库不会自带该目录，应将 `--root` 改为自己持有的照片目录，然后先执行 inventory。

- `candidate-manifest.json`：盘点全部完整图片文件；不填猜测的身份、日期和场次。
- `review-manifest.json`：人工填写入口，132 份完全重复的静态图副本已标记 excluded，并记录保留样本 ID；其他记录仍待核对。
- `readiness.json`：本轮检查为 `needs_preparation`，`release_quality_passed=false`。
- `contact-24.jpg`：按去重后文件顺序等距抽出的 24 张联系表，仅作来源和场景初查。

填写 JSON 时保留 `sample_id`、`file`、`sha256`。若修改了照片内容，重新盘点并保留旧清单，不手改哈希掩盖数据变动。

## 需要补充的记录

先选猫协或饲养者能够确认的一批照片，其余按明确原因排除。无需给缺失信息编造答案。

| JSON 位置 | 填写内容 |
|---|---|
| `dataset_id` / `campus` / `source_ref` | 数据集版本、实际校园及来源记录 |
| `gallery.identity_ids` | 拟验收的完整实际图库身份集合；由 `reviewer` 和 `evidence` 说明核对依据，不用旧向量的 91 个名称直接代替 |
| `identities[]` | `identity_id`、核对人 `reviewer`、身份依据 `evidence`；同一猫多个昵称合并为同一持久标签 |
| `sessions[]` | `session_id`、`captured_at`（ISO 日期或时间）、`time_basis`、`reviewer`、`evidence` |
| 每张图的 `review` | `reviewer`、`evidence`，包含校园来源和该图身份/负样本类别的核对记录 |
| `source_evidence` / `usage_evidence` | 原投稿/档案依据，以及照片用于本次评测的授权或许可依据；备份可访问不等于授权已核实 |
| `partition` | `reference` / `calibration` / `holdout` / `excluded`；排除需写 `excluded_reason` |
| `kind` / `scene` | 已知猫 `known`、未知猫 `unknown_cat` 对应 `single_cat`；`no_cat` 对应 `no_cat` / `screen` / `toy` |
| `identity_id` / `session_id` | 引用上面的身份和场次；无猫图片的身份必须为 null，场次仍需记录 |

`time_basis` 只接受 `original_exif_reviewed`（人工核实过的原始 EXIF）或 `photographer_record`（摄影者记录）。文件修改时间、导入时间和 Hugging Face 上传缓存时间不能代替。场次代表实际的一次拍摄，ID 在整份数据中唯一；同次拍摄中不同猫也属于同场次。无法核实的图片暂不参与跨场次验收。

参考、校准、留出三组一起校验。相同场次不能跨任何两组；已知猫必须在完整图库内，未知猫必须不在图库内。工具检查精确和解码像素重复；dHash 距离 ≤4 的候选需人工复核，`near_duplicate_reviews[]` 记录 first/second 样本 ID、`decision: distinct_capture`、核对人、依据及 `sha256_by_sample`。确为重复或同场照片时应排除/重新划分，不能仅填一条“已确认”来放行。dHash 不覆盖所有相似照片，仍需检查连拍、同背景和裁剪副本。

当前单目标识别评测不能给多猫同框随意指定一个“正确身份”。这类照片另存清单并明确排除原因，后续按检测/选猫交互协议单独验收。双帧 MPO、GIF 等多帧文件需先确定评测哪一帧、保留来源关系，再生成独立静态样本。

## 准备检查通过后的边界

退出码 0 仅表示清单的结构、已填审核记录与内容检查通过；退出码 2 表示仍需准备或输入无效。工具无法替人工证明声明的身份、日期、校园或授权真实，也不生成模型准确率。

该工具是独立准备入口，**尚未接入 `eval_recognition.py` 或校准工作流成为强制前置条件**。在真正执行校园验收前，仍需把完整实际图库、模型/预处理、身份及场次记录、样本量和业务目标冻结为新的实验协议，并绑定准备清单哈希；创建隔离参考库后，再用适配校园协议的评测入口执行。不能绕过这一步直接把公共预评测协议改名为校园验收。

用户已选定临时业务目标：未知猫误确认 ≤5%，已知猫正确确认 ≥80%。还须明确样本量、统计口径及多猫等独立场景的标准；小样本百分比通过不能证明总体可靠性。训练数据重叠和目标硬件容量继续单独跟踪。当前已消耗的公开留出集只作诊断，不再拿来调参。
