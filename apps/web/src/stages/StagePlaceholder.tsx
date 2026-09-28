import type { StageDefinition, StageKind } from "@studio/shared";

import styles from "./StagePlaceholder.module.css";

/** 每个阶段的工作台会长成什么样，先写清楚，开发时按这个往里填 */
const KIND_CONTENT: Record<StageKind, { lead: string; items: string[] }> = {
  input: {
    lead: "左边填原始信息，右边实时回显 AI 理解成的项目卡。",
    items: [
      "人物或角色：名字、参考照片、要表现的气质",
      "道具：必须出现的物件，以及它们的材质和颜色",
      "风格关键词：一个词也能开工，例如日系、港风、赛博",
      "焦段与光圈：整组图打算用什么镜头语言，例如 35mm f/2、85mm f/1.4",
      "拍摄手法与实拍场景的设想：外景还是棚拍，想要什么机位",
      "后期想加的东西：特效、合成、色调方向",
    ],
  },
  choice: {
    lead: "AI 给一批候选，每条都写清依据，你挑一条或几条。",
    items: [
      "候选卡：一句话主张、视觉走向、可执行的建议",
      "每个候选项都能追溯到它依据的哪条输入或资料",
      "可以只采纳其中一部分，剩余部分留在面板里备查",
      "被否决的候选保留记录，避免后面重复讨论",
    ],
  },
  table: {
    lead: "用表格整理数量和来源，方便核对有没有漏项。",
    items: [
      "每一行都能点回它对应的原始材料",
      "支持筛选、排序和批量标记",
      "导出这一张表，作为后续阶段的输入",
    ],
  },
  board: {
    lead: "整屏让给画布，图片可以随便摆，连线跟着图走。",
    items: [
      "选中一张图，右侧出现维度勾选，只分析你勾的部分",
      "分析结果作为注释卡贴在图片旁边，并用箭头绑定",
      "注释卡之间可以再连线，把抽象出来的概念串起来",
      "可以直接在画布上手写新灵感",
    ],
  },
  export: {
    lead: "先预览整份文档，确认无误再导出。",
    items: [
      "按人物地点时间、主题风格、前后期目标、例图、灵感、布光图排序",
      "每条灵感标注来源图和来源维度",
      "导出前逐页检查分页和图片位置",
      "同时输出 PDF 与可继续编辑的 docx",
    ],
  },
};

interface StagePlaceholderProps {
  stage: StageDefinition;
}

export function StagePlaceholder({ stage }: StagePlaceholderProps) {
  const content = KIND_CONTENT[stage.kind];

  return (
    <div className={styles.panel}>
      <p className={styles.lead}>{content.lead}</p>
      <ul className={styles.list}>
        {content.items.map((item) => (
          <li key={item} className={styles.item}>
            {item}
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        当前是 M0 骨架，{stage.id} 的实际功能会在对应里程碑接入，接入之后这块区域就是正式工作台。
      </p>
    </div>
  );
}
