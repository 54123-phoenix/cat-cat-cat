# 校园猫猫社区 — 视觉升级方案

基于对当前代码的分析（橙色 `#F97316` 主色、暖米色 `#FAFAF9` 背景、Inter 字体、`.clay-card`/`.card` 卡片体系、丰富的 CSS keyframes 动画、移动端 480px 居中布局、底部 TabBar 含中央识猫按钮），以下是 7 项可在单次 opencode 运行内落地的视觉打磨项，按"投入产出比 × 演示惊艳度"排序。

---

## 1. 路由切换：方向感页面转场（替代当前无方向的 tab-slide）

**Files to modify**
- `src/index.css`（新增 `page-enter-forward` / `page-enter-back` keyframes 与工具类）
- `src/components/Layout.jsx`（用 `useNavigate` 的 history 方向判断包裹 `<Outlet>` 的 `key` 容器，替换现有 `.tab-slide-in`）

**Specific changes**
当前 Layout.jsx:72 用 `key={location.pathname}` + `.tab-slide-in` 做了简单的淡入上滑，但没有前进/后退方向感。引入一个轻量的导航栈：在 Layout 内维护 `const [history, setHistory] = useState([])`，监听 `location.pathname` 变化时判断是 push（前进，从右滑入）还是 pop（后退，从左滑入）。给容器加上 `page-enter-forward`（`translateX(20px)→0` + opacity）或 `page-enter-back`（`translateX(-20px)→0`）。配合已有的 `prefers-reduced-motion` 兜底。

**Expected visual impact**
点 TabBar 切换时有连贯的方向感流动，像原生 App 一样；演示时切页"活"起来，告别生硬闪现。

---

## 2. CatCard 重设计：图片渐变遮罩 + 悬浮上浮 + 加载 shimmer

**Files to modify**
- `src/components/CatCard.jsx`
- `src/index.css`（新增 `.cat-card-img-shimmer` 占位动画与 `.cat-card-overlay` 渐变）

**Specific changes**
当前 CatCard.jsx:7 的图片区是纯 `aspect-square` 方块，文字信息在下方独立 `p-3` 区。改为：图片占满卡片上半部，底部叠加 `linear-gradient(to top, rgba(28,25,23,0.78), transparent 40%)` 渐变遮罩，把猫名 + 颜色 chip + 位置直接压在图片上（白色文字），整卡变成"杂志封面"式。图片 `onLoad` 前显示 shimmer（复用现有 `.skeleton` 渐变 + 一个猫爪 SVG 水印）。整卡 `hover` 时 `transform: translateY(-4px)` + `box-shadow` 升级到 `shadow-elevated`，`active` 时 `scale(0.98)`。圆角统一用 `rounded-2xl`。

**Expected visual impact**
首页/个人页的猫卡片瞬间从"功能块"变成"图鉴卡片"，渐变遮罩让任意照片都文字可读；悬浮上浮配合已有 `like-pop` 动画体系形成一致的"轻飘"手感。

---

## 3. 首页 Hero 区：渐变问候横幅 + 动态时段配色

**Files to modify**
- `src/pages/Home.jsx`（顶部 `card p-5` 区，Home.jsx:85-113）
- `src/index.css`（新增 `.hero-gradient-morning/noon/evening/night` 四套渐变背景）

**Specific changes**
把现有问候卡片背景从纯白 `.card` 换成根据 `greeting()` 时段动态选择的暖色渐变（早安：`#FFF7ED→#FED7AA`；中午：`#FEF3C7→#FFF7ED`；傍晚：`#FED7AA→#FB923C` 微暖；夜晚：`#1C1917→#44403C` 深色配白字）。三个统计小卡保持白底但加 `border-primary/10` 与图标。问候语用 `text-2xl font-bold` 加大字号，名字用 `font-extrabold`。右上角 `PawPrint` 改成会 `animate-breathe`（已有 keyframe）的呼吸光点。

**Expected visual impact**
打开 App 第一屏就有"今日感"的渐变横幅，演示时一眼抓住注意力；时段变化体现产品用心程度。

---

## 4. 底部 TabBar 活跃态：胶囊高亮 + 图标 morph + 中央识猫按钮光环

**Files to modify**
- `src/components/TabBar.jsx`
- `src/index.css`（新增 `.tab-active-pill` 与 `.scan-ring-pulse`）

**Specific changes**
当前 TabBar.jsx:22 活跃态只是文字变色，太弱。给活跃项加一个 `bg-primary-light` 胶囊背景（`px-3 py-1 rounded-full`）+ 图标从 `w-5` 微放大到 `w-5.5` + `text-primary`，用 `transition-all duration-300`。中央识猫按钮（TabBar.jsx:38）外层加一个常驻 `animate-scan-ring`（已有 keyframe）的橙色光环 div，让"识猫"始终是视觉焦点。非活跃项 `opacity-60`。底部加一条 `1px` 的 `bg-gradient` 顶边替代纯灰边。

**Expected visual impact**
TabBar 从"四个灰图标"变成"有焦点、有呼吸"的导航；中央识猫按钮的光环让 CTA 永远第一眼可见，演示时引导观众点最核心功能。

---

## 5. Scan 页相机按钮重设计：取景框 + 扫描线 + 快门拟物

**Files to modify**
- `src/pages/Scan.jsx`（idle 上传区，Scan.jsx:146-151）
- `src/index.css`（新增 `.viewfinder-corner` 四角、`.scan-line` 扫描线动画）

**Specific changes**
当前 idle 状态只是一个虚线 dashed 框 + Camera 图标，太朴素。改成拟物取景器：一个 `aspect-[3/4]` 的深色 `bg-stone-900` 区域，四角用 4 个 `border-2 border-primary` 的 L 形角标（`viewfinder-corner`），中央放已有 `.camera-btn`（180px 圆形渐变快门）。识别 loading 时叠加从上到下循环的橙色 `scan-line`（`@keyframes` 上下扫），配合已有 `.animate-pupil-scan` 的瞳孔扫描感。整体氛围从"上传表单"变成"AI 相机"。

**Expected visual impact**
Scan 是课程 demo 最想展示的 AI 功能，取景器 + 扫描线让"识别中"过程有强烈的科技仪式感，远胜当前的转圈 spinner。

---

## 6. Profile 页头部：渐变 banner + 头像白环 + 统计胶囊条

**Files to modify**
- `src/pages/Profile.jsx`（顶部 User Info 卡，Profile.jsx:120-165）
- `src/index.css`（新增 `.profile-banner` 渐变）

**Specific changes**
当前 Profile 头部是普通白 `.card`。改成：顶部一个 `h-28` 的 `bg-gradient-to-br from-primary to-primary-hover` 圆角 banner（`rounded-b-3xl` 下圆角），头像 `w-20 h-20` 用 `-mt-10` 骑在 banner 与下方内容交界处，外加 `4px white ring` + `shadow-lg`。昵称 `text-2xl font-extrabold`。三个统计从竖排图标改成横向胶囊条（`bg-primary-light rounded-full px-4 py-2` 内含图标+数字+标签），并排居中。勋章墙标题区加一个小进度条显示 `earnedBadges.length/totalBadges`。

**Expected visual impact**
个人页从"列表页"变成"个人主页"，渐变 banner + 骑跨头像是社交 App 经典高级感手法；演示账号数据时观感专业。

---

## 7. 全局：图片加载 shimmer + 按钮涟漪 + 卡片入场 stagger

**Files to modify**
- `src/index.css`（新增 `.img-shimmer` 占位、`.btn-ripple` 涟漪、`.stagger-1/2/3/4` 延迟工具类）
- `src/components/CatCard.jsx`、`src/components/PostCard.jsx`（图片加 `loading="lazy"` + shimmer 占位）
- `src/pages/Home.jsx`（猫卡片网格加 stagger 延迟类）

**Specific changes**
三处微打磨合一：(a) 所有 `<img>` 包一层 shimmer 占位，`onLoad` 后淡入图片（复用现有 `.skeleton` 渐变）。(b) 给 `.clay-btn` / `.btn-primary` 加 `:active` 时的橙色涟漪（用 `::after` 伪元素 + `paw-ripple` 已有 keyframe）。(c) 首页猫卡片网格按 index % 4 加 `.stagger-1..4`（`animation-delay: 60/120/180/240ms`）配合已有 `animate-fade-up`，让列表"逐个浮现"而非"整块闪出"。

**Expected visual impact**
三处都是"低投入高回报"的微动效：shimmer 消除图片灰块跳变，涟漪让每次点击有回响，stagger 让数据加载完成有节奏感——合起来就是"打磨过"与"没打磨过"的分水岭。

---

## 落地顺序建议

1 → 7 → 4 → 2 → 3 → 6 → 5

先做全局基础（转场、微动效、TabBar），再逐页打磨卡片与头部，最后做最复杂的 Scan 取景器。每项独立可验证，任一项失败不影响其他。
