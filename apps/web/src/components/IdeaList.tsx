import { useEffect, useState } from "react";

import {
  IDEA_TARGET_LABEL,
  type IdeaEntry,
  type IdeaTarget,
  type ProjectMeta,
} from "@studio/shared";

import { assetUrl } from "@/lib/api";
import { newId } from "@/lib/id";

import styles from "./IdeaList.module.css";

const TARGETS: IdeaTarget[] = ["styling", "lighting", "lens", "composition", "props", "post"];

interface IdeaListProps {
  project: ProjectMeta;
  saving: boolean;
  onSave: (list: IdeaEntry[]) => Promise<void>;
}

/** 把公共区里的完整想法与分组结果收拢成一份清单，已存在的条目保留人的改动 */
function collect(project: ProjectMeta, existing: IdeaEntry[]): IdeaEntry[] {
  const previous = new Map(existing.map((entry) => [entry.sourceId, entry]));
  const itemsById = new Map(project.board.items.map((item) => [item.id, item]));
  const result: IdeaEntry[] = [];

  for (const item of project.board.items) {
    if (item.kind !== "idea") {
      continue;
    }
    const before = previous.get(item.id);
    result.push({
      id: before?.id ?? newId(),
      source: "idea",
      sourceId: item.id,
      referenceIds: [item.referenceId],
      elements: item.elements.map((element) => element.name),
      text: before?.text ?? item.note,
      plan: before?.plan ?? item.plan,
      appliesTo: before?.appliesTo ?? [],
      adopted: before?.adopted ?? true,
    });
  }

  for (const group of project.board.groups) {
    const before = previous.get(group.id);
    const referenceIds = [
      ...new Set(
        group.memberIds
          .map((id) => itemsById.get(id)?.referenceId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const elements = [
      ...new Set(
        group.memberIds.flatMap(
          (id) => itemsById.get(id)?.elements.map((element) => element.name) ?? [],
        ),
      ),
    ];
    result.push({
      id: before?.id ?? newId(),
      source: "group",
      sourceId: group.id,
      referenceIds,
      elements,
      text: before?.text ?? "",
      plan: before?.plan ?? group.plan,
      appliesTo: before?.appliesTo ?? [],
      adopted: before?.adopted ?? true,
    });
  }

  return result;
}

export function IdeaList({ project, saving, onSave }: IdeaListProps) {
  const [list, setList] = useState<IdeaEntry[]>(project.ideaList);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    setList(project.ideaList);
  }, [project.id, project.ideaList]);

  const dirty = JSON.stringify(list) !== JSON.stringify(project.ideaList);
  const adoptedCount = list.filter((entry) => entry.adopted).length;

  const patch = (id: string, changes: Partial<IdeaEntry>) => {
    setList((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)),
    );
  };

  const syncFromBoard = () => {
    setList((current) => collect(project, current));
    setSyncedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.head}>
        <div>
          <h2 className={styles.title}>灵感清单</h2>
          <p className={styles.sub}>
            来源分两种：公共区里已经补全的<b>完整想法</b>，以及若干组成元素连成一组后补全的结果。
            每条都带着它的来源图，做到与图一一对应。
          </p>
        </div>
        <div className={styles.headActions}>
          <button type="button" className={styles.primary} onClick={syncFromBoard}>
            从公共区同步
          </button>
          <span className={styles.count}>
            共 {list.length} 条 · 定稿 {adoptedCount} 条
            {syncedAt ? ` · 上次同步 ${syncedAt}` : ""}
          </span>
        </div>
      </section>

      {list.length === 0 ? (
        <p className={styles.empty}>
          还没有灵感。回到 S4 公共区，把补全过的完整想法或分组结果做出来，再点上面的「从公共区同步」。
        </p>
      ) : (
        <ul className={styles.list}>
          {list.map((entry) => (
            <li key={entry.id} className={styles.card} data-dropped={!entry.adopted || undefined}>
              <div className={styles.cardHead}>
                <span className={styles.sourceTag} data-source={entry.source}>
                  {entry.source === "idea"
                    ? "完整想法"
                    : `组成元素组 · ${entry.referenceIds.length} 张`}
                </span>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={entry.adopted ? styles.ghost : styles.primary}
                    onClick={() => patch(entry.id, { adopted: !entry.adopted })}
                  >
                    {entry.adopted ? "移出定稿" : "纳入定稿"}
                  </button>
                  <button
                    type="button"
                    className={styles.ghost}
                    onClick={() =>
                      setList((current) => current.filter((item) => item.id !== entry.id))
                    }
                  >
                    删除
                  </button>
                </div>
              </div>

              <div className={styles.sources}>
                {entry.referenceIds.map((referenceId) => {
                  const reference = project.references.find((item) => item.id === referenceId);
                  if (!reference) {
                    return (
                      <span key={referenceId} className={styles.sourceMissing}>
                        来源图已不在口袋
                      </span>
                    );
                  }
                  return (
                    <figure key={referenceId} className={styles.sourceFigure}>
                      <img
                        src={assetUrl(project.id, reference.thumb || reference.file)}
                        alt={reference.note || reference.author || "来源参考图"}
                        loading="lazy"
                      />
                      <figcaption>
                        {reference.sourceSite || "本地"}
                        {reference.author ? ` · ${reference.author}` : ""}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>

              {entry.elements.length > 0 ? (
                <div className={styles.chips}>
                  {entry.elements.map((element) => (
                    <span key={element} className={styles.chip}>
                      {element}
                    </span>
                  ))}
                </div>
              ) : null}

              <label className={styles.field}>
                <span>灵感正文</span>
                <textarea
                  rows={2}
                  value={entry.text}
                  placeholder="可以在这里补写或改写"
                  onChange={(event) => patch(entry.id, { text: event.target.value })}
                />
              </label>

              <label className={styles.field}>
                <span>完整策划</span>
                <textarea
                  rows={4}
                  value={entry.plan}
                  placeholder="AI 补全或手写的完整方案"
                  onChange={(event) => patch(entry.id, { plan: event.target.value })}
                />
              </label>

              <div className={styles.targets}>
                <span className={styles.targetsLabel}>作用环节</span>
                {TARGETS.map((target) => {
                  const active = entry.appliesTo.includes(target);
                  return (
                    <button
                      key={target}
                      type="button"
                      className={styles.target}
                      data-active={active || undefined}
                      onClick={() =>
                        patch(entry.id, {
                          appliesTo: active
                            ? entry.appliesTo.filter((value) => value !== target)
                            : [...entry.appliesTo, target],
                        })
                      }
                    >
                      {IDEA_TARGET_LABEL[target]}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={!dirty || saving}
          onClick={() => void onSave(list)}
        >
          {saving ? "保存中" : dirty ? "保存灵感清单" : "已是最新"}
        </button>
        <span className={styles.status}>
          {dirty ? "有未保存的修改" : "定稿的灵感会进入 S7 的最终方案"}
        </span>
      </div>
    </div>
  );
}
