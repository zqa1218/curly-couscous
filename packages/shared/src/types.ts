import type { StageId } from "./stages";

/** 立项阶段人输入的原始信息 */
export interface BriefInput {
  subject: string;
  props: string;
  /** 拍摄场景，与拍摄手法分开填写 */
  shootingScene: string;
  styleKeywords: string[];
  /** 焦段，例如 35mm / 85mm */
  focalLength: string;
  /** 光圈，例如 f/1.4 - f/2.8 */
  aperture: string;
  /** 前期拍摄手法：机位、运镜、构图方式 */
  shootingTechnique: string;
  /** 拍摄前期效果：实拍阶段就要做出来的效果 */
  onSetEffect: string;
  /** 拍摄后期效果 */
  postProduction: string;
}

/** S0 阶段可以呼叫 AI 的任务 */
export type AiTask =
  | "props"
  | "style"
  | "location"
  | "venues"
  | "character"
  | "themes"
  | "elements"
  | "blend-directions"
  | "blend-plan"
  | "group-plan"
  | "expand-plan"
  | "lighting"
  | "blueprint"
  | "technique"
  | "effect-pre"
  | "effect-post"
  | "refine-pre"
  | "refine-post";

export const AI_TASK_LABEL: Record<AiTask, string> = {
  props: "推荐道具",
  style: "推荐风格关键词",
  location: "推荐拍摄场景",
  venues: "推荐具体场地",
  character: "调研人物档案",
  themes: "推荐主题定调",
  elements: "分析图片元素",
  "blend-directions": "分析新灵感方向",
  "blend-plan": "生成新灵感策划",
  "group-plan": "补全这组组成元素",
  "expand-plan": "补全灵感策划",
  lighting: "推荐灯位方案",
  blueprint: "给出蓝本调整建议",
  technique: "推荐拍摄手法",
  "effect-pre": "推荐前期效果",
  "effect-post": "推荐后期效果",
  "refine-pre": "细化前期效果",
  "refine-post": "细化后期效果",
};

/** 一条 AI 候选建议 */
export interface AiSuggestion {
  /** 短标题：关键词、道具名或建议名 */
  title: string;
  /** 一句话说明为什么合适、怎么用 */
  detail: string;
}

export interface AiSuggestRequest {
  task: AiTask;
  brief: BriefInput;
  /** 细化类任务里，人已经写下的原文 */
  existing?: string;
  /** 需要一起交给模型的上下文，例如抽出来的元素、两张图的灵感 */
  context?: string;
}

export interface AiSuggestResponse {
  task: AiTask;
  suggestions: AiSuggestion[];
  model: string;
}

/** 公共区里一张图上的分析注释 */
export interface BoardAnalysis {
  id: string;
  dimensions: AnalysisDimension[];
  text: string;
  createdAt: string;
}

/** 从图里抽离出来的一个元素 */
export interface BoardElement {
  id: string;
  name: string;
  detail: string;
}

/**
 * 公共区里两类东西：
 * - idea：完整想法，已经补全过，是终态，不能再连线
 * - component：组成元素，本身不是完整想法，必须和别的组成元素连起来后补全
 */
export type BoardItemKind = "idea" | "component";

/** 公共区里的一张图。同一个参考图可以被多次取用，各自独立摆放与分析 */
export interface BoardItem {
  id: string;
  referenceId: string;
  kind: BoardItemKind;
  x: number;
  y: number;
  /** 人挑选出来要抽离使用的元素 */
  elements: BoardElement[];
  /** 人自己写的灵感 */
  note: string;
  /** AI 补全后的完整策划 */
  plan: string;
  analyses: BoardAnalysis[];
  createdAt: string;
}

/** 公共区里两个图之间的连线，连线本身就是一条新灵感 */
export interface BoardLink {
  id: string;
  fromItemId: string;
  toItemId: string;
  /** 最终定下来的新灵感 */
  note: string;
  /** AI 生成的完整新灵感场景策划 */
  plan: string;
  createdAt: string;
}

export interface Board {
  items: BoardItem[];
  links: BoardLink[];
  /** 由多个组成元素连成的一组，补全后的完整想法记在这里 */
  groups: BoardGroup[];
}

export interface BoardGroup {
  id: string;
  /** 参与这组的组成元素，两个或更多 */
  memberIds: string[];
  /** 这组用到的元素摘要 */
  note: string;
  /** 补全后的完整想法 */
  plan: string;
  createdAt: string;
}

/** 推荐去找例图的站点 */
export interface SiteRecommendation {
  id: string;
  name: string;
  category: ReferenceCategory;
  /** 带 {q} 占位符的搜索直达链接 */
  searchUrl: string;
  /** 这个站适合找什么 */
  what: string;
  /** 使用提示，例如需要登录、能否直链下载 */
  note: string;
}

export interface AiAnalyzeRequest {
  projectId: string;
  referenceId: string;
  dimensions: AnalysisDimension[];
}

export interface AiAnalyzeResponse {
  items: Array<{ dimension: AnalysisDimension; text: string }>;
  model: string;
}

/** 参考图的三类用途 */
export type ReferenceCategory = "abstract" | "artwork" | "cosplay";

export const REFERENCE_CATEGORY_LABEL: Record<ReferenceCategory, string> = {
  abstract: "抽象风格画作",
  artwork: "优秀原画",
  cosplay: "优秀 Cos 作品",
};

/** 一张参考图的登记信息 */
export interface ReferenceImage {
  id: string;
  category: ReferenceCategory;
  /** 原图内容的 sha256，用于去重 */
  hash: string;
  /** 本地相对路径，指向 assets/refs 下的文件 */
  file: string;
  /** 缩略图相对路径，未生成时为空 */
  thumb: string;
  sourceUrl: string;
  sourceSite: string;
  author: string;
  note: string;
  addedAt: string;
}

/** 可提取的分析维度 */
export type AnalysisDimension =
  | "layout"
  | "background"
  | "mood"
  | "lighting"
  | "lens"
  | "props"
  | "color"
  | "styling"
  | "composition";

export const DIMENSION_LABEL: Record<AnalysisDimension, string> = {
  layout: "整体布局",
  background: "背景场景",
  mood: "氛围感",
  lighting: "布光",
  lens: "镜头与景深",
  props: "道具",
  color: "色调",
  styling: "服装",
  composition: "构图",
};

/** 一条灵感作用在拍摄的哪个环节 */
export type IdeaTarget = "styling" | "lighting" | "lens" | "composition" | "props" | "post";

export const IDEA_TARGET_LABEL: Record<IdeaTarget, string> = {
  styling: "造型",
  lighting: "光线",
  lens: "镜头",
  composition: "构图",
  props: "道具",
  post: "后期",
};

/** 一条灵感，来源必须可追溯 */
export interface Idea {
  id: string;
  text: string;
  /** 人写的还是 AI 推荐的 */
  origin: "human" | "ai";
  /** 来自哪张参考图，人写且无来源时为空 */
  sourceImageId: string | null;
  /** 来自哪些分析维度 */
  dimensions: AnalysisDimension[];
  /** 作用于拍摄的哪个环节 */
  appliesTo: IdeaTarget;
  adopted: boolean;
  createdAt: string;
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** 当前停留在哪个阶段 */
  currentStage: StageId;
  /** 已完成并被人确认的阶段 */
  completedStages: StageId[];
  brief: BriefInput;
  /** 已登记的参考例图 */
  references: ReferenceImage[];
  /** 公共区：从口袋取用的图，以及它们之间的连线 */
  board: Board;
  /** S1 选定的城市、日期、场地与时段 */
  plan: ShootPlan;
  /** S2 的人物档案与主题定调 */
  research: ProjectResearch;
  /** S5 收拢定稿的灵感清单 */
  ideaList: IdeaEntry[];
  /** S6 每条灵感对应的布光方案 */
  lighting: LightingPlan[];
}

/** 一个灯位 */
export interface LightingUnit {
  id: string;
  /** 灯位代号与作用，例如 A 主光 */
  title: string;
  /** 灯具、功率、附件、位置与作用 */
  detail: string;
}

/**
 * S6 的布光方案，每条对应 S5 里的一条灵感：
 * 可以上传自己画的灯位图，也可以让 AI 给出推荐灯位文本，两者可并存。
 */
export interface LightingPlan {
  ideaId: string;
  units: LightingUnit[];
  /** 人的补充说明，例如现场限制 */
  note: string;
  /** 上传的灯位图，相对 assets/uploads 的路径，没有则为空 */
  image: string;
}

/**
 * S5 里的一条灵感。每条都必须能反查到来源：
 * - 单个完整想法：source=idea，sourceId 指向那张图
 * - 若干组成元素连成的一组：source=group，sourceId 指向那一组
 * referenceIds 记录这条灵感对应的参考图，做到与图一一对应。
 */
export interface IdeaEntry {
  id: string;
  source: "idea" | "group";
  sourceId: string;
  referenceIds: string[];
  /** 用到的元素名 */
  elements: string[];
  /** 灵感正文 */
  text: string;
  /** 完整策划 */
  plan: string;
  /** 作用在拍摄的哪个环节 */
  appliesTo: IdeaTarget[];
  /** 是否纳入定稿 */
  adopted: boolean;
}

/** S1 选址与时间的结果 */
export interface ShootPlan {
  city: string;
  /** YYYY-MM-DD */
  date: string;
  venue: string;
  timeWindow: string;
}

export interface CityInfo {
  name: string;
  lat: number;
  lon: number;
  /** 标准时区偏移，单位小时 */
  tz: number;
}

/** S2 的结果：人物档案与主题定调 */
export interface ProjectResearch {
  character: string;
  theme: string;
}

/** 本地算出来的日出日落与特殊时段 */
export interface SunTimes {
  sunrise: string | null;
  sunset: string | null;
  solarNoon: string | null;
  goldenMorning: [string, string] | null;
  goldenEvening: [string, string] | null;
  blueMorning: [string, string] | null;
  blueEvening: [string, string] | null;
  dayLength: string | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  currentStage: StageId;
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  version: string;
  /** 项目根目录的绝对路径 */
  projectsRoot: string;
  /** 是否已经配置 AI 密钥 */
  aiConfigured: boolean;
}
