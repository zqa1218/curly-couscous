import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * DeepSeek 官方接口。注意：只有 deepseek-flash 支持图片输入，
 * deepseek-v4-pro 不支持视觉，视觉相关调用不要指向它。
 */
export const AI_DEFAULTS = {
  baseUrl: "https://api.deepseek.com",
  textModel: "deepseek-flash",
  visionModel: "deepseek-flash",
} as const;

export interface AiSettings {
  baseUrl: string;
  apiKey: string;
  textModel: string;
  visionModel: string;
}

/** 返回给前端的设置，密钥只暴露是否已配置 */
export interface PublicSettings {
  baseUrl: string;
  textModel: string;
  visionModel: string;
  hasApiKey: boolean;
}

const DEFAULT_SETTINGS: AiSettings = {
  baseUrl: AI_DEFAULTS.baseUrl,
  apiKey: "",
  textModel: AI_DEFAULTS.textModel,
  visionModel: AI_DEFAULTS.visionModel,
};

export function readSettings(settingsPath: string): AiSettings {
  if (!existsSync(settingsPath)) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const raw = JSON.parse(readFileSync(settingsPath, "utf8")) as Partial<AiSettings>;
    return {
      baseUrl: raw.baseUrl?.trim() || DEFAULT_SETTINGS.baseUrl,
      apiKey: raw.apiKey?.trim() || "",
      textModel: raw.textModel?.trim() || DEFAULT_SETTINGS.textModel,
      visionModel: raw.visionModel?.trim() || DEFAULT_SETTINGS.visionModel,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settingsPath: string, patch: Partial<AiSettings>): AiSettings {
  const current = readSettings(settingsPath);
  const next: AiSettings = {
    baseUrl: patch.baseUrl?.trim() || current.baseUrl,
    // 空字符串代表用户没有改动密钥，保持原值
    apiKey: patch.apiKey === undefined ? current.apiKey : patch.apiKey.trim(),
    textModel: patch.textModel?.trim() || current.textModel,
    visionModel: patch.visionModel?.trim() || current.visionModel,
  };
  mkdirSync(path.dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export function toPublicSettings(settings: AiSettings): PublicSettings {
  return {
    baseUrl: settings.baseUrl,
    textModel: settings.textModel,
    visionModel: settings.visionModel,
    hasApiKey: settings.apiKey.length > 0,
  };
}
