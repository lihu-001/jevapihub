# Jev Interface Hub — 产品需求与技术设计方案

> 文档版本：v1.0  
> 日期：2026-09-27  
> 用途：可直接交给 Codex / Claude Code / Cursor / 其他编码 AI 按阶段开发。  
> 核心原则：**一个 Runtime + N 个 Interface Manifest**，不再为每一种 Jev 用途维护一份独立 Python 脚本。

---

## 0. 一句话定义

Jev Interface Hub 是一个面向 TypeSafe/Jev 的 **Interface IDE + Playground + Interface Hub**：用户可以在网页上手动或通过 AI 定义 `state + questions + 结果处理规则`，使用自己的 TypeSafe API Key 在线运行、保存、版本化、分享、Fork，并把高质量 Interface 作为可复用配置下载。

平台 **不向普通用户提供平台统一的 TypeSafe Key**。Jev 推理调用由用户自己的 TypeSafe API Key 计费。

---

# 1. 产品目标

## 1.1 当前问题

当前每增加一个 Jev 使用场景，就要单独生成并维护脚本，例如：

- 中文文章 AI 味检测
- 自媒体标题评分
- 人物对白自然度
- SEO 内容质量
- 小说节奏检测
- 客服分类
- 其他任意 `state/questions` 判断任务

这些脚本的绝大多数差异实际只是：

1. 输入材料不同；
2. `state` 结构不同；
3. `questions` 定义不同；
4. 结果汇总方式不同。

因此正确抽象应当是：

```text
一个通用 Runtime Engine
        +
N 份可配置的 Interface Manifest
```

而不是：

```text
N 个独立 Python / JS 程序
```

## 1.2 产品目标

系统必须实现：

1. 用户可输入自己的 TypeSafe API Key。
2. 用户可以手动定义 State 输入结构。
3. 用户可以手动定义 Noul / Choice / Score questions。
4. 用户可以用自然语言让生成式 AI 自动生成 Interface Manifest。
5. 用户可以直接运行当前草稿，无需先保存。
6. 用户可以保存 Interface，并重复使用。
7. 用户可以创建不可变版本。
8. 用户可以发布公共 Interface。
9. 其他用户可以直接测试公共 Interface。
10. 其他用户可以 Fork 公共 Interface 后修改。
11. Interface 可下载为标准 Manifest JSON，并可生成 Python / TypeScript / cURL 示例。
12. TypeSafe API Key 不进入用户账号数据库，不做持久化存储。
13. 默认不存储用户提交给 Jev 的实际正文和 Jev 返回结果。

## 1.3 非目标（V1 不做）

以下能力明确不属于 V1：

- 平台统一售卖 Jev 推理额度；
- 平台统一 TypeSafe API Key；
- 多步骤 Agent / Workflow；
- 一道题结果自动决定下一次 Jev 请求；
- 任意第三方 HTTP 请求编排；
- 用户上传任意 JS/Python 代码作为后处理；
- 图片、音频、视频 Jev 判断；
- 团队/企业复杂 RBAC；
- 复杂计费系统；
- 允许用户配置任意上游 URL 的开放代理。

这些以后可以作为 V2/V3。

---

# 2. TypeSafe/Jev 当前能力约束

开发必须按当前官方 HTTP API 契约实现，而不是按旧脚本猜测。

当前官方接口：

```http
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

请求核心结构：

```json
{
  "state": {},
  "model": "jev-latest",
  "questions": {}
}
```

需要遵守：

- `state` 可以是字符串、JSON object 或 array。
- 同一次请求中的所有 questions 查看同一个 state，并且独立判断。
- `questions` 是 `map<string, Question>`。
- question ID 由用户自己定义，返回 answer 使用相同 ID；ID 本身不参与模型推理。
- Question 类型只有：`noul`、`choice`、`score`。
- Noul：返回 0~1 的 `noul`。
- Choice：criteria 最多 255 个 option，返回 choice、probabilities、confidence。
- Score：criteria 为有序数组，最少 2 档、最多 10 档；返回概率加权 score、probabilities、confidence。
- instructions / criteria 可以是字符串，也可以是 JSON object / array。
- 服务端可能返回 401 / 422 / 429 / 529 等错误。
- 429 / 529 应指数退避重试。
- 当前 Jev 1.13 文档列出的模型 ID 为 `jev-1.13.0`，同时有 `jev-latest` 别名。
- 正式发布的 Interface 建议允许固定模型版本，避免 `jev-latest` 更新后行为变化。

**不要在代码中硬编码价格。** 可展示 TypeSafe 响应中的 token usage，但价格属于易变化信息。

官方参考：

- https://docs.typesafe.ai/api
- https://docs.typesafe.ai/concepts/state
- https://docs.typesafe.ai/primitives/advanced
- https://docs.typesafe.ai/models

---

# 3. 用户与权限模型

## 3.1 游客无需注册即可使用

游客可以：

- 浏览公共 Interface Hub；
- 搜索公共 Interface；
- 查看 Interface 定义；
- 输入自己的 TypeSafe API Key；
- 在线运行公共 Interface；
- 新建临时 Interface；
- 使用 Manual Builder；
- 将草稿保存在本浏览器；
- 导入/导出 Manifest JSON；
- 下载 Python / TypeScript / cURL 示例。

## 3.2 登录用户额外能力

登录后可以：

- 云端保存 Interface；
- 创建版本；
- 发布/取消发布；
- 创建私有 Interface；
- Fork 公共 Interface；
- 收藏/Star；
- 管理自己的 Interface；
- 查看版本历史；
- 使用社区身份展示作者；
- AI Builder 使用配额（如果平台 AI Builder 需要限额）。

## 3.3 注册与 API Key 完全分离

用户账号 **不能** 包含：

```text
typesafe_api_key
```

数据库从设计层面不创建该字段。

注册的目的：

```text
保存 Interface / Version / Fork / Star / 发布身份
```

API Key 的目的：

```text
仅用于本次 Jev 请求授权
```

---

# 4. API Key 安全设计（强制要求）

这是系统最高优先级的安全要求之一。

## 4.1 默认行为

TypeSafe API Key 默认只存在：

```text
浏览器当前 React/JS 内存
```

刷新或关闭页面后消失。

可以提供一个用户主动选择的选项：

```text
[ ] 在当前浏览器会话中记住
```

选中后可以放入：

```text
sessionStorage
```

V1 不默认写 `localStorage`。

## 4.2 后端一定会临时看到 Key

由于实际请求走：

```text
Browser -> App Backend -> TypeSafe
```

所以服务器在请求生命周期中必然拿到明文 API Key。

产品文案必须准确：

> API Key 仅用于当前请求，不保存至账号或数据库，不写入应用日志。默认情况下 Key 仅保留在当前页面会话。

禁止宣称：

> “服务器永远无法看到你的 API Key”。

## 4.3 Key 的传输方式

推荐：

```http
POST /api/runtime/playground
X-Typesafe-Api-Key: <USER_KEY>
Content-Type: application/json
```

不要使用 URL query：

```text
?apiKey=xxx
```

不要把 Key 写进 Interface Manifest。

## 4.4 后端日志规则

以下内容必须永远被 redaction：

- `X-Typesafe-Api-Key`
- `Authorization`
- 请求 Header 全量打印
- `/api/runtime/*` 的 request body 全量打印
- 上游 TypeSafe request headers

错误日志不得包含用户 Key。

例如错误只能记录：

```text
TypeSafe 401
TypeSafe 422
TypeSafe 429
TypeSafe 529
requestId (如有)
latency
interface/version id
```

## 4.5 监控系统

如果接入 Sentry / APM / OpenTelemetry：

- `beforeSend` 必须移除 API Key；
- 不采集运行页面表单内容；
- 不采集 `/api/runtime/*` body；
- 不记录上游 Authorization；
- 错误 breadcrumbs 不得包含 Header。

## 4.6 HTTP 缓存

所有 Runtime 路由响应：

```http
Cache-Control: no-store
```

浏览器调用同样使用：

```js
fetch(..., { cache: "no-store" })
```

## 4.7 XSS

因为 sessionStorage/内存中的 Key 仍可被 XSS 读取：

- 设置严格 CSP；
- 不允许 `unsafe-eval`；
- 尽量不允许 `unsafe-inline`；
- 不渲染未清洗 HTML；
- Interface 描述使用 Markdown 时必须 sanitize；
- 禁止用户通过 Manifest 注入 `<script>`。

---

# 5. 核心抽象：Jev Interface Manifest v1

所有业务能力统一保存为一个 Manifest。

## 5.1 Manifest 目标

Manifest 必须做到：

- 完整描述输入表单；
- 完整描述 state 如何由输入构建；
- 完整描述 Jev questions；
- 完整描述结果如何展示；
- 可选描述安全的后处理；
- 能独立导入/导出；
- 能被数据库版本化；
- 能被 AI Builder 生成；
- 能自动生成调用代码。

## 5.2 Manifest 示例

```json
{
  "schemaVersion": "1.0",
  "metadata": {
    "name": "自媒体标题评分",
    "slug": "media-title-score",
    "description": "根据标题及可选正文评价标题质量",
    "category": "content",
    "tags": ["标题", "自媒体", "中文"],
    "language": "zh-CN"
  },
  "runtime": {
    "provider": "typesafe",
    "model": "jev-1.13.0",
    "timeoutMs": 60000,
    "maxRetries": 2
  },
  "inputs": [
    {
      "id": "title",
      "label": "标题",
      "component": "text",
      "valueType": "string",
      "required": true,
      "constraints": {"maxLength": 200}
    },
    {
      "id": "article",
      "label": "正文（可选）",
      "component": "textarea",
      "valueType": "string",
      "required": false,
      "constraints": {"maxLength": 50000}
    }
  ],
  "stateTemplate": {
    "title": {"$input": "title"},
    "article": {"$input": "article"}
  },
  "questions": {
    "clarity": {
      "type": "score",
      "instructions": "评价标题清晰度",
      "criteria": [
        "难以理解",
        "较不清晰",
        "基本清晰",
        "清晰",
        "非常清晰"
      ]
    },
    "clickbait": {
      "type": "choice",
      "instructions": "标题是否存在明显标题党问题？",
      "criteria": {
        "none": "没有明显问题",
        "mild": "有轻微夸张但不影响核心事实",
        "strong": "明显夸张或核心承诺缺乏正文支撑",
        "insufficient": "缺少正文，无法核对兑现情况"
      }
    }
  },
  "postprocess": {
    "kind": "weighted_score",
    "metrics": []
  },
  "resultView": {
    "showRaw": true,
    "showProbabilities": true,
    "showConfidence": true,
    "order": ["clarity", "clickbait"]
  },
  "examples": []
}
```

---

# 6. Inputs / State Builder 设计

## 6.1 Input 支持类型

V1 支持：

```text
text
textarea
number
boolean
select
json
```

内部 valueType 支持：

```text
string
number
boolean
json
```

## 6.2 Input 字段

每个 input：

```json
{
  "id": "article",
  "label": "文章正文",
  "description": "待评估正文",
  "component": "textarea",
  "valueType": "string",
  "required": true,
  "placeholder": "粘贴文章……",
  "defaultValue": "",
  "constraints": {
    "minLength": 1,
    "maxLength": 50000
  }
}
```

## 6.3 State Template 不允许执行代码

禁止：

```js
new Function(...)
eval(...)
```

State 使用结构化变量引用：

```json
{
  "article": {"$input": "article"},
  "genre": {"$input": "genre"},
  "source": "web"
}
```

Runtime 递归解析：

```json
{"$input": "article"}
```

替换为用户输入。

如果可选字段为空：

- object property 默认省略；
- array element 默认省略；
- 必填字段缺失直接返回 400；
- 不自动编造默认文本。

## 6.4 State Preview

Builder 必须提供：

```text
Input Form Preview
Resolved State Preview
Raw JSON Preview
```

让高级用户明确看到最终发送给 TypeSafe 的 state。

---

# 7. Questions Builder

## 7.1 Question 公共字段

```json
{
  "id": "clarity",
  "type": "score",
  "instructions": "..."
}
```

ID 要求：

- 当前 Interface 内唯一；
- 推荐正则：`^[a-zA-Z][a-zA-Z0-9_-]{0,63}$`；
- UI 自动检查重复。

## 7.2 Noul

编辑器：

```text
Question ID
Instructions
True criteria（可选）
False criteria（可选）
```

序列化：

```json
{
  "type": "noul",
  "instructions": "是否表达紧迫性？",
  "criteria": {
    "true": "明确表达时间紧迫",
    "false": "没有表达紧迫"
  }
}
```

## 7.3 Choice

UI：

```text
Question ID
Instructions
Options
+ Add Option
```

每个 Option：

```text
key
criteria
```

约束：

- V1 至少 2 项；
- Provider 上限 255；
- UI 显示当前数量；
- option key 唯一。

## 7.4 Score

UI：

```text
Question ID
Instructions
Level 0
Level 1
...
```

约束：

- 2~10 levels；
- 顺序不可丢失；
- 支持拖动排序。

## 7.5 Advanced JSON Mode

因为 instructions / criteria 可以是 JSON object/array，Question Editor 提供：

```text
Simple Mode
Advanced JSON Mode
```

Simple Mode 使用普通表单。

Advanced Mode 允许编辑结构化 JSON，但必须通过 JSON Schema 校验。

---

# 8. Runtime Engine

## 8.1 两种运行入口

### A. Playground / Draft

用于尚未保存的动态 Manifest：

```http
POST /api/runtime/playground
X-Typesafe-Api-Key: <key>
```

Body：

```json
{
  "manifest": { ... },
  "inputs": { ... }
}
```

服务器必须：

1. 验证 Manifest；
2. 验证 Inputs；
3. Resolve state；
4. 生成 TypeSafe request；
5. 调 TypeSafe；
6. 校验 TypeSafe response；
7. 执行安全 postprocess；
8. 返回结果。

### B. Saved / Published Interface

```http
POST /api/runtime/interfaces/:interfaceId/versions/:versionId
X-Typesafe-Api-Key: <key>
```

Body：

```json
{
  "inputs": { ... }
}
```

**客户端不能提交 questions。**

服务器必须从数据库加载该版本的不可变 Manifest。

这样保证：

- 版本可复现；
- 用户不能在运行已发布 Interface 时偷偷替换 questions；
- 统计对应准确版本。

## 8.2 TypeSafe 上游请求

后端固定请求：

```text
https://api.typesafe.ai/v1/systemone
```

禁止把 URL 作为客户端参数。

Headers：

```http
Authorization: Bearer <user-typesafe-key>
Content-Type: application/json
```

Body：

```json
{
  "state": "resolved state",
  "model": "manifest runtime model",
  "questions": "manifest questions"
}
```

## 8.3 Timeout / Retry

默认：

```text
timeout: 60s
maxRetries: 2
```

只对适合重试的错误进行指数退避，例如：

```text
429
529
部分 5xx
网络超时
```

不要重试：

```text
401
422
```

## 8.4 App 自身限制

即使 TypeSafe 上游允许更大请求，本平台仍需要自我保护：

- Runtime HTTP body 默认最大 1 MB；
- 单次 questions 默认最多 50 个（平台限制，可由管理员调整）；
- Choice option 不超过 255；
- Score level 2~10；
- Interface Manifest JSON 默认最大 512 KB；
- 请求必须为 JSON；
- 不允许用户指定任意上游 URL。

这些属于平台保护限制，不宣称是 Jev 官方限制。

---

# 9. Response 与结果显示

## 9.1 原始 Provider Result

至少保存于本次响应内：

```json
{
  "model": "jev-1.13.0",
  "answers": {},
  "usage": {
    "input_tokens": 0,
    "output_tokens": 0
  }
}
```

## 9.2 自动 Result Renderer

根据类型自动渲染：

### Noul

```text
0 ---------------- 0.82 ---------------- 1
                       Yes tendency
```

显示：

- noul 数值；
- 可选阈值视觉标记；
- 不擅自把 0.82 写成“82% 是 AI 生成”这类错误语义。

### Choice

显示：

- chosen option；
- confidence；
- probability distribution；
- 条形图。

### Score

显示：

- weighted score；
- max level；
- confidence；
- probability distribution；
- legend。

## 9.3 Raw JSON

所有运行页面必须提供：

```text
Result
Raw JSON
Request Preview（不包含 API Key）
```

便于开发者调试。

---

# 10. Postprocess 设计

## 10.1 原则

Postprocess 必须是声明式，禁止执行用户 JS/Python。

V1 支持：

```text
none
weighted_score
jsonlogic（可选；只允许白名单操作符）
```

## 10.2 Weighted Score

例如：

```json
{
  "kind": "weighted_score",
  "metrics": [
    {
      "id": "overall",
      "label": "综合分",
      "scale": 100,
      "sources": [
        {
          "questionId": "clarity",
          "weight": 30,
          "transform": "score_percent"
        },
        {
          "questionId": "value",
          "weight": 40,
          "transform": "score_percent"
        },
        {
          "questionId": "is_misleading",
          "weight": 30,
          "transform": "inverse_noul_percent"
        }
      ]
    }
  ]
}
```

定义：

### score_percent

若 Score 有 N 档：

```text
score / (N - 1) * 100
```

### noul_percent

```text
noul * 100
```

### inverse_noul_percent

```text
(1 - noul) * 100
```

权重最后归一化。

## 10.3 JSONLogic

如果实现 JSONLogic：

仅允许白名单：

```text
var
+
-
*
/
min
max
if
and
or
!
<
<=
>
>=
==
```

禁止扩展函数，禁止 eval。

---

# 11. Manual Builder 页面设计

建议桌面端三栏：

```text
┌────────────────┬────────────────────────┬─────────────────┐
│ Inputs / State │ Questions              │ Preview / Run   │
│                │                        │                 │
│ + Field        │ + Noul                 │ API Key         │
│ State Template │ + Choice               │ Input Form      │
│                │ + Score                │ Run             │
│                │                        │ Result          │
└────────────────┴────────────────────────┴─────────────────┘
```

移动端按 Tab：

```text
Inputs | Questions | Test | Result
```

## 11.1 Builder 顶栏

```text
Name
Save
Publish
Import
Export
AI Define
Raw Manifest
```

游客看到：

```text
Save locally
Login to save to cloud
```

## 11.2 Questions 操作

支持：

- 新增；
- 复制；
- 删除；
- 拖动排序（仅显示顺序；发送给 API 仍为 map）；
- Simple / Advanced 切换；
- 实时校验。

---

# 12. AI Builder

## 12.1 AI Builder 的职责

生成式 AI 负责：

```text
自然语言需求
      ↓
Interface Manifest Draft
```

Jev 本身负责：

```text
执行最终 Manifest
```

不要用 Jev 来生成 Manifest。

## 12.2 AI Builder 输入

用户输入类似：

> 做一个公众号标题评分接口。输入标题和正文。评价清晰度、读者价值、吸引力、具体度、自然度、标题党、题文一致性，最后生成百分制总分。中文文章。

## 12.3 AI Builder 输出要求

生成模型必须只输出合法 Manifest JSON。

服务器执行：

```text
LLM response
   ↓
JSON parse
   ↓
Manifest JSON Schema validation
   ↓
业务规则 validation
   ↓
成功 -> 打开 Builder
失败 -> 自动修复一次 / 返回错误
```

AI 生成后必须标记：

```text
AI-generated draft — please test before publishing
```

## 12.4 AI Builder 迭代编辑

支持：

> “标题党判断太严，正常悬念不要算问题。”

AI 不能直接修改数据库已发布版本。

流程：

```text
Published v3
  ↓ clone to draft
AI refine
  ↓
Draft
  ↓ test
  ↓ publish
Published v4
```

## 12.5 AI Builder API

```http
POST /api/ai-builder/generate
POST /api/ai-builder/refine
```

输入：

```json
{
  "prompt": "...",
  "currentManifest": null
}
```

输出：

```json
{
  "manifest": {},
  "warnings": []
}
```

## 12.6 AI Builder 成本策略

V1 推荐二选一：

### 方案 A（Beta 最简单）

平台配置一个生成式 LLM Key：

- 仅登录用户；
- 每用户每日限额；
- 管理员可关闭；
- 不影响 Jev BYOK 原则。

### 方案 B（完全 BYOK）

允许用户临时输入支持的生成式 AI Provider Key，使用方式与 TypeSafe Key 相同，不存储。

**不要允许任意 base URL**，防止 SSRF；仅允许代码内预定义 Provider endpoint。

---

# 13. Interface 保存与版本设计

## 13.1 Draft 与 Published Version 分离

`Interface` 是逻辑项目。

`InterfaceVersion` 是不可变快照。

用户编辑的是 Draft。

点击 Publish 时：

```text
Draft Manifest
     ↓ validate
Create immutable Version N
     ↓
Set publishedVersionId
```

之后修改 Draft 不影响 Version N。

## 13.2 版本号

V1 使用整数版本：

```text
v1
v2
v3
```

不要强制 SemVer。

Manifest export 中：

```json
{
  "version": 3
}
```

## 13.3 Model Pinning

发布时提示：

```text
Model:
○ jev-latest
● jev-1.13.0 (recommended for reproducibility)
```

平台不自动更改已发布版本的 model 字段。

---

# 14. Interface Hub

## 14.1 公共列表

支持：

- 搜索；
- 分类；
- 标签；
- 语言；
- 最新；
- 最多运行；
- 最多收藏；
- Featured。

## 14.2 Interface 卡片

显示：

```text
名称
描述
作者
分类
语言
当前发布版本
Jev model
运行次数
Star 数
更新时间
```

## 14.3 Interface Detail

页面包含：

```text
Overview
Try it
Questions
Manifest
Versions
Examples
Fork
Download
```

默认首先突出 `Try it`。

## 14.4 Fork

Fork 必须记录：

```text
source interface
source version
fork owner
```

Fork 创建一个新的 Draft Interface。

原 Interface 后续更新不自动覆盖 Fork。

## 14.5 Visibility

支持：

```text
private
unlisted
public
```

规则：

- private：只有 owner；
- unlisted：知道链接的人可看，不出现在 Hub 搜索；
- public：Hub 可搜索。

---

# 15. 下载 / 导入 / 导出

## 15.1 Canonical Manifest

扩展名建议：

```text
.jev-interface.json
```

例如：

```text
media-title-score.jev-interface.json
```

## 15.2 自动生成代码

下载菜单：

```text
Manifest JSON
Python
TypeScript
cURL
```

代码生成必须基于固定模板，不需要再次调用 AI。

## 15.3 Python Export

生成内容应：

- 从环境变量读取 `TYPESAFE_API_KEY`；
- 不把真实 Key 写入文件；
- 包含 questions；
- 用样例 inputs 生成 state；
- 输出 raw result。

## 15.4 Import

上传 Manifest JSON：

```text
parse
↓
validate schema
↓
show warnings
↓
open as draft
```

不得直接覆盖现有已发布版本。

---

# 16. 数据库设计

推荐 PostgreSQL。

## 16.1 users

如果 Auth 框架有自己的用户表，可映射。

核心字段：

```text
id
name
email
avatar_url
role (user/admin)
created_at
updated_at
```

**没有 TypeSafe API Key。**

## 16.2 interfaces

```text
id UUID PK
owner_id FK users
name
slug
description
category
language
visibility (private/unlisted/public)
status (draft/published/archived)
forked_from_interface_id nullable
forked_from_version_id nullable
published_version_id nullable
created_at
updated_at
```

唯一约束建议：

```text
(owner_id, slug)
```

公共 URL 可以：

```text
/@username/slug
```

## 16.3 interface_drafts

```text
interface_id PK/FK
manifest_json JSONB
updated_at
```

## 16.4 interface_versions

```text
id UUID PK
interface_id FK
version_number INTEGER
manifest_json JSONB
changelog TEXT
created_by FK users
created_at
published_at
```

唯一：

```text
(interface_id, version_number)
```

`manifest_json` 发布后不可 UPDATE。

## 16.5 stars

```text
user_id
interface_id
created_at
```

联合唯一：

```text
(user_id, interface_id)
```

## 16.6 run_events

默认只记录非敏感元数据：

```text
id
interface_id nullable
interface_version_id nullable
user_id nullable
anonymous_session_hash nullable
success
provider_model
input_tokens nullable
output_tokens nullable
latency_ms
provider_status nullable
created_at
```

禁止字段：

```text
api_key
state
questions copy
raw answer
article
prompt text
```

对于 Playground 草稿，不需要保存完整 manifest 到 run event。

## 16.7 moderation（后续可选）

```text
reports
featured_interfaces
blocked_interfaces
```

---

# 17. 页面 / 路由

推荐页面：

```text
/
/hub
/hub?category=...
/i/[owner]/[slug]
/i/[owner]/[slug]/versions/[version]
/builder/new
/builder/[interfaceId]
/playground
/me/interfaces
/me/stars
/login
/settings
/admin/interfaces (admin)
```

---

# 18. HTTP API 设计

## 18.1 Public Interface

```text
GET /api/interfaces
GET /api/interfaces/:owner/:slug
GET /api/interfaces/:id/versions
GET /api/interfaces/:id/versions/:version
```

## 18.2 Authenticated CRUD

```text
POST   /api/interfaces
PATCH  /api/interfaces/:id
DELETE /api/interfaces/:id
PUT    /api/interfaces/:id/draft
POST   /api/interfaces/:id/publish
POST   /api/interfaces/:id/fork
POST   /api/interfaces/:id/star
DELETE /api/interfaces/:id/star
```

## 18.3 Runtime

```text
POST /api/runtime/playground
POST /api/runtime/interfaces/:interfaceId/versions/:versionId
```

## 18.4 AI Builder

```text
POST /api/ai-builder/generate
POST /api/ai-builder/refine
```

## 18.5 Export

```text
GET /api/interfaces/:id/versions/:version/export/manifest
GET /api/interfaces/:id/versions/:version/export/python
GET /api/interfaces/:id/versions/:version/export/typescript
GET /api/interfaces/:id/versions/:version/export/curl
```

---

# 19. 前端 API Key UX

全局右上角可以显示：

```text
TypeSafe: Not connected
```

点击后 Drawer：

```text
TypeSafe API Key
[••••••••••••••••]

[ ] Remember for this browser session

Key is used only for requests to TypeSafe and is not saved to your account.

[Test connection]
[Clear]
```

前端 API Key Store：

```ts
interface CredentialState {
  typesafeKey: string | null;
  rememberSession: boolean;
}
```

默认仅内存。

`rememberSession = true` 才同步 `sessionStorage`。

不要同步到 Server Component、Cookie、数据库。

---

# 20. 技术栈建议

为了方便 AI 开发和后期维护，V1 建议单仓全栈：

## Web

- Next.js（App Router，使用实施时稳定版）
- TypeScript strict mode
- React
- Tailwind CSS
- shadcn/ui 或等价可维护组件库

## Validation

- Zod
- JSON Schema（Manifest 对外标准）

## Database

- PostgreSQL
- Drizzle ORM

## Auth

- Auth.js / 当前稳定 OAuth Auth 方案
- 初始支持 GitHub + Google
- 后续可加 Email Magic Link

## Runtime

- Server-side `fetch` 调 TypeSafe HTTP API
- 不依赖 Python SDK

## Optional

- Redis / Upstash：Rate limit、短期缓存非敏感公共数据
- Sentry：必须配置 secret redaction

## Tests

- Vitest：unit/integration
- Playwright：E2E

## Deployment

可部署：

- Vercel + managed PostgreSQL；或
- Docker + VPS + PostgreSQL。

代码不能强依赖单一托管商。

---

# 21. 推荐目录结构

```text
src/
  app/
    page.tsx
    hub/
    i/
    builder/
    playground/
    me/
    login/
    api/
      runtime/
        playground/route.ts
        interfaces/[interfaceId]/versions/[versionId]/route.ts
      interfaces/
      ai-builder/
      export/

  components/
    credentials/
    builder/
    questions/
    inputs/
    results/
    hub/

  lib/
    manifest/
      types.ts
      schema.ts
      validate.ts
      resolve-state.ts
      normalize.ts
    typesafe/
      client.ts
      errors.ts
      sanitize.ts
    postprocess/
      weighted-score.ts
      jsonlogic.ts
    export/
      python.ts
      typescript.ts
      curl.ts
    auth/
    db/
    rate-limit/
    security/

  db/
    schema.ts
    migrations/

tests/
  unit/
  integration/
  e2e/

public/

.env.example
README.md
```

---

# 22. Manifest Validation

必须有两层：

## Layer 1 — JSON Schema

校验结构。

## Layer 2 — Semantic Validation

包括：

- Input ID 唯一；
- `$input` 引用必须存在；
- Question ID 唯一；
- Choice option 2~255；
- Score levels 2~10；
- Postprocess source question 必须存在；
- transform 必须与 question type 兼容；
- resultView order 引用必须存在；
- model 非空；
- Manifest size 不超过平台限制；
- 不包含 API Key 字段；
- 不包含 function / script / URL execution 配置。

---

# 23. TypeSafe Response Validation

不能盲信上游 JSON。

使用 Zod 校验：

### Noul Answer

```text
type == noul
noul finite 0..1
```

### Choice Answer

```text
type == choice
choice ∈ Manifest criteria keys
probabilities keys == option keys
probabilities values 0..1
sum approximately 1
confidence 0..1
```

### Score Answer

```text
type == score
score finite 0..N-1
probabilities level keys完整
sum approximately 1
confidence 0..1
```

任何异常返回：

```text
UPSTREAM_INVALID_RESPONSE
```

不伪造缺失字段。

---

# 24. Error Model

前端统一错误：

```json
{
  "error": {
    "code": "TYPESAFE_UNAUTHORIZED",
    "message": "TypeSafe API Key 无效或无权限",
    "retryable": false
  }
}
```

建议代码：

```text
INVALID_MANIFEST
INVALID_INPUT
MISSING_TYPESAFE_KEY
TYPESAFE_UNAUTHORIZED
TYPESAFE_VALIDATION_ERROR
TYPESAFE_RATE_LIMIT
TYPESAFE_OVERLOADED
TYPESAFE_TIMEOUT
TYPESAFE_UNKNOWN_ERROR
UPSTREAM_INVALID_RESPONSE
POSTPROCESS_ERROR
RATE_LIMITED_BY_APP
```

错误 UI 不回显上游完整 body（避免潜在敏感信息）。

---

# 25. Privacy / Run History

## 默认

不保存：

- 用户 state；
- 输入正文；
- TypeSafe Key；
- raw answers；
- AI Builder 用户业务正文（除非用户主动保存为 Interface description/example）。

可以记录：

- Interface/version；
- success；
- latency；
- token usage；
- provider model；
- HTTP status 分类。

如果未来提供“保存运行记录”：

必须是显式 opt-in，并单独设计数据保留策略。

---

# 26. Rate Limit

虽然 TypeSafe 消耗的是用户自己的额度，但平台后端仍需防滥用。

建议初始：

游客：

```text
60 runtime requests / minute / IP
```

登录用户：

```text
120 runtime requests / minute / user
```

AI Builder：

```text
按账号单独限制
```

具体数值必须通过环境配置，不写死业务逻辑。

---

# 27. Search / Hub 排序

V1 排序只使用站内客观指标：

```text
recent
runs
stars
featured
```

不要宣称 Interface “准确率最高”，除非未来有明确 Eval 数据。

---

# 28. Eval / Test Cases（V1.1 建议）

Interface 可附带 example/test cases：

```json
{
  "name": "典型标题",
  "inputs": {},
  "expectations": {
    "clickbait.choice": ["none", "mild"],
    "clarity.score": {"min": 2.5}
  }
}
```

发布前可点击：

```text
Run Test Suite
```

展示：

```text
Passed 18 / 20
```

不要把小测试集称作“准确率证明”。

---

# 29. 首批 Seed Interfaces

系统上线时至少包含两个官方示例：

1. 中文文章 AI 味 / 模板腔评估
2. 自媒体标题评分

迁移原则：

- 将原 Python 中 `state` 构造转为 inputs + stateTemplate；
- 将 question specs 转为 Manifest questions；
- 将汇总规则转为 postprocess；
- 删除 Python CLI、文件读取等与 Interface 本体无关逻辑；
- 原脚本只作为迁移参考，之后 Interface Manifest 为唯一业务源。

---

# 30. UI 视觉方向

定位：开发者工具 + AI 工具市场。

风格：

- 简洁；
- 高信息密度；
- 默认浅色；
- 支持暗色；
- Builder 强调结构化编辑；
- JSON 使用 monospace；
- Result 用卡片 + 概率条；
- 不使用过度营销式动画。

关键颜色只使用设计系统 token，不把业务逻辑与具体颜色绑定。

---

# 31. 可访问性

最低要求：

- 所有表单有 label；
- Keyboard 可操作；
- Dialog/Drawer focus trap；
- 状态不能只依赖颜色表达；
- JSON Editor 有文本替代；
- 错误与字段绑定；
- Loading 状态有 aria 属性。

---

# 32. 开发阶段

## Phase 0 — Foundation

交付：

- Next.js 项目；
- TypeScript strict；
- DB/ORM；
- Manifest types + JSON Schema；
- semantic validator；
- state resolver；
- TypeSafe HTTP client；
- API Key redaction；
- unit tests。

验收：

- Manifest 可解析；
- stateTemplate 可正确 resolve；
- TypeSafe Key 不进入 DB/log；
- mock TypeSafe request 契约正确。

## Phase 1 — Playground / Manual Builder

交付：

- API Key Drawer；
- Input Builder；
- State Template Editor；
- Noul / Choice / Score Builder；
- Request Preview；
- Playground Run；
- Result Renderer；
- Local Draft；
- Import/Export Manifest。

验收：

游客在无账号情况下可以：

```text
输入 Key -> 创建 Interface -> Run -> 看结果 -> 导出 JSON
```

## Phase 2 — Account / Cloud Save

交付：

- OAuth 登录；
- My Interfaces；
- 云端 Draft；
- Publish Version；
- private/unlisted/public；
- version history。

## Phase 3 — AI Builder

交付：

- Natural language -> Manifest；
- Refine Manifest；
- validation repair；
- diff/preview；
- AI-generated 标识。

## Phase 4 — Interface Hub

交付：

- 公共列表；
- Detail + Try it；
- Search/filter；
- Star；
- Fork；
- Featured；
- run counts。

## Phase 5 — Code Export / Eval

交付：

- Python / TS / cURL；
- Test cases；
- Run Test Suite；
- 更完整统计。

---

# 33. Definition of Done — 核心验收标准

## 33.1 API Key

必须通过自动测试证明：

- DB schema 无 TypeSafe API Key 字段；
- Runtime 成功后 DB 中搜索不到测试 Key；
- 应用 logger 捕获不到测试 Key；
- error logger 捕获不到测试 Key；
- response 不回显 Key；
- export 不包含 Key；
- Manifest 不包含 Key。

测试使用一个明确的假 Key：

```text
TEST_SECRET_TYPESAFE_KEY_DO_NOT_STORE_123456
```

测试结束扫描：

```text
DB
logs
generated files
HTTP response snapshots
```

必须为 0 命中。

## 33.2 Manifest

- 合法 Manifest 可导入；
- 非法 Score 11 levels 被拒绝；
- Choice >255 被拒绝；
- 未知 `$input` 被拒绝；
- 重复 question id 被拒绝；
- postprocess 引用不存在 question 被拒绝。

## 33.3 Runtime

- 401 转为稳定错误；
- 422 转为稳定错误；
- 429/529 可重试；
- timeout 可控；
- saved interface 运行时不能由客户端覆盖 questions；
- TypeSafe 返回异常结构不会导致错误分数。

## 33.4 Auth

游客：

- 可运行；
- 不可云端保存；
- 不可 publish/fork/star。

登录用户：

- 可保存自己的 Interface；
- 不能修改别人的 Interface；
- 可 Fork public；
- private 不能被其他用户读取。

## 33.5 Version

- 发布版本不可编辑；
- 修改只发生在 Draft；
- 新发布创建新 Version；
- 历史 Version 可继续运行。

---

# 34. 必须实现的测试

## Unit

- Manifest schema
- semantic validation
- state resolver
- optional input omission
- Noul parser
- Choice parser
- Score parser
- weighted score
- API key redactor
- export generator

## Integration

- Playground Runtime -> mocked TypeSafe
- Saved Runtime -> DB manifest -> mocked TypeSafe
- Publish immutable version
- Fork lineage
- Auth authorization
- TypeSafe error mapping

## E2E

### E2E 1：游客测试公共 Interface

```text
打开公共 Interface
输入 Key
填写 inputs
Run
看到答案
刷新后（默认）Key 消失
```

### E2E 2：游客创建草稿

```text
新建
加 textarea
加 Score
Run
Export Manifest
```

### E2E 3：用户保存发布

```text
登录
创建 Interface
保存 Draft
Publish v1
修改 Draft
Publish v2
v1 内容不变
```

### E2E 4：Fork

```text
用户 B 打开用户 A public Interface
Fork
B 得到自己的 Draft
A 原内容不变
```

### E2E 5：Secret Leak

使用假 Key 跑完整流程后自动扫描 logs/DB/output，0 命中。

---

# 35. 编码规范

编码 AI 必须遵守：

1. TypeScript strict，不使用无理由 `any`。
2. 所有外部输入经过 Zod/JSON Schema。
3. 不使用 `eval` / `new Function`。
4. 不执行用户代码。
5. 不把 TypeSafe Key 写入 cookie/database/localStorage/server log。
6. Runtime route 必须 `no-store`。
7. Provider client 和 UI 分离。
8. Manifest 是业务唯一真源；不要为具体 Interface 创建专属代码分支。
9. 不写 `if interface.name == "AI味检测"` 这类特殊业务逻辑。
10. 特定 Interface 差异全部通过 Manifest 表达。
11. TypeSafe HTTP client 必须单独模块，可 mock。
12. 每个 Phase 完成后运行 lint/typecheck/tests。
13. DB migration 必须进入版本控制。
14. `.env.example` 不能包含真实 secret。

---

# 36. 禁止实现清单

编码 AI 不得自行添加：

- 平台 TypeSafe 共用 Key 给所有用户；
- TypeSafe Key 数据库保存；
- 自动上传用户 Key 到监控；
- arbitrary proxy URL；
- arbitrary JavaScript postprocess；
- arbitrary shell/python execution；
- 未登录才可以运行的强制墙；
- 每种 Interface 一套专属后端代码；
- 隐式保存用户正文；
- 把 Noul 数字解释成“AI 生成概率”等无 Manifest 定义的含义。

---

# 37. Admin V1

最小管理功能：

- 查看 public Interfaces；
- Featured 开关；
- Archive/Hide 明显违规 Interface；
- 管理分类；
- 查看匿名 run metrics；
- 不提供查看 TypeSafe Key 的页面（因为不存在）；
- 不默认提供查看用户 runtime state 的页面（因为不保存）。

---

# 38. 环境变量

示例：

```env
DATABASE_URL=
AUTH_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI Builder 可选
AI_BUILDER_PROVIDER=
AI_BUILDER_API_KEY=

# App
APP_URL=http://localhost:3000
RUNTIME_MAX_BODY_BYTES=1048576
RUNTIME_MAX_QUESTIONS=50
RUNTIME_RATE_LIMIT_GUEST=60
RUNTIME_RATE_LIMIT_USER=120
```

**不存在：**

```env
PUBLIC_TYPESAFE_API_KEY=
```

平台不向所有用户提供共享 TypeSafe Key。

---

# 39. 开发 AI 执行方式

不要一次生成整个系统然后宣称完成。

必须按 Phase 开发，每个 Phase：

```text
1. 阅读本规格相关章节
2. 写 implementation plan
3. 实现
4. migration（如有）
5. unit test
6. integration test
7. typecheck
8. lint
9. 给出变更摘要
10. 再进入下一 Phase
```

如果发现规格和 TypeSafe 当前官方 API 冲突：

1. 先查官方文档；
2. 保持产品原则；
3. 修改 provider adapter；
4. 不修改 Manifest 高层抽象，除非确实无法表达。

---

# 40. 推荐 MVP 截止点

第一版可上线验证的最低范围：

```text
✅ 游客
✅ TypeSafe Key 临时输入
✅ Manual Builder
✅ Noul / Choice / Score
✅ Inputs + stateTemplate
✅ Run
✅ Result Viewer
✅ Local Draft
✅ Import / Export Manifest
✅ 注册登录
✅ Cloud Save
✅ Publish Version
✅ Public Interface Page
✅ Fork
✅ Hub Search
```

AI Builder 可以与 Hub 同期或下一阶段加入。

如果工期有限，**宁可推迟 AI Builder，也不要牺牲 Manifest / Runtime / Secret 安全这三个核心。**

---

# 41. 最终架构图

```text
                           Jev Interface Hub
                                  │
                 ┌────────────────┴────────────────┐
                 │                                 │
           Manual Builder                    AI Builder
                 │                                 │
                 └──────────────┬──────────────────┘
                                │
                                ▼
                      Interface Manifest v1
                                │
             ┌──────────────────┼───────────────────┐
             │                  │                   │
         Local Draft        Cloud Draft        Published Version
             │                  │                   │
             └──────────────────┴──────────┬────────┘
                                           │
                                           ▼
                                      Runtime Engine
                                           │
                          User TypeSafe API Key (ephemeral)
                                           │
                                           ▼
                         POST api.typesafe.ai/v1/systemone
                                           │
                                           ▼
                                   Structured Answers
                                           │
                                  ┌────────┴────────┐
                                  │                 │
                            Result Renderer   Safe Postprocess
                                  │                 │
                                  └────────┬────────┘
                                           ▼
                                     Web Result
```

---

# 42. 产品原则总结

本项目必须始终保持以下 8 条原则：

1. **一个 Runtime，N 个 Manifest。**
2. **用户为自己的 Jev 调用付费。**
3. **TypeSafe Key 不持久化。**
4. **运行公共 Interface 不强制注册。**
5. **注册只服务于保存、版本、Fork、发布和社区身份。**
6. **Published Version 不可变。**
7. **Manifest 是业务唯一真源。**
8. **用户定义配置，不执行用户代码。**

只要后续实现不偏离这 8 条，产品架构就不会重新退化成“一个用途一份脚本”。
