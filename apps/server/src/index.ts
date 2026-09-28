import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "@fastify/cors";
import Fastify from "fastify";

import type {
  AiAnalyzeRequest,
  AiSuggestRequest,
  Board,
  HealthResponse,
  ProjectMeta,
} from "@studio/shared";

import { AiError, analyzeElements, analyzeReference, suggest } from "./ai";
import { readSettings, toPublicSettings, writeSettings } from "./config";
import { exportProject } from "./export";
import {
  createProject,
  createProjectFrom,
  listProjects,
  readProject,
  writeProject,
} from "./projects";
import {
  addReference,
  readAsset,
  readOutput,
  ReferenceError,
  saveUpload,
  updateReference,
  type IncomingReference,
} from "./references";
import { SITE_RECOMMENDATIONS } from "./sites";
import { CITIES, computeSunTimes, lookupCity } from "./solar";

const VERSION = "0.1.0";
const SERVER_PORT = 4317;

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const projectsRoot = path.join(repoRoot, "projects");
const settingsPath = path.join(repoRoot, "data", "settings.json");

mkdirSync(projectsRoot, { recursive: true });

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/api/health", async (): Promise<HealthResponse> => {
  const settings = readSettings(settingsPath);
  return {
    ok: true,
    service: "photo-studio-planner",
    version: VERSION,
    projectsRoot,
    aiConfigured: settings.apiKey.length > 0,
  };
});

app.get("/api/settings", async () => toPublicSettings(readSettings(settingsPath)));

app.get("/api/sites", async () => SITE_RECOMMENDATIONS);

app.get<{ Querystring: { city?: string; date?: string } }>("/api/solar", async (request, reply) => {
  const cityName = request.query.city?.trim() ?? "";
  const date = request.query.date?.trim() ?? "";
  if (!cityName || !date) {
    return reply.code(400).send({ message: "需要城市和日期才能算日出日落" });
  }
  const city = lookupCity(cityName);
  if (!city) {
    return reply
      .code(404)
      .send({ message: `内置城市表里没有"${cityName}"，换一个附近的大城市试试` });
  }
  try {
    return { city, times: computeSunTimes(date, city) };
  } catch (error) {
    return reply
      .code(400)
      .send({ message: error instanceof Error ? error.message : "日期格式不对" });
  }
});

app.get("/api/cities", async () => CITIES.map((city) => city.name));

app.put<{ Body: { baseUrl?: string; apiKey?: string; textModel?: string; visionModel?: string } }>(
  "/api/settings",
  async (request, reply) => {
    const body = request.body ?? {};
    if (body.apiKey !== undefined && body.apiKey.length > 0 && body.apiKey.trim().length < 8) {
      return reply.code(400).send({ message: "密钥看起来太短，请检查是否复制完整" });
    }
    const saved = writeSettings(settingsPath, body);
    return toPublicSettings(saved);
  },
);

app.get("/api/projects", async () => listProjects(projectsRoot));

app.post<{ Body: { name?: string } }>("/api/projects", async (request, reply) => {
  const name = request.body?.name?.trim();
  if (!name) {
    return reply.code(400).send({ message: "请先给这个企划起个名字" });
  }
  return createProject(projectsRoot, name);
});

app.get<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
  const meta = readProject(projectsRoot, request.params.id);
  if (!meta) {
    return reply.code(404).send({ message: "没有找到这个企划" });
  }
  return meta;
});

app.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
  "/api/projects/:id",
  async (request, reply) => {
    const existing = readProject(projectsRoot, request.params.id);
    if (!existing) {
      return reply.code(404).send({ message: "没有找到这个企划" });
    }
    const merged = { ...existing, ...request.body, id: existing.id } as typeof existing;
    return writeProject(projectsRoot, merged);
  },
);

app.post<{ Body: AiSuggestRequest }>("/api/ai/suggest", async (request, reply) => {
  const body = request.body;
  if (!body || !body.task || !body.brief) {
    return reply.code(400).send({ message: "请求缺少任务类型或立项信息" });
  }
  try {
    const settings = readSettings(settingsPath);
    const result = await suggest(settings, body);
    return { task: body.task, suggestions: result.suggestions, model: result.model };
  } catch (error) {
    if (error instanceof AiError) {
      return reply.code(error.status).send({ message: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ message: "AI 调用失败，可以重试一次" });
  }
});

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  bmp: "image/bmp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

app.post<{ Params: { id: string }; Body: IncomingReference }>(
  "/api/projects/:id/references",
  async (request, reply) => {
    try {
      const result = await addReference(projectsRoot, request.params.id, request.body ?? {});
      return reply.code(result.duplicate ? 200 : 201).send(result);
    } catch (error) {
      if (error instanceof ReferenceError) {
        return reply.code(error.status).send({ message: error.message });
      }
      request.log.error(error);
      return reply.code(500).send({ message: "导入失败，可以重试一次" });
    }
  },
);

app.post<{ Params: { id: string }; Body: { dataUrl?: string } }>(
  "/api/projects/:id/uploads",
  async (request, reply) => {
    const dataUrl = request.body?.dataUrl;
    if (!dataUrl) {
      return reply.code(400).send({ message: "缺少图片数据" });
    }
    try {
      return { path: saveUpload(projectsRoot, request.params.id, dataUrl) };
    } catch (error) {
      if (error instanceof ReferenceError) {
        return reply.code(error.status).send({ message: error.message });
      }
      request.log.error(error);
      return reply.code(500).send({ message: "上传失败，可以重试一次" });
    }
  },
);

app.patch<{
  Params: { id: string; refId: string };
  Body: { thumbDataUrl?: string; author?: string; note?: string; sourceUrl?: string };
}>("/api/projects/:id/references/:refId", async (request, reply) => {
  try {
    return updateReference(projectsRoot, request.params.id, request.params.refId, request.body ?? {});
  } catch (error) {
    if (error instanceof ReferenceError) {
      return reply.code(error.status).send({ message: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ message: "更新失败，可以重试一次" });
  }
});

app.get<{ Params: { id: string; kind: string; name: string } }>(
  "/api/projects/:id/assets/:kind/:name",
  async (request, reply) => {
    try {
      const asset = readAsset(projectsRoot, request.params.id, request.params.kind, request.params.name);
      return reply
        .header("Cache-Control", "private, max-age=3600")
        .type(CONTENT_TYPES[asset.ext] ?? "application/octet-stream")
        .send(asset.buffer);
    } catch (error) {
      if (error instanceof ReferenceError) {
        return reply.code(error.status).send({ message: error.message });
      }
      request.log.error(error);
      return reply.code(500).send({ message: "读取素材失败" });
    }
  },
);

app.get<{ Params: { id: string; name: string } }>(
  "/api/projects/:id/output/:name",
  async (request, reply) => {
    try {
      const file = readOutput(projectsRoot, request.params.id, request.params.name);
      return reply
        .header("Cache-Control", "no-store")
        .type(CONTENT_TYPES[file.ext] ?? "application/octet-stream")
        .send(file.buffer);
    } catch (error) {
      if (error instanceof ReferenceError) {
        return reply.code(error.status).send({ message: error.message });
      }
      request.log.error(error);
      return reply.code(500).send({ message: "读取导出文件失败" });
    }
  },
);

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

app.post<{ Body: AiAnalyzeRequest }>("/api/ai/analyze", async (request, reply) => {
  const body = request.body;
  if (!body?.projectId || !body.referenceId || !Array.isArray(body.dimensions)) {
    return reply.code(400).send({ message: "请求缺少企划、参考图或分析维度" });
  }
  if (body.dimensions.length === 0) {
    return reply.code(400).send({ message: "先勾选要提取的维度" });
  }
  const project = readProject(projectsRoot, body.projectId);
  if (!project) {
    return reply.code(404).send({ message: "没有找到这个企划" });
  }
  const reference = project.references.find((item) => item.id === body.referenceId);
  if (!reference) {
    return reply.code(404).send({ message: "没有找到这张参考图" });
  }

  const ext = path.extname(reference.file).slice(1).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    return reply.code(400).send({ message: `这个格式（${ext}）不支持图片分析` });
  }

  try {
    const settings = readSettings(settingsPath);
    const result = await analyzeReference(settings, {
      imagePath: path.join(projectsRoot, body.projectId, reference.file),
      mime,
      dimensions: body.dimensions,
      brief: project.brief,
    });
    return { items: result.items, model: result.model };
  } catch (error) {
    if (error instanceof AiError) {
      return reply.code(error.status).send({ message: error.message });
    }
    request.log.error(error);
    return reply.code(500).send({ message: "图片分析失败，可以重试一次" });
  }
});

app.post<{ Body: { projectId?: string; referenceId?: string } }>(
  "/api/ai/elements",
  async (request, reply) => {
    const body = request.body;
    if (!body?.projectId || !body.referenceId) {
      return reply.code(400).send({ message: "请求缺少企划或参考图" });
    }
    const project = readProject(projectsRoot, body.projectId);
    if (!project) {
      return reply.code(404).send({ message: "没有找到这个企划" });
    }
    const reference = project.references.find((item) => item.id === body.referenceId);
    if (!reference) {
      return reply.code(404).send({ message: "没有找到这张参考图" });
    }
    const ext = path.extname(reference.file).slice(1).toLowerCase();
    const mime = MIME_BY_EXT[ext];
    if (!mime) {
      return reply.code(400).send({ message: `这个格式（${ext}）不支持图片分析` });
    }
    try {
      const settings = readSettings(settingsPath);
      const result = await analyzeElements(settings, {
        imagePath: path.join(projectsRoot, body.projectId, reference.file),
        mime,
        brief: project.brief,
      });
      return { suggestions: result.suggestions, model: result.model };
    } catch (error) {
      if (error instanceof AiError) {
        return reply.code(error.status).send({ message: error.message });
      }
      request.log.error(error);
      return reply.code(500).send({ message: "元素提取失败，可以重试一次" });
    }
  },
);

/** 把一个企划导出成可分享的项目包（纯数据，不含图片文件） */
app.get<{ Params: { id: string } }>("/api/projects/:id/package", async (request, reply) => {
  const project = readProject(projectsRoot, request.params.id);
  if (!project) {
    return reply.code(404).send({ message: "没有找到这个企划" });
  }
  return {
    format: "shootplan-package",
    version: 1,
    exportedAt: new Date().toISOString(),
    project: {
      name: project.name,
      brief: project.brief,
      plan: project.plan,
      research: project.research,
      ideaList: project.ideaList,
      lighting: project.lighting,
    },
  };
});

interface PackageBody {
  name?: string;
  format?: string;
  project?: {
    name?: string;
    brief?: unknown;
    plan?: unknown;
    research?: unknown;
    ideaList?: unknown;
    lighting?: unknown;
  };
}

/** 从项目包新建一个企划；图片不会跟着来，参考图需要自己重新导入 */
app.post<{ Body: PackageBody }>("/api/projects/import", async (request, reply) => {
  const body = request.body;
  const incoming = body?.project;
  if (!incoming) {
    return reply.code(400).send({ message: "项目包里没有找到企划内容" });
  }
  const name = body.name?.trim() || incoming.name?.trim() || "导入的企划";
  const created = createProjectFrom(projectsRoot, name, {
    brief: incoming.brief as ProjectMeta["brief"],
    plan: incoming.plan as ProjectMeta["plan"],
    research: incoming.research as ProjectMeta["research"],
    ideaList: Array.isArray(incoming.ideaList) ? (incoming.ideaList as ProjectMeta["ideaList"]) : [],
    lighting: Array.isArray(incoming.lighting) ? (incoming.lighting as ProjectMeta["lighting"]) : [],
    references: [],
    board: { items: [], links: [], groups: [] },
  });
  return created;
});

/** 以某个企划为蓝本新建：复制写作骨架（场景、风格、布光、灵感文本），换成新的人物设定 */
app.post<{ Body: { sourceId?: string; name?: string; brief?: ProjectMeta["brief"] } }>(
  "/api/projects/clone",
  async (request, reply) => {
    const body = request.body;
    if (!body?.sourceId) {
      return reply.code(400).send({ message: "缺少蓝本企划" });
    }
    const source = readProject(projectsRoot, body.sourceId);
    if (!source) {
      return reply.code(404).send({ message: "没有找到蓝本企划" });
    }
    const name = body.name?.trim() || `${source.name} · 新拍`;
    const created = createProjectFrom(projectsRoot, name, {
      brief: { ...source.brief, ...(body.brief ?? {}) },
      plan: { ...source.plan, venue: "", timeWindow: "" },
      research: { character: "", theme: source.research.theme },
      ideaList: [],
      lighting: [],
      references: [],
      board: { items: [], links: [], groups: [] },
    });
    return created;
  },
);

app.post<{ Params: { id: string } }>("/api/projects/:id/export", async (request, reply) => {
  const project = readProject(projectsRoot, request.params.id);
  if (!project) {
    return reply.code(404).send({ message: "没有找到这个企划" });
  }

  let sun = null;
  const city = lookupCity(project.plan.city);
  if (city && /^\d{4}-\d{2}-\d{2}$/.test(project.plan.date)) {
    try {
      sun = computeSunTimes(project.plan.date, city);
    } catch {
      sun = null;
    }
  }

  try {
    const result = await exportProject({ projectsRoot, repoRoot, project, sun });
    const outputPath = (target: string) =>
      `/api/projects/${encodeURIComponent(project.id)}/output/${encodeURIComponent(path.basename(target))}`;
    return {
      docx: outputPath(result.docx),
      pdf: result.pdf ? outputPath(result.pdf) : "",
      fileStem: result.fileStem,
    };
  } catch (error) {
    request.log.error(error);
    return reply
      .code(500)
      .send({ message: error instanceof Error ? error.message : "导出失败，可以重试一次" });
  }
});

app.patch<{ Params: { id: string }; Body: { board?: Board } }>(
  "/api/projects/:id/board",
  async (request, reply) => {
    const project = readProject(projectsRoot, request.params.id);
    if (!project) {
      return reply.code(404).send({ message: "没有找到这个企划" });
    }
    const board = request.body?.board;
    if (!board || !Array.isArray(board.items) || !Array.isArray(board.links)) {
      return reply.code(400).send({ message: "公共区数据格式不对" });
    }
    return writeProject(projectsRoot, { ...project, board });
  },
);

try {
  await app.listen({ port: SERVER_PORT, host: "127.0.0.1" });
  app.log.info(`企划目录：${projectsRoot}`);
  if (!existsSync(settingsPath)) {
    app.log.info("尚未配置 AI 密钥，先在设置页填入 DeepSeek 密钥");
  }
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
