# 项目归属与个人贡献

## 项目属性

Cat-Cat-Cat 是 5 人校园团队项目，不是个人独立作品。Git 历史保留了多位成员的提交；项目中的视觉识别、产品工程和演示交付由团队共同完成。

## `@54123-phoenix` 的角色

韩奥博（`@54123-phoenix`）担任队长，参与以下工作：

- 产品与项目管理：拆分交付阶段，协调 Web、API、小程序与部署验收；
- Web 前端：主流程页面、分享与游戏化能力、类型安全与 CI 修复；
- FastAPI 后端与数据库：路由/数据模型问题修复、数据库迁移、权限和安全加固；
- 小程序：接口对齐、上传与路由问题修复、构建与发布准备；
- 质量与交付：测试、GitHub Actions、依赖兼容、Git LFS、Docker 与发布文档。

## 明确不归属于其的主要工作

- DINOv3 / FAISS / YOLO 识别模型的训练与识别精度优化；
- 项目文档的主要撰写；
- 课程评审与答辩主讲。

## 代表性可核验提交

| 范围 | 提交 | 证明内容 |
| --- | --- | --- |
| 核心错误修复 | [`7392ac4`](https://github.com/54123-phoenix/cat-cat-cat/commit/7392ac4) | 路由顺序、端点不一致、模型关系和经纬度等问题 |
| 类型安全 | [`f05d612`](https://github.com/54123-phoenix/cat-cat-cat/commit/f05d612) | 移除 `@ts-nocheck`，修复 47 处 TypeScript 错误并收紧编译规则 |
| 安全加固 | [`e25702d`](https://github.com/54123-phoenix/cat-cat-cat/commit/e25702d) | 清理密钥、收紧公开上传、补充 SSE 安全边界 |
| 性能与架构 | [`3090b20`](https://github.com/54123-phoenix/cat-cat-cat/commit/3090b20) | 将附近猫查询下沉后端，补 PostgreSQL 部署链路 |
| 小程序可用性 | [`54f89b6`](https://github.com/54123-phoenix/cat-cat-cat/commit/54f89b6) | 修复上传、URL 和页面生命周期等问题 |
| 数据库与重要缺陷 | [`d7d5d74`](https://github.com/54123-phoenix/cat-cat-cat/commit/d7d5d74) | 修复四项重要问题并增加数据库迁移 |
| CI 可靠性 | [`4f6d3b9`](https://github.com/54123-phoenix/cat-cat-cat/commit/4f6d3b9) | 修复 TypeScript 和 pytest 模块路径问题 |
| 用户闭环 | [`efcf659`](https://github.com/54123-phoenix/cat-cat-cat/commit/efcf659) | 游戏化路径、猫身份卡/护照和分享物料 |

## 阅读这个项目时的证据顺序

1. 先从 [README](README.md) 了解产品闭环与架构。
2. 再查看上表提交的 diff，区分个人工作与团队工作。
3. 检查 `.github/workflows/`、`cat-backend/tests/` 和 `cat-frontend/src/__tests__/` 中的自动验证。
