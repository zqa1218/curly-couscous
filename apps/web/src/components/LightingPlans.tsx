import { useEffect, useRef, useState } from "react";

import type { AiSuggestion, LightingPlan, LightingUnit, ProjectMeta } from "@studio/shared";

import { api, assetUrl } from "@/lib/api";
import { newId } from "@/lib/id";

import { AiAssistBlock } from "./AiAssistBlock";
import styles from "./LightingPlans.module.css";

interface LightingPlansProps {
  project: ProjectMeta;
  saving: boolean;
  onSave: (plans: LightingPlan[]) => Promise<void>;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

const EMPTY: LightingPlan = { ideaId: "", units: [], note: "", image: "" };

export function LightingPlans({ project, saving, onSave }: LightingPlansProps) {
  const [plans, setPlans] = useState<LightingPlan[]>(project.lighting);
  const [demands, setDemands] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setPlans(project.lighting);
  }, [project.id, project.lighting]);

  const ideas = project.ideaList.filter((entry) => entry.adopted);
  const dirty = JSON.stringify(plans) !== JSON.stringify(project.lighting);

  const planOf = (ideaId: string): LightingPlan =>
    plans.find((plan) => plan.ideaId === ideaId) ?? { ...EMPTY, ideaId };

  const patch = (ideaId: string, changes: Partial<LightingPlan>) => {
    setPlans((current) => {
      const existing = current.find((plan) => plan.ideaId === ideaId);
      if (existing) {
        return current.map((plan) => (plan.ideaId === ideaId ? { ...plan, ...changes } : plan));
      }
      return [...current, { ...EMPTY, ideaId, ...changes }];
    });
  };

  const uploadImage = async (ideaId: string, file: File) => {
    setBusy(ideaId);
    setError(null);
    try {
      if (file.size > 25 * 1024 * 1024) {
        throw new Error("图片超过 25MB，先压缩再上传");
      }
      const dataUrl = await readAsDataUrl(file);
      const result = await api.upload(project.id, dataUrl);
      patch(ideaId, { image: result.path });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "上传失败");
    } finally {
      setBusy(null);
    }
  };

  const adoptUnits = (ideaId: string, items: AiSuggestion[]) => {
    const units: LightingUnit[] = items.map((item) => ({
      id: newId(),
      title: item.title,
      detail: item.detail,
    }));
    const current = planOf(ideaId);
    patch(ideaId, { units: [...current.units, ...units] });
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.head}>
        <div>
          <h2 className={styles.title}>布光方案</h2>
          <p className={styles.sub}>
            每条定稿灵感对应一份布光。两种方式可以选一种，也可以都用：上传你自己画好的灯位图，或者写清要求让
            AI 给出推荐灯位，再照着把灯架起来。
          </p>
        </div>
        <span className={styles.count}>
          定稿灵感 {ideas.length} 条 · 已有布光 {plans.filter((p) => p.units.length > 0 || p.image).length} 条
        </span>
      </section>

      {ideas.length === 0 ? (
        <p className={styles.empty}>
          还没有定稿灵感。先去 S5 灵感归档，从公共区同步并把要用的灵感纳入定稿，再回到这里配布光。
        </p>
      ) : (
        <ul className={styles.list}>
          {ideas.map((idea, index) => {
            const plan = planOf(idea.id);
            const summary = idea.text || idea.plan || "（这条灵感还没有正文）";
            return (
              <li key={idea.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.index}>灵感 {index + 1}</span>
                  <span className={styles.sourceTag} data-source={idea.source}>
                    {idea.source === "idea" ? "完整想法" : `组成元素组 · ${idea.referenceIds.length} 张`}
                  </span>
                </div>

                <div className={styles.ideaRow}>
                  <div className={styles.ideaSources}>
                    {idea.referenceIds.map((referenceId) => {
                      const reference = project.references.find((item) => item.id === referenceId);
                      if (!reference) {
                        return null;
                      }
                      return (
                        <img
                          key={referenceId}
                          className={styles.ideaThumb}
                          src={assetUrl(project.id, reference.thumb || reference.file)}
                          alt={reference.note || reference.author || "来源参考图"}
                          loading="lazy"
                        />
                      );
                    })}
                  </div>
                  <p className={styles.ideaText}>{summary.slice(0, 180)}</p>
                </div>

                <div className={styles.columns}>
                  <div className={styles.column}>
                    <h3 className={styles.columnTitle}>方式一 · 上传灯位图</h3>
                    {plan.image ? (
                      <>
                        <img
                          className={styles.diagram}
                          src={assetUrl(project.id, plan.image)}
                          alt="上传的灯位图"
                        />
                        <button
                          type="button"
                          className={styles.ghost}
                          onClick={() => patch(idea.id, { image: "" })}
                        >
                          移除这张图
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={styles.ghost}
                          disabled={busy === idea.id}
                          onClick={() => inputs.current[idea.id]?.click()}
                        >
                          {busy === idea.id ? "上传中" : "选择灯位图"}
                        </button>
                        <input
                          ref={(node) => {
                            inputs.current[idea.id] = node;
                          }}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void uploadImage(idea.id, file);
                            }
                            event.target.value = "";
                          }}
                        />
                      </>
                    )}
                    <p className={styles.hint}>自己画的俯视灯位图、现场照片或手绘扫描件都行。</p>
                  </div>

                  <div className={styles.column}>
                    <h3 className={styles.columnTitle}>方式二 · 让 AI 推荐灯位</h3>
                    <textarea
                      className={styles.demand}
                      rows={3}
                      value={demands[idea.id] ?? ""}
                      placeholder="写下你对布光的要求，例如：只有一盏灯、要保留窗光的层次、预算有限"
                      onChange={(event) =>
                        setDemands((current) => ({ ...current, [idea.id]: event.target.value }))
                      }
                    />
                    <AiAssistBlock
                      task="lighting"
                      brief={project.brief}
                      existing={[summary, demands[idea.id]].filter(Boolean).join("\n\n")}
                      mode="multi"
                      buttonLabel="AI 推荐灯位方案"
                      onAdopt={(items) => adoptUnits(idea.id, items)}
                    />
                    <p className={styles.hint}>
                      建议按灯位逐条给出，采纳后就是下面那张灯位表；不写要求也可以直接生成。
                    </p>
                  </div>
                </div>

                {plan.units.length > 0 ? (
                  <table className={styles.units}>
                    <tbody>
                      {plan.units.map((unit) => (
                        <tr key={unit.id}>
                          <th>{unit.title}</th>
                          <td>{unit.detail}</td>
                          <td className={styles.unitAction}>
                            <button
                              type="button"
                              className={styles.linkBtn}
                              onClick={() =>
                                patch(idea.id, {
                                  units: plan.units.filter((item) => item.id !== unit.id),
                                })
                              }
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}

                <label className={styles.noteField}>
                  <span>现场备注</span>
                  <textarea
                    rows={2}
                    value={plan.note}
                    placeholder="例如：现场只有两个插座、天花板不能固定"
                    onChange={(event) => patch(idea.id, { note: event.target.value })}
                  />
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={!dirty || saving || ideas.length === 0}
          onClick={() => void onSave(plans)}
        >
          {saving ? "保存中" : dirty ? "保存布光方案" : "已是最新"}
        </button>
        <span className={styles.status}>
          {dirty ? "有未保存的修改" : "布光方案会进入 S7 的最终方案"}
        </span>
      </div>
    </div>
  );
}
