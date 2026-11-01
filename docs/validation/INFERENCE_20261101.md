# 完整 CPU 推理镜像与模型/参考库恢复验收

日期：2026-11-01。修复前基线 `d48f9eb`。本轮新增 ISS-040，完成 ISS-014 的真实运行时专项；不将参考图片自匹配当作独立样本识别准确率。

## 原始故障与修复

原始 Dockerfile 的完整 inference 阶段实际构建成功，但运行检查失败：

- 宽范围安装 Ultralytics 8.4.197 引入新依赖，将 HTTPX 0.27.0 升至 0.28.1、AnyIO 3.7.1 升至 4.15.1。FastAPI 0.104.1 要求 AnyIO < 4，`pip check` 返回 1，见[原始检查](inference-pip-before.log)。
- 原镜像 OpenCV 5.0.0 导入报缺 `libxcb.so.1`，见[原始导入失败](inference-import-before.log)。固定为 OpenCV 4.11 后也曾报缺 `libGL.so.1`，因此仅固定 Python 版本不足以修复。
- 默认 Torch 包附带 CUDA 库，但当前模型加载和推理使用 CPU。原镜像检查大小 9,949,321,288 字节，修复后 2,786,560,263 字节（约 9.27 → 2.60 GiB）；这是 Docker 报告的镜像大小，不是宿主磁盘净回收量。

现在固定 Torch 2.6.0、Torchvision 0.21.0、timm 1.0.22、Ultralytics 8.3.221、OpenCV 4.11.0.86 和 Hugging Face Hub 0.36.0。Docker 从 PyTorch CPU 索引安装运行时，用后端 `requirements.txt` 约束后续安装；安装 libgl1/libglib2.0-0，构建时执行 `pip check` 和实际导入检查。API 阶段继续不包含 Torch。传递依赖尚未形成完整 lockfile，实际解析版本记录在结果中。

## 权重、数据及隔离范围

工作区此前没有权重和新版已发布 store。旧 `cat_embeddings.json` 不能作为恢复成功依据。本轮从代码既有模型来源下载固定版本，下载及复用缓存都检查文件大小和 SHA256；脚本是 [inference_assets.py](../../scripts/inference_assets.py)。

| 文件 | 固定来源 | SHA256 |
|---|---|---|
| finetuned_best.pt | theavenger/cat-reid-dinov3，revision fefdd206f2a77ef7247ca583e5604441e5b3259f | 32f04b89e7f292ddfa9b6f9d1f97bc2f465981d40b149e383e988e6a1b4beb6e |
| yolov8m.pt | ultralytics/assets，release v8.3.0 | 5d4a90cdc7a21786cc59cd19778e9eafff836df9e2da32524737c7ee6efe4fe5 |

DINOv3 哈希与 Hugging Face LFS 元数据一致；YOLO 哈希是固定 release 下载后的内容标识。模型仓库的许可声明不能代替整条模型、数据及应用的许可核验，VER-007 保持待处理。

输入为仓库 `showcase/img/cat1.jpg` 和 `cat2.jpg`，建立两个测试档案、两张参考图和一个帖子。它们同时用于查询，只证明真实推理链路和自匹配一致性；没有独立已知猫、未知猫或无猫测试集。构建使用真实 YOLO 裁剪、DINOv3、256 维投影和 FAISS，没有替换推理函数或模拟成功结果。

脚本从 Compose 派生命令与网络，只替换为唯一项目名、全新命名卷、测试凭据和随机回环端口。API/worker 设置 OMP、MKL、OpenBLAS 各 2 线程。未使用或修改实际业务数据库、宿主业务挂载、Houseflow 容器及历史卷。

## 本地结果

Windows Docker Desktop 4.97.0、Linux/amd64 Engine 29.9.2，Docker 可用约 16 GB 内存/32 个逻辑 CPU。**完整容器 12 组全部通过**，见[完整结果](inference-local.json)：

1. inference 与 Web/nginx 镜像构建成功。
2. 依赖检查通过，真实权重严格加载成功；Torch 2.6.0+cpu，HTTPX 0.27.0。
3. 空库迁移、四个 Gunicorn worker、Redis 健康。
4. nginx 认证、档案创建、图片上传与读取。
5. 真实 HTTP 写帖通过 Redis/nginx 推送 SSE。
6. 独立 reference-worker 重建并发布两条真实 256 维向量，健康检查 healthy，HTTP 自匹配两猫均正确。
7. 容器重启后数据库、照片和任务日志持久，识别仍通过。
8. 停止 API 与构建 worker 后，整体复制数据库、uploads、models、reference-store；恢复到第二套全新卷，识别通过。
9. 损坏恢复卷中的权重，已预热服务返回 unavailable，无猫身份。
10. 损坏向量文件，返回 unavailable。
11. 损坏参考照片，返回 unavailable。
12. 每次恢复正确资产后，识别重新通过。

恢复前后迁移版本 `j20261031`、database_id、generation=4、快照/发布 ID、记录计数、照片/权重/向量/清单/指针/任务日志 SHA256 全部一致。SQLite integrity_check 与 foreign_key_check 均通过。操作结束清理两套测试容器、卷和网络。

两次自匹配均为 1.0；恢复后 HTTP 请求实测约 2.52 秒和 1.14 秒，仅是两次带缓存/预热差异的冒烟样本，不是延迟分位数或吞吐量结论。分数不是经过校准的正确概率。

ISS-014 另在相同完整镜像中执行真实 Torch 加载检查：完整权重成功；缺文件、损坏字节、删除投影参数、将投影维度从 256 改为 255 均返回 None。只在容器临时目录构造坏权重，原权重只读挂载；保持 `weights_only=True` 和严格加载。见[结果](inference-checkpoint-local.json)与[原始日志](inference-checkpoint-local.log)。无 Torch 环境仍由 API 阶段验收覆盖；按加载失败不得返回假模型的范围关闭 ISS-014，不关闭 VER-001。

## 重复执行与 CI

仓库根目录，宿主需要 Python 3.11、httpx 0.27.0、Pillow 及可用 Linux Docker/Compose：

```bash
python scripts/inference_assets.py --output-dir artifacts/inference-models
python scripts/verify_docker_runtime.py --models-dir artifacts/inference-models --output-dir artifacts/inference-runtime
```

省略 `--models-dir` 仍执行原有七组 API 阶段验收。`--prepare-only` 只检查配置；推理模式也会检查输入权重哈希，不把配置检查当作运行成功。

新增独立 `inference-runtime` CI 任务，执行权重校验、完整镜像、真实加载/错误权重检查与十二组恢复验收；上传结果、诊断日志与小型参考库，不上传权重或数据库。远端结果待实际运行后补记。

## 未关闭的范围

生产宿主机 bind mount、真实业务数据恢复、容量/并发、ARM/GPU、断电及跨主机文件系统未验收。当前 PowerShell 运维脚本仍只覆盖数据库与默认 uploads，完整 store/模型需在统一停写窗口另行备份；本轮容器演练不代表已完成通用生产恢复工具。

识别准确率、阈值、未知猫误接受率、无猫行为、独立评测脚本结果、微信、地图与 LLM 均不因本轮通过而改变验收状态。
