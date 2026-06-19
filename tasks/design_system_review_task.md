You are a senior UI/UX designer and frontend architect reviewing a student cat community web app project.

## Context

The project is a React + Tailwind web app at D:/Desktop/cat/cat-frontend for recording campus cats. It has 20 cats with 200 photos, a map page, community posts, badge system, admin panel. The backend is FastAPI + SQLite running on Docker.

The app currently looks "engineer-built" — functional but visually flat. White backgrounds, white cards, single orange color, no design system.

## Your Task

A friend of the student has written a detailed design critique (attached below). Your job:

1. Read the current codebase thoroughly to understand the current visual state
2. Analyze the friend's 6 design directions, their priority ranking, their references to Pokémon GO / Duolingo / Apple HIG / Material 3 / Ant Design 5
3. Write a comprehensive upgrade plan with:

### Part A: Critique the Critique
- Which of the 6 directions do you agree/disagree with? Why?
- Is the friend's priority ordering right? Would you reorder it?
- What's missing from the friend's analysis?

### Part B: Your Design System Proposal
Based on reading the actual code, design a specific, implementable design system upgrade. For each element:

- Color palette (specific hex values, not just descriptions)
- Typography scale (specific font sizes, weights, line heights)
- Spacing system
- Shadow/elevation system
- Card/tile redesign
- Border radius consistency

Give concrete CSS values. Reference existing Tailwind classes where possible.

### Part C: Concrete Implementation Plan (in priority order)
For each phase:
- EXACT files to modify
- EXACT CSS/Tailwind changes
- EXACT component structure changes
- Expected visual impact (1-2 sentences)
- Effort estimate (hours)

### Part D: Reference Analysis
For each referenced product/design system the friend mentioned (Pokémon GO, Duolingo, Apple HIG, Material 3, Ant Design 5, Keep, Xiaohongshu), analyze:
- What specific design elements could this project learn from them?
- Can you name Chinese apps that do the same thing better for a campus cat context? (e.g. 小红书 for social feed, 大众点评 for map + discovery, 高德地图 for vehicle map)

Write to D:/Desktop/cat/tasks/design_system_plan.md

## The Friend's Critique

Below is the full critique:

[方向一：打破纯白底色，增加视觉层次与深度]
添加浅色氛围背景，微渐变（浅米色到浅橙色 #FFF9F5 到 #FFF2EA），引入微阴影和毛玻璃。

[方向二：拟物化与情绪化加强猫主题]
空状态画失落小猫插画，勋章图标换成鱼干/毛线球/猫爪印，数据卡片加大图标，特殊按钮做成猫爪形。

[方向三：品牌主色-辅助色进阶配色系统]
引入薄荷绿 #5EC8A7、奶油黄 #FFB84D、柔粉色。纯橙按钮改为径向渐变。

[方向四：信息排版层级]
数字放大到 36px font-weight 800，说明文字 12px color #888。引导语用手写体。

[方向五：微交互与动效]
点击弹跳、页面过渡淡入上滑、按钮光影扫过。

[方向六：地图界面破局改造]
半透明猫咪足迹图层，半圆弧形卡片悬浮底部，附近猫咪清单。

[朋友优先级排序]
1. 排版层级
2. 空间感（阴影+背景）
3. 颜色系统（3色）
4. 地图改造
5. 猫咪主题
6. 动画

[朋友认为项目最需要的是]
学习 Pokémon GO + 小红书 + 大众点评 的结合体，建立完整 Design System。

[朋友警告]
不要毛玻璃、不要堆动画、不要搞太多颜色。
猫元素只能用于空状态/加载/成就/引导，主界面保持专业。
60%功能 → 30%UI系统 → 10%动画。

[朋友推荐参考]
- Apple HIG / Material 3 / Ant Design 5 (设计系统)
- Pokémon GO (地图+探索)
- 大众点评 (地图+发现)
- 小红书 (信息流卡片)
- Keep (数据页面)
- Duolingo (品牌IP用法)
- 支付宝 (数据卡片)
