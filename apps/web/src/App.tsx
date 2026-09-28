import { useCallback, useEffect, useState } from "react";

import {
  STAGES,
  type BriefInput,
  type HealthResponse,
  type IdeaEntry,
  type LightingPlan,
  type ProjectMeta,
  type ProjectResearch,
  type ProjectSummary,
  type ShootPlan,
  type SiteRecommendation,
  type StageId,
} from "@studio/shared";

import { AiDock } from "./components/AiDock";
import { AppShell } from "./components/AppShell";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { HomePage } from "./components/HomePage";
import { ProjectBar, type SaveState } from "./components/ProjectBar";
import { ProjectsPage } from "./components/ProjectsPage";
import { SettingsDialog } from "./components/SettingsDialog";
import { StageNav } from "./components/StageNav";
import { StageWorkspace } from "./components/StageWorkspace";
import { api, type PublicSettings } from "./lib/api";

function toSummary(meta: ProjectMeta): ProjectSummary {
  return {
    id: meta.id,
    name: meta.name,
    updatedAt: meta.updatedAt,
    currentStage: meta.currentStage,
  };
}

export function App() {
  const [view, setView] = useState<"home" | "projects" | "workbench">("home");
  const [current, setCurrent] = useState<StageId>("S0");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [savingBrief, setSavingBrief] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sites, setSites] = useState<SiteRecommendation[]>([]);
  const [boardRequest, setBoardRequest] = useState<{ referenceId: string; at: number } | null>(
    null,
  );

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then((data) => {
        if (alive) {
          setHealth(data);
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          setHealthError(error instanceof Error ? error.message : "无法连接本地服务");
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .settings()
      .then((data) => {
        if (alive) {
          setSettings(data);
        }
      })
      .catch(() => {
        /* 设置读不到不影响骨架渲染，M2 再接错误态 */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .sites()
      .then((list) => {
        if (alive) {
          setSites(list);
        }
      })
      .catch(() => {
        /* 站点目录拉不到时，导入功能仍然可用 */
      });
    return () => {
      alive = false;
    };
  }, []);

  const openProject = useCallback(async (id: string) => {
    if (!id) {
      setProject(null);
      return;
    }
    try {
      const meta = await api.getProject(id);
      setProject(meta);
      setCurrent(meta.currentStage);
      setSaveState("idle");
      setSavedAt(null);
    } catch {
      /* 单个企划读不到时保持当前视图，M1 接错误提示 */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .listProjects()
      .then((list) => {
        if (!alive) {
          return;
        }
        setProjects(list);
        const first = list[0];
        // 有深链参数时不自动打开第一个企划，否则会把深链指定的企划与阶段覆盖掉
        const deepLinked = new URLSearchParams(window.location.search).get("project");
        if (first && !deepLinked) {
          void openProject(first.id);
        }
      })
      .catch(() => {
        /* 首次启动还没有 projects 目录时忽略 */
      });
    return () => {
      alive = false;
    };
  }, [openProject]);

  // 深链：/?view=workbench&project=<id>&stage=S4，便于分享与截图
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetView = params.get("view");
    const targetProject = params.get("project");
    const targetStage = params.get("stage");
    if (targetView === "home" || targetView === "projects" || targetView === "workbench") {
      setView(targetView);
    }
    if (targetProject) {
      // 先打开企划（它会带入企划里存的阶段），再覆盖成链接里指定的阶段
      void openProject(targetProject).then(() => {
        if (targetStage) {
          setCurrent(targetStage as StageId);
        }
      });
    } else if (targetStage) {
      setCurrent(targetStage as StageId);
    }
    // 只在首次挂载时读取一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createProject = useCallback(async (name: string) => {
    const meta = await api.createProject(name);
    setProjects((prev) => [toSummary(meta), ...prev]);
    setProject(meta);
    setCurrent("S0");
    setSaveState("idle");
    setSavedAt(null);
  }, []);

  const saveBrief = useCallback(
    async (brief: BriefInput) => {
      if (!project) {
        return;
      }
      setSavingBrief(true);
      setSaveState("saving");
      try {
        const updated = await api.updateProject(project.id, { brief });
        setProject(updated);
        setSaveState("saved");
        setSavedAt(
          new Date(updated.updatedAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
        setProjects((prev) =>
          prev.map((item) => (item.id === updated.id ? toSummary(updated) : item)),
        );
      } catch {
        setSaveState("error");
      } finally {
        setSavingBrief(false);
      }
    },
    [project],
  );

  const refreshProject = useCallback(async () => {
    if (!project) {
      return;
    }
    try {
      const fresh = await api.getProject(project.id);
      setProject(fresh);
      setProjects((prev) => prev.map((item) => (item.id === fresh.id ? toSummary(fresh) : item)));
    } catch {
      /* 刷新失败时保留当前视图 */
    }
  }, [project]);

  /** 从 S3 带着图跳到黑板 */
  const openInBoard = useCallback((referenceId: string) => {
    setBoardRequest({ referenceId, at: Date.now() });
    setCurrent("S4");
  }, []);

  const savePlan = useCallback(
    async (plan: ShootPlan) => {
      if (!project) {
        return;
      }
      setSavingBrief(true);
      setSaveState("saving");
      try {
        const updated = await api.updateProject(project.id, { plan });
        setProject(updated);
        setSaveState("saved");
        setSavedAt(
          new Date(updated.updatedAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      } catch {
        setSaveState("error");
      } finally {
        setSavingBrief(false);
      }
    },
    [project],
  );

  const saveResearch = useCallback(
    async (research: ProjectResearch) => {
      if (!project) {
        return;
      }
      setSavingBrief(true);
      setSaveState("saving");
      try {
        const updated = await api.updateProject(project.id, { research });
        setProject(updated);
        setSaveState("saved");
        setSavedAt(
          new Date(updated.updatedAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      } catch {
        setSaveState("error");
      } finally {
        setSavingBrief(false);
      }
    },
    [project],
  );

  const saveIdeaList = useCallback(
    async (ideaList: IdeaEntry[]) => {
      if (!project) {
        return;
      }
      setSavingBrief(true);
      setSaveState("saving");
      try {
        const updated = await api.updateProject(project.id, { ideaList });
        setProject(updated);
        setSaveState("saved");
        setSavedAt(
          new Date(updated.updatedAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      } catch {
        setSaveState("error");
      } finally {
        setSavingBrief(false);
      }
    },
    [project],
  );

  const saveLighting = useCallback(
    async (lighting: LightingPlan[]) => {
      if (!project) {
        return;
      }
      setSavingBrief(true);
      setSaveState("saving");
      try {
        const updated = await api.updateProject(project.id, { lighting });
        setProject(updated);
        setSaveState("saved");
        setSavedAt(
          new Date(updated.updatedAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      } catch {
        setSaveState("error");
      } finally {
        setSavingBrief(false);
      }
    },
    [project],
  );

  const stage = STAGES.find((item) => item.id === current) ?? STAGES[0]!;
  const connectionState = healthError ? "error" : health ? "ready" : "loading";

  const openInWorkbench = (id: string) => {
    void openProject(id);
    setView("workbench");
  };

  const handleCreated = (created: ProjectMeta) => {
    setProjects((prev) => [toSummary(created), ...prev.filter((item) => item.id !== created.id)]);
    setProject(created);
    setCurrent(created.currentStage);
    setSaveState("idle");
    setSavedAt(null);
    setView("workbench");
  };

  if (view === "home") {
    return (
      <>
        <HomePage
          projectCount={projects.length}
          onEnter={() => setView("projects")}
          onCreate={() => setView("projects")}
        />
        <SettingsDialog
          open={settingsOpen}
          initial={settings}
          onClose={() => setSettingsOpen(false)}
          onSaved={(saved) => {
            setSettings(saved);
            setSettingsOpen(false);
          }}
        />
      </>
    );
  }

  if (view === "projects") {
    return (
      <ProjectsPage
        projects={projects}
        onOpen={openInWorkbench}
        onCreated={handleCreated}
        onBack={() => setView("home")}
      />
    );
  }

  return (
    <>
      <div data-stage={current} style={{ display: "contents" }}>
      <AppShell
      project={
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
          <button
            type="button"
            style={{ fontSize: 12, color: "var(--ink-faint)", whiteSpace: "nowrap" }}
            onClick={() => setView("home")}
          >
            首页
          </button>
          <button
            type="button"
            style={{ fontSize: 12, color: "var(--ink-faint)", whiteSpace: "nowrap" }}
            onClick={() => setView("projects")}
          >
            项目
          </button>
          <ProjectBar
            projects={projects}
            currentId={project?.id ?? null}
            saveState={saveState}
            savedAt={savedAt}
            onSelect={(id) => void openProject(id)}
            onCreate={createProject}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>
      }
      status={
        <ConnectionStatus
          state={connectionState}
          detail={health?.projectsRoot ?? healthError ?? "正在获取企划目录"}
          aiConfigured={health?.aiConfigured ?? false}
        />
      }
      nav={<StageNav stages={STAGES} current={current} completed={project?.completedStages ?? []} onSelect={setCurrent} />}
      workspace={
        <StageWorkspace
          stage={stage}
          project={project}
          savingBrief={savingBrief}
          onSaveBrief={saveBrief}
          onNeedSettings={() => setSettingsOpen(true)}
          onRefreshProject={refreshProject}
          sites={sites}
          onOpenInBoard={openInBoard}
          boardRequest={boardRequest}
          onSavePlan={savePlan}
          onSaveResearch={saveResearch}
          onSaveIdeaList={saveIdeaList}
          onSaveLighting={saveLighting}
        />
      }
      dock={
        <AiDock
          stage={stage}
          model={settings?.visionModel ?? "deepseek-flash"}
          configured={settings?.hasApiKey ?? health?.aiConfigured ?? false}
        />
      }
      />
      <SettingsDialog
        open={settingsOpen}
        initial={settings}
        onClose={() => setSettingsOpen(false)}
        onSaved={(saved) => {
          setSettings(saved);
          setSettingsOpen(false);
          setHealth((current) =>
            current ? { ...current, aiConfigured: saved.hasApiKey } : current,
          );
        }}
      />
      </div>
    </>
  );
}
