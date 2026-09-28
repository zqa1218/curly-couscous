import { useEffect, useState } from "react";

import type { AiSuggestion, BriefInput, ProjectMeta } from "@studio/shared";

import { AiAssistBlock } from "./AiAssistBlock";
import styles from "./BriefForm.module.css";

interface BriefFormProps {
  project: ProjectMeta;
  saving: boolean;
  onSave: (brief: BriefInput) => Promise<void>;
  onNeedSettings: () => void;
}

type TextField = "props" | "shootingScene" | "shootingTechnique" | "onSetEffect" | "postProduction";

function parseKeywords(value: string): string[] {
  return value
    .split(/[,，、;；\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function BriefForm({ project, saving, onSave, onNeedSettings }: BriefFormProps) {
  const [draft, setDraft] = useState<BriefInput>(project.brief);
  const [keywordText, setKeywordText] = useState(project.brief.styleKeywords.join("、"));

  // 切换企划时重置草稿；保存后父组件回填同值，不会打断正在输入的内容
  useEffect(() => {
    setDraft(project.brief);
    setKeywordText(project.brief.styleKeywords.join("、"));
  }, [project.id, project.brief]);

  const set = <K extends keyof BriefInput>(key: K, value: BriefInput[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const dirty = JSON.stringify(draft) !== JSON.stringify(project.brief);

  const submit = async () => {
    await onSave({ ...draft, styleKeywords: parseKeywords(keywordText) });
  };

  /** 清单类字段：把选中的建议按行追加，保留人已经写的内容 */
  const appendLines = (key: TextField, items: AiSuggestion[]) => {
    const block = items
      .map((item) => (item.detail ? `${item.title}：${item.detail}` : item.title))
      .join("\n");
    setDraft((current) => {
      const existing = current[key];
      return {
        ...current,
        [key]: existing.trim() ? `${existing.trimEnd()}\n${block}` : block,
      };
    });
  };

  const appendKeywords = (items: AiSuggestion[]) => {
    const joined = items.map((item) => item.title).join("、");
    const next = keywordText.trim() ? `${keywordText.trim()}、${joined}` : joined;
    setKeywordText(next);
    setDraft((current) => ({ ...current, styleKeywords: parseKeywords(next) }));
  };

  /** 细化类建议：用改写后的完整表述替换原字段 */
  const replaceText = (key: TextField, items: AiSuggestion[]) => {
    const picked = items[0];
    if (!picked) {
      return;
    }
    setDraft((current) => ({ ...current, [key]: picked.detail || picked.title }));
  };

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        // 单行输入里按回车直接保存；文本框里回车是换行，改用 Ctrl/Cmd + S
        const enterInInput =
          event.key === "Enter" && !event.shiftKey && target.tagName === "INPUT";
        const shortcutSave =
          (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
        if (enterInInput || shortcutSave) {
          event.preventDefault();
          void submit();
        }
      }}
    >
      <section className={styles.group}>
        <h2 className={styles.groupTitle}>拍摄对象</h2>

        <div className={styles.row}>
          <label className={styles.label} htmlFor="brief-subject">
            人物或角色
          </label>
          <div className={styles.control}>
            <textarea
              id="brief-subject"
              rows={3}
              value={draft.subject}
              placeholder="名字或角色名，也可以写清要表现的气质"
              onChange={(event) => set("subject", event.target.value)}
            />
            <p className={styles.hint}>写清楚是谁、要拍出什么感觉，后面的调研与主题都会以它为依据。</p>
          </div>
        </div>

        <div className={styles.row}>
          <label className={styles.label} htmlFor="brief-props">
            道具
          </label>
          <div className={styles.control}>
            <textarea
              id="brief-props"
              rows={3}
              value={draft.props}
              placeholder="必须出现的物件"
              onChange={(event) => set("props", event.target.value)}
            />
            <AiAssistBlock
              task="props"
              brief={draft}
              mode="multi"
              buttonLabel="AI 推荐道具"
              onAdopt={(items) => appendLines("props", items)}
            />
            <p className={styles.hint}>写清材质和颜色，布光时会用到。</p>
          </div>
        </div>
      </section>

      <section className={styles.group}>
        <h2 className={styles.groupTitle}>拍摄场景</h2>

        <div className={styles.row}>
          <label className={styles.label} htmlFor="brief-scene">
            拍摄场景
          </label>
          <div className={styles.control}>
            <textarea
              id="brief-scene"
              rows={3}
              value={draft.shootingScene}
              placeholder="去哪里拍：室内影棚、老城区街道、有窗光的书房……"
              onChange={(event) => set("shootingScene", event.target.value)}
            />
            <AiAssistBlock
              task="location"
              brief={draft}
              mode="multi"
              buttonLabel="AI 推荐拍摄场景"
              onAdopt={(items) => appendLines("shootingScene", items)}
            />
            <p className={styles.hint}>
              这里写"去哪拍"，拍摄手法那一栏写"怎么拍"，两者分开，S1 的选址建议会只依据这一栏。
            </p>
          </div>
        </div>
      </section>

      <section className={styles.group}>
        <h2 className={styles.groupTitle}>风格与镜头</h2>

        <div className={styles.row}>
          <label className={styles.label} htmlFor="brief-keywords">
            风格关键词
          </label>
          <div className={styles.control}>
            <input
              id="brief-keywords"
              value={keywordText}
              placeholder="日系、港风、赛博"
              onChange={(event) => {
                setKeywordText(event.target.value);
                set("styleKeywords", parseKeywords(event.target.value));
              }}
            />
            <AiAssistBlock
              task="style"
              brief={draft}
              mode="multi"
              buttonLabel="AI 推荐风格关键词"
              onAdopt={appendKeywords}
            />
            <p className={styles.hint}>用逗号或空格分隔，一个词也能开工。</p>
          </div>
        </div>

        <div className={styles.pair}>
          <div className={styles.row}>
            <label className={styles.label} htmlFor="brief-focal">
              焦段
            </label>
            <div className={styles.control}>
              <input
                id="brief-focal"
                value={draft.focalLength}
                placeholder="35mm 主视角、85mm 特写"
                onChange={(event) => set("focalLength", event.target.value)}
              />
            </div>
          </div>

          <div className={styles.row}>
            <label className={styles.label} htmlFor="brief-aperture">
              光圈
            </label>
            <div className={styles.control}>
              <input
                id="brief-aperture"
                value={draft.aperture}
                placeholder="f/1.4 - f/2.8"
                onChange={(event) => set("aperture", event.target.value)}
              />
            </div>
          </div>
        </div>

        <p className={styles.groupHint}>
          焦段与光圈会一路带到后面的风格分析和灵感里，作为判断景深、透视与虚化的依据。
        </p>
      </section>

      <section className={styles.group}>
        <h2 className={styles.groupTitle}>执行与效果</h2>

        <div className={styles.row}>
          <label className={styles.label} htmlFor="brief-technique">
            拍摄手法
          </label>
          <div className={styles.control}>
            <textarea
              id="brief-technique"
              rows={3}
              value={draft.shootingTechnique}
              placeholder="机位高低、跟拍还是固定、抓拍还是摆拍、需要什么辅助器材"
              onChange={(event) => set("shootingTechnique", event.target.value)}
            />
            <AiAssistBlock
              task="technique"
              brief={draft}
              mode="multi"
              buttonLabel="AI 推荐拍摄手法"
              onAdopt={(items) => appendLines("shootingTechnique", items)}
            />
          </div>
        </div>

        <div className={styles.row}>
          <label className={styles.label} htmlFor="brief-effect-pre">
            拍摄前期效果
          </label>
          <div className={styles.control}>
            <textarea
              id="brief-effect-pre"
              rows={3}
              value={draft.onSetEffect}
              placeholder="实拍阶段就要做出来的效果：烟雾、水汽、逆光眩光、风扇吹动"
              onChange={(event) => set("onSetEffect", event.target.value)}
            />
            <div className={styles.assistRow}>
              <AiAssistBlock
                task="effect-pre"
                brief={draft}
                mode="multi"
                buttonLabel="AI 推荐前期效果"
                onAdopt={(items) => appendLines("onSetEffect", items)}
              />
              <AiAssistBlock
                task="refine-pre"
                brief={draft}
                existing={draft.onSetEffect}
                mode="single"
                buttonLabel="AI 细化我的写法"
                onAdopt={(items) => replaceText("onSetEffect", items)}
              />
            </div>
          </div>
        </div>

        <div className={styles.row}>
          <label className={styles.label} htmlFor="brief-effect-post">
            拍摄后期效果
          </label>
          <div className={styles.control}>
            <textarea
              id="brief-effect-post"
              rows={3}
              value={draft.postProduction}
              placeholder="后期要加的东西：调色方向、颗粒、光晕、合成"
              onChange={(event) => set("postProduction", event.target.value)}
            />
            <div className={styles.assistRow}>
              <AiAssistBlock
                task="effect-post"
                brief={draft}
                mode="multi"
                buttonLabel="AI 推荐后期效果"
                onAdopt={(items) => appendLines("postProduction", items)}
              />
              <AiAssistBlock
                task="refine-post"
                brief={draft}
                existing={draft.postProduction}
                mode="single"
                buttonLabel="AI 细化我的写法"
                onAdopt={(items) => replaceText("postProduction", items)}
              />
            </div>
          </div>
        </div>
      </section>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.submit}
          disabled={!dirty || saving}
          onClick={() => void submit()}
        >
          {saving ? "保存中" : dirty ? "保存立项信息" : "已是最新"}
        </button>
        <span className={styles.status}>
          {dirty ? "有未保存的修改" : "改动会自动写进这个企划的 project.json"}
        </span>
        <button type="button" className={styles.settingsLink} onClick={onNeedSettings}>
          AI 设置
        </button>
      </div>
    </form>
  );
}
