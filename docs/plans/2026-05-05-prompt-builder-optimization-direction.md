# GPT Image Playground Prompt Builder 优化方向

> **For Hermes:** 如果后续进入实现阶段，先用 `writing-plans` 细化为任务，再按 `subagent-driven-development` 执行。本文是产品/架构优化方向，不直接改代码。

**Goal:** 参考 Muse UI 的提示词组合逻辑，把当前 `gpt-image-playground` 从“裸 prompt 调用器”升级为“结构化图像创作工作台”。

**Architecture:** 当前项目已经有 Next.js 16 + React 19 前端、OpenAI Images API 服务层、SQLite job 队列、批量 CSV、模板库和编辑/遮罩能力。优化的核心不是多加几个长提示词，而是新增一个可测试、可预览、可复用的 `Prompt Builder` 层：把场景、画幅、主体、风格、约束、参考图语义、编辑意图等组合成最终 prompt，同时保留用户原始输入与 fullPrompt。

**Tech Stack:** Next.js App Router, TypeScript, React, OpenAI SDK, SQLite/better-sqlite3, existing `src/lib/image-generation-service.ts`, `src/components/generation-form.tsx`, `docs/gpt-image-prompt_templates/*`。

---

## 0. 当前项目状态判断

我看了这些关键位置：

- `package.json`：Next.js 16、React 19、OpenAI SDK、SQLite、Dexie、R2/S3 相关依赖。
- `src/components/generation-form.tsx`：生成表单目前主要收集裸 `prompt`、模型、尺寸、质量、输出格式、背景、moderation、streaming、batch CSV。
- `src/app/playground-client.tsx`：把表单字段直接塞进 `FormData`，`prompt` 基本等于用户输入。
- `src/lib/image-generation-service.ts`：服务端直接读取 `formData.get('prompt')`，然后调用 `openai.images.generate()` 或 `openai.images.edit()`。
- `src/lib/image-jobs.ts` 与 `src/app/api/image-jobs/route.ts`：已有 job 队列和 params 记录，但没有区分 `rawPrompt` / `fullPrompt` / `builderConfig`。
- `src/lib/prompt-template-data.ts` + `docs/gpt-image-prompt_templates/`：已有大量“成品 prompt 模板”，但还没有被抽象成组合式配置系统。

所以这个项目的短板很清楚：

> 现在是“用户写完整 prompt → 调 API”。  
> 更好的方向是“用户描述意图 → Prompt Builder 组合专业控制块 → 可预览/可调试 → 调 API”。

Muse UI 值得借鉴的是组合结构，而不是照搬它那套 UI 生成词库。

---

## 1. 最高优先级：建立 Prompt Builder 核心层

### 为什么

Muse UI 的强处不是某一句 prompt，而是这个骨架：

```text
Base Prompt
  = TASK
  + SPECS
  + USER DESCRIPTION
  + COMPONENT KEYWORDS
  + HARD OUTPUT CONSTRAINT

Optional Control Blocks
  + Media Type
  + Design Tokens
  + Layout Skeleton
  + Strict Design System JSON
  + DESIGN.md
  + Visual Style Reference
  + Layout Density Strategy
  + Language Constraint

Runtime Wrappers
  + Repaint Instruction prefix
  + Reference image labels / parts
  + Media mode cleanup
```

当前项目缺少这个中间层，导致：

- 模板只是“一整段文本”，不能细粒度复用；
- 批量生成只能换 prompt，不能批量换场景/风格/语言/约束；
- 编辑模式与生成模式只是 API mode 的差别，没有语义包装；
- 历史记录无法解释“这个图是如何由哪些控制块生成的”。

### 建议新增文件

```text
src/lib/prompt-builder/types.ts
src/lib/prompt-builder/catalogs.ts
src/lib/prompt-builder/build-prompt.ts
src/lib/prompt-builder/cleanup.ts
src/lib/prompt-builder/__tests__ 或 tests/prompt-builder.test.mjs
```

### 核心类型建议

```ts
export type PromptIntentMode =
  | 'free'
  | 'poster'
  | 'product'
  | 'character'
  | 'infographic'
  | 'cover'
  | 'social-post'
  | 'photo-edit'
  | 'repaint';

export type PromptBuilderConfig = {
  mode: PromptIntentMode;
  rawDescription: string;
  subject?: string;
  scene?: string;
  styleId?: string;
  mediumId?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | 'custom';
  size?: string;
  keywords?: string[];
  outputLanguage?: 'zh' | 'en' | 'ja' | 'ko' | 'auto';
  textPolicy?: 'no-text' | 'allow-short-text' | 'text-first';
  designTokens?: {
    enabled: boolean;
    aiColor?: boolean;
    primaryColor?: string;
    backgroundColor?: string;
    accentColor?: string;
    borderRadius?: string;
    density?: 'sparse' | 'balanced' | 'dense';
  };
  visualStyle?: string;
  layoutGuide?: string;
  strictSpecJson?: unknown;
  editInstruction?: string;
};
```

### Builder 输出建议

不要只返回字符串，至少返回：

```ts
export type BuiltPrompt = {
  rawPrompt: string;
  fullPrompt: string;
  blocks: Array<{
    id: string;
    title: string;
    enabled: boolean;
    content: string;
  }>;
  warnings: string[];
};
```

这样前端能做“Prompt Inspector”，服务端能记录 fullPrompt，测试也能断言每个块。

---

## 2. 把“模板库”升级为“场景/风格/约束目录”

### 当前问题

`docs/gpt-image-prompt_templates/prompts.json` 里的模板是成品 prompt。这很适合展示案例，但不适合作为生成系统的底层抽象。

现在模板库像一盒彩色贴纸；它好看，但不可组合。应该把它拆成积木。

### 优化方向

把模板拆成三层：

```text
Scene Catalog       场景：海报 / 信息图 / 角色设定 / 产品板 / 穿搭报告
Style Catalog       风格：极简 / editorial / 复古 / 电影感 / 科普绘本
Constraint Catalog  约束：文字密度 / 画幅 / 构图 / 语言 / 避免项
```

建议新增：

```text
src/lib/prompt-builder/catalogs/scenes.ts
src/lib/prompt-builder/catalogs/styles.ts
src/lib/prompt-builder/catalogs/layouts.ts
src/lib/prompt-builder/catalogs/text-policies.ts
```

每个 catalog item 不要只是 label，而要包含可注入片段：

```ts
export type PromptCatalogItem = {
  id: string;
  name: string;
  description: string;
  promptModifier: string;
  negativeHints?: string[];
  defaultAspectRatio?: string;
  defaultTextPolicy?: PromptBuilderConfig['textPolicy'];
};
```

### 可从现有模板反向沉淀

不是马上重写所有模板。先选 8 类高频：

1. 大字海报
2. 信息图
3. 角色设定
4. 产品概念板
5. 穿搭/发型/五官报告
6. 社交媒体图文
7. 科普绘本/剖面图
8. 角色海报/神话肖像

每类沉淀一个 scene，再慢慢把 prompts.json 里的模板挂到 scene 下作为 examples。

---

## 3. 生成模式：从裸 prompt 表单改成“意图 + 控制块”

### 当前表单

`GenerationFormData` 现在是：

```ts
prompt, n, size, quality, output_format, background, moderation, model
```

这更像 API 调试器，不像创作工具。

### 建议新增高级模式

保留裸 prompt，不要强迫用户走结构化。建议两个模式：

```text
Free Prompt     用户完全控制，直接发送 prompt
Guided Prompt   通过 Prompt Builder 组合 fullPrompt
```

字段分组建议：

```text
1. 你要做什么？
   - scene/mode：海报、产品图、角色设定、信息图、封面、社交媒体图
   - rawDescription：自然语言描述

2. 它长什么样？
   - styleId
   - mediumId / visualStyle
   - color/tokens

3. 它怎么排版？
   - aspectRatio / size
   - layoutDensity
   - textPolicy
   - outputLanguage

4. 有哪些硬约束？
   - mustInclude
   - mustAvoid
   - strictSpecJson / design brief

5. 最终 Prompt 预览
   - rawPrompt
   - fullPrompt
   - blocks inspector
```

### UX 上的关键点

必须让用户看到组合后的 fullPrompt。否则这是黑箱，黑箱迟早会变成玄学。

建议新增一个折叠区：

```text
Prompt Inspector
├─ Final Prompt
├─ Enabled Blocks
│  ├─ TASK
│  ├─ SPECS
│  ├─ STYLE
│  ├─ TEXT POLICY
│  └─ HARD CONSTRAINTS
└─ Warnings
```

---

## 4. 编辑模式：区分“重绘、改图、融合、参考”四种语义

### 当前状态

`edit` 模式支持：

- 多张 image file；
- mask；
- prompt；
- streaming；
- size/quality。

但所有图片在 OpenAI edit API 里只是 `image: imageFiles`，没有在 prompt 层明确标注语义。Muse UI 对 Gemini 的做法是给图像 parts 加标签，例如：

```text
REFERENCE 1: COLOR PALETTE SOURCE.
REFERENCE 2: VISUAL STYLE SOURCE.
REFERENCE 3: LAYOUT STRUCTURE.
**INPUT IMAGE FOR EDITING**
Reference Image: Inpainting Mask
Reference Images: Content Assets
```

OpenAI Images edit API 不一定支持像 Gemini parts 那样给每张图独立 label，但我们仍然可以在 prompt 文本里建立语义映射。

### 建议新增图片角色

```ts
export type ReferenceImageRole =
  | 'source-image'
  | 'style-reference'
  | 'color-reference'
  | 'layout-reference'
  | 'content-asset'
  | 'mask';
```

前端上传图片时让用户指定角色，或默认第一张为 `source-image`。

Builder 对 edit 模式注入：

```text
**EDIT TASK**: Modify the provided source image according to the instruction.
**SOURCE IMAGE**: Use image 1 as the primary subject/content source.
**STYLE REFERENCE**: If provided, use reference images only for style/color/layout, not identity replacement.
**MASK POLICY**: If a mask is provided, change only the masked area and preserve unmasked regions.
**EDIT INSTRUCTION**: {editInstruction}
```

### 价值

- 减少“参考图被误当主体”的问题；
- 局部重绘更稳定；
- 多图编辑不再全靠用户在 prompt 里解释图片顺序。

---

## 5. 局部重绘 Repaint：实现 wrapper，而不是另写一套表单

Muse UI 的 repaint 逻辑很简单但有效：

```text
**REPAINT INSTRUCTION**: {config.description || "Regenerate this area seamlessly."}

{original prompt}
```

当前项目已经有 mask 编辑能力，可以直接借鉴这个思想。

建议新增：

```ts
function wrapRepaintPrompt(fullPrompt: string, instruction?: string): string {
  return `**REPAINT INSTRUCTION**: ${instruction || 'Regenerate this area seamlessly.'}\n\n${fullPrompt}`;
}
```

但要加两条适合 OpenAI edit 的约束：

```text
Preserve all unmasked regions exactly.
Make the changed area blend seamlessly with lighting, perspective, texture, and style.
```

---

## 6. 增加“文字生成策略”，这是 GPT Image 2 的关键控制点

这个项目叫 `gpt-image-playground`，而 GPT Image 2 很大价值在文字与版式。Muse UI 的 `TEXT LANGUAGE` 值得借鉴，但还不够。

建议把文字策略单独做成控制块：

```ts
textPolicy:
  | 'no-text'
  | 'allow-short-text'
  | 'text-first'
  | 'structured-labels'
```

对应 prompt：

```text
**TEXT POLICY**: No visible text. Use symbols and composition only.
```

```text
**TEXT POLICY**: Use short, legible text only. Avoid tiny unreadable paragraphs.
**TEXT LANGUAGE**: Use SIMPLIFIED CHINESE for all visible text.
```

```text
**TEXT POLICY**: Text is the primary visual element. Make all typography large, accurate, and central to the composition.
```

```text
**TEXT POLICY**: Use structured labels, callouts, captions, and section headers. Keep every label concise and readable.
```

这比单纯 `promptLanguage` 更适合图像生成。

---

## 7. 记录 rawPrompt / fullPrompt / builderConfig，避免历史不可复盘

### 当前问题

`image_jobs.prompt` 存的是 prompt 字符串，`params_json` 存了 FormData 的序列化字段。但如果后续加入 Builder，必须区分：

- 用户原始输入；
- Builder 组合后的最终 prompt；
- Builder 配置；
- 启用过哪些 blocks；
- warnings。

### 建议 DB 层

短期无需大迁移，可以先塞进 `params_json`：

```json
{
  "prompt_mode": "guided",
  "raw_prompt": "用户输入",
  "full_prompt": "最终发送给模型的 prompt",
  "prompt_builder_config": {...},
  "prompt_blocks": [...],
  "prompt_warnings": [...]
}
```

中期再考虑给 `image_jobs` 加字段：

```sql
raw_prompt TEXT,
full_prompt TEXT,
prompt_builder_json TEXT
```

### 服务端原则

真正调用 API 的地方应该只信任服务端 Builder 的输出。前端可以预览 fullPrompt，但不能作为唯一可信来源。

---

## 8. 批量 CSV：从 prompt 批量扩展到 config 批量

现有 `batch-csv.ts` 已经支持批量 prompt 和参数。优化方向是新增 Guided CSV：

```csv
mode,scene,description,subject,style,aspect_ratio,text_policy,language,must_include,must_avoid,n,size,quality
poster,大字海报,做一张关于长期主义的中文海报,,editorial,3:4,text-first,zh,大标题|副标题,小字过多,1,1024x1536,high
infographic,信息图,解释咖啡因如何影响睡眠,咖啡因,minimal,16:9,structured-labels,zh,流程箭头|图标,医学诊断,1,1536x1024,high
```

这样批量生成从“复制九段长 prompt”变成“批量组合不同配置”。

---

## 9. 优先级路线图

### P0：Prompt Builder MVP

目标：最小但可用。

- 新增 `src/lib/prompt-builder/build-prompt.ts`。
- 支持 `free` 与 `guided` 两种模式。
- 支持 5 个 blocks：`TASK`、`SPECS`、`DESC`、`STYLE`、`TEXT POLICY`、`QUALITY`。
- 前端显示 fullPrompt 预览。
- 服务端记录 `raw_prompt/full_prompt/prompt_blocks` 到 `params_json`。
- 测试 Builder 输出顺序与条件注入。

验收标准：

- Free 模式下 fullPrompt 等于用户 prompt。
- Guided 模式下可以看到结构化 fullPrompt。
- 生成历史里能看到最终发送给 API 的 fullPrompt。
- 现有 `npm test` 通过。

### P1：Catalog 化

目标：从现有模板库沉淀可组合资产。

- 建 `scenes.ts/styles.ts/text-policies.ts`。
- 先做 8 个 scene、12 个 style、4 个 text policy。
- 模板库页面支持“一键套用为 Guided Config”，而不是只复制 prompt。

验收标准：

- 用户点一个模板，可以看到 scene/style/textPolicy 被填入，而不只是 textarea 被塞满。
- 可以替换风格而保留场景描述。

### P2：编辑模式语义化

目标：多图编辑更可靠。

- 上传图片支持 role 标记。
- edit prompt 自动注入 source/style/color/layout/content/mask 语义说明。
- Repaint wrapper 加入 preserve unmasked regions 约束。

验收标准：

- 有 mask 时自动进入 repaint wrapper。
- 第一张图默认 source-image。
- 多参考图在 fullPrompt 中有明确图片顺序说明。

### P3：Prompt Inspector 与调试体验

目标：减少玄学。

- 前端展开每个 block。
- warnings 告诉用户：比如 `text-first` + `no-text` 冲突、透明背景不支持、尺寸与模型不兼容。
- job 详情页展示 raw/full/blocks。

### P4：质量闭环

目标：让系统逐渐变聪明，而不是越堆越乱。

- 每次生成允许用户标记：好 / 坏 / 文字错 / 构图错 / 风格错 / 不听参考图。
- 把失败原因保存到 job metadata。
- 后续根据失败类型调整 Builder blocks。

---

## 10. 不建议做的事

### 不要直接复制 Muse UI 的 66 个风格和 132 个设计系统

那会让项目膨胀，但不一定更好用。这个项目面向 GPT Image 2，应优先围绕：

- 文字准确性；
- 海报/信息图/产品/角色这类场景；
- edit/mask 的稳定性；
- 批量生产与复盘。

### 不要把 Builder 只做在前端

前端预览可以，但服务端必须重新 build。否则历史记录和 API 实际调用可能不一致，也容易被错误参数污染。

### 不要把所有控制项一次性塞进表单

先做高级折叠区。默认体验应该仍然简单：一句描述 + 场景 + 风格 + 语言。

---

## 11. 最小实现建议

如果只做第一刀，我建议这样切：

1. 新建 `src/lib/prompt-builder/build-prompt.ts`。
2. 增加 `PromptBuilderConfig` 和 `BuiltPrompt`。
3. GenerationForm 增加一个开关：`Free / Guided`。
4. Guided 模式只加：场景、风格、文字策略、语言。
5. 前端实时展示 fullPrompt。
6. API 提交时传 `prompt_mode` 与 `prompt_builder_config`。
7. 服务端调用 Builder，使用 `built.fullPrompt` 作为真正 prompt。
8. 把 built 信息写入 job params。
9. 加 6 个 Builder 单测。

这一步做完，项目气质就会变：从 API playground，变成可控的 image prompt cockpit。

---

## 12. Builder MVP 示例

```ts
export function buildPrompt(config: PromptBuilderConfig): BuiltPrompt {
  if (config.mode === 'free') {
    return {
      rawPrompt: config.rawDescription,
      fullPrompt: config.rawDescription,
      blocks: [],
      warnings: []
    };
  }

  const blocks = [
    block('TASK', `Generate a ${config.mode} image for: ${config.subject || config.rawDescription}.`),
    block('SPECS', `Canvas: ${config.aspectRatio || 'auto'}, size: ${config.size || 'auto'}.`),
    block('DESCRIPTION', config.rawDescription),
    config.styleId ? block('STYLE', resolveStyle(config.styleId).promptModifier) : null,
    buildTextPolicyBlock(config),
    block('QUALITY', 'High-quality, coherent composition, legible details, production-ready image.')
  ].filter(Boolean);

  return {
    rawPrompt: config.rawDescription,
    fullPrompt: blocks.map((b) => `**${b.title}**: ${b.content}`).join('\n'),
    blocks,
    warnings: validatePromptConfig(config)
  };
}
```

这就是第一块骨头。先让系统有脊梁，再谈词库和花活。
