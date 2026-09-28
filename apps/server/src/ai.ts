import { readFileSync } from "node:fs";

import { DIMENSION_LABEL } from "@studio/shared";
import type {
  AiSuggestion,
  AiSuggestRequest,
  AiTask,
  AnalysisDimension,
  BriefInput,
} from "@studio/shared";

import type { AiSettings } from "./config";

/** 每个任务要告诉模型什么，以及产出多少条候选 */
const TASK_GUIDE: Record<AiTask, { instruction: string; count: number }> = {
  props: {
    count: 5,
    instruction:
      "根据拍摄对象和已有的风格关键词，推荐几件可用道具。每件道具要写清材质、颜色，以及它在画面里起什么作用。不要编造品牌。",
  },
  style: {
    count: 6,
    instruction:
      "根据拍摄对象、道具和已有场景，推荐风格关键词。标题写成能直接填进表单的关键词，四到八个字；说明写它为什么适合当前人物与道具，以及在画面上的具体表现（色调、光线、质感）。不要重复已有的关键词。",
  },
  location: {
    count: 5,
    instruction:
      "根据拍摄对象和风格关键词，推荐可以迁移的通用拍摄场景类型，例如老城区红砖墙、日系杂货铺门口、有天光的旧厂房。不要编造具体店名和地址。说明写清这类场景的光线条件、最佳时段和限制。",
  },
  venues: {
    count: 5,
    instruction:
      "根据拍摄对象、道具、场景与风格，推荐可以真正落地的场地候选。标题写场地名，用可以迁移的通用描述（例如带落地窗的旧公寓、有顶光的旧厂房、梧桐树下的老街角），不要编造具体店名和门牌号。说明里必须写清四件事：这个场地的光线条件（朝向、进光方式、是否有遮挡）、一天中最适合拍摄的时段、需要提前确认的限制（是否收费、是否需要报备、人流情况）、以及它和当前风格为什么匹配。",
  },
  character: {
    count: 6,
    instruction:
      "根据拍摄对象（人物或角色），整理一份能直接指导拍摄的档案。每条标题写维度名，说明写内容，覆盖这几个维度：出典与身份、外形与体型特征、服装与配色规律、标志性元素（必须出现或必须避免的东西）、容易被拍错的地方、可选的表现气质。如果某个信息你不确定，就明确写「需要核实」并说明该查什么，不要编造设定。",
  },
  elements: {
    count: 6,
    instruction:
      "看着这张参考图，列出可以抽离出来单独使用的元素。每条标题是元素名，四到八个字，例如逆光发丝、斑驳树影、冷调背景、黄铜反光、前景虚化。说明写清三件事：这个元素在图里具体怎么表现、它由什么构成（光线、颜色、材质、位置）、抽离出来能用在拍摄的哪个环节。只列真正可复用的元素，不要评价整张图好不好看。",
  },
  "blend-directions": {
    count: 3,
    instruction:
      "根据给出的两张图的元素与各自的灵感，提出三个把两者结合的新灵感方向。标题是四到八个字的方向名，说明写清：它分别借用了双方的哪个元素、结合之后会形成什么画面。三个方向要有明显区别，让人能真的做选择。",
  },
  "blend-plan": {
    count: 1,
    instruction:
      "把选定的方向展开成一份可以直接开拍的完整灵感场景策划。说明里依次写清：画面描述、光线方案（主光方向与光比）、镜头与构图、道具与造型、以及现场执行要注意的点。要具体到摄影师能照着做，不要写抽象的口号。",
  },
  "group-plan": {
    count: 1,
    instruction:
      "给出的材料是多个组成元素，每个都写了它抽离自哪张图、以及具体是什么。请把它们整合成一个完整的想法，展开成可以直接开拍的场景策划。说明里依次写清：画面描述、每个组成元素在最终画面里落在什么位置起什么作用、光线方案（主光方向与光比）、镜头与构图、道具与造型、现场执行要注意的点。必须让每个组成元素都有明确去处，一个都不能漏。",
  },
  lighting: {
    count: 5,
    instruction:
      "根据这条灵感以及用户写下的布光要求，给出推荐的灯位方案。每条对应一个灯位：标题写灯位代号与作用，例如 A 主光、B 辅光、C 发丝光、D 背景光；说明写清五件事：灯具类型、功率、附件、位置与高度、以及它在这张画面里起什么作用。如果有自然光或反光板参与，也单独列一条。要让人照着就能把灯架起来，不写抽象术语。",
  },
  blueprint: {
    count: 3,
    instruction:
      "用户想以一份已有企划为蓝本，做一次针对新角色或新人物的拍摄。材料里有蓝本企划的设定，以及用户这次的新需求。请给出三个可以照做的调整方向：标题写方向名，说明写清三件事——蓝本里哪些做法应当保留、哪些必须为新角色改掉、以及具体怎么改（从道具、场景、配色、光线、镜头里挑相关的说）。要具体到能直接改企划，不要泛泛而谈。",
  },
  "expand-plan": {
    count: 1,
    instruction:
      "根据这张图抽离出来的元素和人写下的灵感，补全成一份可以直接开拍的完整场景策划。说明里依次写清：画面描述、光线方案（主光方向与光比）、镜头与构图、道具与造型、以及彩排时要注意的点。保留人原本的想法，只做补全和具体化，不要改掉方向。",
  },
  themes: {
    count: 3,
    instruction:
      "根据人物或角色、道具、场景与风格关键词，给出三个主题定调方向。标题是四到八个字的方向名，说明要写清三件事：一句话主张、视觉走向（色调与光线）、以及对这个企划的具体拍摄建议。三个方向之间要有明显区别，例如一个偏叙事、一个偏氛围、一个偏造型，让人能真的做出选择。",
  },
  technique: {
    count: 5,
    instruction:
      "根据拍摄对象、场景和风格，推荐前期拍摄手法：机位高度、角度、焦段配合、构图方式、需要的辅助器材。说明要写清具体怎么拍。",
  },
  "effect-pre": {
    count: 5,
    instruction:
      "推荐在实拍阶段就能做出来的前期效果，例如烟雾、水汽、风扇吹动、镜面反射、彩色道具光、逆光眩光。说明写清实现方式、需要的器材和风险。",
  },
  "effect-post": {
    count: 5,
    instruction:
      "推荐后期可以做的效果，例如色调分离、胶片颗粒、轻微光晕、双重曝光、合成背景。说明写清实现思路，以及这个效果对前期素材有什么要求。",
  },
  "refine-pre": {
    count: 3,
    instruction:
      "用户已经写下了一段关于前期效果的想法，请给出三条细化与优化建议。标题写改动方向，说明写改好之后的完整表述，可以直接替换原文。",
  },
  "refine-post": {
    count: 3,
    instruction:
      "用户已经写下了一段关于后期效果的想法，请给出三条细化与优化建议。标题写改动方向，说明写改好之后的完整表述，可以直接替换原文。",
  },
};

const SYSTEM_PROMPT =
  "你是一位资深商业摄影师和拍摄企划，擅长把模糊的想法翻译成现场能执行的方案。" +
  "只输出 JSON，不要输出解释文字。所有内容用简体中文。" +
  '输出结构固定为 {"suggestions":[{"title":"短标题","detail":"一句话说明"}]}。';

function describeBrief(brief: BriefInput): string {
  const lines: string[] = [];
  const push = (label: string, value: string) => {
    if (value && value.trim()) {
      lines.push(`${label}：${value.trim()}`);
    }
  };
  push("拍摄对象", brief.subject);
  push("道具", brief.props);
  push("拍摄场景", brief.shootingScene);
  push("风格关键词", brief.styleKeywords.join("、"));
  push("焦段", brief.focalLength);
  push("光圈", brief.aperture);
  push("拍摄手法", brief.shootingTechnique);
  push("前期效果", brief.onSetEffect);
  push("后期效果", brief.postProduction);
  return lines.length > 0 ? lines.join("\n") : "（用户还没有填写任何信息）";
}

function buildUserPrompt(request: AiSuggestRequest): string {
  const guide = TASK_GUIDE[request.task];
  const parts = [
    `已有信息：\n${describeBrief(request.brief)}`,
    `本次任务：${guide.instruction}`,
    `输出 ${guide.count} 条候选，按推荐程度从高到低排列。`,
  ];
  if (request.context && request.context.trim()) {
    parts.splice(1, 0, `本次要处理的材料：\n${request.context.trim()}`);
  }
  if (request.existing && request.existing.trim()) {
    parts.splice(1, 0, `用户已经写的原文：\n${request.existing.trim()}`);
  }
  return parts.join("\n\n");
}

function parseSuggestions(content: string): AiSuggestion[] {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AiError("模型返回的内容不是合法 JSON，可以重试一次");
  }
  const list = (parsed as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(list)) {
    throw new AiError("模型没有按要求返回候选列表，可以重试一次");
  }
  return list
    .map((item) => {
      const record = item as { title?: unknown; detail?: unknown };
      return {
        title: typeof record.title === "string" ? record.title.trim() : "",
        detail: typeof record.detail === "string" ? record.detail.trim() : "",
      };
    })
    .filter((item) => item.title.length > 0);
}

export class AiError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AiError";
    this.status = status;
  }
}

export interface AiResult {
  suggestions: AiSuggestion[];
  model: string;
}

export async function suggest(
  settings: AiSettings,
  request: AiSuggestRequest,
): Promise<AiResult> {
  if (!settings.apiKey) {
    throw new AiError("还没配置 DeepSeek 密钥，先在设置里填上", 428);
  }

  const url = `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body = {
    model: settings.textModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(request) },
    ],
    // 推荐类任务要快要便宜，关掉思考模式；思考模式开启时不能传 temperature
    thinking: { type: "disabled" },
    temperature: 0.8,
    max_tokens: 1600,
    response_format: { type: "json_object" },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "未知错误";
    throw new AiError(`连不上 DeepSeek 接口（${reason}），检查网络或接口地址`, 502);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new AiError(describeHttpError(response.status, text), 502);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiError("模型没有返回内容，可以重试一次", 502);
  }

  return { suggestions: parseSuggestions(content), model: settings.textModel };
}

function describeHttpError(status: number, body: string): string {
  switch (status) {
    case 401:
      return "密钥无效，检查是否复制完整";
    case 402:
      return "账户余额不足，去 DeepSeek 平台充值后再试";
    case 429:
      return "请求太频繁，等一会儿再试";
    case 400:
      return `模型拒绝了这次请求：${body.slice(0, 120)}`;
    default:
      return `接口返回 ${status}：${body.slice(0, 120)}`;
  }
}

export interface AnalyzeInput {
  /** 本地图片的绝对路径 */
  imagePath: string;
  mime: string;
  dimensions: AnalysisDimension[];
  brief: BriefInput;
}

const ANALYZE_SYSTEM =
  "你是资深摄影指导，正在拆解一张参考图，为即将执行的拍摄提取可复用的信息。" +
  "只输出 JSON，结构固定为 {\"items\":[{\"dimension\":\"维度英文键\",\"text\":\"观察结论\"}]}。" +
  "text 用简体中文，必须具体到能直接指导拍摄，例如光位方向、光比、色温倾向、焦段与景深判断、道具材质与位置。" +
  "不要写“很好看”“很有氛围”这类无法执行的评价。";

const ELEMENT_SYSTEM =
  "你是资深摄影指导，正在把一张参考图拆成可以单独拿去使用的元素。" +
  "只输出 JSON，结构固定为 {\"suggestions\":[{\"title\":\"元素名\",\"detail\":\"说明\"}]}。" +
  "title 是四到八个字的元素名，例如逆光发丝、斑驳树影、冷调背景、黄铜反光、前景虚化。" +
  "detail 用简体中文写清三件事：这个元素在图里具体怎么表现、它由什么构成（光线、颜色、材质、位置）、抽离出来能用在拍摄的哪个环节。" +
  "只列真正可复用的元素，不要评价整张图好不好看。";

/** 拆元素：让模型看图，列出可抽离复用的元素 */
export async function analyzeElements(
  settings: AiSettings,
  input: { imagePath: string; mime: string; brief: BriefInput },
): Promise<{ suggestions: AiSuggestion[]; model: string }> {
  if (!settings.apiKey) {
    throw new AiError("还没配置 DeepSeek 密钥，先在设置里填上", 428);
  }

  const dataUrl = `data:${input.mime};base64,${readFileSync(input.imagePath).toString("base64")}`;
  const instruction = [
    `本次拍摄的背景信息：\n${describeBrief(input.brief)}`,
    "请列出这张参考图里可以抽离出来单独使用的元素，六条左右，按可复用程度从高到低排列。",
  ].join("\n\n");

  const content = await callVision(settings, ELEMENT_SYSTEM, instruction, dataUrl, 1400);
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AiError("模型返回的内容不是合法 JSON，可以重试一次");
  }
  const list = (parsed as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(list)) {
    throw new AiError("模型没有按要求返回元素清单，可以重试一次");
  }
  const suggestions = list
    .map((raw) => {
      const record = raw as { title?: unknown; detail?: unknown };
      return {
        title: typeof record.title === "string" ? record.title.trim() : "",
        detail: typeof record.detail === "string" ? record.detail.trim() : "",
      };
    })
    .filter((item) => item.title.length > 0);
  if (suggestions.length === 0) {
    throw new AiError("模型没有产出可用元素，可以重试一次");
  }
  return { suggestions, model: settings.visionModel };
}

/** 带图调用视觉模型的公共部分 */
async function callVision(
  settings: AiSettings,
  system: string,
  instruction: string,
  dataUrl: string,
  maxTokens: number,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.visionModel,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        thinking: { type: "disabled" },
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "未知错误";
    throw new AiError(`连不上 DeepSeek 接口（${reason}），检查网络或接口地址`, 502);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new AiError(describeHttpError(response.status, text), 502);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiError("模型没有返回内容，可以重试一次", 502);
  }
  return content;
}

export async function analyzeReference(
  settings: AiSettings,
  input: AnalyzeInput,
): Promise<{ items: Array<{ dimension: AnalysisDimension; text: string }>; model: string }> {
  if (!settings.apiKey) {
    throw new AiError("还没配置 DeepSeek 密钥，先在设置里填上", 428);
  }

  const wanted = input.dimensions
    .map((dimension) => `- ${dimension}（${DIMENSION_LABEL[dimension]}）`)
    .join("\n");

  const context = describeBrief(input.brief);
  const instruction = [
    `本次拍摄的背景信息：\n${context}`,
    `请只分析这些维度，每个维度输出一到三条结论：\n${wanted}`,
    "dimension 字段必须使用上面括号前的英文键。",
  ].join("\n\n");

  const dataUrl = `data:${input.mime};base64,${readFileSync(input.imagePath).toString("base64")}`;

  let response: Response;
  try {
    response = await fetch(`${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        // 只有 flash 支持图片输入
        model: settings.visionModel,
        messages: [
          { role: "system", content: ANALYZE_SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        thinking: { type: "disabled" },
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "未知错误";
    throw new AiError(`连不上 DeepSeek 接口（${reason}），检查网络或接口地址`, 502);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new AiError(describeHttpError(response.status, text), 502);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiError("模型没有返回内容，可以重试一次", 502);
  }

  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AiError("模型返回的内容不是合法 JSON，可以重试一次");
  }
  const list = (parsed as { items?: unknown }).items;
  if (!Array.isArray(list)) {
    throw new AiError("模型没有按要求返回分析结果，可以重试一次");
  }
  const allowed = new Set(input.dimensions as string[]);
  const items = list
    .map((raw) => {
      const record = raw as { dimension?: unknown; text?: unknown };
      return {
        dimension: typeof record.dimension === "string" ? record.dimension : "",
        text: typeof record.text === "string" ? record.text.trim() : "",
      };
    })
    .filter((item) => allowed.has(item.dimension) && item.text.length > 0)
    .map((item) => ({ dimension: item.dimension as AnalysisDimension, text: item.text }));

  if (items.length === 0) {
    throw new AiError("模型没有产出可用结论，可以换个维度再试");
  }
  return { items, model: settings.visionModel };
}
