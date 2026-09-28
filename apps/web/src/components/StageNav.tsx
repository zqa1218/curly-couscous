import type { StageDefinition, StageId } from "@studio/shared";

import styles from "./StageNav.module.css";

interface StageNavProps {
  stages: StageDefinition[];
  current: StageId;
  completed: StageId[];
  onSelect: (id: StageId) => void;
}

export function StageNav({ stages, current, completed, onSelect }: StageNavProps) {
  const currentIndex = stages.findIndex((stage) => stage.id === current);

  return (
    <nav className={styles.nav} aria-label="企划阶段">
      <div className={styles.heading}>
        <span className={styles.headingLabel}>企划流程</span>
        <span className={styles.headingCount}>
          {currentIndex + 1} / {stages.length}
        </span>
      </div>
      <ol className={styles.list}>
        {stages.map((stage) => {
          const isCurrent = stage.id === current;
          const isDone = completed.includes(stage.id);
          return (
            <li key={stage.id}>
              <button
                type="button"
                className={styles.item}
                data-current={isCurrent || undefined}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onSelect(stage.id)}
              >
                <span className={styles.code}>{stage.id}</span>
                <span className={styles.label}>{stage.title}</span>
                <span
                  className={styles.state}
                  data-state={isDone ? "done" : isCurrent ? "current" : "idle"}
                  aria-hidden="true"
                />
              </button>
            </li>
          );
        })}
      </ol>
      <p className={styles.footnote}>
        每一步都由 AI 先给候选，你点采纳之后才写进企划数据。
      </p>
    </nav>
  );
}
