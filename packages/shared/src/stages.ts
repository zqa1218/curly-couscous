export type StageId = "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7";

export type StageKind = "input" | "choice" | "board" | "table" | "export";

export interface StageDefinition {
  id: StageId;
  /** 阶段导航里显示的名字 */
  title: string;
  /** 一句话说明这个阶段要产出什么 */
  produce: string;
  /** 交互形态，决定主工作区渲染哪一种工作台 */
  kind: StageKind;
  /** 人在这个阶段要做出的决定 */
  decision: string;
}

export const STAGES: StageDefinition[] = [
  {
    id: "S0",
    title: "立项输入",
    produce: "项目卡与信息缺口清单",
    kind: "input",
    decision: "确认输入没有理解偏差",
  },
  {
    id: "S1",
    title: "选址与时间",
    produce: "场地候选与最佳时段",
    kind: "choice",
    decision: "选定主场地与备选场地",
  },
  {
    id: "S2",
    title: "人物与主题",
    produce: "角色档案与主题定调方向",
    kind: "choice",
    decision: "主题方向定稿",
  },
  {
    id: "S3",
    title: "参考例图",
    produce: "参考图库与来源索引",
    kind: "table",
    decision: "选定进入黑板的图",
  },
  {
    id: "S4",
    title: "黑板",
    produce: "标注画布与灵感草案",
    kind: "board",
    decision: "采纳哪些分析与灵感",
  },
  {
    id: "S5",
    title: "灵感归档",
    produce: "带来源标注的灵感清单",
    kind: "table",
    decision: "灵感清单定稿",
  },
  {
    id: "S6",
    title: "布光",
    produce: "布光图与灯位说明表",
    kind: "table",
    decision: "灯位确认",
  },
  {
    id: "S7",
    title: "导出方案",
    produce: "图文 PDF 与 docx",
    kind: "export",
    decision: "定稿验收",
  },
];

export const STAGE_IDS: StageId[] = STAGES.map((stage) => stage.id);

export function getStage(id: StageId): StageDefinition {
  const stage = STAGES.find((item) => item.id === id);
  if (!stage) {
    throw new Error(`未知阶段：${id}`);
  }
  return stage;
}
