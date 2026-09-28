import type { StageId } from "@studio/shared";

/** 三段式阶段色：准备（冷）→ 创作（暖）→ 交付（紫绿） */
export const STAGE_ACCENT: Record<StageId, string> = {
  S0: "#6fb3ff",
  S1: "#5cd8c9",
  S2: "#5ec8e8",
  S3: "#ffd166",
  S4: "#ffa96b",
  S5: "#ff9db0",
  S6: "#b39dff",
  S7: "#7fe3a1",
};

export const STAGE_GROUP: Record<StageId, string> = {
  S0: "准备",
  S1: "准备",
  S2: "准备",
  S3: "创作",
  S4: "创作",
  S5: "创作",
  S6: "交付",
  S7: "交付",
};
