# 模型健康检查与阈值校准

P5-01 的目标是让识别链路可观测、可解释、可安全降级。

## 健康接口

系统健康入口：

```text
GET /api/system/health
```

默认检查内容：

- PyTorch 运行时是否可用
- 模型权重文件是否存在且非空
- reference embedding 文件是否存在、可解析、维度一致
- `RECOGNIZE_THRESHOLD_CONFIRMED` 与 `RECOGNIZE_THRESHOLD_UNCERTAIN` 是否有效
- warm model load 是否跳过

需要实际加载模型权重时使用：

```text
GET /api/system/health?warm_model=true
```

默认不做 warm load，是为了让普通健康探针保持轻量；发布前、演示前、部署后首轮验收可以启用 warm check。

## 状态语义

- `healthy`：必需检查通过。
- `degraded`：核心文件与配置可用，但存在可接受的跳过或告警项。
- `unhealthy`：模型运行时、权重、embedding 或阈值配置存在阻断问题。

识别接口仍保持原有四态契约：

```text
confirmed | uncertain | unknown | unavailable
```

健康接口只解释模型是否可用，不改变 `/api/recognize` 的响应形状。

## 阈值校准建议

当前阈值通过环境变量配置：

```text
RECOGNIZE_THRESHOLD_CONFIRMED=0.45
RECOGNIZE_THRESHOLD_UNCERTAIN=0.30
```

校准时建议维护一个固定样本集：

- 每只已知猫至少 5 张正样本。
- 至少 30 张非目标猫、模糊图、非猫图作为负样本。
- 样本集不要混入训练 reference photo。
- 每次调整阈值后记录 confirmed、uncertain、unknown、unavailable 的数量变化。

推荐准则：

- `confirmed` 宁可少一点，也不要把错误猫高置信返回。
- `uncertain` 应覆盖相似猫、角度差异、遮挡等需要人工选择的场景。
- `unknown` 应承接疑似新猫和质量不足图片。
- `unavailable` 只表示模型链路不可用，不表示图片不是猫。

## 验收方式

每次改动模型链路后运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File harness/run.ps1 -Mode quick -ContinueOnFailure
```

阶段完成前运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File harness/run.ps1 -Mode full -ContinueOnFailure
```
