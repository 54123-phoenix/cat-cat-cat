# 已知问题与待验证事项台账

记录日期：2026-10-30，进度更新：2026-11-01。审查基线：[main / f350468e1d39de81e76416e315a4739516dd123c](https://github.com/54123-phoenix/cat-cat-cat/tree/f350468e1d39de81e76416e315a4739516dd123c)。

**当前结论：项目已有真实业务实现，但关键流程、权限边界、数据正确性和交付流程仍有缺陷，尚未达到稳定发布候选版的质量。** 本台账记录本次源码审查和本地验证结果，不把历史文档中的“已完成”当作验收结论，也不追溯推断缺陷最早出现的时间。

初始登记 32 项问题（19 项 P1、13 项 P2），修复轮新增 ISS-033、优化轮新增 ISS-034/035（均 P2），C 复验新增 ISS-036/037（P1），远端多进程复验新增 ISS-038（P1），浏览器重连复验新增 ISS-039（P2），完整推理复验新增 ISS-040（P1），同轮 Redis 复验新增 ISS-041（P1），评测复验新增 ISS-042（P2），原照片备份核验新增 ISS-043（P1），合计 43 项。当前 **32 项通过本地验收，7 项代码已有修复但专项验收未完成，3 项部分完成，1 项未解决；另有 7 个 VER 专项分范围跟踪**。具体修复、测试、迁移与限制见 [连续修复记录](validation/REPAIR_PROGRESS.md)、[优化 A](validation/OPTIMIZATION_A.md)、[B1](validation/OPTIMIZATION_B1.md)、[B2/B3](validation/OPTIMIZATION_B23.md)、[B4](validation/OPTIMIZATION_B4.md)、[C](validation/OPTIMIZATION_C.md)、[CI](validation/CI_REPAIR_20261101.md)、[Docker](validation/DOCKER_ACCEPTANCE_20261101.md)、[SQLite 启动](validation/SQLITE_STARTUP_20261101.md)、[浏览器重连](validation/RECONNECT_20261101.md)、[完整推理](validation/INFERENCE_20261101.md)及[SSE 协议修复](validation/SSE_KEEPALIVE_20261101.md)。条目数包含工程债务和交付缺口，不等于独立漏洞数量，也不用于计算完成率。

## 阅读与关闭规则

- **P1**：影响身份/数据边界、核心流程或可交付性，应在相关能力扩大内测或发布前解决。
- **P2**：影响结果可信度、失败处理、维护或持续交付，需要纳入修复计划。优先级不是 CVSS 评分。
- **已复现**：已有本地请求、浏览器或命令输出证明；“隔离模拟”会单独注明，不能冒充微信真机或线上结果。
- **源码确认**：实现或配置问题已核对，但没有完成对应真实运行环境的验证；不能据此声称已经发生线上事故。
- **待验证/待决策**：当前证据不足，或必须先明确产品要求；不能直接记为功能失败。
- **关闭条件**：逐项满足验收标准，登记修复提交（尚未提交时记录工作区文件 SHA256）、环境、日期及复验证据后，才能改为“已修复”；本地验收与部署验收分开说明。多项子条件必须全部完成，或另拆条目保留未完成部分。仅改 README、构建通过或 harness 得满分不能关闭问题。

各条目的现象与源码描述保留为修复前历史；当前结果以状态及“本轮结果”链接为准。代码链接相对本文所在目录；所列行号对应审查基线，后续修改可能位移。为便于核对历史实现，可在上面的固定提交中打开同名文件。

## 原始审查验证基线（修复前，保留历史证据）

环境：Windows、Python 3.11.9、Node 24.15.0；Node 与仓库 CI 的 Node 20 不同。后端使用独立虚拟环境，前端按 lockfile 安装依赖。以下是本地结果，不是 GitHub CI 运行结论。

| 检查 | 本次结果 | 能证明的范围 |
|---|---|---|
| 后端 `pytest tests -q` | 92 passed，22 warnings | 现有测试断言通过 |
| Web `npm test` | 26 passed，5 个文件 | 现有前端测试通过 |
| Web `npx tsc --noEmit`、`npm run build` | 通过 | 可类型检查和打包；主 JS chunk 约 501.87 kB，有体积警告 |
| 小程序 `npm run build:weapp` | 通过 | 微信目标可构建，不代表真机和真实 API 可用 |
| 小程序 `npx tsc --noEmit` | 失败 | Taro 声明错误，另有 3 处源码未使用变量错误 |
| Web `npx eslint src` | 37 errors、11,923 warnings | 大量 warning 属格式规则，不等于同数量功能缺陷 |
| 空库 `alembic upgrade head` | 失败，`no such table: main.cat_images` | 当前迁移不能从空库建立完整结构 |
| harness 安全/API 静态合同 | 通过 | 仍漏掉本次已复现的路径边界、路由问题 |
| 浏览器冒烟 | 登录、首页、本地猫情报回退问答通过；管理入口空白、图鉴崩溃 | 仅覆盖实际执行路径 |
| Docker、真实识别、微信真机、外部 LLM、恢复演练、容量 | 未完成 | 见 VER 系列，不给通过结论 |

完整审查报告与原始证据保存在本地同级目录 `cat-cat-cat-review`，**未纳入本仓库**；以下证据链接只在保留该目录的工作区中有效。仓库内已保留每项问题的现象、源码定位及验收标准。

| 证据编号 | 内容与位置 |
|---|---|
| E01 | [完整项目审查报告](../../cat-cat-cat-review/项目审查报告.md) |
| E02 | [后端复现结果](../../cat-cat-cat-review/probe-results.json)、[隔离复现脚本](../../cat-cat-cat-review/probe_backend.py) |
| E03 | [小程序请求封装模拟结果](../../cat-cat-cat-review/mini-probe-results.json)、[模拟脚本](../../cat-cat-cat-review/probe_miniprogram.cjs) |
| E04 | [浏览器错误](../../cat-cat-cat-review/browser-errors.json)、[图鉴截图](../../cat-cat-cat-review/collection-error.jpg) |
| E05 | [空库迁移日志](../../cat-cat-cat-review/migration-empty.log) |
| E06 | [后端测试](../../cat-cat-cat-review/backend-tests.log)、[Web 测试](../../cat-cat-cat-review/frontend-tests.log)、[Web 类型检查](../../cat-cat-cat-review/web-typecheck.log)、[Web 构建](../../cat-cat-cat-review/web-build.log) |
| E07 | [小程序构建](../../cat-cat-cat-review/mini-build.log)、[小程序类型检查](../../cat-cat-cat-review/mini-typecheck.log)、[Web lint](../../cat-cat-cat-review/web-lint.json) |
| E08 | [安全合同](../../cat-cat-cat-review/security-contract.log)、[API 合同](../../cat-cat-cat-review/api-contract.log) |

E02 脚本会创建测试记录，复跑必须使用新的临时数据库和测试上传目录。审查未对真实用户数据执行恢复或修改。

## 问题与修复状态

### ISS-001 上传目录边界判断错误

**P1 · 已修复 · 本地验收通过（2026-10-30）。** 审查基线的 [main.py](../cat-backend/app/main.py) 第 153–155 行使用字符串 `startswith` 检查路径。

- 现象与影响：与 uploads 同名前缀的相邻目录通过检查；E02 `upload_path_boundary` 成功读取目录外的无敏感测试标记，HTTP 200。证据不支持泛化成任意系统文件必然可读。
- 验收：以解析后的路径父子关系限制读取；正常上传资源可访问，父目录穿越、同名前缀相邻目录及解析后越界路径均被拒绝；增加对应行为测试。
- 修复与证据：现在拒绝绝对资源路径，解析真实路径后校验目录归属；新增 26 项 HTTP 回归，覆盖相对/绝对配置及 Windows 目录联接；安全 harness 改为运行这些测试。修复前 9 failed / 17 passed，修复后 26 passed；后端全量 118 passed。详见[验收记录与文件指纹](validation/ISS-001.md)。修改尚未提交，未执行线上部署。

- 本轮结果：见 [ISS-001 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-002 微信开发认证忽略关闭开关

**P1 · 已修复 · 本地验收通过（2026-10-30）。** [wechat.py](../cat-backend/app/services/wechat.py) 第 9 行仅根据凭据是否为空决定开发模式。

- 现象与影响：缺少 AppID/Secret 且 `WECHAT_DEV_MODE=0` 时，伪造 code 仍可取得 token；code 前 8 位相同会映射同一个模拟 openid。见 E02 `wechat_dev_flag_ignored`、`wechat_login_without_credentials`。风险适用于缺凭据配置。
- 验收：只有显式启用开发模式才允许模拟身份；关闭开关且凭据缺失时拒绝登录；正式模式无效 code 不发 token；开发身份规则避免上述碰撞，并覆盖配置组合测试。

- 本轮结果：见 [ISS-002 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-003 数据库时间默认值被固定在模块导入时

**P1 · 已修复 · 本地验收通过（2026-10-30）。** [models.py](../cat-backend/app/models.py) 含 24 处已求值的 `default=datetime.now(timezone.utc)`，`Post.updated_at` 的 onupdate 同样提前求值。

- 现象与影响：依赖默认值的两次插入得到相同时间，见 E02 `timestamp_defaults`；排序、打卡、每日统计和周报可能失真。显式写入时间的路径不一定受影响。
- 验收：默认值及更新值在操作发生时求值；隔开时间插入/更新的记录正确变化；统一 UTC 存储和业务时区查询，覆盖跨日边界；评估历史错误时间，对无法恢复的原始时间明确记录，避免编造回填。

- 本轮结果：见 [ISS-003 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-004 Web 管理入口重定向到自身

**P1 · 已修复 · 本地验收通过（2026-10-30）。** [App.tsx](../cat-frontend/src/App.tsx) 第 90 行在无管理 token 时从 `/admin` 导向 `/admin`。

- 现象与影响：管理登录表单无法正常挂载，浏览器出现空白页；有管理页面不代表管理入口可用。见 E01 浏览器检查记录。
- 验收：无 token 可进入管理登录，成功后进入后台；无效/过期 token 可回到可操作的登录状态；普通用户不会因错误重定向获得管理权限。

- 本轮结果：见 [ISS-004 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-005 管理请求凭据取决于 URL 前缀

**P1 · 已修复 · 本地验收通过（2026-10-30）。** [api.ts](../cat-frontend/src/api.ts) 第 43 行只为 `/admin` 前缀请求选择管理 token。

- 现象与影响：管理端访问 `/cats`、`/feeding`、`/posts/reports` 等受保护操作时可能发送普通 token 或不发送 token；修复 ISS-004 不能自动修复此问题。
- 验收：明确管理请求认证上下文；仅管理 token、普通与管理 token 同时存在、管理 token 过期三个场景均验证猫档案维护、喂食维护、举报审核；后端继续独立校验角色。

- 本轮结果：见 [ISS-005 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-006 图鉴加载完成触发 Hook 顺序错误

**P1 · 已修复 · 本地验收通过（2026-10-30）。** [Collection.tsx](../cat-frontend/src/pages/Collection.tsx) 第 60 行提前返回，位于第 81 行 `useMemo` 之前。

- 现象与影响：loading 前后 Hook 数量变化，报 `Rendered more hooks than during the previous render`，页面进入错误边界。见 E04。
- 验收：所有 Hook 在各次渲染中保持相同调用顺序；实际执行 loading→有数据、loading→空数据、请求失败、搜索与筛选，均无 Hook 错误。个人相遇归属另见 ISS-027。

- 本轮结果：见 [ISS-006 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-007 小程序请求依赖浏览器 FormData

**P1 · 代码已有修复 · 待专项验收（2026-10-30）。** [services/api.ts](../cat-miniprogram/src/services/api.ts) 第 24 行使用 `instanceof FormData`，[社区页](../cat-miniprogram/src/pages/community/index.tsx) 第 210 行构造 `new FormData()`。

- 现象与影响：真实请求封装在无浏览器 FormData 的 JS 环境中直接 ReferenceError；仓库没有对应平台适配。见 E03 `withoutBrowserFormData`。这不是微信真机测试结果。
- 验收：使用目标平台支持的普通请求、表单和上传方式；关闭 demoMode，在微信开发者工具及真机验证登录、普通 GET、发帖、有图上传，不依赖浏览器全局 FormData。

- 本轮结果：见 [ISS-007 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-008 小程序把分页对象当数组

**P1 · 代码已有修复 · 待专项验收（2026-10-30）。** [services/api.ts](../cat-miniprogram/src/services/api.ts)、[首页](../cat-miniprogram/src/pages/index/index.tsx) 第 33–37 行及[社区页](../cat-miniprogram/src/pages/community/index.tsx) 第 28 行。

- 现象与影响：API 返回 `{items,total,has_more}`，页面按数组读取，正常数据被转换成空列表。见 E03 `paginatedResponse`。
- 验收：所有猫、帖子、偶遇列表统一消费分页契约；真实 API 下有数据能显示，空列表有正确状态，多页不重复、不遗漏，总数与是否还有下一页正确。

- 本轮结果：见 [ISS-008 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-009 小程序无图偶遇提交格式不匹配

**P1 · 代码已有修复 · 待专项验收（2026-10-30）。** [services/api.ts](../cat-miniprogram/src/services/api.ts) `createSighting` 与[后端 sightings.py](../cat-backend/app/api/sightings.py) 的 `Form` 参数不一致。

- 现象与影响：无图分支发送 JSON `catId`，后端要求表单 `cat_id`；识别后自动记录又吞掉异常，可能出现已识别但未保存。见 E03 `sightingWithoutImage` 和[识别页](../cat-miniprogram/src/pages/scan/index.tsx) 第 64、78 行。
- 验收：有图、无图两条路径都能以实际接口合同创建记录，返回的 id 可查询；提交失败向用户反馈且能重试，不能提前显示已保存；对上传分支校验 HTTP 状态。

- 本轮结果：见 [ISS-009 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-010 小程序缺少识别不可用状态

**P2 · 代码已有修复 · 待专项验收（2026-10-30）。** [scan/index.tsx](../cat-miniprogram/src/pages/scan/index.tsx) 的 Phase 和渲染未覆盖 `unavailable`，却把接口状态强制断言成 Phase。

- 现象与影响：后端确有 unavailable 返回，页面状态机不能完整解释服务缺模型等情况；构建成功无法覆盖此运行分支。
- 验收：confirmed、uncertain、unknown、unavailable、请求错误均有可理解的页面和下一步操作；不可用时不创建伪偶遇、不显示成功，具备返回/重试路径。

- 本轮结果：见 [ISS-010 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-011 举报列表被动态路由遮蔽

**P1 · 已修复 · 本地验收通过（2026-10-30）。** [posts.py](../cat-backend/app/api/posts.py) 第 95 行的 `/{post_id}` 注册在第 198 行 `/reports` 前。

- 现象与影响：合法管理身份请求举报列表返回 422，把 reports 当作整数 post_id 解析。见 E02 `report_list`。
- 验收：举报列表正确匹配并可分页读取，普通帖子详情保持正常；匿名与无权限角色被正确拒绝；增加实际路由请求测试。

- 本轮结果：见 [ISS-011 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-012 审核拒绝状态写成 rejectd

**P1 · 已修复 · 本地验收通过（2026-10-30）。** [admin.py](../cat-backend/app/api/admin.py) 第 141 行使用 `action + 'd'`。

- 现象与影响：reject 返回并写入 `rejectd`，破坏依赖 rejected 的列表、统计和后续状态处理。见 E02 `reject_sighting`。
- 验收：使用明确的合法状态映射；批准、拒绝、重复操作和非法操作均有确定行为；检查并迁移历史 rejectd 记录，前后端展示与查询一致。

- 本轮结果：见 [ISS-012 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-013 待审内容没有统一的公开读取边界

**P1 · 已修复 · 本地验收通过（2026-10-30）。** [sightings.py](../cat-backend/app/api/sightings.py)、[routes.py](../cat-backend/app/api/routes.py)、[map.py](../cat-backend/app/api/map.py)、[gallery.py](../cat-backend/app/api/gallery.py) 及相关 CRUD。

- 现象与影响：匿名指定 `status=pending` 可读待审偶遇，详情也无状态隔离；本次待审测试地点进入路线推荐。热力/图库等缺少一致 approved 条件。见 E02 `public_pending_sightings`、`pending_in_route_recommendations`。
- 验收：明确作者、审核员、管理员及公众的可见范围；公开列表、详情、图库、热力、路线和相关聚合只使用允许公开的数据；批准/拒绝后缓存同步更新；测试直接 ID 读取和参数绕过。猫情报工具已有 approved 过滤，应保留。

- 本轮结果：见 [ISS-013 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-014 AI 缺失或不匹配权重时仍可能返回模型

**P1 · 已修复 · 真实运行时本地验收通过（2026-11-01）。** 原始 [model_loader.py](../cat-backend/app/services/model_loader.py) 第 146 行 `pretrained=False`，第 182 行缺权重仅警告，随后仍返回模型。

- 现象与影响：存在随机权重或不完整加载模型继续参与检索的实现路径；其分数不能被当作可信识别。核心依赖环境返回 unavailable 已验证，但不足以证明“装了 PyTorch、缺权重”也能正确停止。
- 验收：权重缺失、损坏、关键参数或维度不匹配时停止提供识别结果并返回 unavailable；只有通过模型/参考库兼容校验才进入就绪态；分别测试无运行时、缺权重、坏权重、完整权重。

- 本轮结果：见 [ISS-014 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

- 专项补验：完整 CPU 镜像中真实 Torch 严格加载固定权重成功；缺文件、坏字节、缺参数和投影维度错误均拒绝。真实模型发布参考库后，损坏权重/向量/参考图均返回 unavailable，修复资产后恢复识别。按加载正确性关闭，独立识别质量仍由 VER-001 跟踪。见[推理与恢复验收](validation/INFERENCE_20261101.md)。

### ISS-015 识别评测脚本与当前函数接口不兼容

**P1 · 已修复 · 本机与远端真实模型评测执行通过（2026-11-01）。** 审查基线的 [eval_recognition.py](../cat-backend/scripts/eval_recognition.py) 第 50 行传入识别函数不支持的 `crop` 参数。

- 现象与影响：调用得到 `TypeError: recognize_cat_image() got an unexpected keyword argument 'crop'`，不能用该脚本直接复现精度报告。见 E02 `eval_script_call_contract`。
- 验收：在固定环境、固定模型和已标注样本上完整跑通，输出可核对的预测、指标、失败样本和版本；脚本通过只是评测工具修复，识别质量本身另按 VER-001 验收。

- 本轮结果：见 [ISS-015 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

- 专项补验：固定模型、24 张参考图和 62 张查询，本机与 CI 真实构建/发布/评测完整执行，逐图文件哈希、身份排名、业务状态及汇总一致。脚本输出模型/参考库/依赖/预处理/源码版本、指标和失败样本；按工具执行范围关闭。未知猫误接受 9/18，识别质量仍未通过，见[公开预评测](validation/RECOGNITION_PILOT_20261101.md)。

### ISS-016 Alembic 无法从空数据库迁移

**P1 · 已修复 · 本地验收通过（2026-10-30）。** [baseline 迁移](../cat-backend/alembic/versions/4cf3161f45b4_baseline_capture_current_schema.py) 第 22 行起对不存在的表创建索引。

- 现象与影响：空库 `alembic upgrade head` 报 `no such table: main.cat_images`。应用启动 `create_all` 不承担已有数据库结构升级。见 E05。
- 验收：空库到 head、支持的历史结构到 head 均成功；关键表、列、约束和索引正确且保留旧数据；记录初始化与升级的唯一操作流程，不能靠手工先建表掩盖失败。

- 本轮结果：见 [ISS-016 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-017 Compose 数据卷与备份发现路径不一致

**P1 · 代码已有修复 · 待专项验收（2026-10-30）。** [docker-compose.yml](../docker-compose.yml) 将宿主 `cat-backend/cat_community.db` 挂到容器目录 `/app/data`；[backup.ps1](../scripts/backup.ps1) 第 51 行只扫描后端顶层 `.db` 文件。

- 现象与影响：宿主路径为文件时有文件/目录冲突；若首次被创建为目录，实际库又位于下一层，顶层扫描无法找到。当前数据库仍是 SQLite，Compose 启动 PostgreSQL 不表示应用已切换数据库。
- 验收：统一实际数据库文件、宿主卷、容器路径、备份与恢复目标；空环境首次启动、重启持久化和数据写入后备份均验证同一份数据库；Docker 实际演练见 VER-003。

- 本轮结果：见 [ISS-017 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-018 SQLite 在线备份缺少一致性保证

**P1 · 已修复 · 本地验收通过（2026-10-30）。** [backup.ps1](../scripts/backup.ps1) 直接复制 db，没有 SQLite backup API 或明确的停写/WAL 协调。

- 现象与影响：启用 WAL 且持续写入时，单独复制主库不能保证包含期望的已提交数据和一致快照。dry run 不证明备份可恢复。
- 验收：采用有明确一致性保证的备份方式；在持续写入的可丢弃环境生成备份，恢复到独立副本，校验完整性、关键记录和附件关系；保留演练日志和恢复时间。见 VER-003。

- 本轮结果：见 [ISS-018 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-019 Redis 缺依赖，多 worker 事件退回进程内

**P1 · 已修复 · 本机真实 Redis 验收通过（2026-10-31）。** [requirements.txt](../cat-backend/requirements.txt)、[events.py](../cat-backend/app/events.py)、[cache.py](../cat-backend/app/cache.py)、[gunicorn.conf.py](../cat-backend/gunicorn.conf.py)。

- 现象与影响：后端未声明 redis 包，本次新环境回退到进程内缓存/广播；部署配置为 4 workers，内存队列无法跨进程广播。E02 `cache_runtime` 证明依赖回退，没有完成多 worker 丢事件实测。
- 验收：按锁定依赖安装后确实连接 Redis；不同 worker 的生产者和 SSE 客户端收到预期事件；断连行为明确、可观测；若选择只支持单 worker，必须限制部署并同步文档。见 VER-004。

- 本轮结果：Redis 7.4.2 与四个独立 API 进程实测通过同步/异步广播、缓存共享与失效、撤销 token、订阅清理和中断恢复。按本机后端范围关闭，见 [C 验收](validation/OPTIMIZATION_C.md)。后续 Linux Gunicorn 容器和浏览器核心页面重连同步分别通过 [Docker](validation/DOCKER_ACCEPTANCE_20261101.md)与[重连验收](validation/RECONNECT_20261101.md)，生产网络及容量仍待验证。

### ISS-020 内存缓存未落实 TTL 和容量上限

**P2 · 已修复 · 本地验收通过（2026-10-30）。** [cache.py](../cat-backend/app/cache.py) 第 24 行起的回退类只存取字典；标准 cachetools 与当前 set/delete 调用也不一致。

- 现象与影响：保存 ttl/maxsize 却不淘汰，数据可能长期陈旧或持续增长；安装可选 cachetools 后也不能假定接口自动兼容。E02 确认本次走自定义回退。
- 验收：使用可控时钟验证到期失效、容量淘汰、显式失效；装/不装可选依赖和 Redis 不可用时均符合统一缓存合同；检查实际调用需要的精确键与模式失效语义。

- 本轮结果：见 [ISS-020 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-021 SSE 未校验 token_version

**P1 · 已修复 · 本地验收通过（2026-10-30）。** [api/events.py](../cat-backend/app/api/events.py) 第 15 行起的 `_resolve_user` 缺少普通鉴权中的版本比较。

- 现象与影响：撤销 token 后普通接口返回 401，SSE 身份解析仍接受旧 token。见 E02 `revoked_token`。本次没有据此声称已读取到敏感 SSE 事件。
- 验收：SSE 连接使用统一的令牌/用户校验；撤销、删除用户、过期和无效 token 均不能新建连接；明确并测试已有长连接的撤销策略。

- 本轮结果：见 [ISS-021 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-022 内存 SSE 断开时未等待取消订阅

**P2 · 已修复 · 本地验收通过（2026-10-30）。** [api/events.py](../cat-backend/app/api/events.py) 第 64 行调用 async `unsubscribe` 时缺少 await。

- 现象与影响：断线清理不能保证执行，存在订阅者和队列残留风险；未测量长期运行后的内存增长。
- 验收：反复建立、断开、取消 SSE 后订阅数量回到基线，没有未等待协程警告；内存和 Redis 分支均覆盖；异常退出也执行清理。

- 本轮结果：见 [ISS-022 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-023 Web 分页参数与返回元信息不统一

**P2 · 已修复 · 本地验收通过（2026-10-30）。** [useApi.ts](../cat-frontend/src/hooks/useApi.ts) 第 168 行及图库分页发送 page，后端按 skip 处理；[api.ts](../cat-frontend/src/api.ts) 部分包装丢弃 total/has_more。

- 现象与影响：page=1/2 得到同一组 20 条偶遇；无限加载可能重复、漏数据或停止错误。见 E02 `sighting_page_parameter`。各接口需分别对齐，不能假定所有分页参数相同。
- 验收：用至少三页稳定数据验证偶遇、图库和相关列表，翻页无重复遗漏、最后一页终止正确；空数据、筛选变更和返回列表时元信息一致。

- 本轮结果：见 [ISS-023 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-024 热力接口接受 skip 却未用于查询

**P2 · 已修复 · 本地验收通过（2026-10-30）。** [api/map.py](../cat-backend/app/api/map.py) 第 15–22 行未将 skip 传给 CRUD。

- 现象与影响：skip=0 与 skip=3 返回相同点，has_more 却使用 skip 计算，返回值互相矛盾。见 E02 `heatmap_skip_parameter`。
- 验收：在稳定排序下实际执行 offset/limit，分页结果与 total/has_more 一致；缓存键、审核过滤及数据更新后的失效一致。

- 本轮结果：见 [ISS-024 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-025 Web 识猫保存缺失位置数据

**P2 · 代码已有修复 · 待专项验收（2026-10-30）。** [Scan.tsx](../cat-frontend/src/pages/Scan.tsx) 第 81–82 行显式传入 undefined 经纬度；[crud.py](../cat-backend/app/crud.py) 热力查询排除空坐标。

- 现象与影响：识别生成的这类偶遇不能直接形成热力点，“识猫→地图”的数据链路不完整；不能因此认定所有手工偶遇均无坐标。
- 验收：用户可授权定位或选择有效位置；拒绝授权时仍能保存无位置记录且界面解释清楚；坐标及坐标系正确持久化，记录审核通过后在预期地图位置可见。

- 本轮结果：见 [ISS-025 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-026 偶遇投票重复发放经验值

**P2 · 已修复 · 本地验收通过（2026-10-30）。** [sightings.py](../cat-backend/app/api/sightings.py) 第 153 行起达到 3 票后，每次投票均重发正确投票奖励。

- 现象与影响：同一投票重复提交让三人的 XP 从 `[3,3,3]` 变为 `[6,6,6]`，成长数值可重复累加。见 E02 `repeated_vote_rewards`。
- 验收：明确奖励事件唯一性；重复请求、并发请求和重试不重复发奖；对改票、识别结论变更明确规则；评估已产生的异常 XP，不在无证据情况下直接扣改历史数值。

- 本轮结果：见 [ISS-026 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-027 个人图鉴、每日识别任务和发现统计混入全站数据

**P2 · 已修复 · 本地验收通过（2026-10-30）。** [Collection.tsx](../cat-frontend/src/pages/Collection.tsx)、[api/user.py](../cat-backend/app/api/user.py) 第 225 行、[crud.py](../cat-backend/app/crud.py) 第 741 行及 [Discovery 模型](../cat-backend/app/models.py)。

- 现象与影响：图鉴根据全站偶遇认定“我已相遇”；个人识别任务统计全站 recognize 审计；发现数采用全站 Discovery，实体无提交者 user_id，无法可靠归属。
- 验收：用两个用户分别产生数据，逐项验证图鉴、识别任务、发现数互不串入；新线索记录真实提交者；历史无归属记录保留为未知，不自动归给任意用户；按 ISS-003 的时间规则验证每日边界。

- 本轮结果：见 [ISS-027 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-028 新猫与照片更新未闭合识别参考库生命周期

**P2 · 已修复 · 本地生命周期验收通过（2026-10-31）。** [crud.py](../cat-backend/app/crud.py) 第 1138 行 `review_discovery` 及照片入库流程、[services](../cat-backend/app/services)、[embeddings](../cat-backend/embeddings)。

- 现象与影响：审核和上传只创建数据库记录，未自动提取特征、更新索引及刷新各 worker 缓存；已有向量绑定数字 cat_id，未验证当前数据库身份/版本一致。入档不等于能被识别。
- 验收：建立可追踪的参考库重建/更新流程，固定模型、向量及身份映射版本；新增/删除/变更猫和照片后验证检索结果及多 worker 一致性；换库或映射失配时拒绝错误匹配并可恢复到有效版本。

- 本轮结果：B1—B4 已完成持久身份与校验、事务计数、任务/独立 worker、原子发布、兼容性回滚、多进程刷新和管理状态/重试。实际浏览器验证入队/进度/失败重试/发布、照片上传失败后的同档案重试、审核员只读及错误恢复；两个 HTTP 进程故障回归再次通过。按“管理员手动触发全量重建”的范围关闭，不承诺审核后自动推理。Redis 禁用测试不等于实际 Redis 验收；真实模型、Docker 和容量分别保留 VER-001/003/004/006。见 [B1](validation/OPTIMIZATION_B1.md)、[B2/B3](validation/OPTIMIZATION_B23.md)、[B4 验收](validation/OPTIMIZATION_B4.md)。

### ISS-029 类型约束与模块边界不足

**P2 · 部分完成 · 未关闭（2026-10-30）。** [crud.py](../cat-backend/app/crud.py) 约 1,405 行、[gamification.py](../cat-backend/app/api/gamification.py) 约 916 行；[Web tsconfig](../cat-frontend/tsconfig.json) `strict=false`，多处 any、重复请求封装，部分页面超过 500 行。

- 现象与影响：数据访问、积分、统计相互耦合；接口字段或包装改变后，类型检查难以及早阻止页面误用。文件长本身不是运行失败证据。
- 验收：先为认证、分页、识别、审核等关键合同建立明确请求/响应类型，消除这些边界的无约束 any；按业务职责拆分高耦合逻辑并覆盖关键行为；记录严格类型检查迁移范围和剩余债务，不以纯行数下降判定完成。

- 本轮结果：见 [ISS-029 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-030 质量门禁缺失且部分检查只验证字符串

**P2 · 部分完成 · 未关闭（2026-10-30）。** [security_check.py](../harness/checks/security_check.py)、[ci.yml](../.github/workflows/ci.yml)、[Web 测试](../cat-frontend/src/__tests__)。

- 现象与影响（审查基线）：安全检查甚至要求保留有缺陷的 startswith 表达式；它通过时 ISS-001 仍可复现。部分 auth/api 测试重复 localStorage 断言；CI 未执行 Web 测试、lint、小程序类型检查，已有 37 lint errors 和小程序类型错误未被该门禁阻止。见 E06–E08。
- 验收：修复会失败的行为回归成为门禁，覆盖管理认证、图鉴渲染、分页、审核边界等关键路径；CI 运行前后端测试、类型检查和合理 lint 规则；解决阻断错误并对遗留格式告警分级治理，不能简单关闭规则换取通过。
- 局部进展（2026-10-30）：上传边界已改为 HTTP 回归，新增认证、图鉴、分页、审核、数据归属等行为测试与 CI 门禁；告警治理和远端 CI 尚未全部验收，本条保留部分完成。

- 远端复验（2026-11-01）：首次 CI 的 Web、小程序、Redis 通过；后端测试夹具密码依赖环境、浏览器等待与 5 秒轮询竞争导致两条任务失败。修复后本地后端 240 项、参考库浏览器 8 组通过；提交 971c937 的远端五个任务也全部通过。告警治理仍未完成，本条保持部分完成。见 [CI 修复记录](validation/CI_REPAIR_20261101.md)。

- 评测轮补验（2026-11-01）：修复首次 SSE 打开后帖子刷新与断线写入竞争的测试时序，保留真实断线前后断言；`2c829ff` 本机和 CI 重连各 10 组、远端全部 7 个任务通过。后端本机 68 / CI 69 条弃用告警仍在，本条保持部分完成，见[同轮门禁记录](validation/RECOGNITION_PILOT_20261101.md#同轮浏览器门禁时序修复)。

- 本轮结果：见 [ISS-030 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-031 文档完成状态和部分功能描述缺少实现支持

**P2 · 部分完成 · 未关闭（2026-10-30）。** [README](../README.md)、[FINAL_ACCEPTANCE](FINAL_ACCEPTANCE.md)、[DEPLOY](../DEPLOY.md)、[crud.py](../cat-backend/app/crud.py) 的 `review_discovery`。

- 现象与影响：feature-complete/release candidate 的表述超出验证结果；文档中的新猫合并、发现者勋章与实现不符；部署文档引用不存在的 `scripts/download_assets.py`，仍称 13 个小程序页面，实际为 17 个。
- 验收：逐项把已实现、已验证、未实现、待环境验证分开；部署命令在干净环境可重现，页面数量与实际一致；学生课表/审核/复盘 Agent 继续标为规划，现有猫情报 Agent 单独描述。本次新增台账入口只完成风险提示，不代表相关功能或全部文档已经修正。

- 本轮结果：见 [ISS-031 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-032 展示截图与小程序 tab 素材仍是占位内容

**P2 · 代码已有修复 · 待专项验收（2026-10-30）。** [showcase](../showcase)、[小程序资源](../cat-miniprogram/src/assets)。

- 现象与影响：README 引用的五张页面预览 PNG 的 SHA256 相同，不能证明五个不同页面的实际效果；检查的 10 个 tab PNG 均为 1×1 占位图。
- 验收：以可运行版本截取对应真实页面，标明版本与必要的演示数据说明；替换正常/选中 tab 图标并在微信目标下检查显示；展示素材与实际页面对应。

- 本轮结果：见 [ISS-032 修复、证据与剩余边界](validation/REPAIR_PROGRESS.md#每项修复及关闭范围)。

### ISS-033 Web 个人资料加载中断导致误退出

**P2 · 已修复 · 本地验收通过（2026-10-30）。** 浏览器快速从登录后的首页切换到图鉴时复现；`Layout.tsx` 对 profile 请求的所有失败都清除 token，页面卸载中断请求也触发退出。

- 修复：API 错误保留 HTTP status，只有明确 401 才退出；普通网络/服务错误保留有效会话，旧请求不得清除更新后的 token。
- 验收：3 项 transient/503/401 分支测试通过；真实 Edge 管理登录/退出、普通登录后快速切页、图鉴搜索通过，0 pageerror。见 [证据](validation/REPAIR_PROGRESS.md)。

### ISS-034 管理身份验证网络失败导致误退出

**P2 · 已修复 · 本地验收通过（2026-10-30）。** Admin 对 getAdminMe 的所有失败清除管理凭据；不同于 ISS-033 的普通个人资料路径。

- 修复：401/403 退回登录；网络异常/503 保留凭据，显示重试，验证成功后才加载管理数据；组件卸载后的旧响应不继续更新状态。
- 验收：网络异常、503 的组件测试及真实 Chromium/Edge 故障注入与重试通过；真实过期签名 token 被后端拒绝，普通用户 token 保留。见 [优化 A 验收](validation/OPTIMIZATION_A.md)。

### ISS-035 偶遇创建静默丢弃地点名称

**P2 · 已修复 · 本地验收通过（2026-10-30）。** 路由接收 location_name 并传给 SightingCreate，但其父模型没有该字段，Pydantic 将其当额外字段忽略。实际浏览器看到“校园某处”，不是提交的测试地点。

- 修复：创建模型保留 location_name，持久化和响应一致；不是仅修正页面显示。
- 验收：HTTP 表单测试核对响应和数据库字段；实际浏览器保存待审、管理列表显示地点、点击通过后公开列表/热力数据更新。首次失败的截图与 trace 保留，见 [优化 A 验收](validation/OPTIMIZATION_A.md)。

### ISS-036 修复迁移丢失唯一索引，并发启动创建重复账号

**P1 · 已修复 · 本地验收通过（2026-10-31）。** C 阶段使用真实 Redis 和四个 API 进程复现两个 admin。此前冻结 schema 的采纳工具将 UNIQUE INDEX 建成普通索引，原迁移测试只核对表和列，遗漏此缺陷。初始账号与校园的先查后插流程也未处理并发冲突。

- 修复：新增 j20261031，恢复用户名、openid、校园 slug、邀请码唯一索引；有重复记录时整项拒绝、不改数据、不自动合并。启动核对唯一索引；初始化仅忽略另一个进程已完成同自然键插入的冲突，保留原密码。
- 验收：四种重复旧库均被拒绝且数据/旧索引/修订号保持不变，明确改正夹具后升级并验证数据库拒绝再次重复；四线程确定性交错及四个真实 API 进程都只保留一个初始账号。见 [C 证据](validation/OPTIMIZATION_C.md)。

### ISS-037 Redis 失联期间撤回审核，恢复后旧点位重新公开

**P1 · 已修复 · 本机 Redis 故障验收通过（2026-10-31）。** 先预热已批准偶遇的热力图缓存，切断 Redis 客户端连接，撤回审核，再恢复连接，热力图 total 从 0 回到 1。缓存失效不是可靠的权限边界。

- 修复：热力图直接读取数据库当前审核状态，移除该端点缓存与审核后的失效调用；其它普通排行榜缓存仍遵循 TTL。
- 验收：Redis 保留旧内容的真实故障测试和缓存失效丢失的 HTTP 回归均通过，撤回点位在中断期间及恢复后都不再返回。数据库额外读负载仍需容量评估。见 [C 证据](validation/OPTIMIZATION_C.md)。

### ISS-038 多进程启动时切换 SQLite WAL 模式发生锁竞争

**P1 · 已修复 · 本地持锁回归及真实四进程验收通过（2026-11-01）。** 远端四个 API 同时启动，一个进程在连接 hook 的 `PRAGMA journal_mode=WAL` 报 database is locked，应用启动失败；与 Redis 服务是否健康无关。

- 修复：已有 WAL/内存模式不重复切换；只对初始化期间的 SQLITE_BUSY/LOCKED 最多等待 5 秒，其它错误立即传播。成功后保留业务 busy_timeout 与外键约束，不重放业务写入。
- 验收：同一真实持锁回归在旧实现失败，修复后通过；持续占锁按截止时间退出，只读错误不被吞掉；本机真实 Redis 加四 API 十项通过。修复提交 ec8ad5a 的远端六个任务全部成功，后端 243 项、Redis 十项、Docker 七组通过。见 [SQLite 启动记录](validation/SQLITE_STARTUP_20261101.md)。不声明已经验证持续高并发写入容量。

### ISS-039 浏览器重连不刷新数据且有限重试后停止

**P2 · 已修复 · 本地与远端 CI 验收通过（2026-11-01）。** 旧 `useEventStream` 的 `onopen` 不触发业务查询，五次失败后停止重试；首页与 Layout 重复订阅。点赞/投票局部状态也不响应新 props。

- 复现：真实 API 在 Redis TCP 中断期间写入帖子并确认落库；恢复后 SSE 已打开，但浏览器仍无新帖子。投票 props 更新后票数仍旧的回归也失败。
- 修复：统一连接与刷新通知、持续退避重试、离线恢复与会话终止清理；刷新查询和局部 state，保留输入，忽略迟到结果，并同步点赞/投票/展开评论。
- 验收：本机与 Linux CI 的真实 Chromium + Redis 各十组通过，覆盖帖子/评论/通知/图鉴/首页、草稿与筛选保留、60 秒断线、浏览器离线、登出与撤销。Web 全量 78 项通过，修复提交 `7109286` 的远端六项任务全部成功。按列明页面和连接生命周期关闭；不代表逐条离线事件重放、地图/微信实机或生产容量已经验证。见[证据与边界](validation/RECONNECT_20261101.md)。

### ISS-040 完整推理镜像缺系统库且安装过程破坏后端依赖约束

**P1 · 已修复 · 本地与远端完整容器验收通过（2026-11-01）。** 原始 inference 镜像构建返回成功，但 OpenCV 导入缺 libxcb；宽范围推理依赖把 AnyIO 升到 4.15.1，与 FastAPI 0.104.1 要求冲突，pip check 失败。固定 OpenCV 后另复现缺 libGL。

- 修复：固定关键推理依赖，使用 CPU Torch；以后端 requirements 约束安装，补系统库，并在镜像构建时检查依赖和导入。
- 验收：真实权重加载、YOLO→DINOv3→FAISS 发布及 HTTP 自匹配、重启、数据库/模型/store 新卷恢复、资产损坏后拒绝与恢复，共十二组通过。镜像约 9.27 → 2.60 GiB。范围不包含 GPU、独立样本精度或生产容量。见[完整证据](validation/INFERENCE_20261101.md)。

### ISS-041 HTTP keep-alive 定时器误关闭活动 SSE

**P1 · 已修复 · 本地与远端 CI 验收通过（2026-11-01）。** 提交 `4cd6a2e` 的远端 Redis 验收在撤销 token、等待 SSE 结束时出现 incomplete chunked read；服务端报 h11 SEND_BODY 状态下错误关闭连接。

- 根因：Uvicorn 0.24.0 完成前一响应后安排 idle timer，再处理已缓冲请求；新 SSE 请求没有取消旧 timer，活动响应被截断。
- 修复：固定 Uvicorn 0.54.0，包含处理新请求时取消旧 timer 的上游修复；增加同一 TCP 连接连续普通请求/SSE 的回归，断言跨过 idle timeout 后消息和结束标记完整。
- 验收：同一测试旧版失败、新版通过，本机后端 244 项、真实 Redis 四进程十项通过；修复提交 `e2f1bd4` 的七项远端门禁全部通过，包括完整推理十二组、API 容器七组及浏览器重连十组。生产代理和容量不在关闭范围。见[协议修复证据](validation/SSE_KEEPALIVE_20261101.md)。

### ISS-042 评测把业务判定当作检索排名且缺少数据与版本约束

**P2 · 已修复 · 本地回归与真实评测通过（2026-11-01）。** 旧脚本按 `cat_name` 计分，第一候选正确但返回 uncertain 时 Top-1 为 0；confirmed/unknown 隐藏的排名也无法用于 Top-3。没有未知猫/无猫分组和输入/参考库版本校验，读文件失败会静默跳过。

- 修复：内部诊断共享实际 API 推理路径，使用未筛选排名与持久 reference_id 计分；清单绑定数据库/快照/图像哈希并检查重复与身份映射，记录全部查询、失败和版本，缺图/坏图/不可用明确使评测不完整。
- 验收：旧统计回归失败，新版定向 44 项及后端全量 257 项通过；同一公开清单在本机、Linux CI 真实执行结果一致。HTTP 结构、识别决策与阈值保持不变；不将执行通过当作模型质量合格。见[数据、指标与证据](validation/RECOGNITION_PILOT_20261101.md)。

### ISS-043 历史照片备份截断，恢复入口失效

**P1 · 已复现 · 未解决（2026-11-01）。** Git 历史指向的 HF 数据版本 `61e619ea06bba63f48d03f470794ae8d24870bcc` 只提供 130 张独立图片和 3 个各 500 MiB 的分卷；全部发布哈希通过，但三个分卷拼接后压缩流在第 940 张图片中途提前结束，仅 939 张图片文件完整恢复。

- 影响：当前远端备份不能用于完整图库恢复。目录未见旧脚本请求的单个压缩包，旧同步入口还会在调用缺失脚本后输出“完成”；本轮已让该入口明确失败并给出文档，完整照片缺口仍在。
- 已做：隔离恢复可读前缀，去重后 936 张静态图，272 张含原始日期线索；1 张 MPO 双帧需明确选择。旧向量只有 91 个猫名和 1,421 条向量，无法替代原图与身份映射。准备工具通过 16 项定向与 303 项后端回归，不等于备份修复。
- 关闭条件：取得完整源照片或其余分卷，核对完整源文件清单和哈希，验证压缩流正常结束及完整恢复，并提供可重复执行、失败不报成功的恢复入口。图库身份与场次的可靠性另由 VER-001 验收。
- 证据：[原有照片盘点与准备](validation/CAMPUS_ASSETS_20261101.md)、[固定来源与机器结果](validation/campus-asset-audit.json)。没有据此推断线上数据已经丢失或精确缺失张数。

## 待验证或待决策事项

这些事项不能因测试未运行而直接判断失败，也不能因存在代码就判断完成。

| 编号 | 优先级 / 状态 | 已知事实与边界 | 完成条件 |
|---|---|---|---|
| VER-001 真实识别质量 | P1 / 公开样本门槛通过，校园验收未完成 | 已确认中心裁剪截断头脸，新增带版本校验的完整主体填充。在四组开发对照后，另冻结新身份、96 张参考和校准/留出各 116 张。新校准选择 0.70 / 0.49 / 分差 0，新留出已知正确确认 31/36（86.11%）、未知误确认 1/60（1.67%），狗误确认与不可用为 0。 | [覆盖与新留出证据](validation/REFERENCE_COVERAGE_20261101.md)。0379/0406 共 5 张已知猫未确认，0127 一张误确认。新旧留出不同，不能将正确率之差视为算法收益。默认及业务参考库未切换；[原照片盘点](validation/CAMPUS_ASSETS_20261101.md)找回 936 张静态图，但新增 ISS-043 备份缺口，身份/场次可靠的校园数据、训练重叠、相似度文案和目标硬件容量仍待验收，不能据公开小样本保证总体误确认 ≤5%。 |
| VER-002 微信真机全流程 | P1 / 待验证 | 只完成构建与隔离 JS 模拟；尚未配置正式平台条件并执行真机测试。 | 修复 ISS-007/008/009/010/032 后，在明确 AppID、域名、基础库和设备版本下，关闭 demoMode 验证登录、列表、拍照、识别、保存、发帖、错误重试，并保存记录。 |
| VER-003 Docker 部署与恢复 | P1 / 部分验收 | 本机旧库/附件恢复、API 阶段本机与 CI 七组通过；完整 CPU inference 本机与 CI 十二组通过，包含真实模型/store 新卷恢复和故障拒绝。 | [C](validation/OPTIMIZATION_C.md)、[Docker](validation/DOCKER_ACCEPTANCE_20261101.md)及[完整推理](validation/INFERENCE_20261101.md)。实际业务挂载、通用生产备份工具、容量与目标硬件仍待验证。 |
| VER-004 Redis 与多 worker | P1 / 后端、容器及核心页面重连集成通过 | Redis + 四 API 十项、Gunicorn 四 worker 经 Redis/nginx 的真实 SSE 推送通过；浏览器十组故障恢复通过。SQLite 启动竞争与浏览器缺陷分别记录 ISS-038/039。 | [C](validation/OPTIMIZATION_C.md)、[Docker](validation/DOCKER_ACCEPTANCE_20261101.md)、[SQLite 启动](validation/SQLITE_STARTUP_20261101.md)及[浏览器重连](validation/RECONNECT_20261101.md)。Pub/Sub 不提供离线重放，通过接口补回当前状态；生产网络代理、容量和未列明客户端仍须按环境验证。 |
| VER-005 地图和外部 LLM | P2 / 待验证 | 本地缺地图 Key；猫情报数据库/规则回退已在浏览器跑通，但真实地图与外部 LLM 工具循环未验收。 | 使用有效配置验证地图加载、坐标转换和定位；验证真实 LLM 工具调用、超时、错误响应及回退。分别保存结果，不能用回退成功替代 LLM 成功。 |
| VER-006 性能与路线产品边界 | P2 / 待验证、待决策 | 源码存在图库全量读取后排序分页、排行榜逐用户统计、通知逐收件人提交；未压测，不能声称已测得容量不足。路线按热度组织，打卡校验站名，不证明实际到达。 | 先明确目标数据量、并发、延迟和是否需要可信到访/路线优化；对图库、排行榜、通知压测并记录查询数/延迟/内存，按结果优化。轻量路线玩法可保留，但文案不得暗示已验证到访或路网最优。 |
| VER-007 代码、数据与模型许可 | P2 / 待决策 | 仓库未发现 LICENSE；不能替作者选择许可，也不能据此认定已发生侵权。 | 由权利人明确代码许可，核对图片、猫档案数据、模型权重和其他素材的来源、授权与使用范围，补充可核验说明。 |

## 建议处理顺序

1. **恢复可信核心流程**：ISS-001/002/003/004/005/006/011/012/013/021。先修身份、路径、时间、管理入口、审核与图鉴，再复验相关公开和管理流程。
2. **统一两端业务合同与数据正确性**：ISS-007/008/009/010/020/023/024/025/026/027。将类型和行为门禁（ISS-029/030）随修复一起补齐。
3. **完成 AI 可复现交付**：ISS-014/015/028，随后执行 VER-001；“评测能跑”和“指标达到约定目标”分别验收。
4. **完成部署与恢复**：ISS-016/017/018/019/022，执行 VER-003/004；相应代码修复可与前面并行，但发布前必须有真实环境证据。
5. **补齐对外展示与其余验收**：ISS-031/032、VER-002/005/006/007。只有证据更新后才上调项目完成状态。

## 后续更新记录

| 日期 | 范围 | 变更 | 修复提交 / 复验证据 |
|---|---|---|---|
| 2026-10-30 | 初始审查基线 | 登记 32 项未修复问题、7 项待验证或待决策事项；添加 README 与验收文档入口 | 仅文档整理；无业务修复提交 |
| 2026-10-30 | ISS-001；ISS-030 局部进展 | 修复上传路径边界，加入 26 项 HTTP 回归及实际执行它们的安全检查；ISS-001 本地验收通过，ISS-030 保持未修复 | [验收记录](validation/ISS-001.md)：26 项专项、118 项后端全量通过；工作区文件指纹已登记，尚未提交 |

| 2026-10-30 | 连续修复；新增 ISS-033 | 更新为 19 项本地通过、10 项待专项、3 项部分完成、1 项未修复；保留 VER-001～007 | [修复记录](validation/REPAIR_PROGRESS.md)：后端 163、Web 48、小程序合同 5 项通过；含真实浏览器和隔离恢复演练；尚未提交 |

| 2026-10-30 | 优化 A1/A2；新增 ISS-034/035 | LFS 资源门禁、独立安装验证、浏览器 CI、显式迁移启动、管理失败重试与审核按钮、地点字段修复；21 项本地通过，其余原有状态不变 | [优化 A 验收](validation/OPTIMIZATION_A.md)：后端 172、Web 52、小程序合同 5；Chromium/Edge 本地通过，远端 CI 未执行；尚未提交 |

| 2026-10-30 | B1 / ISS-028 | 持久参考身份与失配拒绝、候选构建、模型缓存绑定和管理诊断；ISS-028 从未修复改为部分完成；总计 21 项本地通过、10 项待专项、4 项部分完成 | [B1 验收](validation/OPTIMIZATION_B1.md)：后端 205 项、Chromium 六组流程通过；真实模型与完整参考库生命周期仍待验收 |

| 2026-10-31 | B2/B3 / ISS-028 | 持久任务、事务计数、独立构建 worker、原子发布、兼容性回滚和多进程刷新；管理可见性仍待 B4，问题数量和关闭状态不变 | [B2/B3 验收](validation/OPTIMIZATION_B23.md)：后端 225 项，两个真实进程八组故障步骤及 Chromium 六组回归通过；Redis 禁用，不计作真实 Redis 或模型验收 |

| 2026-10-31 | B4 / ISS-028 | 管理状态、进度、待发布变化、权限与重试闭环完成，ISS-028 按本地生命周期范围关闭；22 项本地通过、10 项待专项、3 项部分完成 | [B4 验收](validation/OPTIMIZATION_B4.md)：后端 229、Web 66、B4 浏览器 8 组及核心 6 组通过；模型和环境专项状态不变 |

| 2026-10-31 | C / ISS-019、036、037 | 真实 Redis 四进程、SQLite/附件恢复；补唯一约束和并发初始化，修复审核撤回后旧热力图复现；25 项本地通过、9 项待专项、3 项部分完成 | [C 验收](validation/OPTIMIZATION_C.md)；Docker Desktop 启动失败，容器验收未完成；无提交或部署 |

| 2026-11-01 | ISS-038 / Docker 本机与 CI | 修复 WAL 启动竞争，更新后的本机 Docker 七组通过；26 项本地通过、9 项待专项、3 项部分完成 | [SQLite 启动](validation/SQLITE_STARTUP_20261101.md)及[Docker](validation/DOCKER_ACCEPTANCE_20261101.md) |
| 2026-11-01 | ISS-039 / 浏览器重连 | 统一订阅、长断线恢复和状态同步；39 项中 27 项本地通过、9 项待专项、3 项部分完成 | [重连验收](validation/RECONNECT_20261101.md)：Web 78 项、真实浏览器十组通过 |

| 2026-11-01 | ISS-014/040 / 完整推理 | 真实权重与失配拒绝、依赖及系统库修复、完整新卷恢复；40 项中 29 项本地通过、8 项待专项、3 项部分完成 | [推理验收](validation/INFERENCE_20261101.md)：十二组容器及真实 Torch 四类坏权重检查通过 |

| 2026-11-01 | ISS-041 / SSE 协议 | 旧版 Uvicorn TCP 回归失败，升级后通过；41 项中 30 项本地通过、8 项待专项、3 项部分完成 | [SSE 验收](validation/SSE_KEEPALIVE_20261101.md)：本机后端 244 项、Redis 十项，修复提交七项远端 CI 全部通过 |

| 2026-11-01 | ISS-015/042 / 公开识别预评测 | 工具真实执行通过、修复排名/身份/数据门禁；42 项中 32 项本地通过、7 项待专项、3 项部分完成 | [评测记录](validation/RECOGNITION_PILOT_20261101.md)：257 项后端、62 张真实查询两环境一致；未知猫误接受 50%，VER-001 未关闭 |

| 2026-11-01 | VER-001 / 保守策略校准与留出验收 | 完成数据冻结、校准、候选冻结和留出检验；未知猫误确认达标，已知猫正确确认未达标；问题计数不变 | [实验记录](validation/RECOGNITION_CALIBRATION_20261101.md)：最新代码 273 项后端、七项常规 CI 通过；专项因 28/36 <80% 返回质量失败，候选未提升为默认 |

| 2026-11-01 | VER-001 / 输入几何与参考覆盖 | 新增完整主体填充和旧向量失配拒绝；新公开留出达到经验门槛，校园专项保持未关闭，问题计数不变 | [新实验记录](validation/REFERENCE_COVERAGE_20261101.md)：后端 287 项、七项 CI 通过；新留出 31/36 正确确认、1/60 未知误确认，默认未切换 |
| 2026-11-01 | ISS-043 / 校园照片资料准备 | 发现原备份截断，新增未解决项；43 项中 32 本地通过、7 待专项、3 部分完成、1 未解决 | [盘点记录](validation/CAMPUS_ASSETS_20261101.md)：936 张独立静态图、272 张日期线索，16 项准备检查及后端 303 项通过，未执行校园模型验收 |

| 2026-11-01 | 来源重新采集，状态不变 | 37 页、727 个档案 ID；按用户资源约束停在 94 张图片，旧 91 名中 90 个同名。发现同名 ID、至少 4 个物种误标、拼图，未导入评测 | [采集与远端证据](validation/MEOWZART_SOURCE_20261101.md)；ISS-043、VER-001、VER-007 保持开放 |

后续每次关闭或降级条目，应在本表追加原因及证据，并同步条目状态和顶部数量；保留稳定编号，不删除已修复问题的历史记录。
