import { execFile } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import type { ProjectMeta, SunTimes } from "@studio/shared";

const run = promisify(execFile);

/** 优先用运行环境自带的 Python（已装 python-docx），其次找系统 Python */
function resolvePython(): string | null {
  const candidates = [
    process.env.SHOOTPLAN_PYTHON,
    process.env.USERPROFILE
      ? path.join(
          process.env.USERPROFILE,
          ".cache",
          "codex-runtimes",
          "codex-primary-runtime",
          "dependencies",
          "python",
          "python.exe",
        )
      : undefined,
    "python",
    "python3",
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (candidate.includes(path.sep) || candidate.includes("/")) {
      if (existsSync(candidate)) {
        return candidate;
      }
      continue;
    }
    return candidate; // 交给系统 PATH 解析
  }
  return null;
}

export interface ExportResult {
  docx: string;
  pdf: string;
  fileStem: string;
}

export async function exportProject(options: {
  projectsRoot: string;
  repoRoot: string;
  project: ProjectMeta;
  sun: SunTimes | null;
}): Promise<ExportResult> {
  const { projectsRoot, repoRoot, project, sun } = options;
  const projectDir = path.join(projectsRoot, project.id);
  const outputDir = path.join(projectDir, "output");
  mkdirSync(outputDir, { recursive: true });

  const adopted = project.ideaList.filter((entry) => entry.adopted);
  const ideas = adopted.map((entry, index) => ({
    id: entry.id,
    index: index + 1,
    source: entry.source,
    text: entry.text,
    plan: entry.plan,
    elements: entry.elements,
    images: entry.referenceIds
      .map((referenceId) => {
        const reference = project.references.find((item) => item.id === referenceId);
        return reference ? path.join(projectDir, reference.thumb || reference.file) : "";
      })
      .filter(Boolean),
  }));

  const lighting = project.lighting.flatMap((plan, index) => {
    const position = ideas.findIndex((idea) => idea.id === plan.ideaId);
    if (position < 0) {
      return [];
    }
    return [
      {
        index: index + 1,
        ideaIndex: position + 1,
        units: plan.units.map((unit) => ({ title: unit.title, detail: unit.detail })),
        note: plan.note,
        image: plan.image ? path.join(projectDir, plan.image) : "",
      },
    ];
  });

  const fileStem = `${project.name}-拍摄方案`;
  const payload = {
    name: project.name,
    exportedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    brief: project.brief,
    plan: project.plan,
    research: project.research,
    sun,
    ideas,
    lighting,
    outputDir,
    fileStem,
    makePdf: true,
  };

  const payloadPath = path.join(outputDir, "export-payload.json");
  writeFileSync(payloadPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const python = resolvePython();
  if (!python) {
    throw new Error("找不到可用的 Python，无法生成文档");
  }
  const script = path.join(repoRoot, "tools", "export_project_docx.py");
  if (!existsSync(script)) {
    throw new Error("导出脚本不存在，检查 tools/export_project_docx.py");
  }

  const { stdout } = await run(python, [script, payloadPath], {
    cwd: repoRoot,
    timeout: 300_000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  const parsed = JSON.parse(stdout.trim().split("\n").pop() ?? "{}") as {
    docx?: string;
    pdf?: string;
  };
  if (!parsed.docx) {
    throw new Error("导出脚本没有返回文档路径");
  }
  return { docx: parsed.docx, pdf: parsed.pdf ?? "", fileStem };
}
