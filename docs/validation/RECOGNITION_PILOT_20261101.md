# 识别评测工具与公开样本预评测

日期：2026-11-01。基线 `1176594`。用户选择先用公开、带个体标注的数据做小规模预评测；本轮不代表校园实测或跨场景泛化验收。

## 评测口径修复

ISS-015 的函数参数兼容修改此前只经过模拟测试。本次检查又发现 ISS-042：旧脚本把 API 阈值判定后的 `cat_name`/候选列表当作检索排名，第一候选正确但为 uncertain 时，Top-1 记成 0；confirmed 时丢失其余排名，名字相同也可能掩盖身份错误。旧脚本不支持未知猫/无猫分组，读文件失败会跳过，没有固定模型、参考库及输入版本。

旧脚本的统计错误已由[失败回归](recognition-metrics-before.log)复现。现在内部 `recognize_with_details` 与 API 共用同一推理路径，提供未经过确认阈值筛选的排名。公开 HTTP 返回结构、阈值和识别决策保持不变；内部诊断不会把低分猫身份附加到公开 unknown 响应。

新脚本使用显式 manifest 与持久 `reference_id`，校验数据库、快照、参考图全集、每张文件 SHA256 和解码像素。拒绝重复内容、重新编码的同像素图、参考图与查询图混用、错误身份映射、目录越界、缺图和坏图；dHash 距离不超过 4 的相似图另外列出供复核。运行中再次核对文件和发布版本。不能把这些检查当作拍摄场景或训练数据独立性的证明。

逐图输出原始排名、分数、业务状态、耗时、错误码和文件哈希；另记录模型/检测器/参考库、依赖、预处理、阈值和源码哈希。无法推理时保留样本与分母，返回退出码 2。退出码 0 只表示评测完整执行，未设置准确率合格门槛。

| 指标 | 口径 |
|---|---|
| 已知猫 Top-1 / Top-3 | 未经过确认阈值筛选的前 1 / 3 个猫身份是否包含真值；分母为全部已知猫查询 |
| 已知猫错误确认 | confirmed，但持久身份错误 |
| 已知猫误拒绝率 | 返回 unknown / 全部已知猫；uncertain、unavailable 另列，不混算为 unknown |
| 未正确确认率 | 未得到正确 confirmed / 全部已知猫，含待确认和不可用；这是业务覆盖口径 |
| 未知猫 / 无猫误接受率 | confirmed / 对应分组全部样本；uncertain 候选暴露率另列 |
| 确认精确率 | 正确确认的已知猫 / 三组中所有 confirmed；零分母输出 null |
| 延迟 | 独立进程首次查询，以及其余串行查询 p50/p95；包括参考库校验，不含 HTTP，不是容量结论 |

## 数据、划分与可解释范围

固定清单：[recognition-pilot-manifest.json](recognition-pilot-manifest.json)。包含原始下载 URL、SHA256、个体标签、分组和选择理由；仓库不保存数据集照片。

- 猫数据来自 [Cat Individual Images v1](https://www.kaggle.com/datasets/timost1234/cat-individuals)，发布说明署名 Tzu-Yuan Lin，Kaggle 发布者 timost1234，许可标为 CC BY 4.0。其拍摄来源主要是台湾收容所，另含社交媒体。按目录个体标签使用，不把品种标签当个体。
- 初始目录只纳入直接位于个体文件夹的 JPEG/PNG，排除更深层重复目录与 HEIC；500 个至少有 8 张支持格式图片的目录为候选，固定 seed=20261101。已知猫每只 2 张建库、3 张查询；未知猫完全不入库。抽样与排除在推理前完成。
- 视觉检查排除 0023/0026（疑似跨目录重叠或混杂）及 0031/0063/0509（多猫且缺少目标身份框）；用固定备用随机顺序补足 12 个已知身份。初始选择和排除理由保留在本地 artifacts 及清单中，没有按模型结果筛掉困难样本。
- 最终 **24 张参考图、36 张已知猫查询、18 张未知猫查询（6 个身份）、8 张无猫对照，共 86 张**。无猫照片来自 [scikit-image v0.25.2 数据](https://github.com/scikit-image/scikit-image/tree/v0.25.2/skimage/data)，固定到提交 e8a42ba85aaf5fd9322ef9ca51bc21063b22fcae；逐项来源及 CC0/公有领域说明见其 `_fetchers.py`。对照含人物、咖啡、纹理、太空与火箭，已视觉确认无可见猫；不涵盖狗、玩具猫、屏幕猫等困难负样本。
- 全部保留图片已在推理前检查联系表。猫身份仍依赖数据提供者标签，未由饲养者复核；近似姿态、背景和同次拍摄风险仍存在。不能把不同文件名或简单图像哈希差异称为跨场景独立测试。
- [当前模型卡](https://huggingface.co/theavenger/cat-reid-dinov3) 只说明训练涉及 131 只猫，没有公开训练图片/身份清单，因此与本次公开样本的训练重叠未知。本轮不关闭全项目许可专项 VER-007。

本轮保持确认阈值 0.57、候选阈值 0.49，不使用这些查询调参。没有独立校准集、目标业务通过线或足够多困难负样本；VER-001 仍不能关闭。

## 运行与结果

本地使用完整 CPU 镜像，固定上轮已验证的 DINOv3 与 YOLO 权重；隔离新 SQLite、uploads 与托管参考库，真实 worker 构建并发布 24 条向量，查询在另一个进程中执行。容器运行时禁网，模型与原始数据只读挂载，不连接业务数据库。

本地后端全量 **257 passed / 68 warnings / 200.27 秒**，见[日志](recognition-backend-local.log)；评测、快照和检测器定向回归 44 项通过。评测代码提交 `15a58f0fd1b839c4536f6dd183b445f33aabe4a7`，本地与[手动远端运行 41298488843](https://github.com/54123-phoenix/cat-cat-cat/actions/runs/41298488843) 均完整执行 62 张查询。见[本地结果](recognition-pilot-local.json)、[远端结果](recognition-pilot-ci.json)、[运行状态](recognition-pilot-ci-run.json)及[对照](recognition-cross-environment.json)。

[本机构建任务](recognition-build-local.json)和[远端构建任务](recognition-build-ci.json)均为 succeeded / published，完成 24/24 张参考图；[本地逐图运行日志](recognition-pilot-local.log)保留实际执行过程。两次运行各自创建新的数据库与发布版本，按冻结来源标签和图像哈希核对，不要求随机生成的数据库身份或快照 ID 相同。

| 分组 | 本地与远端一致的结果 | 解释 |
|---|---|---|
| 已知猫，36 张 / 12 个身份 | Top-1 33/36 = 91.67%；Top-3 36/36 = 100% | 33 张正确确认，1 张错误确认，1 张待确认，1 张 unknown |
| 未知猫，18 张 / 6 个身份 | **9/18 错误确认 = 50%**；3 张待确认，6 张 unknown | 错误确认涉及 4 个未知身份，不能当作 18 个独立个体实验 |
| 无猫，8 张 | 0/8 错误确认；全部 unknown | 仅限所列简单负样本；不证明困难负样本稳健性 |
| 三组全部确认 | 43 次 confirmed 中 33 次正确，精确率 76.74% | 强烈依赖本次三组的构成比例，不能外推到真实流量 |
| 可用性 / 输入 | unavailable=0，输入错误=0；无 exact/pixel 重复或 dHash<=4 候选 | 不代表没有近似姿态、相同背景或同场拍摄相关性 |

已知身份 0318 的三张查询分别返回 uncertain、错误的 0372、unknown，均未得到正确确认。未知身份 0068、0078、0181、0243 中有样本被确认成参考库里的其他猫；逐图路径、分数和候选在 JSON 中保留。不能通过只展示已知猫 Top-1 来掩盖未知猫误接受。

两环境逐图标签、业务状态和排名完全一致，最高分差不超过 2.63e-6。**评测工具按 ISS-015/042 范围通过，识别质量 VER-001 保持未关闭：当前默认阈值在此预评测中存在明显误接受。** 没有根据这组查询修改阈值。由于结果已经被查看，这份清单以后可以用作回归样本，不能再作为阈值校准后的独立最终测试集。

源码原始字节哈希有三项因 Windows CRLF 与 Linux LF 换行不同而不相等。已分别核对本机实际文件和 `15a58f0` 的 Git blob，五项源码在统一换行后完全相同；原始哈希保留不改，核对结果附在[两环境对照](recognition-cross-environment.json)中。

本机 Docker Desktop/Windows bind mount：首个查询 8.23 秒，其余串行查询 p50=6.79 秒、p95=7.63 秒。远端 Linux 限制 2 CPU/8 GiB：首个 4.06 秒，其余 p50=2.22 秒、p95=2.40 秒。两者包含图片/模型/参考库完整性检查和推理，硬件与挂载方式不同，没有拆分计时，不能将差异归因于某一个组件，也不能当作 HTTP 并发容量结果。

## 同轮浏览器门禁时序修复

评测提交的[首次常规 CI 41298469285](https://github.com/54123-phoenix/cat-cat-cat/actions/runs/41298469285)六项通过，浏览器重连项失败，见[原断言](recognition-reconnect-ci-before.log)。失败发生在首次 SSE 建立后的帖子刷新：服务日志显示同一时间窗口内新帖写入与浏览器 GET /api/posts 并发，页面合法地提前取得了新帖，但测试要求断线时它必须不存在。

修复提交 `2c829fff877b1dda4a7d5c32a22e2c0b149a1611` 在测试脚本里记录真实 fetch 的完成状态，等待首次 onopen 引发的帖子读取结束，再启动断线与写帖步骤。返回原始 fetch promise，不替换响应、不删除“断线时缺失/重连后可见”的断言，也没有修改产品刷新逻辑。归入 ISS-030 的验收时序维护。

修复后[本机重连](recognition-reconnect-local.json)和[远端重连](recognition-reconnect-ci.json)均为 **10/10 passed、page_errors=[]**，初始帖子读取均为 pending=0 / completedAfterOpen=1；[本机日志](recognition-reconnect-local.log)保留执行顺序。长断线场景分别持续 88.44 / 76.43 秒，均自动恢复。Chromium 均为 156.0.8078.4，Redis 分别为 7.4.9 / 7.4.12。

[最终常规 CI 41298934883](https://github.com/54123-phoenix/cat-cat-cat/actions/runs/41298934883)对应修复提交 `2c829ff`，**七项全部成功**，见[运行摘要](recognition-ci-summary.json)。后端 **257 passed / 69 warnings / 74.72 秒**，见[CI 日志摘录](recognition-backend-ci.log)；比本机多一条 Linux `crypt` 弃用警告，未关闭告警规则。Web、小程序、Redis、Docker API 和完整 CPU 推理通过；[核心浏览器 6 组](recognition-core-browser-ci.json)与[参考库浏览器 8 组](recognition-reference-browser-ci.json)也全部通过。浏览器参考库场景使用合成推理适配器；真实模型质量证据来自前述独立手动评测。

本轮评测与浏览器临时容器已退出并清理，本轮专用评测镜像已删除；下载样本、模型和本地隔离评测资料保留在忽略的 artifacts 目录，便于复核。没有改动业务数据库或其他项目容器。后续提交仅补本文、README、台账及证据，代码验收版本以上述 SHA 为准。

## 复跑

新评测入口使用 `--manifest`，不再接受仅凭文件夹名字推断身份的 `--crops-dir/--per-cat/--limit`。迁移旧调用时，先列出全部参考/查询图片及身份映射，绑定当前数据库与快照；不从旧文件夹名称猜测真值。

```bash
# 仓库根目录；宿主需要 httpx 0.27.0、Pillow
python scripts/inference_assets.py --output-dir artifacts/inference-models
python scripts/prepare_recognition_pilot.py --frozen-manifest docs/validation/recognition-pilot-manifest.json --output-dir artifacts/recognition-data
docker build --target inference --build-arg PIP_INDEX=https://pypi.org/simple -t cat-public-pilot cat-backend
```

完整容器命令见 [手动评测工作流](../../.github/workflows/recognition-pilot.yml)。它只创建新的测试库，在没有网络的容器内构建并运行 `run_recognition_pilot.py`；输出目录已存在时拒绝覆盖。也可在已有完整 Python 推理环境中运行该脚本，指定新输出目录。已有兼容参考库只需调用 `cat-backend/scripts/eval_recognition.py --manifest <绑定清单> --output <结果>`。

手动工作流只上传结果、绑定清单、构建任务和日志，不上传图片、数据库或权重。CI 绿色只说明执行成功；质量结论必须阅读逐组指标、失败样本与以上边界。
