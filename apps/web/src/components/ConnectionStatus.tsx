import styles from "./ConnectionStatus.module.css";

interface ConnectionStatusProps {
  state: "loading" | "ready" | "error";
  detail: string;
  aiConfigured: boolean;
}

export function ConnectionStatus({ state, detail, aiConfigured }: ConnectionStatusProps) {
  const label =
    state === "loading" ? "正在连接本地服务" : state === "ready" ? "本地服务已连接" : "本地服务未连接";

  return (
    <>
      <span className={styles.item}>
        <span className={styles.dot} data-state={state} aria-hidden="true" />
        {label}
      </span>
      <span className={styles.item}>
        {aiConfigured ? "已配置 AI 密钥" : "未配置 AI 密钥"}
      </span>
      <span className={styles.path} title={detail}>
        {detail}
      </span>
    </>
  );
}
