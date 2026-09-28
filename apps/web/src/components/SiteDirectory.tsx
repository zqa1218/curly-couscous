import { useMemo, useState } from "react";

import {
  REFERENCE_CATEGORY_LABEL,
  type ReferenceCategory,
  type SiteRecommendation,
} from "@studio/shared";

import styles from "./SiteDirectory.module.css";

interface SiteDirectoryProps {
  sites: SiteRecommendation[];
}

const ORDER: ReferenceCategory[] = ["artwork", "cosplay", "abstract"];

function buildLink(template: string, query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    try {
      return new URL(template).origin;
    } catch {
      return template;
    }
  }
  return template.replace("{q}", encodeURIComponent(trimmed));
}

export function SiteDirectory({ sites }: SiteDirectoryProps) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(
    () =>
      ORDER.map((category) => ({
        category,
        list: sites.filter((site) => site.category === category),
      })).filter((group) => group.list.length > 0),
    [sites],
  );

  return (
    <section className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>去哪里找例图</h2>
          <p className={styles.sub}>
            填一个搜索词，下面每个链接都会带上它。站点大多不允许程序下载，需要你在浏览器里挑好再保存下来导入。
          </p>
        </div>
        <label className={styles.search}>
          <span>搜索词</span>
          <input
            value={query}
            placeholder="角色名、风格或英文标签"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>

      <div className={styles.groups}>
        {grouped.map((group) => (
          <div key={group.category} className={styles.group}>
            <h3 className={styles.groupTitle}>
              {REFERENCE_CATEGORY_LABEL[group.category]}
              <span className={styles.groupHint}>
                {group.category === "artwork"
                  ? "当后期素材与动作参考"
                  : group.category === "cosplay"
                    ? "当动作、风格与后期参考"
                    : "当背景氛围与主题思想参考"}
              </span>
            </h3>
            <ul className={styles.list}>
              {group.list.map((site) => (
                <li key={site.id} className={styles.item}>
                  <a
                    className={styles.link}
                    href={buildLink(site.searchUrl, query)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {site.name}
                  </a>
                  <p className={styles.what}>{site.what}</p>
                  <p className={styles.note}>{site.note}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
