import type {
  AiAnalyzeRequest,
  AiAnalyzeResponse,
  AiSuggestion,
  AiSuggestRequest,
  AiSuggestResponse,
  Board,
  CityInfo,
  HealthResponse,
  ProjectMeta,
  ProjectSummary,
  ReferenceImage,
  SiteRecommendation,
  SunTimes,
} from "@studio/shared";

export interface PublicSettings {
  baseUrl: string;
  textModel: string;
  visionModel: string;
  hasApiKey: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `请求失败：${response.status}`);
  }
  return (await response.json()) as T;
}

export const api = {
  health: () => request<HealthResponse>("/api/health"),
  settings: () => request<PublicSettings>("/api/settings"),
  listProjects: () => request<ProjectSummary[]>("/api/projects"),
  getProject: (id: string) => request<ProjectMeta>(`/api/projects/${encodeURIComponent(id)}`),
  createProject: (name: string) =>
    request<ProjectMeta>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  updateProject: (id: string, patch: Partial<ProjectMeta>) =>
    request<ProjectMeta>(`/api/projects/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  updateSettings: (patch: {
    baseUrl?: string;
    apiKey?: string;
    textModel?: string;
    visionModel?: string;
  }) => request<PublicSettings>("/api/settings", { method: "PUT", body: JSON.stringify(patch) }),
  suggest: (payload: AiSuggestRequest) =>
    request<AiSuggestResponse>("/api/ai/suggest", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  addReference: (
    projectId: string,
    payload: {
      category: string;
      dataUrl?: string;
      url?: string;
      thumbDataUrl?: string;
      sourceUrl?: string;
      author?: string;
      note?: string;
    },
  ) =>
    request<{ reference: ReferenceImage; duplicate: boolean }>(
      `/api/projects/${encodeURIComponent(projectId)}/references`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
  updateReference: (
    projectId: string,
    referenceId: string,
    patch: { thumbDataUrl?: string; author?: string; note?: string; sourceUrl?: string },
  ) =>
    request<ReferenceImage>(
      `/api/projects/${encodeURIComponent(projectId)}/references/${encodeURIComponent(referenceId)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    ),
  sites: () => request<SiteRecommendation[]>("/api/sites"),
  analyze: (payload: AiAnalyzeRequest) =>
    request<AiAnalyzeResponse>("/api/ai/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  elements: (projectId: string, referenceId: string) =>
    request<{ suggestions: AiSuggestion[]; model: string }>("/api/ai/elements", {
      method: "POST",
      body: JSON.stringify({ projectId, referenceId }),
    }),
  upload: (projectId: string, dataUrl: string) =>
    request<{ path: string }>(`/api/projects/${encodeURIComponent(projectId)}/uploads`, {
      method: "POST",
      body: JSON.stringify({ dataUrl }),
    }),
  saveBoard: (projectId: string, board: Board) =>
    request<ProjectMeta>(`/api/projects/${encodeURIComponent(projectId)}/board`, {
      method: "PATCH",
      body: JSON.stringify({ board }),
    }),
  solar: (city: string, date: string) =>
    request<{ city: CityInfo; times: SunTimes }>(
      `/api/solar?city=${encodeURIComponent(city)}&date=${encodeURIComponent(date)}`,
    ),
  projectPackage: (projectId: string) =>
    request<{ format: string; version: number; project: unknown }>(
      `/api/projects/${encodeURIComponent(projectId)}/package`,
    ),
  importPackage: (payload: Record<string, unknown>, name?: string) =>
    request<ProjectMeta>("/api/projects/import", {
      method: "POST",
      body: JSON.stringify({ ...payload, name }),
    }),
  cloneProject: (sourceId: string, name: string, brief: ProjectMeta["brief"]) =>
    request<ProjectMeta>("/api/projects/clone", {
      method: "POST",
      body: JSON.stringify({ sourceId, name, brief }),
    }),
};

/** 素材存在企划目录下，相对路径直接拼在项目接口后面即可访问 */
export function assetUrl(projectId: string, relativePath: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/${relativePath}`;
}
