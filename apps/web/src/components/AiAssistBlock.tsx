import { useState } from "react";

import { AI_TASK_LABEL, type AiSuggestion, type AiTask, type BriefInput } from "@studio/shared";

import { api } from "@/lib/api";

import styles from "./AiAssistBlock.module.css";

interface AiAssistBlockProps {
  task: AiTask;
  brief: BriefInput;
  /** 细化类任务需要人已写下的原文 */
  existing?: string;
  /** 多选用于清单类字段，单选用于替换整段文字 */
  mode: "multi" | "single";
  buttonLabel: string;
  onAdopt: (items: AiSuggestion[]) => void;
}

type Phase = "idle" | "loading" | "ready" | "error";

export function AiAssistBlock({
  task,
  brief,
  existing,
  mode,
  buttonLabel,
  onAdopt,
}: AiAssistBlockProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const run = async () => {
    setPhase("loading");
    setMessage(null);
    try {
      const result = await api.suggest({ task, brief, existing });
      setSuggestions(result.suggestions);
      setPicked(result.suggestions.map((_, index) => index));
      setPhase("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 调用失败");
      setPhase("error");
    }
  };

  const reset = () => {
    setPhase("idle");
    setSuggestions([]);
    setPicked([]);
    setMessage(null);
  };

  const adopt = () => {
    const items = suggestions.filter((_, index) => picked.includes(index));
    if (items.length > 0) {
      onAdopt(items);
    }
    reset();
  };

  return (
    <div className={styles.block}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => void run()}
        disabled={phase === "loading"}
      >
        {phase === "loading" ? "AI 正在生成" : buttonLabel}
      </button>

      {phase === "error" && message ? (
        <div className={styles.error}>
          <span>{message}</span>
          <button type="button" className={styles.link} onClick={() => void run()}>
            重试
          </button>
          <button type="button" className={styles.link} onClick={reset}>
            收起
          </button>
        </div>
      ) : null}

      {phase === "ready" ? (
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>{AI_TASK_LABEL[task]}</span>
            <span className={styles.panelHint}>
              {mode === "multi" ? "勾选要加入表单的条目" : "选一条替换当前文字"}
            </span>
          </div>

          <ul className={styles.list}>
            {suggestions.map((item, index) => {
              const active = picked.includes(index);
              return (
                <li key={`${item.title}-${index}`}>
                  <button
                    type="button"
                    className={styles.item}
                    data-active={active || undefined}
                    onClick={() => {
                      setPicked((current) =>
                        mode === "single"
                          ? [index]
                          : active
                            ? current.filter((value) => value !== index)
                            : [...current, index],
                      );
                    }}
                  >
                    <span className={styles.mark} data-active={active || undefined} aria-hidden="true" />
                    <span className={styles.text}>
                      <span className={styles.title}>{item.title}</span>
                      {item.detail ? <span className={styles.detail}>{item.detail}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.primary}
              disabled={picked.length === 0}
              onClick={adopt}
            >
              {mode === "multi" ? `加入选中的 ${picked.length} 项` : "用这条替换"}
            </button>
            <button type="button" className={styles.link} onClick={reset}>
              取消
            </button>
            <button type="button" className={styles.link} onClick={() => void run()}>
              换一批
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
