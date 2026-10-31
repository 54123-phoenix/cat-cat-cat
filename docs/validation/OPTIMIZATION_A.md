# 优化 A：交付基线与浏览器门禁

日期：2026-10-30。当前工作区改动，尚未提交、推送或部署；实际业务库未修改。历史 [REPAIR_PROGRESS](REPAIR_PROGRESS.md) 与原 SHA 清单保留，本文件记录新增工作。

## A1：安装与资源门禁——本地通过

**问题**：Web/小程序 checkout 缺少 LFS 拉取，构建不检查图片是否可解码；小程序地图 `cat.png` 有 PNG 头但内容损坏。后端版本只支持本轮验证的 Python 3.11，误用 Python 3.13 时旧 pydantic-core 依赖无法安装。

**实现**：CI 使用 `lfs: true`；新增 `scripts/check_assets.py` 检查目录、LFS 指针、图片解码和 1×1 占位图。Web/小程序构建前检查，小程序构建后再次检查静态资源。地图图标改为同源 Lucide 48×48 透明 PNG，生成脚本一并维护。Web Docker 使用 Node 24 和 `npm ci`。本地安装文档明确 Python 3.11。

**验证**：

- 基线本地 clone 跳过 LFS smudge 后，showcase 中的 LFS 指针被拒绝；旧 tab 素材是原始 1×1 图，也被拒绝，不把它们误写成 LFS 指针。
- 当前工作区导出 420 个受版本控制或非忽略文件到新目录，无 node_modules、.env、业务数据库或上传目录，执行两端 `npm ci`；包管理器下载缓存可能复用，不声称已验证网络完全无缓存下载。
- Web：48 项测试、类型检查、lint 和构建通过；小程序：5 项请求合同测试、类型检查及微信目标构建通过；构建后 10 个静态图标通过资源门禁（地图图标被构建器内联，另在源码检查）。
- 新建 Python 3.11.9 虚拟环境安装 requirements-dev 成功，后端 168 项通过，包含空库/旧库/重复升级测试和 5 项资源门禁测试。当前三组源资源共 30 张图片，0 失败。
- 原始导出、输入 SHA 与日志位于同级 `cat-cat-cat-review/optimization-a1/`；候选输入清单另存为本目录的 `optimization-a1-inputs.json`。

**限制**：工作区尚未提交，所以“当前工作区导出验证”不等于远端检出或远端 CI 成功。npm 安装报告 Web 16 项（8 moderate / 8 high）、小程序 80 项（27 moderate / 41 high / 12 critical）依赖告警，含开发/传递依赖；尚未按实际可达性逐项分诊，也未使用破坏性的自动升级。Python 依赖仍有开放版本范围，不等同完整锁定环境。真实微信显示及 Docker 构建未验收。

**回退**：可单独还原门禁、CI 和图标修改；不涉及数据库结构或业务数据。

## A2：浏览器与显式迁移——本地通过

**问题**：旧浏览器脚本固定 Windows Edge、端口与 showcase 输出，无法直接在 Linux CI 执行；应用导入时 create_all 掩盖漏迁移。新浏览器链路进一步复现两处缺陷：管理身份验证请求失败误清凭据；偶遇创建模型漏掉 location_name，导致后端静默丢弃地点名称。

**实现**：

- 浏览器脚本默认 Chromium，支持 Edge、端口、输出目录；固定临时数据库与测试凭据。正常结果不改展示图；失败自动保留 result.json、日志、异常、页面截图和 trace。CI 新增独立 browser-smoke job，失败也上传产物。
- 移除导入时建库；启动前核对 Alembic head、必需表和列，失败时给出明确诊断。先检查结构，再初始化 Redis/管理员等运行状态。迁移读取后端 .env，环境变量优先；后端 Docker 默认启动先迁移，Compose 保持既有迁移步骤。
- 三组遗留 API 测试改为模块隔离的数据库与依赖覆盖；只给这些测试 create_all 库标记版本，生产没有跳过检查的开关。真实迁移和启动测试通过独立进程执行。
- 管理端仅在 401/403 时退回登录，网络错误/503 保留凭据并显示重试；验证失败时不显示可操作管理台。补齐 SightingBase.location_name，HTTP 回归同时核对响应及数据库持久值。管理列表新增待审状态、通过/拒绝按钮，使用管理员凭据调用审核 API；请求失败保留待审状态，不虚报成功，成功后刷新列表和看板。

**验证**：

| 检查 | 结果与边界 |
|---|---|
| 后端全量 | 172 passed / 52 warnings；增加 4 项真实进程启动测试。地点修复后相关 7 项合同测试再次通过 |
| 启动行为 | 导入不生成 DB；不存在的库、未标记库、旧 head 均阻止启动；显式升级后成功且旧记录保留；head 正确但缺列时拒绝，不自动修复 |
| Web | 52 项测试、类型检查、阻断 lint、生产构建通过；主 chunk 502.80 kB，警告仍存在 |
| Edge 156，390×844 | 六组流程通过，0 pageerror；包括真实 API 保存待审→角色拒绝→管理列表→审核→公开列表/热力数据/本人图鉴 ID；503 是明确的故障注入，401 来自真实服务验证过期签名 token |
| 失败产物 | 第一次跨角色测试因地点名称丢失失败，已实际产生 failure.png、trace.zip、failure.txt、servers.log、result.json，保留于 artifacts/optimization-a2-browser；修复后的独立结果在 artifacts/optimization-a2-browser-pass |

新增 Chromium 156.0.8078.4 验收：在独立 Python 3.11 环境安装 requirements-browser.txt 和 Chromium 成功，六组流程通过，0 pageerror；其中审核已改为浏览器点击“通过”，公开列表/地图/本人图鉴 ID 仍通过真实 API 校验。组件测试另覆盖通过、拒绝、服务失败后的重试与凭据选择。机器可读最终结果见 [Chromium 结果](optimization-a2-browser.json)；最终日志在 artifacts/optimization-a2-chromium。本轮相关源码 SHA 见 [清单](optimization-a-files.sha256)。Windows Chromium 通过不冒充 Linux CI 通过。

**限制**：保存动作由 Playwright API 发起，审核由真实 UI 点击完成；没有据此宣称摄像头/上传 UI 已验收。管理偶遇仍只展示最近 20 条，审核队列分页和筛选需在合同/页面优化阶段继续补齐。结构检查只检查版本、表、列，不替代约束/索引审计。GitHub Actions 远端、Docker daemon、真实模型、Redis、微信及外部地图/LLM 未通过本轮验收；ISS-028 参考库生命周期仍未实现。

**回退**：应用和脚本修改可按本次差异还原；本轮未新增业务 schema 迁移，head 仍为 g20261030。回退应用不应删除已经迁移的业务数据。

## 后续顺序

下一项按原计划为 B1：持久猫身份、数据库/参考库身份及模型/产物清单，拒绝错库和错模型。随后 B2/B3 安全重建、发布、回滚和多进程刷新；管理可见性阶段继续补齐审核队列分页/筛选。新增依赖漏洞分诊进入交付债务队列，优先检查对外可达的生产依赖，然后处理构建链，不盲目 `npm audit fix --force`。
