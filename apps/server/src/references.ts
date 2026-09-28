import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { ReferenceCategory, ReferenceImage } from "@studio/shared";

import { readProject, writeProject } from "./projects";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_CATEGORIES: ReferenceCategory[] = ["abstract", "artwork", "cosplay"];
export const ASSET_KINDS = ["refs", "thumbs", "uploads", "generated"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export class ReferenceError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ReferenceError";
    this.status = status;
  }
}

export interface IncomingReference {
  category?: string;
  /** 本地文件导入时传 data URL */
  dataUrl?: string;
  /** 从网址导入时传图片地址，由服务端下载，绕开浏览器跨域限制 */
  url?: string;
  thumbDataUrl?: string;
  sourceUrl?: string;
  sourceSite?: string;
  author?: string;
  note?: string;
}

function extensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "image/bmp": "bmp",
  };
  const ext = map[mime.toLowerCase()];
  if (!ext) {
    throw new ReferenceError(`不支持的图片格式：${mime}`);
  }
  return ext;
}

function decodeDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match || !match[1] || !match[2]) {
    throw new ReferenceError("图片数据格式不对，应该是 data URL");
  }
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > MAX_BYTES) {
    throw new ReferenceError("图片超过 25MB，先压缩再导入");
  }
  return { mime: match[1], buffer };
}

async function downloadImage(url: string): Promise<{ mime: string; buffer: Buffer }> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ReferenceError("下载失败，站点可能不允许程序访问，可以手动保存图片后再导入", 502);
  }
  if (!response.ok) {
    if (response.status === 404 || response.status === 410) {
      throw new ReferenceError(
        `这个地址打不开（${response.status}），确认复制的是图片直链，或者手动保存图片后再导入`,
        502,
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new ReferenceError(
        `站点不允许程序访问（${response.status}），手动保存图片后再导入`,
        502,
      );
    }
    throw new ReferenceError(`下载失败（${response.status}），可以稍后重试`, 502);
  }
  const mime = (response.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    throw new ReferenceError("图片超过 25MB，先压缩再导入");
  }
  if (!mime.startsWith("image/")) {
    throw new ReferenceError("这个地址不是图片，请确认复制的是图片直链");
  }
  return { mime, buffer };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function parseCategory(value: string | undefined): ReferenceCategory {
  if (value && (ALLOWED_CATEGORIES as string[]).includes(value)) {
    return value as ReferenceCategory;
  }
  throw new ReferenceError("请先选择这张图属于哪一类");
}

function projectDir(projectsRoot: string, projectId: string): string {
  return path.join(projectsRoot, projectId);
}

export async function addReference(
  projectsRoot: string,
  projectId: string,
  incoming: IncomingReference,
): Promise<{ reference: ReferenceImage; duplicate: boolean }> {
  const project = readProject(projectsRoot, projectId);
  if (!project) {
    throw new ReferenceError("没有找到这个企划", 404);
  }
  const category = parseCategory(incoming.category);

  const source = incoming.dataUrl
    ? decodeDataUrl(incoming.dataUrl)
    : incoming.url
      ? await downloadImage(incoming.url)
      : null;
  if (!source) {
    throw new ReferenceError("缺少图片数据或图片地址");
  }

  const hash = createHash("sha256").update(source.buffer).digest("hex");
  const existing = project.references.find((item) => item.hash === hash);
  if (existing) {
    return { reference: existing, duplicate: true };
  }

  const ext = extensionFromMime(source.mime);
  const id = hash.slice(0, 12);
  const dir = projectDir(projectsRoot, projectId);
  const refsDir = path.join(dir, "assets", "refs");
  const thumbsDir = path.join(dir, "assets", "thumbs");
  mkdirSync(refsDir, { recursive: true });
  mkdirSync(thumbsDir, { recursive: true });

  const fileName = `${id}.${ext}`;
  writeFileSync(path.join(refsDir, fileName), source.buffer);

  let thumbPath = "";
  if (incoming.thumbDataUrl) {
    const thumb = decodeDataUrl(incoming.thumbDataUrl);
    writeFileSync(path.join(thumbsDir, `${id}.jpg`), thumb.buffer);
    thumbPath = `assets/thumbs/${id}.jpg`;
  }

  const sourceUrl = incoming.sourceUrl?.trim() || incoming.url?.trim() || "";
  const reference: ReferenceImage = {
    id,
    category,
    hash,
    file: `assets/refs/${fileName}`,
    thumb: thumbPath,
    sourceUrl,
    sourceSite: incoming.sourceSite?.trim() || hostOf(sourceUrl),
    author: incoming.author?.trim() ?? "",
    note: incoming.note?.trim() ?? "",
    addedAt: new Date().toISOString(),
  };

  project.references = [...project.references, reference];
  writeProject(projectsRoot, project);
  return { reference, duplicate: false };
}

export function updateReference(
  projectsRoot: string,
  projectId: string,
  referenceId: string,
  patch: { thumbDataUrl?: string; author?: string; note?: string; sourceUrl?: string },
): ReferenceImage {
  const project = readProject(projectsRoot, projectId);
  if (!project) {
    throw new ReferenceError("没有找到这个企划", 404);
  }
  const index = project.references.findIndex((item) => item.id === referenceId);
  const current = project.references[index];
  if (!current) {
    throw new ReferenceError("没有找到这张参考图", 404);
  }

  const next: ReferenceImage = { ...current };
  if (patch.thumbDataUrl) {
    const thumb = decodeDataUrl(patch.thumbDataUrl);
    const thumbsDir = path.join(projectDir(projectsRoot, projectId), "assets", "thumbs");
    mkdirSync(thumbsDir, { recursive: true });
    writeFileSync(path.join(thumbsDir, `${referenceId}.jpg`), thumb.buffer);
    next.thumb = `assets/thumbs/${referenceId}.jpg`;
  }
  if (patch.author !== undefined) {
    next.author = patch.author.trim();
  }
  if (patch.note !== undefined) {
    next.note = patch.note.trim();
  }
  if (patch.sourceUrl !== undefined) {
    next.sourceUrl = patch.sourceUrl.trim();
    next.sourceSite = hostOf(next.sourceUrl);
  }

  project.references = project.references.map((item, i) => (i === index ? next : item));
  writeProject(projectsRoot, project);
  return next;
}

/** 读取企划目录下的素材文件，供前端显示 */
/** 保存用户上传的图片（例如自己画的灯位图），返回相对路径 */
export function saveUpload(projectsRoot: string, projectId: string, dataUrl: string): string {
  const project = readProject(projectsRoot, projectId);
  if (!project) {
    throw new ReferenceError("没有找到这个企划", 404);
  }
  const { mime, buffer } = decodeDataUrl(dataUrl);
  const ext = extensionFromMime(mime);
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
  const dir = path.join(projectDir(projectsRoot, projectId), "assets", "uploads");
  mkdirSync(dir, { recursive: true });
  const fileName = `${hash}.${ext}`;
  writeFileSync(path.join(dir, fileName), buffer);
  return `assets/uploads/${fileName}`;
}

export function readAsset(
  projectsRoot: string,
  projectId: string,
  kind: string,
  name: string,
): { buffer: Buffer; ext: string } {
  if (!(ASSET_KINDS as readonly string[]).includes(kind)) {
    throw new ReferenceError("素材类型不对", 404);
  }
  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    throw new ReferenceError("文件名不合法", 400);
  }
  const file = path.join(projectDir(projectsRoot, projectId), "assets", kind, name);
  if (!existsSync(file)) {
    throw new ReferenceError(`素材不存在：${path.relative(projectsRoot, file)}`, 404);
  }
  return { buffer: readFileSync(file), ext: path.extname(name).slice(1).toLowerCase() };
}

/** 读取导出目录（outout/）下的文件，docx 与 pdf 走这里下载 */
export function readOutput(
  projectsRoot: string,
  projectId: string,
  name: string,
): { buffer: Buffer; ext: string } {
  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    throw new ReferenceError("文件名不合法", 400);
  }
  const file = path.join(projectDir(projectsRoot, projectId), "output", name);
  if (!existsSync(file)) {
    throw new ReferenceError(`导出文件不存在：${name}`, 404);
  }
  return { buffer: readFileSync(file), ext: path.extname(name).slice(1).toLowerCase() };
}
