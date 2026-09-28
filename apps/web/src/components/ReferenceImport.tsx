import { useRef, useState } from "react";

import {
  REFERENCE_CATEGORY_LABEL,
  type ProjectMeta,
  type ReferenceCategory,
  type SiteRecommendation,
} from "@studio/shared";

import { api, assetUrl } from "@/lib/api";

import styles from "./ReferenceImport.module.css";
import { SiteDirectory } from "./SiteDirectory";

interface ReferenceImportProps {
  project: ProjectMeta;
  sites: SiteRecommendation[];
  onChanged: () => Promise<void> | void;
  /** 带着这张图跳到黑板，进布置台 */
  onOpenInBoard: (referenceId: string) => void;
}

const CATEGORIES: ReferenceCategory[] = ["abstract", "artwork", "cosplay"];

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("解析图片失败"));
    image.src = src;
  });
}

/** 浏览器端生成缩略图，避免把原图重复塞进列表 */
async function shrink(dataUrl: string, max = 480): Promise<string> {
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("生成缩略图失败");
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("读取本地图片失败");
  }
  return readAsDataUrl(await response.blob());
}

export function ReferenceImport({ project, sites, onChanged, onOpenInBoard }: ReferenceImportProps) {
  const [category, setCategory] = useState<ReferenceCategory>("abstract");
  const [sourceUrl, setSourceUrl] = useState("");
  const [author, setAuthor] = useState("");
  const [note, setNote] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const total = project.references.length;
  const countOf = (value: ReferenceCategory) =>
    project.references.filter((item) => item.category === value).length;

  const beginBatch = () => {
    setBusy(true);
    setError(null);
    setMessage(null);
  };

  const finishBatch = async (added: number, skipped: number, failed: string[]) => {
    setBusy(false);
    if (failed.length > 0) {
      setError(failed.slice(0, 2).join("；"));
    }
    const parts: string[] = [];
    if (added > 0) {
      parts.push(`新增 ${added} 张`);
    }
    if (skipped > 0) {
      parts.push(`重复跳过 ${skipped} 张`);
    }
    setMessage(parts.length > 0 ? parts.join("，") : null);
    await onChanged();
  };

  const importFiles = async (files: File[]) => {
    if (files.length === 0) {
      return;
    }
    beginBatch();
    let added = 0;
    let skipped = 0;
    const failed: string[] = [];

    for (const file of files) {
      try {
        if (file.size > 25 * 1024 * 1024) {
          throw new Error(`${file.name} 超过 25MB`);
        }
        const dataUrl = await readAsDataUrl(file);
        const thumbDataUrl = await shrink(dataUrl);
        const result = await api.addReference(project.id, {
          category,
          dataUrl,
          thumbDataUrl,
          sourceUrl,
          author,
          note,
        });
        if (result.duplicate) {
          skipped += 1;
        } else {
          added += 1;
        }
      } catch (fileError) {
        failed.push(fileError instanceof Error ? fileError.message : `${file.name} 导入失败`);
      }
    }

    await finishBatch(added, skipped, failed);
  };

  const importFromUrl = async () => {
    const target = imageUrl.trim();
    if (!target) {
      return;
    }
    beginBatch();
    try {
      const result = await api.addReference(project.id, {
        category,
        url: target,
        sourceUrl: sourceUrl.trim() || target,
        author,
        note,
      });
      if (result.duplicate) {
        await finishBatch(0, 1, []);
      } else {
        if (!result.reference.thumb) {
          const dataUrl = await fetchAsDataUrl(assetUrl(project.id, result.reference.file));
          const thumbDataUrl = await shrink(dataUrl);
          await api.updateReference(project.id, result.reference.id, { thumbDataUrl });
        }
        setImageUrl("");
        await finishBatch(1, 0, []);
      }
    } catch (urlError) {
      await finishBatch(0, 0, [
        urlError instanceof Error ? urlError.message : "从网址导入失败",
      ]);
    }
  };

  return (
    <div className={styles.wrap}>
      <SiteDirectory sites={sites} />

      <div className={styles.pocketLabel}>口袋</div>
      <p className={styles.boardHint}>
        公共区已有 {project.board.items.length} 项。点「去黑板处理」会带着这张图跳到 S4，
        在那里抽元素、写灵感，或者只把元素作为组成元素放进去；口袋里始终保留原图。
      </p>
      <div className={styles.categories}>
        {CATEGORIES.map((value) => (
          <button
            key={value}
            type="button"
            className={styles.category}
            data-active={category === value || undefined}
            onClick={() => setCategory(value)}
          >
            {REFERENCE_CATEGORY_LABEL[value]}
            <span className={styles.count}>{countOf(value)}</span>
          </button>
        ))}
        <span className={styles.total}>共 {total} 张</span>
      </div>

      <div className={styles.sourceRow}>
        <label className={styles.field}>
          <span>来源链接</span>
          <input
            value={sourceUrl}
            placeholder="作品页地址，从网址导入时留空则用图片地址"
            onChange={(event) => setSourceUrl(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>作者</span>
          <input value={author} onChange={(event) => setAuthor(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>备注</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      </div>

      <div
        className={styles.dropZone}
        data-dragging={dragging || undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void importFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <p className={styles.dropTitle}>把例图拖到这里</p>
        <p className={styles.dropHint}>
          支持 JPG、PNG、WebP，单张不超过 25MB。放进来的图归到「{REFERENCE_CATEGORY_LABEL[category]}」。
        </p>
        <button
          type="button"
          className={styles.pick}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          选择文件
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            void importFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </div>

      <div className={styles.urlRow}>
        <input
          value={imageUrl}
          placeholder="或者粘贴图片直链，由本地服务下载后落盘"
          onChange={(event) => setImageUrl(event.target.value)}
        />
        <button type="button" className={styles.primary} disabled={busy} onClick={() => void importFromUrl()}>
          {busy ? "处理中" : "从网址导入"}
        </button>
      </div>

      {message ? <p className={styles.message}>{message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {project.references.length === 0 ? (
        <p className={styles.empty}>还没有导入例图。导入后可以在这里核对来源和分类。</p>
      ) : (
        <ul className={styles.grid}>
          {project.references.map((item) => (
            <li key={item.id} className={styles.card}>
              <div className={styles.thumb}>
                <img
                  src={assetUrl(project.id, item.thumb || item.file)}
                  alt={item.note || item.author || REFERENCE_CATEGORY_LABEL[item.category]}
                  loading="lazy"
                />
              </div>
              <div className={styles.meta}>
                <span className={styles.badge}>{REFERENCE_CATEGORY_LABEL[item.category]}</span>
                {item.sourceSite ? <span className={styles.site}>{item.sourceSite}</span> : null}
              </div>
              {item.author ? <p className={styles.author}>{item.author}</p> : null}
              {item.note ? <p className={styles.note}>{item.note}</p> : null}
              {item.sourceUrl ? (
                <a className={styles.link} href={item.sourceUrl} target="_blank" rel="noreferrer">
                  打开来源
                </a>
              ) : null}
              <button
                type="button"
                className={styles.take}
                onClick={() => onOpenInBoard(item.id)}
              >
                去黑板处理
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.footnote}>
        例图只用于内部创作参考，导出的方案里会标注来源。需要商用授权请另行联系作者。
      </p>
    </div>
  );
}
