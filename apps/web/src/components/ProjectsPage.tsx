import { useRef, useState } from "react";

import type { AiSuggestion, ProjectMeta, ProjectSummary } from "@studio/shared";

import { api } from "@/lib/api";

import { AiAssistBlock } from "./AiAssistBlock";
import styles from "./ProjectsPage.module.css";

interface ProjectsPageProps {
  projects: ProjectSummary[];
  onOpen: (id: string) => void;
  onCreated: (project: ProjectMeta) => void;
  onBack: () => void;
}

export function ProjectsPage({ projects, onOpen, onCreated, onBack }: ProjectsPageProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [blueprint, setBlueprint] = useState<ProjectSummary | null>(null);
  const [blueprintName, setBlueprintName] = useState("");
  const [blueprintSubject, setBlueprintSubject] = useState("");
  const [blueprintKeywords, setBlueprintKeywords] = useState("");
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await api.createProject(trimmed);
      onCreated(created);
      setName("");
      setCreating(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "新建失败");
    } finally {
      setBusy(false);
    }
  };

  const importPackage = async (raw: string) => {
    setBusy(true);
    setError(null);
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed.format !== "shootplan-package") {
        throw new Error("这不是印样台导出的项目包");
      }
      const created = await api.importPackage(parsed);
      onCreated(created);
      setImportText("");
      setImportOpen(false);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "导入失败");
    } finally {
      setBusy(false);
    }
  };

  const runBlueprintSuggest = async () => {
    if (!blueprint) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const source = await api.getProject(blueprint.id);
      const context = [
        `蓝本企划：${source.name}`,
        `蓝本人物：${source.brief.subject}`,
        `蓝本道具：${source.brief.props.split("\n")[0]}`,
        `蓝本场景：${source.brief.shootingScene || source.plan.venue}`,
        `蓝本风格：${source.brief.styleKeywords.join("、")}`,
        `蓝本主题：${source.research.theme}`,
        `这次的拍摄对象：${blueprintSubject || "（未填）"}`,
        `这次想要的风格：${blueprintKeywords || "（未填）"}`,
      ].join("\n");
      const unique = new Set<string>();
      const result = await api.suggest({
        task: "blueprint",
        brief: source.brief,
        context,
      });
      for (const item of result.suggestions) {
        unique.add(item.title);
      }
      setSuggestions(result.suggestions);
    } catch (suggestError) {
      setError(suggestError instanceof Error ? suggestError.message : "生成建议失败");
    } finally {
      setBusy(false);
    }
  };

  const createFromBlueprint = async () => {
    if (!blueprint) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const source = await api.getProject(blueprint.id);
      const advice = suggestions.map((item) => `${item.title}：${item.detail}`).join("\n");
      const brief = {
        ...source.brief,
        subject: blueprintSubject || source.brief.subject,
        styleKeywords: [
          ...new Set([
            ...source.brief.styleKeywords,
            ...blueprintKeywords
              .split(/[,，、\s]+/)
              .map((value) => value.trim())
              .filter(Boolean),
          ]),
        ],
        props: advice ? `${source.brief.props}\n【蓝本调整建议】\n${advice}` : source.brief.props,
      };
      const created = await api.cloneProject(
        blueprint.id,
        blueprintName.trim() || `${source.name} · ${brief.subject || "新拍"}`,
        brief,
      );
      onCreated(created);
      setBlueprint(null);
      setBlueprintName("");
      setBlueprintSubject("");
      setBlueprintKeywords("");
      setSuggestions([]);
    } catch (cloneError) {
      setError(cloneError instanceof Error ? cloneError.message : "创建失败");
    } finally {
      setBusy(false);
    }
  };

  const exportPackage = async (id: string) => {
    try {
      const payload = await api.projectPackage(id);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${id}-项目包.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (packageError) {
      setError(packageError instanceof Error ? packageError.message : "导出项目包失败");
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <button type="button" className={styles.back} onClick={onBack}>
            ← 返回首页
          </button>
          <h1 className={styles.title}>项目</h1>
          <p className={styles.sub}>
            每次拍摄是一个独立项目。可以新建、翻开之前的项目，也可以导入别人分享的项目包，
            或者以某个项目为蓝本改成自己的。
          </p>
        </div>
        <div className={styles.headActions}>
          <button type="button" className={styles.primary} onClick={() => setCreating(true)}>
            新建项目
          </button>
          <button type="button" className={styles.ghost} onClick={() => setImportOpen(!importOpen)}>
            导入项目包
          </button>
        </div>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      {creating ? (
        <div className={styles.inlineForm}>
          <input
            autoFocus
            value={name}
            placeholder="这次拍摄叫什么，例如 秋日人像样片"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void create();
              }
              if (event.key === "Escape") {
                setCreating(false);
              }
            }}
          />
          <button type="button" className={styles.primary} disabled={busy} onClick={() => void create()}>
            创建
          </button>
          <button type="button" className={styles.ghost} onClick={() => setCreating(false)}>
            取消
          </button>
        </div>
      ) : null}

      {importOpen ? (
        <div className={styles.importBox}>
          <p className={styles.importHint}>
            把别人分享的项目包内容粘进来，或者选择一个 .json 文件。导入只带文字与设定，参考图需要自己重新收集。
          </p>
          <textarea
            rows={4}
            value={importText}
            placeholder="粘贴项目包 JSON"
            onChange={(event) => setImportText(event.target.value)}
          />
          <div className={styles.importActions}>
            <button
              type="button"
              className={styles.primary}
              disabled={busy || !importText.trim()}
              onClick={() => void importPackage(importText)}
            >
              从文本导入
            </button>
            <button type="button" className={styles.ghost} onClick={() => fileInput.current?.click()}>
              选择文件
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void file.text().then((text) => importPackage(text));
                }
                event.target.value = "";
              }}
            />
          </div>
        </div>
      ) : null}

      {blueprint ? (
        <div className={styles.blueprint}>
          <div className={styles.blueprintHead}>
            <h2 className={styles.blueprintTitle}>以「{blueprint.name}」为蓝本新建</h2>
            <button type="button" className={styles.back} onClick={() => setBlueprint(null)}>
              取消
            </button>
          </div>
          <div className={styles.blueprintGrid}>
            <label className={styles.field}>
              <span>新项目名称</span>
              <input
                value={blueprintName}
                placeholder={`${blueprint.name} · 新拍`}
                onChange={(event) => setBlueprintName(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>这次的拍摄对象</span>
              <input
                value={blueprintSubject}
                placeholder="新角色或新人物，可以写清气质"
                onChange={(event) => setBlueprintSubject(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>这次想要的风格</span>
              <input
                value={blueprintKeywords}
                placeholder="逗号分隔，留空则沿用蓝本"
                onChange={(event) => setBlueprintKeywords(event.target.value)}
              />
            </label>
          </div>

          <AiAssistBlock
            task="blueprint"
            brief={{
              subject: blueprintSubject,
              props: "",
              shootingScene: "",
              styleKeywords: blueprintKeywords
                .split(/[,，、\s]+/)
                .map((value) => value.trim())
                .filter(Boolean),
              focalLength: "",
              aperture: "",
              shootingTechnique: "",
              onSetEffect: "",
              postProduction: "",
            }}
            existing={`蓝本企划：${blueprint.name}`}
            mode="multi"
            buttonLabel="让 AI 给出调整建议"
            onAdopt={(items) => setSuggestions(items)}
          />
          <button
            type="button"
            className={styles.ghost}
            disabled={busy}
            onClick={() => void runBlueprintSuggest()}
          >
            {busy ? "AI 正在想" : "重新生成建议"}
          </button>

          {suggestions.length > 0 ? (
            <ul className={styles.suggestions}>
              {suggestions.map((item) => (
                <li key={item.title}>
                  <b>{item.title}</b>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <p className={styles.importHint}>
            创建后会带上蓝本的场景骨架、主题与风格，人物换成你填的这个，建议会写进道具栏供后续参考；
            参考图与公共区不会复制，那部分需要你自己重新做。
          </p>
          <button
            type="button"
            className={styles.primary}
            disabled={busy}
            onClick={() => void createFromBlueprint()}
          >
            {busy ? "创建中" : "用蓝本创建项目"}
          </button>
        </div>
      ) : null}

      {projects.length === 0 ? (
        <p className={styles.empty}>还没有项目。新建一个，或者导入别人分享的项目包。</p>
      ) : (
        <ul className={styles.grid}>
          {projects.map((item) => (
            <li key={item.id} className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>{item.name}</h2>
                <span className={styles.stage}>{item.currentStage}</span>
              </div>
              <p className={styles.cardMeta}>
                更新于 {new Date(item.updatedAt).toLocaleString("zh-CN", { hour12: false })}
              </p>
              <div className={styles.cardActions}>
                <button type="button" className={styles.primary} onClick={() => onOpen(item.id)}>
                  打开
                </button>
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => {
                    setBlueprint(item);
                    setSuggestions([]);
                    setError(null);
                  }}
                >
                  以它为蓝本
                </button>
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => void exportPackage(item.id)}
                >
                  导出项目包
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
