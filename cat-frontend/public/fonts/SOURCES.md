# Campus Sans SC 字体资产

本站自托管的简体中文字体，来自本地已有 Noto Sans CJK SC 2.004 开源字体。仅做字符子集、OpenType 语言规则裁剪和内部名称调整；轮廓、真实字重和垂直度量保留。未使用系统商业字体。

## 来源与许可

- 原始文件来自本地 `magic-resume/public/fonts/`，构建时通过 `--font-root` 指定；没有重新下载完整字体。
- 上游：[Noto CJK Sans](https://github.com/notofonts/noto-cjk/tree/main/Sans)。
- [OFL.txt](OFL.txt) 为官方 [Sans/LICENSE](https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/LICENSE) 原文，核对日期为 2026-11-08。
- 三份原文件内嵌版权均为 `© 2014-2021 Adobe (http://www.adobe.com/).`，内嵌许可明确为 SIL Open Font License 1.1；生成字体继续保留版权和许可字段。
- 子集内部族名统一改为 `Campus Sans SC`，不使用 `Source` 保留名称；应随字体分发版权和 OFL 原文，不单独出售字体。
- 本次采用相同版本的 OTF 400 / 500 / 700；未采用本地较旧的静态 TTF，也未把任何静态字重标作可变字体。

| 字重 | 原文件 | SHA-256 |
|---|---|---|
| 400 | `NotoSansSC-Regular.otf` | `2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b` |
| 500 | `NotoSansSC-Medium.otf` | `ca094f6b0001fb048ca39ddd797a0cdb0179e1e55c6561e111c49c3e6a61d7b7` |
| 700 | `NotoSansSC-Bold.otf` | `b5f0d1a190a7f9b43c310a8850630af12553df32c4c050543f9059732d9b4c0a` |

## 字符与加载范围

- 每个字重均包含完整 GB2312 的 7,445 个字符，并包含源文件可提供的项目文字、Latin 和常见标点。
- 核心片覆盖 911 个字符，包括 `cat-frontend/src` 文本文件中的文字、ASCII 和常用中文标点。
- 其余 6,947 个字符分成 28 个扩展片，每片最多256个字符。每个字重的核心/扩展 `unicode-range` 互不重叠，仅遇到对应字符才需要加载该片。
- 保留 OpenType 默认语言与简体中文 `ZHS` 规则，以及默认子集保留的正常排版特性。其他地区 `locl` 字形替换不在本资产范围内；这不是覆盖所有地区字形的泛中日韩字体包。
- 源字体未包含的 Emoji 或其他字符继续由系统字体回退。`manifest.json` 记录当前源码中未包含的码位。
- `font-display: swap` 保证等待字体时使用系统字体显示文字；缓存命中后可直接使用本站字体。

## 体积

- WOFF2 数量：87（每字重1核心片 + 28扩展片）。
- 三个核心片合计：464,032 B（453.2 KiB）。
- 最大扩展片：73,724 B（72.0 KiB）。
- 所有 WOFF2 完整缓存：4,909,128 B（4.68 MiB）。
- 实际页面只下载出现字符所需的字重/片段；以上不是校园网络延迟或首屏耗时测量。CSS 与清单体积另计。
- 文件名含内容 SHA-256 前12位；更新字体会改变 URL。是否长缓存由实际静态服务器配置决定。

## 重建与维护

在项目根目录运行：

```text
python scripts/build_web_fonts.py --font-root "path/to/original/Noto/fonts"
```

- 构建工具为 `fonttools==4.60.2`、`brotli==1.1.0`，安装在独立工具环境；不属于前端运行依赖。
- 脚本为纯 Python，不下载字体，不修改原文件，不删除已有资产。
- 脚本默认检查：核心总量 ≤700 KiB、单扩展片 ≤150 KiB、全部 WOFF2 ≤10 MiB，并验证每个静态字重和全部 GB2312 覆盖。
- 更新界面文案后重建，检查 `manifest.json` 的字符范围、体积与源码摘要。审核差异后再处理不被新清单引用的旧哈希文件。
- `fonts.css` 中全部来源为站内绝对 `/fonts/` 路径。CSS 中仅声明真实的400、500、700，未声明连续可变范围。
