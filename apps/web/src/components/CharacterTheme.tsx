import { useEffect, useState } from "react";

import type { AiSuggestion, ProjectMeta, ProjectResearch } from "@studio/shared";

import { AiAssistBlock } from "./AiAssistBlock";
import styles from "./CharacterTheme.module.css";

interface CharacterThemeProps {
  project: ProjectMeta;
  saving: boolean;
  onSave: (research: ProjectResearch) => Promise<void>;
  onNeedSettings: () => void;
}

export function CharacterTheme({ project, saving, onSave, onNeedSettings }: CharacterThemeProps) {
  const [draft, setDraft] = useState<ProjectResearch>(project.research);

  useEffect(() => {
    setDraft(project.research);
  }, [project.id, project.research]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(project.research);

  const appendCharacter = (items: AiSuggestion[]) => {
    const block = items
      .map((item) => (item.detail ? `【${item.title}】${item.detail}` : `【${item.title}】`))
      .join("\n");
    setDraft((current) => ({
      ...current,
      character: current.character.trim() ? `${current.character.trimEnd()}\n${block}` : block,
    }));
  };

  const replaceTheme = (items: AiSuggestion[]) => {
    const first = items[0];
    if (!first) {
      return;
    }
    setDraft((current) => ({
      ...current,
      theme: first.detail ? `${first.title}｜${first.detail}` : first.title,
    }));
  };

  return (
    <form
      className={styles.form}
      data-character-length={draft.character.length}
      data-theme-length={draft.theme.length}
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
        <h2 className={styles.groupTitle}>这次拍谁</h2>
        <p className={styles.subject}>{project.brief.subject || "（S0 里还没填人物或角色）"}</p>
        <p className={styles.hint}>
          人物信息来自 S0 立项输入，要改就回 S0 改，这里只做调研和定调。
        </p>
      </section>

      <section className={styles.group}>
        <h2 className={styles.groupTitle}>人物档案</h2>
        <label className={styles.field}>
          <span>调研结果</span>
          <textarea
            rows={8}
            value={draft.character}
            placeholder="点下面的按钮让 AI 整理，也可以自己写"
            onChange={(event) => setDraft({ ...draft, character: event.target.value })}
          />
        </label>
        <AiAssistBlock
          task="character"
          brief={project.brief}
          mode="multi"
          buttonLabel="AI 调研人物档案"
          onAdopt={appendCharacter}
        />
        <p className={styles.hint}>
          覆盖出典身份、外形特征、服装配色、标志性元素、容易拍错的地方。AI 拿不准的会标明需要核实，不编造设定。
        </p>
      </section>

      <section className={styles.group}>
        <h2 className={styles.groupTitle}>主题定调</h2>
        <label className={styles.field}>
          <span>选定的方向</span>
          <textarea
            rows={5}
            value={draft.theme}
            placeholder="从 AI 给的方向里挑一个，也可以自己组一个"
            onChange={(event) => setDraft({ ...draft, theme: event.target.value })}
          />
        </label>
        <AiAssistBlock
          task="themes"
          brief={project.brief}
          mode="single"
          buttonLabel="AI 推荐主题方向"
          onAdopt={replaceTheme}
        />
        <p className={styles.hint}>
          AI 给的方向彼此要有区别，方便你真的做选择；定下来之后，后面的布光与灵感都会围着它走。
        </p>
      </section>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.submit}
          disabled={!dirty || saving}
          onClick={() => void onSave(draft)}
        >
          {saving ? "保存中" : dirty ? "保存人物与主题" : "已是最新"}
        </button>
        <span className={styles.status}>
          {dirty ? "有未保存的修改" : "改动会写进这个企划的 project.json"}
        </span>
        <button type="button" className={styles.settingsLink} onClick={onNeedSettings}>
          AI 设置
        </button>
      </div>
    </form>
  );
}
