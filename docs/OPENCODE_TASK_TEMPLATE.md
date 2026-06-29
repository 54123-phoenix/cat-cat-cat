# Opencode 实现任务模板

本模板用于后续 P5+ 实现任务的委派与收口。复制本文件并填充各节。

---

## 目标

一句话说明本任务要交付什么。

## 范围

- 本任务包含什么。
- 本任务不包含什么（明确排除项）。

## 允许修改的文件

列出本任务可改动的文件 / 目录：

- `cat-backend/app/...`
- `cat-frontend/src/...`

## 禁止修改的文件

- `cat-miniprogram/`（除非任务明确涉及小程序）
- `README.md`（由发布清单流程统一更新）
- 依赖文件（`package.json`、lock 文件、`requirements.txt`）
- 不在范围内的 harness 契约

## 验收标准

- [ ] 功能可从指定入口使用。
- [ ] 后端有对应测试且通过。
- [ ] 前端 `npm run build` 通过。
- [ ] full harness `score: 100` 且 `pass`。
- [ ] roadmap / TODO / README 状态一致。

## 必跑测试

```powershell
cd D:\Desktop\cat\cat-backend
.\.venv\Scripts\python.exe -m pytest tests -q

cd D:\Desktop\cat\cat-frontend
npm test -- --run
npm run build

cd D:\Desktop\cat
powershell -NoProfile -ExecutionPolicy Bypass -File harness\run.ps1 -Mode full -ContinueOnFailure
```

## 约束

- 不新增大型依赖。
- 不运行 `git reset --hard`、`git checkout --`、删除未提交文件等破坏性命令。
- 不提交 secrets / tokens / 本地路径。
- 不为耗满时间而扩大范围。

## 交接摘要格式

完成后输出：

```text
<任务ID> 完成。

修改文件：
- ...

新增内容：
- ...

测试结果：
- pytest: N passed
- npm test: N passed
- npm run build: 成功/失败
- full harness: score X (pass/fail)

遗留风险：
- ...
```
