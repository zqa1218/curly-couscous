import { useState } from "react";

import type { ProjectMeta } from "@studio/shared";

import styles from "./ExportPanel.module.css";

interface ExportPanelProps {
  project: ProjectMeta;
}

interface ExportResult {
  docx: string;
  pdf: string;
  fileStem: string;
}

export function ExportPanel({ project }: ExportPanelProps) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const adopted = project.ideaList.filter((entry) => entry.adopted);
  const lightingCount = project.lighting.filter(
    (plan) => plan.units.length > 0 || plan.image,
  ).length;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await response.json()) as ExportResult & { message?: string };
      if (!response.ok) {
        throw new Error(body.message ?? "导出失败");
      }
      setResult(body);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "导出失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <h2 className={styles.title}>将要导出的内容</h2>
        <ul className={styles.checklist}>
          <li>项目概览：人物、道具、场景、风格、焦段与光圈、拍摄手法、前后期效果</li>
          <li>
            时间与地点：{project.plan.city || "未填城市"} {project.plan.date || "未填日期"}，
            含日出日落与黄金、蓝调时刻
          </li>
          <li>人物与主题：档案与主题定调</li>
          <li>
            灵感与来源：{adopted.length} 条定稿灵感，每条带来源图与抽离出的元素
          </li>
          <li>布光：{lightingCount} 条灵感配了灯位表或灯位图</li>
        </ul>

       {(adopted.length === 0 || lightingCount === 0) && (
          <p className={styles.warn}>
            提示：{adopted.length === 0 ? "还没有定稿灵感（去 S5）" : ""}
            {adopted.length === 0 && lightingCount === 0 ? "，" : ""}
            {lightingCount === 0 ? "还没有配布光（去 S6）" : ""}
            ，导出的方案里对应章节会是空的。
          </p>
        )}
      </section>

      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={busy} onClick={() => void run()}>
          {busy ? "正在生成，需要几十秒" : "导出方案"}
        </button>
        <span className={styles.hint}>
          生成一份 docx 与一份 PDF，落在企划目录的 output 下，可以反复导出覆盖。
        </span>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {result ? (
        <section className={styles.result}>
          <h2 className={styles.title}>导出完成</h2>
          <p className={styles.fileName}>{result.fileStem}</p>
          <div className={styles.links}>
            {result.pdf ? (
              <a className={styles.download} href={result.pdf} target="_blank" rel="noreferrer">
                打开 PDF
              </a>
            ) : (
              <span className={styles.missing}>PDF 没生成成功，docx 仍可下载</span>
            )}
            <a className={styles.download} href={result.docx} target="_blank" rel="noreferrer">
              下载 docx
            </a>
          </div>
        </section>
      ) : null}
    </div>
  );
}
