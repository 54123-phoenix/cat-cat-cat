# ISS-039：浏览器断线重连与当前数据同步

日期：2026-11-01。修复基线 `c448f8fd9331a78df60d24231f04d48bcaff4e46`；修复提交 [`7109286d97324ee568582077cb0143abae43bce0`](https://github.com/54123-phoenix/cat-cat-cat/commit/7109286d97324ee568582077cb0143abae43bce0)。

## 已复现的问题

旧版 `useEventStream` 在连接打开时只重置重试计数，不重新查询业务数据；连续五次连接失败后停止重试。首页与 Layout 分别订阅，形成两个 SSE 连接。帖子点赞和投票组件从 props 初始化本地状态后，也不会随新查询结果更新。

真实 Chromium 中切断 API 到 Redis 的 TCP 连接，在中断期间通过真实 API 创建帖子，查询确认已落库，再恢复同一 Redis 实例。旧客户端的 SSE 再次打开，但现有页面在 15 秒断言期限内仍找不到新帖子。[旧版结果](reconnect-before.json)及[失败断言](reconnect-before.log)记录了这一现象。投票数字不同步另有[修复前回归失败](reconnect-poll-before.log)。

最早浏览器脚本漏给帖子列表查询带认证，返回 401；后续扩展脚本又曾在空图鉴中查找不存在的搜索框。这两项是测试夹具错误，修正后重新执行，不登记为产品故障。旧失败截图与 Playwright trace 保存在本地忽略目录 `artifacts/reconnect-before-confirmed/`；不将含测试会话信息的 trace 纳入源码。

## 修复范围

- Layout 统一持有一个 SSE 连接。首次打开、重新连接或收到业务事件时，200 ms 内合并刷新，失效 React Query 缓存并通知本地 state 页面重新读取当前数据。
- 重试退避为 1、2、4、8、16、30 秒，此后保持 30 秒上限，不再五次后放弃。浏览器离线时关闭连接，联网后恢复。
- EventSource 不提供错误状态码，因此用普通认证接口区分会话失效和暂时故障。明确 401 停止连接并回到登录；网络错误和 503 保留会话。登出、卸载、token 切换会清理订阅和定时器，忽略旧连接消息及迟到结果。
- 首页、通知、图鉴、个人资料、猫/帖子详情、勋章、周报、排行榜、路线、年度回顾、任务卡和地图数据读取接入同一刷新通知。旧请求结果不能覆盖更新后的数据；表单不因刷新整体重挂载。
- 点赞、投票和已展开评论随读取结果更新，保留未发送评论、发帖草稿及图鉴搜索词。帖子详情遇到暂时读取失败保留内容，明确 403/404 清除已失效详情；切换帖子或猫档案时清除前一个对象。

本轮没有后端生产代码或数据库迁移修改。新增 `scripts/verify_reconnect_browser.py` 并接入 `browser-smoke` CI。

## 验证环境与方法

Windows，Python 3.11.9、Node 24.15.0；Vite + 真实 Uvicorn API + 临时 SQLite + Docker Redis，所有用户、猫和帖子均为测试数据。脚本使用唯一容器名和随机回环端口，结束时清理自己的 Redis 容器和服务进程；没有读取或修改实际业务数据库、Houseflow 容器和历史卷。

Redis 故障由 TCP 代理切断产生，恢复后核对 Redis `run_id` 不变。浏览器使用原生 EventSource，仅记录连接计数，不模拟成功响应。恢复后直接断言原页面 DOM，不靠手动刷新或重新导航取得新数据。

本地 **Chromium 156.0.8078.4 + Redis 7.4.9 十组全部通过，页面运行错误为 0**，见[结果 JSON](reconnect-browser-local.json)。持续断线 60 秒后恢复并看到新数据；结果中的 `long_outage_seconds=88.44` 包含恢复连接及显示数据的等待时间，不是纯断网时长。

| 浏览器检查 | 结果 |
|---|---|
| 中断期间落库的新帖子自动补回 | 通过 |
| 发帖编辑期间刷新，未发送草稿保留 | 通过 |
| 详情补回新评论，未发送评论保留 | 通过 |
| 通知页补回断线期间的点赞通知 | 通过 |
| 图鉴出现新档案，搜索词保留 | 通过 |
| 首页自动刷新，Redis 订阅数量为 1 | 通过 |
| 浏览器 offline/online 后重连并刷新 | 通过 |
| 超过旧重试预算的长断线后恢复 | 通过 |
| 登出取消待重连定时器和订阅 | 通过 |
| 撤销会话后回到登录并停止订阅 | 通过 |

Web 全量 **78 passed / 14 files**，见[测试日志](reconnect-web.log)；[类型检查](reconnect-typecheck.log)、[lint](reconnect-lint.log)与[构建](reconnect-build.log)通过，主包 504.48 kB。新增 12 个回归覆盖连接生命周期、迟到通知响应、评论草稿、点赞/投票 props 同步，以及详情暂时失败、删除和路由切换。投票回归先失败再修复通过；浏览器十组不含真实投票操作，未将组件测试写成浏览器覆盖。

本轮后端生产代码没有变化，本机不重复执行后端全量。[修复提交的远端运行 41292098365](https://github.com/54123-phoenix/cat-cat-cat/actions/runs/41292098365) **六项全部成功**，见[任务结果](reconnect-ci.json)：后端 243 passed / 69 warnings、Web 78 passed、小程序构建与测试、Redis 四进程十项、Docker API 阶段七组、浏览器核心六组及参考库八组均通过。

新增浏览器重连脚本在 Linux CI 的 **Chromium 156.0.8078.4 + Redis 7.4.12 十组全部通过，页面运行错误为 0**，见[远端结果](reconnect-browser-ci.json)。长断线含恢复与显示的总耗时为 76.34 秒。远端执行的是完整修复提交，包含投票状态同步及为退避/首个心跳预留余量的 60 秒重连等待上限。证据补记只修改文档，后续文档提交不改变这里验收的生产代码。

复跑需要可用 Linux Docker 引擎、Node 依赖、`cat-backend/requirements-browser.txt` 和 Playwright Chromium。在仓库根目录执行：

```bash
python scripts/verify_reconnect_browser.py --output-dir artifacts/reconnect-browser
```

故障时输出 `failure.txt`、截图、trace 与服务日志；成功输出 `result.json`。长断线步骤持续切断至少 60 秒，覆盖旧版退避总预算及真实请求失败耗时。

## 仍然存在的边界

这里验证的是重新查询后的当前状态，Redis Pub/Sub 没有离线事件持久化或逐条重放。无持久记录的短暂弹窗不会被补发；后端允许 TTL 的排行榜缓存仍可能返回 TTL 内旧数据。

真实浏览器覆盖的页面和行为以结果 JSON 的检查项为准，不能扩展成所有页面、所有字段、所有浏览器均已验收。地图 Key、微信真机、外部 LLM、真实模型、完整 inference 镜像与生产网络代理仍需各自环境证据。通知高峰下统一刷新带来的请求负载未压测；SSE 查询参数 token 改为短期票据仍是后续认证改进。

构建仍保留主包超过 500 kB 的警告，没有通过放宽规则掩盖。项目整体尚未达到正式发布条件。
