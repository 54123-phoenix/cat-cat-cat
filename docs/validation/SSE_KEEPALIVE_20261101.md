# ISS-041：活动 SSE 被前一响应的 keep-alive 定时器截断

日期：2026-11-01。发现基线 `4cd6a2e`。完整 CPU 推理首次远端验收通过后，同轮 Redis 验收暴露已有 HTTP 协议缺陷。

## 失败证据与根因

[远端运行 41294796254](https://github.com/54123-phoenix/cat-cat-cat/actions/runs/41294796254) 的 `redis-runtime` 在撤销 token、等待已打开 SSE 正常结束时失败。客户端收到 `RemoteProtocolError: incomplete chunked read`；服务端先在 `H11Protocol.timeout_keep_alive_handler()` 报 `ConnectionClosed ... state=SEND_BODY`，随后发送响应体报 `Can't send data when our state is ERROR`。见[服务端原始日志](sse-keepalive-ci-before.log)。

Uvicorn 0.24.0 完成前一响应后安排 keep-alive 定时器，再处理连接中已缓冲的下一请求。下一请求若成为持续发送的 SSE，没有新的 `data_received()` 取消旧定时器，活动响应就可能被误当作空闲连接关闭。这是服务端 HTTP 生命周期问题，不能靠吞掉客户端协议错误或重跑 CI 关闭。

## 修复与回归

固定 Uvicorn 为 **0.54.0**，包含上游 [#3107](https://github.com/Kludex/uvicorn/pull/3107) 的修复：处理新的 `h11.Request` 时取消此前安排的 keep-alive 定时器。[0.53.0 发布说明](https://github.com/Kludex/uvicorn/blob/0.54.0/docs/release-notes.md#0530-september-14-2026) 记录了该修复；[0.54.0 源码](https://github.com/Kludex/uvicorn/blob/0.54.0/uvicorn/protocols/http/h11_impl.py) 可核对请求处理分支。项目 Python 3.11 满足新版要求；实验性 HTTP/2 没有启用。

新增 [TCP 行为回归](../../cat-backend/tests/test_http_stream_runtime.py)：同一回环 TCP 连接连续发送普通请求和 SSE 请求，idle timeout 为 50 ms，SSE 在 250 ms 后继续发消息并正常结束。断言两次 HTTP 200、两条事件、chunked 结束标记及无事件循环异常，实际使用 Uvicorn h11 状态机，没有模拟网络成功结果。

- Uvicorn 0.24.0：同一测试失败，缺少后半条消息并触发协议错误，见[修复前输出](sse-keepalive-before.log)。
- Uvicorn 0.54.0：同一测试通过，见[修复后输出](sse-keepalive-after.log)。

新版仍包含 `uvicorn.workers.UvicornWorker`，现有 Gunicorn 配置继续使用它；此入口已被上游标记弃用，后续迁移到独立 `uvicorn-worker` 包仍属于依赖维护工作。当前兼容性以完整容器的四 worker 启动和 HTTP 验收为依据。

## 验收范围

本机 Windows、Python 3.11.9：`uv pip check` 检查 53 个包通过，Python 编译通过，**后端全量 244 passed / 68 warnings / 185.07 秒**，见[全量日志](sse-keepalive-backend-local.log)。保留 CI 的不同测试管理员密码；警告主要来自 Pydantic 配置与 HTTPX TestClient 旧入口，没有关闭警告规则。

**真实 Redis 7.4.2（WSL Ubuntu）与 Windows 四个独立 API 进程十项通过**，见[结果](sse-keepalive-redis-local.json)，包括活动 SSE 撤销与拒绝重连、订阅清理、网络故障后恢复。所有本机运行使用测试数据库、唯一端口和临时 Redis 实例；不连接或修改业务库及其它项目容器。

修复提交 **`e2f1bd489e1ec61f271addc569e553bae673d38e`** 的[远端运行 41295461226](https://github.com/54123-phoenix/cat-cat-cat/actions/runs/41295461226) **七项全部成功**，见[任务结果](inference-sse-ci.json)：

| 范围 | 实际结果 |
|---|---|
| 后端全量 | 244 passed / 69 warnings / 84.40 秒，含 TCP 回归；[原始 CI 日志](sse-keepalive-backend-ci.log) |
| Redis 四进程 | 原生 Linux Redis 7.0.15，十项通过；[结果](sse-keepalive-redis-ci.json) |
| Docker API 阶段 | 四 Gunicorn worker、HTTP/SSE、重启和新卷恢复，七组通过；[结果](sse-keepalive-docker-ci.json) |
| 完整 CPU 推理 | 重新构建后十二组通过，真实坏权重拒绝通过；实际 Uvicorn 0.54.0、Gunicorn 26.2.0；[结果](inference-ci-final.json) |
| 浏览器 | Chromium 156.0.8078.4，[核心六组](sse-keepalive-browser-ci.json)、[参考库八组](sse-keepalive-reference-browser-ci.json)、[重连十组](sse-keepalive-reconnect-ci.json) 全部通过；三套 page_errors 均为空 |
| Web / 小程序 | 两项构建与既有测试、类型检查门禁通过 |

重连检查使用 Redis 7.4.12，长断线含恢复等待耗时 76.36 秒；故障期间出现预期连接错误，不把这些注入错误算作页面崩溃。没有在 Redis 脚本中忽略 RemoteProtocolError，也没有更改此轮业务断言以换取通过。后续证据补记只修改文档，不改变这里验收的生产代码。

本次只关闭这一 HTTP 定时器缺陷。Redis Pub/Sub 不持久化离线事件，生产代理配置、并发容量与未列明客户端仍需各自验收。
