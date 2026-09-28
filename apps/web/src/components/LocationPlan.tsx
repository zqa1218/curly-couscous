import { useEffect, useState } from "react";

import type { AiSuggestion, ProjectMeta, ShootPlan, SunTimes } from "@studio/shared";

import { api } from "@/lib/api";

import { AiAssistBlock } from "./AiAssistBlock";
import styles from "./LocationPlan.module.css";

interface LocationPlanProps {
  project: ProjectMeta;
  saving: boolean;
  onSave: (plan: ShootPlan) => Promise<void>;
  onNeedSettings: () => void;
}

function windows(times: SunTimes | null): Array<{ label: string; value: string }> {
  if (!times) {
    return [];
  }
  const list: Array<{ label: string; value: string }> = [];
  if (times.blueMorning) {
    list.push({
      label: "清晨蓝调",
      value: `清晨蓝调时刻 ${times.blueMorning[0]}–${times.blueMorning[1]}`,
    });
  }
  if (times.goldenMorning) {
    list.push({
      label: "早晨黄金时刻",
      value: `早晨黄金时刻 ${times.goldenMorning[0]}–${times.goldenMorning[1]}`,
    });
  }
  if (times.goldenMorning && times.solarNoon) {
    list.push({
      label: "上午",
      value: `上午 ${times.goldenMorning[1]}–${times.solarNoon}`,
    });
  }
  if (times.solarNoon && times.goldenEvening) {
    list.push({
      label: "午后",
      value: `午后 ${times.solarNoon}–${times.goldenEvening[0]}`,
    });
  }
  if (times.goldenEvening) {
    list.push({
      label: "傍晚黄金时刻",
      value: `傍晚黄金时刻 ${times.goldenEvening[0]}–${times.goldenEvening[1]}`,
    });
  }
  if (times.blueEvening) {
    list.push({
      label: "傍晚蓝调",
      value: `傍晚蓝调时刻 ${times.blueEvening[0]}–${times.blueEvening[1]}`,
    });
  }
  return list;
}

/** 用本机日期算偏移后的 ISO 日期，用于快捷选择 */
function isoFromToday(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const QUICK_DATES = [
  { label: "今天", offset: 0 },
  { label: "明天", offset: 1 },
  { label: "一周后", offset: 7 },
];

export function LocationPlan({ project, saving, onSave, onNeedSettings }: LocationPlanProps) {
  const [draft, setDraft] = useState<ShootPlan>(project.plan);
  const [times, setTimes] = useState<SunTimes | null>(null);
  const [solarError, setSolarError] = useState<string | null>(null);
  const [loadingSolar, setLoadingSolar] = useState(false);
  const [resolvedCity, setResolvedCity] = useState("");

  useEffect(() => {
    setDraft(project.plan);
  }, [project.id, project.plan]);

  useEffect(() => {
    const city = draft.city.trim();
    const date = draft.date.trim();
    if (!city || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setTimes(null);
      setSolarError(null);
      return;
    }
    let alive = true;
    setLoadingSolar(true);
    const timer = setTimeout(() => {
      api
        .solar(city, date)
        .then((result) => {
          if (!alive) {
            return;
          }
          setTimes(result.times);
          setResolvedCity(result.city.name);
          setSolarError(null);
        })
        .catch((error: unknown) => {
          if (!alive) {
            return;
          }
          setTimes(null);
          setResolvedCity("");
          setSolarError(error instanceof Error ? error.message : "算不出日出日落");
        })
        .finally(() => {
          if (alive) {
            setLoadingSolar(false);
          }
        });
    }, 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [draft.city, draft.date]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(project.plan);
  const list = windows(times);

  const adoptVenue = (items: AiSuggestion[]) => {
    const first = items[0];
    if (!first) {
      return;
    }
    setDraft((current) => ({
      ...current,
      venue: first.detail ? `${first.title}｜${first.detail}` : first.title,
    }));
  };

  return (
    <form
      className={styles.form}
      data-city={draft.city}
      data-date={draft.date}
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(draft);
      }}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        const enterInInput =
          event.key === "Enter" && !event.shiftKey && target.tagName === "INPUT";
        const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
        if (enterInInput || shortcut) {
          event.preventDefault();
          void onSave(draft);
        }
      }}
    >
      <section className={styles.group}>
        <h2 className={styles.groupTitle}>什么时候拍</h2>
        <div className={styles.pair}>
          <label className={styles.field}>
            <span>城市</span>
            <input
              value={draft.city}
              placeholder="上海"
              onChange={(event) => setDraft({ ...draft, city: event.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span>拍摄日期</span>
            <input
              type="date"
              value={draft.date}
              onChange={(event) => setDraft({ ...draft, date: event.target.value })}
            />
            <div className={styles.quickDates}>
              {QUICK_DATES.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={styles.quickDate}
                  data-active={draft.date === isoFromToday(item.offset) || undefined}
                  onClick={() => setDraft({ ...draft, date: isoFromToday(item.offset) })}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </label>
        </div>

        {loadingSolar ? <p className={styles.hint}>正在算这一天的太阳位置</p> : null}
        {solarError ? <p className={styles.error}>{solarError}</p> : null}

        {times ? (
          <>
            <table className={styles.solar}>
              <tbody>
                <tr>
                  <th>日出</th>
                  <td>{times.sunrise ?? "极夜"}</td>
                  <th>日落</th>
                  <td>{times.sunset ?? "极昼"}</td>
                </tr>
                <tr>
                  <th>正午</th>
                  <td>{times.solarNoon ?? "—"}</td>
                  <th>昼长</th>
                  <td>{times.dayLength ?? "—"}</td>
                </tr>
                <tr>
                  <th>黄金时刻</th>
                  <td colSpan={3}>
                    早 {times.goldenMorning?.[0] ?? "—"}–{times.goldenMorning?.[1] ?? "—"}
                    <span className={styles.gap} />
                    晚 {times.goldenEvening?.[0] ?? "—"}–{times.goldenEvening?.[1] ?? "—"}
                  </td>
                </tr>
                <tr>
                  <th>蓝调时刻</th>
                  <td colSpan={3}>
                    早 {times.blueMorning?.[0] ?? "—"}–{times.blueMorning?.[1] ?? "—"}
                    <span className={styles.gap} />
                    晚 {times.blueEvening?.[0] ?? "—"}–{times.blueEvening?.[1] ?? "—"}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className={styles.hint}>
              上面的时间由程序按{resolvedCity}的经纬度本地算出来（含时区偏移，不考虑夏令时），不是 AI 猜的。
            </p>

            <div className={styles.windows}>
              {list.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={styles.window}
                  data-active={draft.timeWindow === item.value || undefined}
                  onClick={() => setDraft((current) => ({ ...current, timeWindow: item.value }))}
                >
                  {item.label}
                  <span className={styles.windowRange}>{item.value.replace(/^.*时刻\s*/, "")}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className={styles.group}>
        <h2 className={styles.groupTitle}>在哪里拍</h2>

        <label className={styles.field}>
          <span>选定的场地与时段</span>
          <textarea
            rows={2}
            value={draft.venue}
            placeholder="可以从下面的 AI 候选里挑一个，也可以自己填"
            onChange={(event) => setDraft({ ...draft, venue: event.target.value })}
          />
        </label>

        <label className={styles.field}>
          <span>选定时段</span>
          <input
            value={draft.timeWindow}
            placeholder="点上面的时段按钮，或自己写"
            onChange={(event) => setDraft({ ...draft, timeWindow: event.target.value })}
          />
        </label>

        <AiAssistBlock
          task="venues"
          brief={project.brief}
          mode="single"
          buttonLabel="AI 推荐具体场地"
          onAdopt={adoptVenue}
        />
        <p className={styles.hint}>
          AI 给的是可迁移的场地类型和它的光线条件，具体去哪一家由你定；选定后这里的内容会进入最终方案。
        </p>
      </section>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.submit}
          disabled={!dirty || saving}
          onClick={() => void onSave(draft)}
        >
          {saving ? "保存中" : dirty ? "保存选址与时间" : "已是最新"}
        </button>
        <span className={styles.status}>{dirty ? "有未保存的修改" : "改动会写进这个企划的 project.json"}</span>
        <button type="button" className={styles.settingsLink} onClick={onNeedSettings}>
          AI 设置
        </button>
      </div>
    </form>
  );
}
