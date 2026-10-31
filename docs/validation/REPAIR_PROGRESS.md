# 连续修复与本地验收记录

日期：2026-10-30。基线：`f350468e1d39de81e76416e315a4739516dd123c`。本轮为未提交工作区变更，没有推送、部署或迁移真实业务库。用户已授权小修改逐项测试后继续，无需每项等待确认。

当前台账共 33 项（原 32 项加浏览器复验发现的 ISS-033）：**19 项通过本地验收，10 项代码已有修复但专项环境验收未完成，3 项部分完成，1 项未修复**。另有 VER-001～007 保留。这里的本地验收不能代替生产环境验收，也不是全项目完成率。

## 最终检查

| 检查 | 结果 | 证据 / 边界 |
|---|---|---|
| 后端全量 pytest | 163 passed，52 warnings | [日志](repair-backend-full.log)，测试数据库隔离 |
| Web Vitest | 48 passed，11 个文件 | [日志](repair-web-tests.log)，含真实组件与请求边界；日志中的 `Error: test` 来自预期的错误边界测试 |
| Web 类型检查 | 通过 | [日志](repair-web-typecheck.log)；尚未开启全仓 strict |
| Web 阻断 lint | 0 errors | [日志](repair-web-lint-errors.log)；警告没有清零，见下文 |
| Web 生产构建 | 通过 | [日志](repair-web-build.log)，主 chunk 502.63 kB，体积警告保留 |
| 小程序请求合同测试 | 5 passed | [日志](repair-mini-tests.log)，无浏览器 FormData 的 Taro 边界模拟 |
| 小程序源码类型检查 / 微信目标构建 | 通过 | [类型](repair-mini-typecheck.log)、[构建](repair-mini-build.log)，未进行微信设备验收 |
| Edge 浏览器，390×844 | 管理登录/退出、普通登录、图鉴加载/搜索通过，0 pageerror | [结果](repair-browser.log)、[服务日志](browser-server.log)，真实 Vite→API→临时 SQLite；地图只检查无 Key 回退 |
| 数据库升级 | 3 项迁移测试通过，已纳入 163 项 | 空库、重复升级、未标记 create_all 库、旧 head 的归属字段升级，包含数据和外键校验 |
| 备份恢复 | 2 项测试通过，已纳入 163 项 | 打开 WAL 的一致快照；临时项目的 PowerShell 备份/预演/恢复及恢复前快照 |
| 差异空白检查 | `git diff --check` 通过 | 代码/测试/截图指纹见 [SHA256 清单](repair-files.sha256) |

环境：Windows、Python 3.11.9、Node 24.15.0；浏览器 Edge 156。CI 已改用 Node 24，与当前 ESLint 10 / jsdom 29 的运行要求匹配。尚未运行远端 GitHub Actions。

## 每项修复及关闭范围

| 编号 | 当前状态 | 修复、验证与未完成边界 |
|---|---|---|
| ISS-001 | 本地已验收 | resolve 后校验上传目录归属，拒绝绝对路径；26 项 HTTP 回归，含 Windows junction。前轮证据保留于 ISS-001.md。 |
| ISS-002 | 本地已验收 | 默认关闭模拟微信认证，只有显式开关才能模拟；缺少/部分凭据拒绝，开发身份由完整 code 的 SHA256 派生。13 项配置、失败和身份测试；真实微信仍为 VER-002。 |
| ISS-003 | 本地已验收 | 24 处原时间默认值和 onupdate 改为调用函数；UTC 入库/带时区读出，校园日历固定 UTC+08:00。插入、更新、跨日与次日排除测试通过；历史混用时间无法可靠还原，不伪造回填。 |
| ISS-004 | 本地已验收 | `/admin` 直接挂载登录，去除自重定向；组件测试及真实浏览器登录/退出通过。 |
| ISS-005 | 本地已验收 | 管理请求显式选择 admin 认证，管理 401 只清理对应 token；11 种管理操作、混合 token、过期、普通请求场景覆盖。后端角色检查继续生效。 |
| ISS-006 | 本地已验收 | 图鉴 useMemo 位于所有提前返回之前，覆盖有数据、空数据、失败与搜索；真实浏览器加载/搜索通过。 |
| ISS-007 | 待专项验收 | 移除小程序 FormData，文字表单 URL 编码；Taro 模拟、后端真实表单合同与构建通过，待设备。 |
| ISS-008 | 待专项验收 | Page 保留 total/has_more；首页用真实 total，社区按 skip 翻页并隔离旧筛选请求，图库/热力解包 items；待真机三页操作。 |
| ISS-009 | 待专项验收 | 有文件/无文件偶遇字段一致，零坐标与 note 不丢失；uploadFile 校验 HTTP/JSON，失败拒绝 Promise，保存失败不提前显示成功；待设备完整保存/重试。 |
| ISS-010 | 待专项验收 | 识别不可用有专门界面与重试，不再伪装 confirmed；缺失状态也按不可用处理，待设备验收。 |
| ISS-011 | 本地已验收 | 举报固定路由先于数字详情路由，匿名/普通/审核员/管理员 HTTP 行为及数字详情回归通过。 |
| ISS-012 | 本地已验收 | 审核状态显式 approved/rejected，同决定重复提交不重复审计；迁移修复历史 rejectd，测试保留历史数据。 |
| ISS-013 | 本地已验收 | 待审/拒绝偶遇仅本人或审核角色可查询；图库、热力、附近、路线等公开查询限 approved；关注通知延后到审核通过，审核使热力缓存失效。业务记录隔离已测试；并未给公开 uploads 增加逐文件 ACL。 |
| ISS-014 | 待专项验收 | 缺失权重、损坏/维度/缺键严格加载失败时返回 unavailable，不缓存随机模型。5 项控制流测试使用模型桩；真实 checkpoint 兼容性和质量待 VER-001。 |
| ISS-015 | 待专项验收 | 识别函数接受 crop 参数，评测要求独立样本目录，可输出 JSON，空样本/模型不可用返回非零退出码。2 项脚本合同测试；没有真实准确率结论。 |
| ISS-016 | 本地已验收 | 冻结 SQLite 基础 schema，旧迁移容忍既有列/索引，新增对账迁移和两次增量迁移。支持的三条升级路径已测；未知历史变种、PostgreSQL 未验收。应用导入仍有 create_all，不把它当升级替代方案。 |
| ISS-017 | 待专项验收 | Compose 绑定 `cat-backend/data:/app/data`，启动先 Alembic；Docker daemon / 容器重启持久性仍待 VER-003。 |
| ISS-018 | 本地已验收 | SQLite online backup + integrity_check，显式/自动路径选择，拒绝歧义；修复 PowerShell 单结果退化成字符串首字符的问题。WAL 和完整包装脚本的可丢弃副本测试通过；附件部署级一致性仍待 VER-003。 |
| ISS-019 | 待专项验收 | 加 redis 运行依赖；异步发布回到初始化的事件循环，配置 Redis 不可用则启动失败。同步/异步调用模型测试通过，真实 Redis 多 worker 中断恢复待 VER-004。 |
| ISS-020 | 本地已验收 | 统一有界 TTLCache，单条 TTL、单调时钟、线程锁、模式失效；内存分支测试通过。Redis 的部署级失效仍在 VER-004。 |
| ISS-021 | 本地已验收 | SSE 与普通 API 共用 token_version 校验；活动流在事件/心跳前复验，撤销后终止；真实生成器测试通过。 |
| ISS-022 | 本地已验收 | 订阅在生成器消费时创建，finally 等待 unsubscribe；Redis unsubscribe 失败仍 aclose。内存及 Redis 模拟清理通过，真实服务待 VER-004。 |
| ISS-023 | 本地已验收 | Web 统一 page→skip、保留 Page 元信息；偶遇/帖子/图库三个 Hook 各加载 45 项、三页无重复并停止。首页帖子数使用 total。 |
| ISS-024 | 本地已验收 | 热力查询实际 offset/limit，稳定排序；5 个点的三页 total/has_more 与内容一致，审核缓存失效回归通过。 |
| ISS-025 | 待专项验收 | 已选校园点/合法路线坐标随偶遇保存；去掉默认虚构第一地点，未知地点允许无坐标并解释地图不显示。解析与零坐标测试通过；真实地图坐标校准待 VER-005。 |
| ISS-026 | 本地已验收 | 每用户/偶遇唯一奖励流水；投票、流水、XP 同一事务，SQLite upsert 串行化写入。重复、12 个并发 HTTP、改票及故障回滚测试通过。历史 XP 不扣改；已奖励者改票/结论改变不重复奖励，不追溯撤奖。 |
| ISS-027 | 本地已验收 | 私有去重猫 ID 接口用于两端图鉴，不受偶遇分页截断；识别审计和新发现从服务端 token 派生 user_id；发现提交要求登录。两用户/伪造字段/历史未知/跨日/不可用识别测试通过。图鉴仅计本人已审核偶遇。 |
| ISS-028 | 未修复 | 参考库原有缓存/数字 ID 绑定仍缺乏可追踪的版本、重建、发布与多 worker 刷新流程。不是改页面即可解决的缺陷；需要单独实现参考库生命周期，真实模型资产当前也缺失。 |
| ISS-029 | 部分完成 | 增加分页封装、认证上下文与 ApiError，投票结算从路由拆到 service。关键实体仍有 any，strict 未启用，crud/gamification 大模块未完成职责拆分，不能关闭。 |
| ISS-030 | 部分完成 | CI 新增 Web tests/lint、两端 typecheck、小程序合同测试，npm ci；修复随机渲染/渲染期 refs/SSE 闭包等错误。仍有格式与类型债务；React 18 effect 内加载状态规则降为 warning，未关闭 Hook 顺序、purity、refs 等规则。CI 未远端执行，后续仍需提高警告门槛与浏览器门禁。 |
| ISS-031 | 部分完成 | README、DEPLOY、最终验收和备份文档纠正发布状态、页面数、路径及缺失下载命令，明确未实现的新猫合并/发现者勋章；已有猫情报 Agent 与规划 Agent 分开。外部下载、干净 Docker 部署及其余历史规划文档未全量复验。 |
| ISS-032 | 待专项验收 | 五张不同页面截图由本地真实浏览器生成；10 个 tab PNG 改为 Web 同源 Lucide 48×48 透明素材并保留许可。截图已查看，构建通过；微信真机显示未验收。 |
| ISS-033 | 本地已验收 | 新发现：快速页面导航中 profile 请求中断会清空登录。现在只有明确 401 才退出，陈旧请求不清理新的 token。3 项错误分支测试及真实浏览器快速导航通过。 |

## 数据升级与运行注意

当前 Alembic head 是 `g20261030`。升级顺序：备份实际 `DATABASE_URL` 指向的库，停止写入，在后端环境运行 `python -m alembic upgrade head`，完成后再启动新代码。新增 `sighting_vote_rewards`、`discoveries.user_id`、`audit_logs.user_id`。历史 user_id 为 NULL，不按昵称/IP 猜测归属；历史时间和异常 XP 不擅自重写。见 [备份恢复](../BACKUP_RECOVERY.md)。

修复前已有的奖励无法可靠重建流水，因此旧记录可能在部署后的首次共识结算获得一次新规则奖励，但之后不重复；这是保留旧 XP、不推测历史发奖事件的迁移边界。

本地无 PyTorch / 模型权重、正式微信条件、地图 Key、真实 Redis/Docker 环境，故相关验收保持开放。回退成功、模拟测试和构建成功均不代替真实服务或模型验收。许可决策属于权利人，未替用户选择整个仓库许可证。

## 门禁边界与复跑

后端在隔离环境设置 `DATABASE_URL=sqlite://`、测试 JWT_SECRET / ADMIN_PASSWORD、`INIT_DEMO_USER=0` 与测试 UPLOAD_DIR 后运行 `python -m pytest tests -q --tb=short`。新迁移和备份测试使用临时库；浏览器脚本 `python scripts/verify_browser.py` 使用临时项目数据库，测试结束关闭自己创建的进程，不使用业务数据库。

Web：`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`。小程序：`npm test`、`npm run typecheck`、`npm run build:weapp`。小程序 `skipLibCheck=true` 仅隔离 Taro 跨平台声明错误，应用源码的 noUnused/strictNullChecks 继续检查，不能称第三方声明已经修复。

`npm run lint` 使用 `--quiet` 作为阻断错误门禁；完整告警应另跑 `npx eslint src`。格式警告及 effect 状态更新等迁移债务并未删除。浏览器验收需要额外安装 Playwright 且有 Edge；尚未成为 CI 必选步骤。
