import type { StageDefinition } from "@studio/shared";

import styles from "./AiDock.module.css";

interface AiDockProps {
  stage: StageDefinition;
  model: string;
  configured: boolean;
}

export function AiDock({ stage, model, configured }: AiDockProps) {
  return (
    <aside className={styles.dock} aria-label="AI 提议">
      <header className={styles.head}>
        <span className={styles.title}>AI 提议</span>
        <span className={styles.model} title={model}>
          {model}
        </span>
      </header>

      <div className={styles.body}>
        <p className={styles.lead}>
          AI 的说法先落在这里，你点采纳之后才会写进企划数据。
        </p>

        <div className={styles.empty}>
          <p className={styles.emptyTitle}>还没有提议</p>
          <p className={styles.emptyText}>
            {configured
              ? `${stage.id} 开始之后，AI 生成的候选会出现在这一栏。`
              : "还没配置 DeepSeek 密钥，这一栏暂时不会出东西，流程仍然可以手动走完。"}
          </p>
        </div>

        <dl className={styles.legend}>
          <div>
            <dt>采纳</dt>
            <dd>写进企划数据，后续阶段都会用到</dd>
          </div>
          <div>
            <dt>改写</dt>
            <dd>改完再采纳，保留 AI 的原始版本</dd>
          </div>
          <div>
            <dt>忽略</dt>
            <dd>只是丢掉这条提议，不影响已有内容</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
