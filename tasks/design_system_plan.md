# 校园猫猫社区 · Design System 升级方案

> 评审对象：`D:/Desktop/cat/cat-frontend`（React 18 + Tailwind 3 + 高德地图）
> 评审依据：朋友 6 条方向 + 优先级 + 警告，结合对实际代码的逐文件通读
> 评审人立场：高级 UI/UX 设计师 + 前端架构师

---

## 0. 当前视觉状态诊断（基于真实代码）

通读 `tailwind.config.js`、`src/index.css`、全部 14 个 page、24 个 component 后，确认"工程师做的"判断属实，但问题比朋友描述的更具体：

| 维度 | 现状 | 问题 |
|---|---|---|
| 主色 | 单一 `#F97316` 橙 + stone 中性 | 无辅助色；`bg-green-50`/`bg-blue-50`/`bg-purple-100` 散落硬编码（Home.jsx:86-92、PostCard.jsx:15-20、Avatar.jsx:1-7） |
| 字体 | Inter 单族 400–700，`display` 别名也指向 Inter | 无展示字层级；统计数字仅 `text-lg`/`text-2xl`（18–24px），远达不到"数据感" |
| 背景 | `#FAFAF9` 纯色（index.css:10、Layout.jsx:72） | 平；无层次 |
| 卡片 | `#FFF` + `1px solid #E7E5E4` + `0 1px 2px rgb(0 0 0/0.04)`（index.css:18-25） | 边框+微阴影=廉价感；Apple/Linear 风格应是 ring + 真阴影 |
| 圆角 | `rounded-xl`(12) / `rounded-2xl`(16) / `rounded-[20px]` / `rounded-3xl`(24) / `rounded-full` 混用 | 无规则；同层卡片圆角不一致（CatCard 16px vs PostCard 12px vs Login 24px） |
| 阴影 | `card`/`card-hover`/`elevated` 三档但都极弱 | 无浮起感；FAB `shadow-lg shadow-primary/30` 是唯一有存在感的 |
| 动效 | **已过度**：全局爪子光标（index.css:331-337）、cat-dash loader、like-fish 爆裂、paw-trail、scan-ring、tail-wag、breathe | 朋友的"别堆动画"警告**已被违反**；全局光标损害可用性与专业感 |
| 地图 | 高德 whitesmoke + 🐱 emoji marker（Map.jsx:189-198） | emoji 跨平台渲染不一致；无底部 sheet；无"附近"列表 |
| Token 纪律 | PostCard/Gallery/FeedItem 大量裸 `gray-100`/`gray-50` 而非 `border`/`text-muted` token | 系统存在但未强制 |

**关键发现：朋友没提到但同样重要的 3 个问题**
1. **圆角无规则** —— 同层元素 12/16/20/24 混用，是"工程师感"的元凶之一。
2. **边框 vs 阴影** —— 1px 实线边框 + 透明度 4% 阴影 = 便宜；现代做法是 `ring-1 ring-stone-900/5` + 真阴影。
3. **动效已超载** —— 朋友把动画排第 6 是对的，但现状是需要**删减**而非新增。

---

## Part A：对朋友 Critique 的评审

### A.1 对 6 条方向的逐条态度

**方向一（打破纯白底色）—— 部分同意**
- 浅米→浅橙渐变背景 `#FFF9F5 → #FFF2EA`：✅ 强烈同意，低成本高回报。
- 微阴影：✅ 同意，但要落到 elevation token，不要散写。
- 毛玻璃：❌ **朋友自己方向一写了毛玻璃，警告里又说"不要毛玻璃"——自相矛盾**。我站警告：`backdrop-blur` 只保留在 sticky header（Layout.jsx:74）和 modal overlay（index.css:164）两处，不扩散。

**方向二（拟物化猫主题）—— 有条件同意**
- 空状态失落小猫插画：✅ 同意，且应做成 SVG 组件复用。
- 勋章换鱼干/毛线球/猫爪：✅ 同意，但**只换图标语义，不换容器形状**。
- 数据卡片加大图标：✅ 同意，当前 BadgeCard 图标仅 32–40px，太小。
- 特殊按钮做猫爪形：❌ **反对**。爪形按钮破坏点击热区与可预期性，Apple HIG 44pt 规则不允许。猫元素只进 empty/loading/badge/guide，朋友自己的警告也是这条。

**方向三（3 色系统）—— 部分同意**
- 引入薄荷绿 `#5EC8A7`：✅ 同意，作为 secondary/success/map 辅助色非常合适。
- 奶油黄 `#FFB84D`：⚠️ **保留意见**。它和主橙 `#F97316` 色相过近（都 ~30°），并排会显脏。若要第三色，建议改为更冷的反差色或干脆只做"橙 + 薄荷"双色 + 中性灰阶。
- 柔粉色：❌ 同意朋友"别太多颜色"——删。粉和橙暖色撞。
- 径向渐变按钮：✅ 轻量同意，但只在主 CTA（拍照识猫）一处用，不全局铺。

**方向四（排版层级）—— 强烈同意，应为第 1 优先级**
- 数字 36px / 800：✅ 当前最大才 `text-3xl`(30) 且未用 800。
- 说明 12px / `#888`：✅ 当前 caption 用 `text-text-secondary`(#57534E) 偏深，`#888` 更克制。我建议用 `#78716C`(text-muted) 而非纯 `#888`，与 stone 色阶对齐。
- 引导语手写体：⚠️ 谨慎。加第二套字体是维护成本，且中文手写体在移动端渲染不稳。建议**只在 Login 问候语一处**用，其余靠 Inter 的粗细/字号对比造层级。

**方向五（微交互动效）—— 同意排末位，且应先删再加**
- 点击弹跳、淡入上滑：✅ 已有 `animate-fade-up`/`active:scale-95`，够用。
- 按钮光影扫过：⚠️ 可加但只限主 CTA。
- **先删**：全局爪子光标（index.css:331-337）必须移除——它让每个元素都"抖"，专业感归零。

**方向六（地图破局）—— 同意但优先级可降**
- 半圆弧底部卡片 + 附近猫咪清单：✅ 这是大众点评/高德的标准模式，正确。
- 半透明爪印图层：❌ 装饰性，低优先级，先不做。

### A.2 优先级重排

朋友排序：排版(1) > 空间(2) > 颜色(3) > 地图(4) > 猫主题(5) > 动画(6)

**我的重排：排版(1) > 空间(2) > 颜色(3) > 猫主题(4) > 地图(5) > 动画(6)**

理由：
- 前 3 名完全一致——排版、空间、颜色是骨架，必须先定。
- **猫主题(4) 应高于地图(5)**：地图已用高德、能跑；而勋章/空状态 IP 是低成本高情绪回报，且朋友自己说猫元素只进特定场景——改动面小、感知强。地图底部 sheet 是重构，工期重。
- 动画最后，且第一动作是**删减**而非新增。

### A.3 朋友分析里缺的东西

1. **圆角一致性** —— 完全没提，但这是"工程师感"的核心来源之一。
2. **边框→ring+阴影** —— 没提；1px 边框是廉价感的根源。
3. **Token 纪律** —— 没提；系统已建但 PostCard/Gallery 大量裸 `gray-*`，形同虚设。
4. **触控热区** —— 多处图标按钮 `w-3.5 h-3.5`（PostCard.jsx:91,96），低于 Apple HIG 44pt。
5. **Loading 一致性** —— skeleton 存在但 Profile/Feed/Map 各用各的占位。
6. **emoji marker** —— 🐱/🐟/🐠 跨平台渲染不一致，应换 SVG。
7. **暗色模式** —— 夜间问候已翻黑（Home.jsx:24），但无系统暗色模式；可作为后续差异化点（本方案不纳入）。

---

## Part B：Design System 提案（具体数值）

### B.1 色板

```js
// tailwind.config.js → theme.extend.colors
colors: {
  // —— 品牌 ——
  primary:        '#F97316',   // 主橙（保留）
  'primary-hover':'#EA580C',
  'primary-light':'#FFF7ED',
  'primary-50':   '#FFF9F5',   // 新：最浅氛围底

  // —— 辅助：薄荷（新增）——
  mint:           '#5EC8A7',   // secondary / success-map
  'mint-hover':   '#3FAA86',
  'mint-light':   '#E8F7F1',

  // —— 语义 ——
  success: '#22C55E',
  warning: '#F59E0B',
  danger:  '#EF4444',
  info:    '#3B82F6',

  // —— 表面（tonal，Material 3 思路）——
  'surface-0': '#FFF9F5',   // 页面底（渐变起点）
  'surface-1': '#FFFFFF',   // 卡片
  'surface-2': '#FAFAF9',   // 嵌套面板
  'surface-3': '#F5F5F4',   // 按下态/选中态底

  // —— 文本（stone 色阶）——
  text:             '#1C1917',
  'text-secondary': '#57534E',
  'text-muted':     '#78716C',
  'text-disabled':  '#A8A29E',

  // —— 边线/环 ——
  border:        '#E7E5E4',
  'border-light':'#F5F5F4',
  ring:          'rgb(28 25 23 / 0.05)',  // 卡片环

  // —— 活动（保留现有 4 色）——
  // eating amber / sleeping indigo / fighting red / playing emerald
  // 见 index.css .activity-badge-*
}
```

**删去**：`cat-orange`/`cat-warm`（与 primary/primary-light 重复的别名，迁移后移除）；散落的 `bg-green-50`/`bg-blue-50`/`bg-purple-100` 全部替换为 token。

### B.2 字号阶梯

```js
// tailwind.config.js → theme.extend.fontSize
fontSize: {
  'display-xl': ['36px', { lineHeight: '1.1', fontWeight: '800' }],  // 英雄数字
  'display-lg': ['28px', { lineHeight: '1.15', fontWeight: '800' }],
  'h1':         ['22px', { lineHeight: '1.25', fontWeight: '700' }],
  'h2':         ['18px', { lineHeight: '1.3',  fontWeight: '700' }],
  'h3':         ['16px', { lineHeight: '1.4',  fontWeight: '600' }],
  'body':       ['15px', { lineHeight: '1.6',  fontWeight: '400' }],
  'body-sm':    ['14px', { lineHeight: '1.5',  fontWeight: '400' }],
  'caption':    ['12px', { lineHeight: '1.4',  fontWeight: '500' }],
  'overline':   ['11px', { lineHeight: '1.2',  fontWeight: '600' }], // uppercase 标签
}
```
- 数字用 `text-display-xl`（36/800），说明用 `text-caption text-text-muted`。
- 引导语（仅 Login）可加 `font-display` 别名指向 `'Ma Shan Zheng', Inter`（中文手写，仅一处加载）。

### B.3 间距

4px 基准栅格：`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48`。Tailwind 默认已覆盖，**约束**：禁止 `p-3.5`/`gap-2.5` 等半档（现有代码里 `gap-2.5`/`p-2.5` 需清理）。

### B.4 阴影 / Elevation

```js
// tailwind.config.js → theme.extend.boxShadow
boxShadow: {
  'e0': 'none',
  'e1': '0 1px 2px rgb(17 12 9 / 0.04)',                                   // 静止卡片
  'e2': '0 2px 8px -2px rgb(17 12 9 / 0.08), 0 1px 2px rgb(17 12 9 / 0.04)', // hover
  'e3': '0 8px 24px -8px rgb(17 12 9 / 0.12), 0 2px 6px -2px rgb(17 12 9 / 0.06)', // 浮起/modal
  'e4': '0 16px 40px -12px rgb(17 12 9 / 0.16)',                           // FAB
  'primary-glow': '0 8px 24px -4px rgb(249 115 22 / 0.35)',               // 主 CTA
}
```
卡片不再用 `border`，改用 `ring-1 ring-stone-900/5 shadow-e1`。

### B.5 圆角

```js
// tailwind.config.js → theme.extend.borderRadius
borderRadius: {
  'tile':      '12px',   // 缩略图、chip
  'card':      '16px',   // 默认卡片（统一）
  'container': '20px',   // hero/banner
  'pill':      '9999px', // 按钮、标签
  // 保留 Tailwind 默认其余值
}
```
**规则**：卡片一律 `rounded-card`(16px)；hero/banner `rounded-container`(20px)；缩略图 `rounded-tile`(12px)；按钮/标签 `rounded-pill`。**删去** `rounded-xl`/`rounded-2xl`/`rounded-3xl` 在卡片上的混用。

### B.6 卡片重设计

```css
/* src/index.css @layer components */
.card {
  background: #FFFFFF;
  border-radius: 16px;          /* was 12px */
  padding: 16px;
  box-shadow: var(--shadow-e1);
  ring: 1px solid rgb(28 25 23 / 0.05);  /* 用 ring 代替 border */
  transition: box-shadow .2s ease, transform .2s ease;
}
.card-hoverable:hover {
  box-shadow: var(--shadow-e2);
  transform: translateY(-2px);
}
```
Tailwind 等价写法（推荐组件内用）：
```
className="bg-surface-1 rounded-card shadow-e1 ring-1 ring-stone-900/5 p-4"
```

### B.7 背景氛围

```js
// tailwind.config.js → theme.extend.backgroundImage
backgroundImage: {
  'page-warm': 'linear-gradient(180deg, #FFF9F5 0%, #FFF2EA 100%)',
  'hero-morning': 'linear-gradient(135deg, #FFF7ED 0%, #FED7AA 100%)',
}
```
`Layout.jsx` 根容器 `bg-warm-50` → `bg-page-warm`。

---

## Part C：分阶段实施计划（按优先级）

### Phase 1 · 排版层级（最高优先级）

**目标**：数字放大到 36px/800，caption 收到 12px/muted，建立字号 token。

**改动文件**：
- `tailwind.config.js` —— 新增 `fontSize` 全套 token（见 B.2）。
- `src/index.css` —— `body` font-size 改 15px。
- `src/pages/Home.jsx:83-92` —— 三个统计数字 `text-lg font-bold` → `text-display-xl`，标签 `text-xs text-text-secondary` → `text-caption text-text-muted`。
- `src/pages/Profile.jsx:149,156,163` —— 统计数字 `text-base` → `text-display-lg`。
- `src/pages/WeeklyReport.jsx:38,43,48,51` —— `text-2xl` → `text-display-xl`，标签 `text-caption text-text-muted`。
- `src/pages/CatDetail.jsx:118` —— 猫名 `text-3xl` → `text-display-lg`。
- `src/components/BadgeCard.jsx:13` —— 勋章首字母 `text-sm` → `text-h3`，图标容器 `w-8 h-8` → `w-12 h-12`。

**视觉影响**：数字瞬间有"数据页"的分量感，层级一眼可读。
**工期**：~2h

---

### Phase 2 · 空间感 / Elevation（背景 + 阴影 + ring）

**目标**：页面底变暖渐变，卡片去边框换 ring+真阴影，圆角统一。

**改动文件**：
- `tailwind.config.js` —— 新增 `boxShadow`(B.4)、`borderRadius`(B.5)、`backgroundImage`(B.7)、`colors.surface-*`。
- `src/index.css` ——
  - `body` `background-color:#FAFAF9` → 删除（交给 Layout 渐变）。
  - `.card` 改为 B.6 写法（去 `border`，加 `ring` + `shadow-e1`，圆角 16px）。
  - `.clay-card` 圆角 20px → 保留为 `rounded-container`。
  - `.tab-bar` 去 `border-top`，改 `shadow-e2` + `ring-1 ring-stone-900/5`。
- `src/components/Layout.jsx:72` —— `bg-warm-50` → `bg-page-warm`；header `bg-warm-50/80` → `bg-surface-0/80`。
- `src/components/CatCard.jsx:6` —— `card ... rounded-2xl` → `rounded-card shadow-e1 ring-1 ring-stone-900/5`，hover `shadow-e2 -translate-y-0.5`。
- `src/components/PostCard.jsx:73` —— `border border-gray-100` → `ring-1 ring-stone-900/5 shadow-e1`，`rounded-xl` → `rounded-card`。
- `src/components/FeedItem.jsx:30` —— 同 PostCard。
- `src/pages/Gallery.jsx:53` —— 同 PostCard。
- `src/components/PageHeader.jsx:13` —— `border-b border-border` → 保留（header 分隔线合理）。
- 全局把卡片上的 `rounded-xl`/`rounded-2xl`/`rounded-3xl` 收敛到 `rounded-card`/`rounded-container`。

**视觉影响**：页面立刻有暖意和层次，卡片"浮"起来而非"贴"着，廉价边框消失。
**工期**：~3h

---

### Phase 3 · 颜色系统 + Token 纪律

**目标**：引入薄荷 secondary，清理所有裸 `gray-*`/`green-50`/`blue-50`/`purple-*`，统一到 token。

**改动文件**：
- `tailwind.config.js` —— 新增 `mint`/`mint-light`/`semantic`/`surface`（见 B.1）；删 `cat-orange`/`cat-warm` 别名。
- `src/pages/Home.jsx:86,90` —— `bg-green-50 text-green-600` → `bg-mint-light text-mint`；`bg-blue-50 text-blue-600` → `bg-info/10 text-info`。
- `src/components/PostCard.jsx:15-20` —— TOPIC_COLORS 改用 token：`find→primary-light/primary`、`daily→mint-light/mint`、`health→info/10 + info`、`suggest→warning/10 + warning`。
- `src/components/Avatar.jsx:1-7` —— 调色盘改用 `primary-light`/`mint-light`/`info/10`/`warning/10` + 对应深色。
- `src/components/FeedItem.jsx:31` —— `bg-cat-warm` → `bg-primary-light`。
- `src/pages/Community.jsx:52` —— 顶部 `bg-primary` banner 保留主橙，但圆角统一 `rounded-b-container`。
- `src/components/TabBar.jsx:23` —— 激活态 `bg-orange-50` → `bg-primary-light`。
- 全局 grep `gray-50/gray-100/gray-200/gray-300/gray-400` → 替换为 `surface-3`/`border`/`text-muted`/`text-disabled` token。

**视觉影响**：颜色从"一橙到底"变成"橙主 + 薄荷辅 + 语义色"的克制三角色系，且未来改色改一处即可。
**工期**：~2.5h

---

### Phase 4 · 猫主题 IP（仅 empty / badge / loading / guide）

**目标**：空状态失落猫 SVG、勋章换鱼干/毛线球/猫爪语义图标、勋章图标放大。**不动主界面按钮形状**。

**改动文件**：
- 新增 `src/components/illustrations/SadCat.jsx`、`EmptyCat.jsx`（纯 SVG，stroke 风格，`currentColor` 可着色）。
- `src/components/EmptyState.jsx` —— 默认 icon 从 `PawPrint` 换 `EmptyCat`；容器 `p-8` → `p-10`，图标 `w-10 h-10` → `w-16 h-16`，加 `text-text-muted/40`。
- 新增 `src/components/BadgeIcon.jsx` —— 按 `badge.series` 映射：sighting→PawPrint、community→MessageSquare、collect→鱼干 SVG、special→Sparkles；尺寸 `w-8 h-8`。
- `src/components/BadgeCard.jsx` —— 用 `BadgeIcon` 替换首字母；容器 `w-16` → `w-20`，图标 `w-8 h-8` → `w-10 h-10`。
- `src/pages/BadgeGallery.jsx:84-88` —— 同上换 `BadgeIcon`，`w-12 h-12` 保留。
- `src/components/CatSpinner.jsx` —— 保留（已是好的 loading IP）。
- `src/pages/Scan.jsx:146` —— idle 引导区图标 `Camera` 旁加一只 `EmptyCat` 小尺寸作情绪点缀。

**视觉影响**：空状态从"一个灰图标"变成"失落小猫"，勋章从"首字母"变成"鱼干/毛线球"，情绪感拉满且不侵入主功能。
**工期**：~3h（主要在画 SVG）

---

### Phase 5 · 地图底部 Sheet + 附近列表

**目标**：地图下缘加半圆弧浮卡，列"附近猫咪"；emoji marker 换 SVG 猫头。

**改动文件**：
- 新增 `src/components/CatMarker.jsx` —— SVG 猫头圆形 marker（32×32，`#F97316` 描边，白底，可传 avatar），替代 emoji。
- `src/pages/Map.jsx:189-198` —— `markerContent.innerHTML = 🐱` → 用 `CatMarker` 渲染（`ReactDOMServer.renderToString` 或拼 SVG 字符串）。
- `src/pages/Map.jsx` 新增底部 sheet：
  ```
  <div className="absolute bottom-0 inset-x-0 z-40 bg-surface-1/95 backdrop-blur rounded-t-container shadow-e3 p-4 pb-20">
    <div className="w-10 h-1 bg-border rounded-full mx-auto mb-3" />  {/* 拖拽指示 */}
    <h3 className="text-h3 mb-2">附近猫咪</h3>
    <div className="flex gap-3 overflow-x-auto scrollbar-none">
      {nearbyCats.map(...)}  {/* 横滑卡片：头像 + 名 + 距离 */}
    </div>
  </div>
  ```
- `src/api.js` —— 若后端无"附近"接口，前端用现有 `getHeatmapData` 结果按距离排序取前 8。
- 时间筛选 pill（Map.jsx:244）`bg-white/90` → `bg-surface-1/90`，`shadow-md` → `shadow-e2`。

**视觉影响**：地图从"满屏标记"变成"标记 + 底部发现栏"，对齐大众点评/高德的肌肉记忆。
**工期**：~3h

---

### Phase 6 · 动效删减 + 微交互点睛

**目标**：删全局爪子光标，保留组件级微交互，主 CTA 加光影扫过。

**改动文件**：
- `src/index.css:331-337` —— **删除**全局 `body { cursor: paw }` 及 `@media (hover:none)` 兜底。
- `src/index.css:339-351` —— `paw-ripple` 保留（点击涟漪是克制的），但降频。
- `src/components/TabBar.jsx:47` —— `animate-scan-ring` 保留（中心按钮强调合理）。
- `src/components/PostCard.jsx:155-160` —— like-fish 爆裂保留（点赞是情绪时刻）。
- `src/index.css` 新增主 CTA 光扫：
  ```css
  .btn-sweep { position: relative; overflow: hidden; }
  .btn-sweep::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(110deg, transparent 30%, rgb(255 255 255 / 0.25) 50%, transparent 70%);
    transform: translateX(-100%); transition: transform .6s ease;
  }
  .btn-sweep:active::after { transform: translateX(100%); }
  ```
- `src/pages/Home.jsx:102`、`src/components/TabBar.jsx:48` 主 CTA 加 `btn-sweep`。
- 清理半档间距 `gap-2.5`/`p-3.5`（PostCard、Gallery）→ `gap-2` 或 `gap-3`。

**视觉影响**：专业感回升（无全局抖动），情绪时刻（点赞、主 CTA）有节制的光。
**工期**：~1.5h

---

**总工期：约 15h**

| Phase | 工期 | 优先级 |
|---|---|---|
| 1 排版 | 2h | P0 |
| 2 空间 | 3h | P0 |
| 3 颜色 | 2.5h | P0 |
| 4 猫 IP | 3h | P1 |
| 5 地图 | 3h | P1 |
| 6 动效 | 1.5h | P2 |

---

## Part D：参考产品分析

### D.1 Pokémon GO
- **可学**：地图优先；生物 marker 用**圆形头像**而非 emoji（我们换 `CatMarker` SVG）；"附近"径向列表；捕获按钮为大 FAB（我们 TabBar 中心识猫按钮已是此模式，保留）。
- **不学**：AR 相机、3D 模型——超出范围。

### D.2 Duolingo
- **可学**：IP 吉祥物**只出现在 empty/loading/achievement/引导**，主练习界面干净——这正是朋友对猫元素的约束，我们 Phase 4 严格执行。圆角厚实（我们统一 16px）。绿色主色（我们用薄荷作 secondary 呼应）。
- **不学**：过度弹跳动效——朋友警告"别堆动画"。

### D.3 Apple HIG
- **可学**：44pt 触控热区（清理 `w-3.5 h-3.5` 小按钮）；sheet 用系统 blur（我们底部地图 sheet 用 `backdrop-blur`）；**ring + 阴影而非边框**（Phase 2 核心）；字号阶梯（Phase 1 token 化）。
- **不学**：SF Pro 字体——中文场景 Inter 更稳。

### D.4 Material 3
- **可学**：**tonal surface** 角色（我们引入 `surface-0/1/2/3`）；color roles（primary/secondary/tertiary → 我们 primary/mint/semantic）；state layer（按下 `surface-3`）。
- **不学**：Material 的直角硬边——我们走圆角柔和路线，更契猫主题。

### D.5 Ant Design 5
- **可学**：**token 化纪律**（我们 Phase 3 清理裸 `gray-*`）；中性色阶（stone 50→900 已对齐）；一致圆角。
- **不学**：Ant 的企业信息密度——社区 App 要更松弛。

### D.6 Keep
- **可学**：数据页**英雄数字**（36px/800，Phase 1）；stat 网格；进度环（BadgeGallery 进度条可升级为环）。
- **不学**：Keep 的深色运动风——校园猫要暖。

### D.7 小红书
- **可学**：**图片优先瀑布流**（Gallery.jsx 已是 2 列网格，可考虑不等高瀑布）；卡片极简、文字压在图上；标签 chip；作者行。PostCard 可往这个方向收。
- **不学**：纯消费内容流——我们有发帖/识猫功能态。

### D.8 大众点评
- **可学**：**地图 + 底部 sheet "附近"列表**（Phase 5 核心）；卡片 peek/展开；"附近/排行/筛选"tab。
- **不学**：商业 POI 密度——我们只 20 只猫。

### D.9 高德地图
- **可学**：干净 marker 样式；底部 panel；**我们已在用高德**，应顺其原生能力（定位、scale 控件）。
- **不学**：导航功能——不需要。

### D.10 支付宝
- **可学**：数据卡片网格（Home/Profile 统计区）；九宫格快捷入口（Home quick actions 已是此模式）。
- **不学**：信息过载——我们克制。

---

## D.11 更契合"校园猫"语境的中文 App 对照

| 场景 | 当前参考 | 更优中文对照 | 借什么 |
|---|---|---|---|
| 社区信息流 | 小红书 | **小红书** | 图片优先卡片、标签 chip、作者行 |
| 地图 + 发现 | 大众点评 | **大众点评** | 底部附近 sheet、卡片 peek |
| 地图 marker/底板 | 高德 | **高德**（已用） | 原生 marker、scale、定位 |
| 数据/周报 | Keep | **Keep** | 英雄数字、stat 网格 |
| 个人/勋章 | 支付宝 | **多邻国**（IP 用法） | 勋章 IP、成就页 |
| Tab + FAB | 微信小程序 | **微信小程序** | 底 tab + 中心 FAB（已是） |

**结论**：朋友的"POKEMON GO + 小红书 + 大众点评 结合体"方向正确。我会把**多邻国的 IP 纪律**（只进特定场景）和**Apple HIG 的 ring-not-border**作为两条最高约束写进设计系统文档，它们是让"工程师感"变"设计师感"的最低成本杠杆。

---

## 附：落地前 3 步 Quick Win（若只能做 3 件事）

1. **删全局爪子光标**（index.css:331-337）—— 10 分钟，专业感 +30%。
2. **页面底换暖渐变 + 卡片去边框换 ring+shadow-e1**（Phase 2 精简版）—— 1h，层次感 +50%。
3. **统计数字放大到 36px/800**（Phase 1 精简版）—— 30min，数据感 +40%。

这三步合计 ~1.5h，即可让 App 脱离"工程师做的"观感。
