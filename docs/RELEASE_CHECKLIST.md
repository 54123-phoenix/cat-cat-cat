# 发布清单

更新于 2026-11-08。本轮仅做本地修复与隔离验收，微信真机、目标服务器与校园质量仍待验证。本清单是当前操作入口；历史 P0–P6 标记和 harness 分数不能替代以下证据。

## 版本与迁移

- [ ] 记录候选提交/文件指纹、依赖锁文件、日期与执行人，明确拟开放范围。
- [ ] 核对实际 DATABASE_URL、uploads、models、reference-store；本地开发与 Compose 数据库位置可能不同。
- [ ] 停止业务写入与 reference-worker，按 [完整资产备份](BACKUP_RECOVERY.md)创建并校验备份。
- [ ] 先在隔离副本运行迁移，再核对记录数、外键与唯一约束。

在 `cat-backend` 执行 `python -m alembic upgrade head`，使用 Python 3.11 项目环境。当前 head 为 `k20261108`：新增偶遇提交请求标识、摘要与用户级唯一索引；不回填、合并或删除旧记录。启动只检查结构，不使用 `Base.metadata.create_all` 代替迁移。未核对的业务数据库不直接升级。

## 自动检查

在仓库根目录、已激活后端测试环境的终端中运行；测试不连接业务 Redis、参考库或外部 Agent。

```powershell
$env:DATABASE_URL = 'sqlite://'
$env:JWT_SECRET = 'local-validation-only-secret'
$env:ADMIN_PASSWORD = 'local-validation-only-admin'
$env:DEMO_PASSWORD = 'local-validation-only-demo'
$env:INIT_DEMO_USER = '0'
$env:UPLOAD_DIR = Join-Path $env:TEMP ('cat-local-validation-' + [guid]::NewGuid().ToString('N'))
$env:REDIS_URL = ''
$env:REFERENCE_STORE = ''
$env:REFERENCE_DIR = ''
$env:AGENT_ENABLED = '0'
$env:AGENT_API_KEY = ''
$env:WECHAT_APPID = ''
$env:WECHAT_SECRET = ''
$env:WECHAT_DEV_MODE = '0'
python scripts/check_assets.py cat-frontend/public cat-miniprogram/src/assets showcase
powershell -NoProfile -File harness/run.ps1 -Mode quick -ContinueOnFailure
powershell -NoProfile -File harness/run.ps1 -Mode full -ContinueOnFailure
python scripts/verify_browser.py
python scripts/verify_reference_browser.py
```

- [ ] 后端、Web、小程序测试与类型检查通过，Web lint 和两端构建通过。
- [ ] quick/full harness 无失败，并检查实际输出，不能只看总分。
- [ ] 真实浏览器无未处理异常，手机/桌面宽度无横向溢出，提交结果可读。
- [ ] 新目录依赖安装与 Git LFS 图片解码有效；记录已有警告及影响。

Web：在 `cat-frontend` 运行 `npm run typecheck`、`npm test`、`npm run lint`、`npm run build`。小程序：在 `cat-miniprogram` 运行 `npm run typecheck`、`npm test`、`npm run build:weapp`。首次浏览器验收需安装 `cat-backend/requirements-browser.txt` 和 Playwright Chromium。

## 核心流程

- [ ] 登录、选择照片、识别，结果出现时尚未创建偶遇。
- [ ] confirmed/uncertain 均由用户核对后明确提交；相似度不描述为正确概率。
- [ ] 提交中禁止重复点击，失败保留照片/地点/备注，相同内容重试只生成一条记录和一次奖励。
- [ ] 模拟服务端写入成功而响应丢失，再重试仍只有一条记录和一张附件。
- [ ] 成功显示待审核，不能再次提交同次偶遇，未审核记录没有公开链接。
- [ ] 审核前匿名详情、列表、地图不可见；通过后可见，撤回后消失。
- [ ] unknown/unavailable、上传失败有可执行下一步，缺模型不伪装成识别成功。
- [ ] 小程序提交包含照片、实际定位/地图选点及地点说明；取消定位可重选，不生成猜测坐标。
- [ ] 地图明确空态、全部/部分失败和重试，没有未标注的样例猫点位。
- [ ] Web 断线恢复保留输入，鉴权失效与暂时网络故障区别处理。

## 校园数据与模型

- [ ] 猫协/资料提供者核对身份、拍摄场次、来源与使用依据，保留审核记录。
- [ ] 资料检查通过后冻结协议、实际图库映射、最少样本数、阈值与目标，使用 [校园评测入口](CAMPUS_DATA_PREPARATION.md)。
- [ ] 参考、校准、留出按场次隔离，近重复经审核，完整实际图库绑定到评测。
- [ ] 留出按冻结条件验收，已用留出不再用于调参后的独立验收。
- [ ] 公开小样本、参考照自匹配、合成推理与校园效果分开报告。
- [ ] 代码、图片、档案、模型使用范围明确；历史备份截断 ISS-043 保持跟踪。

## 真机与部署（资料齐备后执行）

- [ ] 记录微信 AppID、域名、基础库、设备版本；关闭 demoMode 后验证登录、拍照、上传、定位、保存、列表与重试。
- [ ] 核对目标服务器 TLS、域名、代理、持久卷和日志；Redis 仅供内部网络，默认不发布宿主 6379。
- [ ] 四类资产恢复到全新隔离目录，核对结构、记录数、附件 HTTP/哈希、模型与参考库兼容及真实推理。
- [ ] 预先记录试点人数、并发、图片量、API/识别 p95 与错误率目标，再执行容量验收。
- [ ] 保留完整备份与原配置，记录恢复负责人、耗时和回退步骤。
- [ ] 实际开放的地图/外部 LLM 分别有环境证据，回退成功不替代外部服务验收。

## 最终签收

- [ ] README、台账、roadmap、TODO 与本轮验收记录一致。
- [ ] 分列本地通过、环境待验与产品限制，不用测试数量计算完成率。
- [ ] 维护者在环境和数据证据齐备后决定发布。
