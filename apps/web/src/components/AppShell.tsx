import type { ReactNode } from "react";

import styles from "./AppShell.module.css";

interface AppShellProps {
  project: ReactNode;
  status: ReactNode;
  nav: ReactNode;
  workspace: ReactNode;
  dock: ReactNode;
}

export function AppShell({ project, status, nav, workspace, dock }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandName}>印样台</span>
          <span className={styles.brandDivider} aria-hidden="true" />
          <span className={styles.brandSub}>摄影企划工作台</span>
        </div>
        <div className={styles.project}>{project}</div>
        <div className={styles.status}>{status}</div>
      </header>
      <div className={styles.columns}>
        {nav}
        {workspace}
        {dock}
      </div>
    </div>
  );
}
