# Agent 元素优化实现任务

## 背景

当前项目已经具备校园猫识别、地图路线、社区、徽章、周报和猫协管理能力，但整体展示仍偏向“AI 识猫社区”，Agent 元素不够明显。

本任务目标不是新增一个孤立聊天机器人，而是把现有业务升级为：

> 结合学生课表、校园活动、猫咪出没数据和猫协协作的多 Agent 校园实践系统。

实现完成后，答辩主线应能表达：

```text
学生课表 / 校园活动 -> Agent 生成今日实践计划 -> 学生执行识猫、路线、记录任务 -> 猫协审核 Agent 辅助复核 -> 学习复盘 Agent 生成课程实践总结
```

## 实现原则

- Agent 必须体现“目标、工具、记忆、规划、执行轨迹、建议、人类确认”。
- 先使用规则、现有接口和 mock 数据实现 Agent 表达，不强依赖真实大模型。
- 不接真实教务系统，第一版使用手动录入或 demo 课表。
- 不让 Agent 自动创建、合并、删除猫档案；涉及猫协审核必须由管理员最终确认。
- 优先复用现有识猫、路线、地图、周报、徽章、管理端能力。

## 建议新增页面

### 1. Agent 工作台

建议路径：

```text
/agents
```

页面名称：

```text
Agent 工作台 / 今日校园实践计划
```

页面内容建议包含 4 个 Agent 卡片：

1. 课表规划 Agent
2. 课间寻猫路线 Agent
3. 猫协审核 Agent
4. 学习复盘 Agent

每个卡片至少展示：

```text
Agent 目标
输入数据
可调用工具
执行步骤
最终建议
是否需要人工确认
```

建议在首页或个人页增加入口，但第一版也可以只通过路由访问。

## Agent 1：课表规划 Agent

### 目标

根据学生今日课程、空闲时间、上课地点和活动安排，生成可执行的校园实践计划。

### 输入

第一版可使用 mock 数据或页面表单：

```json
{
  "courses": [
    {
      "title": "人工智能导论",
      "start": "10:00",
      "end": "11:40",
      "location": "逸夫楼"
    },
    {
      "title": "软件工程",
      "start": "14:00",
      "end": "15:40",
      "location": "计算中心"
    }
  ],
  "activities": [
    {
      "title": "猫协巡护活动",
      "start": "18:30",
      "end": "20:00",
      "location": "南区草坪"
    }
  ]
}
```

### 输出示例

```text
11:40-12:25 有 45 分钟空闲。
建议从逸夫楼出发，前往图书馆东侧记录“小白”。
预计步行 8 分钟，停留 15 分钟，12:25 前可返回食堂。
```

### 执行轨迹示例

```text
1. 读取今日课表
2. 识别课程间空闲窗口
3. 查询附近猫咪出没点
4. 估算路线和停留时间
5. 生成课间实践建议
```

## Agent 2：课间寻猫路线 Agent

### 目标

把现有路线推荐升级为具备解释能力的规划 Agent。

### 可复用能力

- `GET /api/routes/recommendations`
- `GET /api/routes/story`
- 地图页
- 拍照识猫页

### 输出示例

```text
路线 Agent 建议：
今天下午适合从光华楼出发，因为近 14 天这里有 6 次偶遇。
第一站推荐“小白”，最近常在 15:00-17:00 出现。
第二站推荐“橘子”，与第一站距离较近，可以减少绕路。
```

### 建议补充字段

如果后端愿意扩展，可以在 route story 返回中增加：

```json
{
  "agent_trace": [
    "读取近 14 天偶遇记录",
    "按地点聚合热度",
    "结合当前时间段过滤",
    "选择距离和热度综合较优的路线"
  ],
  "agent_reasoning": "优先选择近期偶遇次数高、时间段匹配且路线连续的地点。",
  "estimated_duration_minutes": 45
}
```

## Agent 3：猫协审核 Agent

### 目标

辅助管理员处理未知猫线索，体现 human-in-the-loop。

### 输入

- 新猫线索
- 图片路径
- 地点
- 用户备注
- 现有猫档案
- 最近偶遇记录

### 输出示例

```json
{
  "agent": "cat_review_agent",
  "recommendation": "needs_human_review",
  "confidence": 0.68,
  "suggested_action": "可能是已有猫，请管理员对比候选猫后决定是否合并。",
  "reasons": [
    "提交地点与“小白”最近出没地点接近",
    "用户描述包含白色、亲人等特征",
    "照片角度不足，无法直接确认"
  ],
  "candidate_cats": [
    {
      "cat_id": 1,
      "cat_name": "小白",
      "reason": "地点和描述相似"
    }
  ],
  "trace": [
    "读取未知猫线索",
    "检索现有猫档案",
    "对比地点和描述",
    "生成审核建议"
  ],
  "requires_human_confirmation": true
}
```

### 约束

- Agent 只能给建议，不能自动创建猫档案。
- 管理员仍通过现有“通过 / 合并 / 拒绝”流程完成最终操作。
- 如果建议置信度低，应明确提示“需要补充照片或描述”。

## Agent 4：学习复盘 Agent

### 目标

结合学生本周贡献记录，生成课程实践总结。

### 可复用能力

- 用户周报
- 徽章
- 贡献分
- 路线打卡
- 识猫记录
- 社区发帖

### 输出示例

```text
本周实践总结

你完成了 3 次校园猫观察
贡献了 7 张有效照片
参与了 1 次猫协巡护活动
辅助补全了 2 条猫咪档案

建议写入《AI 应用实践》课程周报：
本周围绕校园猫识别场景，完成了图像采集、模型结果观察、数据记录和人机协同审核实践。
```

## 建议新增接口

第一版可以使用前端 mock。如果需要后端接口，建议新增：

```text
GET /api/agents/daily-plan
POST /api/agents/daily-plan
GET /api/agents/discovery-review/{discovery_id}
GET /api/agents/learning-report
```

返回结构统一包含：

```json
{
  "agent_name": "string",
  "goal": "string",
  "inputs": [],
  "tools": [],
  "trace": [],
  "recommendation": "string",
  "requires_human_confirmation": true
}
```

## 前端建议改动范围

优先新增文件：

```text
cat-frontend/src/pages/Agents.tsx
cat-frontend/src/components/AgentCard.tsx
cat-frontend/src/constants/agentDemoData.ts
```

需要接入路由：

```text
cat-frontend/src/App.tsx
cat-frontend/src/constants/routes.ts
```

可选入口：

```text
cat-frontend/src/pages/Home.tsx
cat-frontend/src/pages/Profile.tsx
```

## 后端建议改动范围

如实现真实接口，优先新增：

```text
cat-backend/app/api/agents.py
```

并在这里注册：

```text
cat-backend/app/main.py
```

第一版不建议改数据库 schema。课表和活动可先用 mock 数据或请求体传入。

## 验收标准

- 能从页面清楚看到至少 3 个 Agent。
- 每个 Agent 都展示目标、工具、执行轨迹和最终建议。
- 至少一个 Agent 与学生课表或活动安排有关。
- 至少一个 Agent 复用现有猫咪路线或识别数据。
- 猫协审核 Agent 明确体现人工最终确认。
- 不破坏现有识猫、地图、社区、管理端主流程。

## 答辩表达建议

可以这样介绍：

```text
我们的项目不是单纯的校园猫识别系统，而是一个面向学生校园生活的多 Agent 实践平台。
课表规划 Agent 负责识别学生空闲窗口；
路线 Agent 负责结合猫咪出没数据生成可执行路线；
猫协审核 Agent 负责辅助未知猫线索复核；
学习复盘 Agent 负责把学生的真实参与记录转化为课程实践报告。
```

核心 Agent 元素：

```text
目标驱动
工具调用
数据记忆
多步规划
执行轨迹
人类确认
课程复盘
```
