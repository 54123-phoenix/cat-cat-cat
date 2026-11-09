# Web 复旦蓝与主题验收（2026-11-08—09）

本轮实施与验收跨 2026 年 11 月 8–9 日，将 Web 默认配色调整为复旦蓝，完善主题偏好、深色界面、登录页和分享图片。浏览器检查使用本地隔离预览、临时数据库和示例附件；未进行线上部署。

## 颜色来源与交付范围

复旦大学官方[《大学章程》](https://fudan.edu.cn/452/list.htm)规定学校标准色为复旦蓝，RGB 为 **14、65、156**，对应 Web 色值 **`#0E419C`**。官方[视觉识别页面](https://www.fudan.edu.cn/2405/list.htm)可作为配套参考；本轮采用的具体颜色值以章程为依据。

- 默认主色为 `#0E419C`，深蓝为 `#0B337B`，配合白色及浅蓝表面；按钮、导航、品牌渐变和相关边界使用主题变量。
- 深色主题使用浅蓝主控色 `#8AB7FF`、深色表面和相应前景色，保证文字及控件可辨识。
- 现有 Logo、猫咪形象、空状态、加载图形及地图标记延续已有矢量资产，只调整配色。它们不是本轮生图成果，也不是学校官方标志。
- 保留既有自托管 Noto Sans SC 字体、真实猫咪照片及业务流程。字体来源和前轮排版验收见 [Web 字体与界面细节优化](WEB_TYPOGRAPHY_20261108.md)。

## 主题与界面行为

沿用 `original` 作为默认主题键，名称改为“复旦蓝”。旧版启动会自动保存 `original`，因此无法区分过去的默认值与主动选择；已有 `original` 统一使用新的蓝色默认。希望继续使用橙色的用户可选择新增的“暖橙”。其余已保存的有效主题键继续保留。

现有八种选项为：`original` 复旦蓝、`orange` 暖橙、`zen` 禅意、`rustic` 田园、`modern` 现代、`sugary` 糖果、`cafe` 咖啡馆、`dark` 深色。

启动只读取并应用偏好，不再自动写入存储；用户主动选择时才保存。缺失、未知或无法读取的存储值回退到默认主题。保存失败仍立即应用所选主题，设置页重新挂载时优先读取有效的当前 DOM 主题，避免覆盖本次会话中已生效的选择。

- 选择器使用具名原生分组、按钮和 `aria-pressed`，提供可见键盘焦点。标签由 10px 调整为 14px，取消整体透明度，点击区域至少 44px；320px 下实测最小为 44×68px。
- 登录卡及输入框使用主题表面，主按钮采用 `on-primary`；标签 14px、输入文字 16px，错误消息使用语义危险色和 `role="alert"`。修正字标颜色继承及横幅遮挡标题，保留登录注册逻辑与文案。
- 个人页修正昵称与顶部横幅重叠；编辑控件、贡献头衔区使用主题表面，并改善 320px 下的文字换行。
- 分享导出修复屏幕外海报副本的位置：`html2canvas` 通过 `onclone` 重置位置，`html-to-image` 备用路径清除逻辑与物理 inset，原页面海报不移动。年度报告固定使用复旦蓝渐变，底部说明下移避免压住二维码。

## 本地验证结果

| 范围 | 已确认结果 | 主要证据 |
|---|---|---|
| 最终 Web 回归 | **175/175 通过，25 个测试文件**；其中主题专用测试 20 项 | `web-tests-final.log` |
| 最终静态检查与构建 | typecheck、全量 Web lint、生产 build 均退出 0；`git diff --check` 通过 | `web-typecheck-final.log`、`web-lint-final.log`、`web-build-final.log` |
| 默认蓝与核心页面 | **4 组通过**：首次启动、6 个路由的响应式布局、8 主题核心对比度、蓝/深色短视口发帖与菜单键盘操作 | `verify_blue.py` / `blue-result.json` |
| 主题选择器 | **8 组通过**：默认值、旧值迁移、8 种显式选择与刷新、标签对比度、响应式、键盘、存储失败后路由重挂载、200% 文字 | `theme_acceptance.py` / `theme-result.json` |
| 登录页 | **8 组通过**：两个主题分别检查标题遮挡、正常表单及响应式、注册切换、错误保留输入并恢复可重试状态 | `login_acceptance.py` / `login-result.json` |
| 品牌页面与真实下载 | 实际界面登录、个人页/贡献头衔窄屏检查、4 张 PNG 下载通过；最终 `failures`、`page_errors`、`http_errors` 均为空 | `verify_brand_flows.py` / `brand-flow-results.json` |
| Quick harness | **3/3 通过**：静态合同、安全与上传合同、文档合同；安全检查内含 40 项通过 | `harness-quick.json` |

核心页面覆盖首页、图鉴、猫咪详情、社区、帖子详情、识猫页，宽度为 320/390/768/1280px；主题选择器和登录页覆盖 320/390/1280px。选择器在 320px、根字号 200% 时仍无横向溢出；蓝/深色发帖弹窗在 320×568px 下可用且正确恢复焦点。

8 主题的核心文字及 placeholder 采样均达到 4.5:1，输入边界达到 3:1；主题选择器标签最低 **7.07:1**。登录页 **32 项文字对比**覆盖正常、悬停、注册、错误状态和横幅渐变，最低 **5.19:1**；深色卡标题/输入为 **14.18:1**、主按钮 **7.89:1**、错误提示 **5.61:1**。错误状态使用本地拦截响应，确认保留输入并恢复可重试，未创建账号。

四张实际下载 PNG 均经内容目视检查和全图 alpha 检查，alpha 范围均为 `[255, 255]`。路线图为 **720×1280**，分别跟随默认蓝与深色；年度报告为 **750×1334**，两个主题在相同数据下导出文件的 SHA-256 一致，说明其固定品牌配色不受页面主题影响。

最终主题、登录、默认蓝报告无未处理页面异常。日志中的既有 jsdom `window.scrollTo` 未实现、Browserslist 数据过期等提示未改变通过结果；Quick harness 的 3/3 仅表示该快速检查范围通过。

## 生图探索状态

新猫咪形象探索保留三份提示：蓝白校园猫、图书馆的猫、立体校园猫，见 [concepts.jsonl](../../output/imagegen/fudan-blue/concepts.jsonl) 与[执行说明](../../output/imagegen/fudan-blue/README.md)。

本轮只尝试提交第一份提示，图像服务返回 **HTTP 403**，结果为 **0 张生成图片**；另外两份没有重复提交。提示集是后续生成与比较的输入，不构成已完成的新形象设计。执行状态证据为 `imagegen-result.json`。

## 证据索引与边界

本机 Git 忽略目录 [`artifacts/web-fudan-blue-20261108/`](../../artifacts/web-fudan-blue-20261108/) 保留本轮日志、脚本、报告及图片：

- 最终汇总：[`blue-result.json`](../../artifacts/web-fudan-blue-20261108/blue-result.json)、[`theme-result.json`](../../artifacts/web-fudan-blue-20261108/theme-result.json)、[`login-result.json`](../../artifacts/web-fudan-blue-20261108/login-result.json)、[`brand-flow-results.json`](../../artifacts/web-fudan-blue-20261108/brand-flow-results.json)、[`harness-quick.json`](../../artifacts/web-fudan-blue-20261108/harness-quick.json)。
- 主题截图：`theme-profile-{original,dark}-{320,390}.png`、`theme-selector-text200-320.png`；这些截图用于选择器验收，同期个人页其他区域的最终状态以品牌流程截图为准。
- 登录截图：[`login-original.png`](../../artifacts/web-fudan-blue-20261108/login-original.png)、[`login-dark.png`](../../artifacts/web-fudan-blue-20261108/login-dark.png) 及两个 `-error.png` 版本。
- 最终分享文件：`brand-route-share-{light,dark}.png`、`brand-wrapped-{light,dark}.png`；个人页证据为 `brand-profile-dark-320.png`、`brand-profile-editor-dark.png` 等。
- 过程诊断：`theme-result-preview-interruption.json` 记录首次本地预览中断，恢复后主题复验通过；`brand-flow-first-export-failure.json` 及导出诊断文件用于解释修复过程，不作为最终通过报告。

临时 Web/API 服务已停止，临时数据及附件清理，监听端口已验证释放。上述结论来自桌面 Chromium 和固定隔离样例；200% 检查通过调整根字号完成，对比度为指定控件与状态的采样，不是全站 WCAG 审计。真实设备、不同浏览器、校园弱网及线上部署仍需独立验收。
