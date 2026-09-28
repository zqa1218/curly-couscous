import { useEffect, useState } from "react";

import { AI_DEFAULTS_HINT } from "@/lib/constants";
import { api, type PublicSettings } from "@/lib/api";

import styles from "./SettingsDialog.module.css";

interface SettingsDialogProps {
  open: boolean;
  initial: PublicSettings | null;
  onClose: () => void;
  onSaved: (settings: PublicSettings) => void;
}

export function SettingsDialog({ open, initial, onClose, onSaved }: SettingsDialogProps) {
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? AI_DEFAULTS_HINT.baseUrl);
  const [textModel, setTextModel] = useState(initial?.textModel ?? AI_DEFAULTS_HINT.textModel);
  const [visionModel, setVisionModel] = useState(initial?.visionModel ?? AI_DEFAULTS_HINT.visionModel);
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(initial?.hasApiKey ?? false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  // 每次打开都从服务端取一次最新值，避免用到页面上过期的设置
  useEffect(() => {
    if (!open) {
      return;
    }
    let alive = true;
    setApiKey("");
    setState("idle");
    setMessage(null);
    api
      .settings()
      .then((fresh) => {
        if (!alive) {
          return;
        }
        setBaseUrl(fresh.baseUrl);
        setTextModel(fresh.textModel);
        setVisionModel(fresh.visionModel);
        setHasKey(fresh.hasApiKey);
      })
      .catch(() => {
        /* 读不到就保留当前值，保存时服务端仍会校验 */
      });
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const save = async () => {
    setState("saving");
    setMessage(null);
    try {
      const saved = await api.updateSettings({
        baseUrl,
        textModel,
        visionModel,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      onSaved(saved);
      setApiKey("");
      setHasKey(saved.hasApiKey);
      setState("saved");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "保存失败");
    }
  };

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="AI 设置"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.head}>
          <h2 className={styles.title}>AI 设置</h2>
          <button type="button" className={styles.close} onClick={onClose}>
            关闭
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="settings-base-url">
              接口地址
            </label>
            <input
              id="settings-base-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="settings-api-key">
              API 密钥
            </label>
            <input
              id="settings-api-key"
              type="password"
              value={apiKey}
              placeholder={hasKey ? "已配置，留空表示不改动" : "粘贴 DeepSeek 的 API key"}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <p className={styles.hint}>密钥只存在本机的 data/settings.json，不会打包进前端，也不进版本库。</p>
          </div>

          <div className={styles.pair}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="settings-text-model">
                文本模型
              </label>
              <input
                id="settings-text-model"
                value={textModel}
                onChange={(event) => setTextModel(event.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="settings-vision-model">
                视觉模型
              </label>
              <input
                id="settings-vision-model"
                value={visionModel}
                onChange={(event) => setVisionModel(event.target.value)}
              />
            </div>
          </div>

          <p className={styles.note}>
            图片分析用视觉模型。DeepSeek 目前只有 flash 支持图片输入，pro 不支持，不要把视觉模型改成 pro。
          </p>

          {message ? <p className={styles.error}>{message}</p> : null}
          {state === "saved" ? <p className={styles.ok}>已保存</p> : null}
        </div>

        <footer className={styles.foot}>
          <button type="button" className={styles.primary} disabled={state === "saving"} onClick={() => void save()}>
            {state === "saving" ? "保存中" : "保存设置"}
          </button>
        </footer>
      </div>
    </div>
  );
}
