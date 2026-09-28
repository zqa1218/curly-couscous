import { useState } from "react";

import type { ProjectSummary } from "@studio/shared";

import styles from "./ProjectBar.module.css";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface ProjectBarProps {
  projects: ProjectSummary[];
  currentId: string | null;
  saveState: SaveState;
  savedAt: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onOpenSettings: () => void;
}

const SAVE_TEXT: Record<SaveState, string> = {
  idle: "",
  saving: "正在保存",
  saved: "已保存",
  error: "保存失败",
};

export function ProjectBar({
  projects,
  currentId,
  saveState,
  savedAt,
  onSelect,
  onCreate,
  onOpenSettings,
}: ProjectBarProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) {
      return;
    }
    setBusy(true);
    try {
      await onCreate(trimmed);
      setName("");
      setCreating(false);
    } finally {
      setBusy(false);
    }
  };

  if (creating) {
    return (
      <div className={styles.bar}>
        <label className={styles.label} htmlFor="new-project-name">
          新企划名称
        </label>
        <input
          id="new-project-name"
          className={styles.input}
          value={name}
          autoFocus
          placeholder="例如 秋日人像样片"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void submit();
            }
            if (event.key === "Escape") {
              setCreating(false);
            }
          }}
        />
        <button
          type="button"
          className={styles.primary}
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "创建中" : "创建"}
        </button>
        <button type="button" className={styles.ghost} onClick={() => setCreating(false)}>
          取消
        </button>
      </div>
    );
  }

  return (
    <div className={styles.bar}>
      <label className={styles.label} htmlFor="project-select">
        当前企划
      </label>
      <select
        id="project-select"
        className={styles.select}
        value={currentId ?? ""}
        onChange={(event) => onSelect(event.target.value)}
      >
        {projects.length === 0 ? <option value="">还没有企划</option> : null}
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <button type="button" className={styles.ghost} onClick={() => setCreating(true)}>
        新建企划
      </button>
      <button type="button" className={styles.ghost} onClick={onOpenSettings}>
        AI 设置
      </button>
      {saveState !== "idle" ? (
        <span className={styles.save} data-state={saveState}>
          {SAVE_TEXT[saveState]}
          {saveState === "saved" && savedAt ? ` ${savedAt}` : ""}
        </span>
      ) : null}
    </div>
  );
}
