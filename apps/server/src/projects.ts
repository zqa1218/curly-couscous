import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { BriefInput, ProjectMeta, ProjectSummary } from "@studio/shared";

const PROJECT_SUBDIRS = [
  "assets/refs",
  "assets/uploads",
  "assets/generated",
  "assets/thumbs",
  "board",
  "docs",
  "output",
];

/** 去掉文件名非法字符，保留中文 */
function toFolderName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim();
  return cleaned.length > 0 ? cleaned.slice(0, 60) : "未命名企划";
}

function stamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

export function createProject(projectsRoot: string, name: string): ProjectMeta {
  const folder = toFolderName(name);
  let id = `${folder}-${stamp()}`;
  let suffix = 2;
  while (existsSync(path.join(projectsRoot, id))) {
    id = `${folder}-${stamp()}-${suffix}`;
    suffix += 1;
  }

  const projectDir = path.join(projectsRoot, id);
  for (const sub of PROJECT_SUBDIRS) {
    mkdirSync(path.join(projectDir, sub), { recursive: true });
  }

  // 黑板先落一个空的 Excalidraw 场景，打开项目时不会因为文件缺失而报错
  const emptyBoard = {
    type: "excalidraw",
    version: 2,
    source: "photo-studio-planner",
    elements: [],
    appState: { gridSize: null, viewBackgroundColor: "#F1F3F5" },
    files: {},
  };
  writeFileSync(
    path.join(projectDir, "board", "board.excalidraw"),
    `${JSON.stringify(emptyBoard, null, 2)}\n`,
    "utf8",
  );

  const now = new Date().toISOString();
  const meta: ProjectMeta = {
    id,
    name: folder,
    createdAt: now,
    updatedAt: now,
    currentStage: "S0",
    completedStages: [],
    brief: {
      subject: "",
      props: "",
      shootingScene: "",
      styleKeywords: [],
      focalLength: "",
      aperture: "",
      shootingTechnique: "",
      onSetEffect: "",
      postProduction: "",
    },
    references: [],
    board: { items: [], links: [], groups: [] },
    plan: { city: "", date: "", venue: "", timeWindow: "" },
    research: { character: "", theme: "" },
    ideaList: [],
    lighting: [],
  };
  writeFileSync(
    path.join(projectDir, "project.json"),
    `${JSON.stringify(meta, null, 2)}\n`,
    "utf8",
  );
  return meta;
}

export function readProject(projectsRoot: string, id: string): ProjectMeta | null {
  const file = path.join(projectsRoot, id, "project.json");
  if (!existsSync(file)) {
    return null;
  }
  try {
    return normalizeProject(JSON.parse(readFileSync(file, "utf8")) as Partial<ProjectMeta>, id);
  } catch {
    return null;
  }
}

/** 旧版本企划文件缺字段时补齐，避免读到 undefined */
function normalizeProject(raw: Partial<ProjectMeta>, fallbackId: string): ProjectMeta {
  const brief: Partial<BriefInput> = raw.brief ?? {};
  // 早期版本把「拍摄手法与场景」合成一个字段，读旧文件时并入拍摄手法
  const legacyApproach = (raw.brief as { shootingApproach?: string } | undefined)?.shootingApproach;
  return {
    id: raw.id ?? fallbackId,
    name: raw.name ?? fallbackId,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    currentStage: raw.currentStage ?? "S0",
    completedStages: raw.completedStages ?? [],
    brief: {
      subject: brief.subject ?? "",
      props: brief.props ?? "",
      shootingScene: brief.shootingScene ?? "",
      styleKeywords: brief.styleKeywords ?? [],
      focalLength: brief.focalLength ?? "",
      aperture: brief.aperture ?? "",
      shootingTechnique: brief.shootingTechnique ?? legacyApproach ?? "",
      onSetEffect: brief.onSetEffect ?? "",
      postProduction: brief.postProduction ?? "",
    },
    references: raw.references ?? [],
    board: {
      items: (raw.board?.items ?? []).map((item) => ({
        ...item,
        // 早期数据没有 kind：已经补全过内容的算完整想法，否则算组成元素
        kind: item.kind ?? (item.note || item.plan ? "idea" : "component"),
        elements: item.elements ?? [],
        note: item.note ?? "",
        plan: item.plan ?? "",
        analyses: item.analyses ?? [],
      })),
      links: (raw.board?.links ?? []).map((link) => ({
        ...link,
        plan: link.plan ?? "",
      })),
      groups: raw.board?.groups ?? [],
    },
    plan: {
      city: raw.plan?.city ?? "",
      date: raw.plan?.date ?? "",
      venue: raw.plan?.venue ?? "",
      timeWindow: raw.plan?.timeWindow ?? "",
    },
    research: {
      character: raw.research?.character ?? "",
      theme: raw.research?.theme ?? "",
    },
    ideaList: raw.ideaList ?? [],
    lighting: raw.lighting ?? [],
  };
}

export function writeProject(projectsRoot: string, meta: ProjectMeta): ProjectMeta {
  const next: ProjectMeta = { ...meta, updatedAt: new Date().toISOString() };
  const file = path.join(projectsRoot, next.id, "project.json");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

/** 用一份内容作为种子创建新企划，用于「导入项目包」与「以蓝本新建」 */
export function createProjectFrom(
  projectsRoot: string,
  name: string,
  seed: Partial<ProjectMeta>,
): ProjectMeta {
  const base = createProject(projectsRoot, name);
  return writeProject(projectsRoot, {
    ...base,
    ...seed,
    id: base.id,
    name: base.name,
    createdAt: base.createdAt,
  });
}

export function listProjects(projectsRoot: string): ProjectSummary[] {
  if (!existsSync(projectsRoot)) {
    return [];
  }
  return readdirSync(projectsRoot)
    .filter((name) => {
      const full = path.join(projectsRoot, name);
      return statSync(full).isDirectory() && existsSync(path.join(full, "project.json"));
    })
    .map((name) => readProject(projectsRoot, name))
    .filter((meta): meta is ProjectMeta => meta !== null)
    .map((meta) => ({
      id: meta.id,
      name: meta.name,
      updatedAt: meta.updatedAt,
      currentStage: meta.currentStage,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
