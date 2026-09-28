import { useEffect, useMemo, useRef, useState } from "react";

import {
  DIMENSION_LABEL,
  REFERENCE_CATEGORY_LABEL,
  type AiSuggestion,
  type AnalysisDimension,
  type BoardElement,
  type BoardGroup,
  type BoardItem,
  type BoardItemKind,
  type BoardLink,
  type ProjectMeta,
} from "@studio/shared";

import { api, assetUrl } from "@/lib/api";
import { newId } from "@/lib/id";

import styles from "./Board.module.css";

const CARD_W = 150;
const CARD_H = 168;
const SURFACE_W = 1160;
const SURFACE_H = 560;
const PAGE_SIZE = 4;

const ALL_DIMENSIONS: AnalysisDimension[] = [
  "layout",
  "background",
  "mood",
  "lighting",
  "lens",
  "props",
  "color",
  "styling",
  "composition",
];

interface BoardProps {
  project: ProjectMeta;
  onChanged: () => Promise<void> | void;
  /** 从 S3 带着图跳过来时，直接把它放到布置台 */
  stageRequest?: { referenceId: string; at: number } | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** 从连线里找出和某张图连通的所有图，用来判断这一组有几个组成元素 */
function connectedIds(startId: string, links: BoardLink[]): string[] {
  const seen = new Set([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    for (const link of links) {
      const next =
        link.fromItemId === current
          ? link.toItemId
          : link.toItemId === current
            ? link.fromItemId
            : null;
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...seen];
}

function groupKey(ids: string[]): string {
  return [...ids].sort().join("|");
}

export function Board({ project, onChanged, stageRequest }: BoardProps) {
  const [items, setItems] = useState<BoardItem[]>(project.board.items);
  const [links, setLinks] = useState<BoardLink[]>(project.board.links);
  const [groups, setGroups] = useState<BoardGroup[]>(project.board.groups);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [stagedId, setStagedId] = useState<string | null>(null);

  const [elementCandidates, setElementCandidates] = useState<AiSuggestion[]>([]);
  const [pickedCandidates, setPickedCandidates] = useState<number[]>([]);
  const [stagedElements, setStagedElements] = useState<BoardElement[]>([]);
  const [stagedNote, setStagedNote] = useState("");
  const [stagedPlan, setStagedPlan] = useState("");

  const [pickedDimensions, setPickedDimensions] = useState<AnalysisDimension[]>([
    "lighting",
    "color",
  ]);
  const [groupNoteDraft, setGroupNoteDraft] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; grabX: number; grabY: number } | null>(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    setItems(project.board.items);
    setLinks(project.board.links);
    setGroups(project.board.groups);
    itemsRef.current = project.board.items;
  }, [project.board]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!stageRequest) {
      return;
    }
    setStagedId(stageRequest.referenceId);
    setElementCandidates([]);
    setPickedCandidates([]);
    setStagedElements([]);
    setStagedNote("");
    setStagedPlan("");
    setPage(
      Math.max(
        0,
        Math.floor(
          project.references.findIndex((item) => item.id === stageRequest.referenceId) / PAGE_SIZE,
        ),
      ),
    );
    // 只在请求变化时触发
  }, [stageRequest, project.references]);

  const referenceOf = (referenceId: string) =>
    project.references.find((item) => item.id === referenceId) ?? null;

  const totalPages = Math.max(1, Math.ceil(project.references.length / PAGE_SIZE));
  const pageIndex = Math.min(page, totalPages - 1);
  const pageRefs = project.references.slice(
    pageIndex * PAGE_SIZE,
    pageIndex * PAGE_SIZE + PAGE_SIZE,
  );

  const staged = stagedId ? referenceOf(stagedId) : null;
  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );
  const selectedLink = useMemo(
    () => links.find((link) => link.id === selectedLinkId) ?? null,
    [links, selectedLinkId],
  );

  /** 当前选中图所在的这一组，以及它是否已经补全过 */
  const currentGroup = useMemo(() => {
    if (!selected || selected.kind !== "component") {
      return null;
    }
    const memberIds = connectedIds(selected.id, links);
    if (memberIds.length < 2) {
      return { memberIds, saved: null as BoardGroup | null };
    }
    const saved = groups.find((group) => groupKey(group.memberIds) === groupKey(memberIds)) ?? null;
    return { memberIds, saved };
  }, [selected, links, groups]);

  const persist = async (nextItems: BoardItem[], nextLinks: BoardLink[], nextGroups: BoardGroup[]) => {
    setItems(nextItems);
    setLinks(nextLinks);
    setGroups(nextGroups);
    itemsRef.current = nextItems;
    try {
      await api.saveBoard(project.id, { items: nextItems, links: nextLinks, groups: nextGroups });
      await onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "公共区保存失败");
    }
  };

  const resetStaging = () => {
    setElementCandidates([]);
    setPickedCandidates([]);
    setStagedElements([]);
    setStagedNote("");
    setStagedPlan("");
    setError(null);
  };

  const itemContext = (item: BoardItem): string => {
    const reference = referenceOf(item.referenceId);
    const lines = [
      `【图】${reference?.sourceSite || "本地"}${reference?.author ? ` / ${reference.author}` : ""}`,
    ];
    if (item.elements.length > 0) {
      lines.push(
        `抽离出的元素：${item.elements.map((e) => `${e.name}（${e.detail}）`).join("；")}`,
      );
    }
    if (item.note) {
      lines.push(`人写的灵感：${item.note}`);
    }
    if (item.plan) {
      lines.push(`已生成的策划：${item.plan}`);
    }
    return lines.join("\n");
  };

  const extractElements = async () => {
    if (!stagedId) {
      return;
    }
    setBusy("elements");
    setError(null);
    try {
      const result = await api.elements(project.id, stagedId);
      setElementCandidates(result.suggestions);
      setPickedCandidates(result.suggestions.map((_, index) => index));
    } catch (elementError) {
      setError(elementError instanceof Error ? elementError.message : "元素提取失败");
    } finally {
      setBusy(null);
    }
  };

  const adoptElements = () => {
    const chosen = elementCandidates
      .filter((_, index) => pickedCandidates.includes(index))
      .map((item) => ({ id: newId(), name: item.title, detail: item.detail }));
    setStagedElements((current) => [...current, ...chosen]);
    setElementCandidates([]);
    setPickedCandidates([]);
  };

  const expandPlan = async () => {
    if (!staged) {
      return;
    }
    setBusy("expand");
    setError(null);
    try {
      const context = [
        `【图】${staged.sourceSite || "本地"}${staged.author ? ` / ${staged.author}` : ""}`,
        stagedElements.length > 0
          ? `抽离出的元素：${stagedElements.map((e) => `${e.name}（${e.detail}）`).join("；")}`
          : "",
        stagedNote ? `人写的灵感：${stagedNote}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const result = await api.suggest({ task: "expand-plan", brief: project.brief, context });
      setStagedPlan(result.suggestions[0]?.detail || result.suggestions[0]?.title || "");
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "补全失败");
    } finally {
      setBusy(null);
    }
  };

  const placeOnBoard = async (kind: BoardItemKind) => {
    if (!staged) {
      return;
    }
    const index = itemsRef.current.length;
    const perRow = 4;
    const item: BoardItem = {
      id: newId(),
      referenceId: staged.id,
      kind,
      x: 24 + (index % perRow) * 170,
      y: 24 + Math.floor(index / perRow) * 186,
      elements: stagedElements,
      note: kind === "idea" ? stagedNote : "",
      plan: kind === "idea" ? stagedPlan : "",
      analyses: [],
      createdAt: new Date().toISOString(),
    };
    await persist([...itemsRef.current, item], links, groups);
    setSelectedId(item.id);
    resetStaging();
  };

  const analyzeDimensions = async () => {
    if (!selected || pickedDimensions.length === 0) {
      return;
    }
    setBusy("dimensions");
    setError(null);
    try {
      const result = await api.analyze({
        projectId: project.id,
        referenceId: selected.referenceId,
        dimensions: pickedDimensions,
      });
      const text = result.items
        .map((item) => `【${DIMENSION_LABEL[item.dimension]}】${item.text}`)
        .join("\n");
      const next = itemsRef.current.map((item) =>
        item.id === selected.id
          ? {
              ...item,
              analyses: [
                ...item.analyses,
                {
                  id: newId(),
                  dimensions: result.items.map((entry) => entry.dimension),
                  text,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : item,
      );
      await persist(next, links, groups);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "分析失败");
    } finally {
      setBusy(null);
    }
  };

  /** 把这一组的组成元素交给模型，整合成一个完整想法 */
  const completeGroupWithAi = async () => {
    if (!currentGroup || currentGroup.memberIds.length < 2) {
      return;
    }
    const members = currentGroup.memberIds
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is BoardItem => Boolean(item));
    if (members.length < 2) {
      return;
    }
    setBusy("group");
    setError(null);
    try {
      const result = await api.suggest({
        task: "group-plan",
        brief: project.brief,
        context: members.map(itemContext).join("\n\n"),
      });
      const plan = result.suggestions[0]?.detail || result.suggestions[0]?.title || "";
      const note = members
        .map((member) => member.elements.map((element) => element.name).join("、"))
        .filter(Boolean)
        .join(" ＋ ");
      await saveGroup(plan, note);
    } catch (groupError) {
      setError(groupError instanceof Error ? groupError.message : "补全失败");
    } finally {
      setBusy(null);
    }
  };

  const saveGroup = async (plan: string, note: string) => {
    if (!currentGroup || currentGroup.memberIds.length < 2) {
      return;
    }
    const key = groupKey(currentGroup.memberIds);
    const rest = groups.filter((group) => groupKey(group.memberIds) !== key);
    const existing = groups.find((group) => groupKey(group.memberIds) === key);
    const group: BoardGroup = {
      id: existing?.id ?? newId(),
      memberIds: currentGroup.memberIds,
      note,
      plan,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    await persist(itemsRef.current, links, [...rest, group]);
  };

  const saveGroupByHand = async () => {
    if (!currentGroup || !groupNoteDraft.trim()) {
      return;
    }
    const members = currentGroup.memberIds
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is BoardItem => Boolean(item));
    const note = members
      .map((member) => member.elements.map((element) => element.name).join("、"))
      .filter(Boolean)
      .join(" ＋ ");
    await saveGroup(groupNoteDraft.trim(), note);
    setGroupNoteDraft("");
  };

  const completeLink = async (targetId: string) => {
    if (!linkFrom || linkFrom === targetId) {
      setLinkFrom(null);
      return;
    }
    const from = itemsRef.current.find((item) => item.id === linkFrom);
    const to = itemsRef.current.find((item) => item.id === targetId);
    if (!from || !to || from.kind !== "component" || to.kind !== "component") {
      setError("只有组成元素之间才能连线；完整想法已经是终态");
      setLinkFrom(null);
      return;
    }
    const created: BoardLink = {
      id: newId(),
      fromItemId: linkFrom,
      toItemId: targetId,
      note: linkNote.trim(),
      plan: "",
      createdAt: new Date().toISOString(),
    };
    setLinkFrom(null);
    setLinkNote("");
    await persist(itemsRef.current, [...links, created], groups);
    setSelectedId(targetId);
    setSelectedLinkId(null);
  };

  const removeItem = async (itemId: string) => {
    const nextItems = itemsRef.current.filter((item) => item.id !== itemId);
    const nextLinks = links.filter(
      (link) => link.fromItemId !== itemId && link.toItemId !== itemId,
    );
    const nextGroups = groups.filter((group) => !group.memberIds.includes(itemId));
    setSelectedId(null);
    setSelectedLinkId(null);
    await persist(nextItems, nextLinks, nextGroups);
  };

  const centerOf = (item: BoardItem) => ({ x: item.x + CARD_W / 2, y: item.y + CARD_H / 2 });

  return (
    <div className={styles.stage}>
      <section className={styles.pocket}>
        <div className={styles.pocketHead}>
          <span className={styles.pocketTitle}>口袋</span>
          <span className={styles.pocketCount}>
            第 {pageIndex + 1} / {totalPages} 页 · 共 {project.references.length} 张
          </span>
          <div className={styles.pager}>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={pageIndex === 0}
              onClick={() => setPage(pageIndex - 1)}
            >
              上一页
            </button>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={pageIndex >= totalPages - 1}
              onClick={() => setPage(pageIndex + 1)}
            >
              下一页
            </button>
          </div>
        </div>
        {project.references.length === 0 ? (
          <p className={styles.pocketEmpty}>口袋里还没有图，先去 S3 收集。</p>
        ) : (
          <ul className={styles.pocketList}>
            {pageRefs.map((reference) => (
              <li key={reference.id}>
                <button
                  type="button"
                  className={styles.pocketItem}
                  data-active={stagedId === reference.id || undefined}
                  onClick={() => {
                    setStagedId(reference.id);
                    resetStaging();
                  }}
                >
                  <img
                    src={assetUrl(project.id, reference.thumb || reference.file)}
                    alt={reference.note || reference.author || "口袋里的参考图"}
                    loading="lazy"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {staged ? (
        <section className={styles.staging}>
          <div className={styles.stagingPreview}>
            <img src={assetUrl(project.id, staged.file)} alt="当前选中的参考图" />
            <p className={styles.stagingMeta}>
              {REFERENCE_CATEGORY_LABEL[staged.category]}
              {staged.sourceSite ? ` · ${staged.sourceSite}` : ""}
              {staged.author ? ` · ${staged.author}` : ""}
            </p>
          </div>

          <div className={styles.stagingPanel}>
            <div className={styles.stepRow}>
              <span className={styles.stepNo}>1</span>
              <div className={styles.stepBody}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={busy === "elements"}
                  onClick={() => void extractElements()}
                >
                  {busy === "elements" ? "AI 正在看图" : "AI 提取元素"}
                </button>
                <p className={styles.stepHint}>先让 AI 列出这张图里可以抽离复用的元素，再由你挑。</p>
              </div>
            </div>

            {elementCandidates.length > 0 ? (
              <div className={styles.candidatePanel}>
                <div className={styles.candidateHead}>勾选要抽离出来的元素</div>
                <ul className={styles.candidateList}>
                  {elementCandidates.map((item, index) => {
                    const active = pickedCandidates.includes(index);
                    return (
                      <li key={`${item.title}-${index}`}>
                        <button
                          type="button"
                          className={styles.candidate}
                          data-active={active || undefined}
                          onClick={() =>
                            setPickedCandidates((current) =>
                              active
                                ? current.filter((value) => value !== index)
                                : [...current, index],
                            )
                          }
                        >
                          <span className={styles.mark} data-active={active || undefined} />
                          <span>
                            <span className={styles.candidateTitle}>{item.title}</span>
                            <span className={styles.candidateDetail}>{item.detail}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className={styles.candidateFoot}>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={pickedCandidates.length === 0}
                    onClick={adoptElements}
                  >
                    抽离选中的 {pickedCandidates.length} 个元素
                  </button>
                </div>
              </div>
            ) : null}

            {stagedElements.length > 0 ? (
              <div className={styles.chips}>
                {stagedElements.map((element) => (
                  <span key={element.id} className={styles.chip} title={element.detail}>
                    {element.name}
                    <button
                      type="button"
                      className={styles.chipClose}
                      aria-label={`移除 ${element.name}`}
                      onClick={() =>
                        setStagedElements((current) => current.filter((e) => e.id !== element.id))
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className={styles.stepRow}>
              <span className={styles.stepNo}>2</span>
              <div className={styles.stepBody}>
                <textarea
                  className={styles.noteArea}
                  rows={3}
                  value={stagedNote}
                  placeholder="想直接做成完整想法时，在这里写灵感"
                  onChange={(event) => setStagedNote(event.target.value)}
                />
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={busy === "expand"}
                  onClick={() => void expandPlan()}
                >
                  {busy === "expand" ? "AI 正在补全" : "AI 补全成完整策划"}
                </button>
                <p className={styles.stepHint}>
                  只做组成元素的话，这一步可以跳过，直接走下面的第二个按钮。
                </p>
              </div>
            </div>

            {stagedPlan ? (
              <div className={styles.planBox}>
                <div className={styles.planHead}>补全后的策划</div>
                <p className={styles.planText}>{stagedPlan}</p>
              </div>
            ) : null}

            <div className={styles.stepRow}>
              <span className={styles.stepNo}>3</span>
              <div className={styles.stepBody}>
                <div className={styles.placeRow}>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={!stagedNote.trim() && !stagedPlan.trim()}
                    onClick={() => void placeOnBoard("idea")}
                  >
                    作为完整想法放入
                  </button>
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={stagedElements.length === 0}
                    onClick={() => void placeOnBoard("component")}
                  >
                    作为组成元素放入
                  </button>
                </div>
                <p className={styles.stepHint}>
                  <b>完整想法</b>是终态，进去之后不再参与连线；<b>组成元素</b>只带元素进去，必须和别的组成元素连起来，再由 AI 或你补全成完整想法。
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <p className={styles.stagingEmpty}>
          先在口袋翻页条里点一张图：AI 拆元素 → 你挑元素 → 要么补全成完整想法放进去，要么只把元素作为组成元素放进去。
        </p>
      )}

      <div className={styles.layout}>
        <div className={styles.surfaceWrap}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>公共区</h2>
            <span className={styles.sectionHint}>
              {items.filter((item) => item.kind === "idea").length} 个完整想法 ·{" "}
              {items.filter((item) => item.kind === "component").length} 个组成元素 ·{" "}
              {groups.length} 组已补全
            </span>
          </div>
          <div className={styles.surfaceScroll}>
            <div
              className={styles.surface}
              ref={surfaceRef}
              style={{ width: SURFACE_W, height: SURFACE_H }}
            >
              <svg className={styles.lines}>
                {links.map((link) => {
                  const from = items.find((item) => item.id === link.fromItemId);
                  const to = items.find((item) => item.id === link.toItemId);
                  if (!from || !to) {
                    return null;
                  }
                  const a = centerOf(from);
                  const b = centerOf(to);
                  return (
                    <g key={link.id}>
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.line} />
                      <circle cx={a.x} cy={a.y} r={3} className={styles.dot} />
                      <circle cx={b.x} cy={b.y} r={3} className={styles.dot} />
                    </g>
                  );
                })}
              </svg>

              {items.map((item) => {
                const reference = referenceOf(item.referenceId);
                return (
                  <div
                    key={item.id}
                    className={styles.card}
                    role="button"
                    tabIndex={0}
                    aria-label={`公共区里的${item.kind === "idea" ? "完整想法" : "组成元素"}${reference?.sourceSite ? `，来自 ${reference.sourceSite}` : ""}`}
                    data-selected={item.id === selectedId || undefined}
                    data-source={item.id === linkFrom || undefined}
                    data-kind={item.kind}
                    style={{ left: item.x, top: item.y, width: CARD_W, height: CARD_H }}
                    onPointerDown={(event) => {
                      const rect = surfaceRef.current?.getBoundingClientRect();
                      if (!rect) {
                        return;
                      }
                      event.currentTarget.setPointerCapture(event.pointerId);
                      dragRef.current = {
                        id: item.id,
                        grabX: event.clientX - rect.left - item.x,
                        grabY: event.clientY - rect.top - item.y,
                      };
                    }}
                    onPointerMove={(event) => {
                      const drag = dragRef.current;
                      const rect = surfaceRef.current?.getBoundingClientRect();
                      if (!drag || drag.id !== item.id || !rect) {
                        return;
                      }
                      const x = clamp(event.clientX - rect.left - drag.grabX, 0, SURFACE_W - CARD_W);
                      const y = clamp(event.clientY - rect.top - drag.grabY, 0, SURFACE_H - CARD_H);
                      setItems((current) =>
                        current.map((entry) => (entry.id === item.id ? { ...entry, x, y } : entry)),
                      );
                    }}
                    onPointerUp={() => {
                      if (dragRef.current?.id === item.id) {
                        dragRef.current = null;
                        void persist(itemsRef.current, links, groups);
                      }
                    }}
                    onClick={() => {
                      if (linkFrom && linkFrom !== item.id) {
                        void completeLink(item.id);
                        return;
                      }
                      setSelectedId(item.id);
                      setSelectedLinkId(null);
                      setGroupNoteDraft("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") {
                        return;
                      }
                      event.preventDefault();
                      if (linkFrom && linkFrom !== item.id) {
                        void completeLink(item.id);
                        return;
                      }
                      setSelectedId(item.id);
                      setSelectedLinkId(null);
                      setGroupNoteDraft("");
                    }}
                  >
                    <div className={styles.cardThumb}>
                      {reference ? (
                        <img
                          src={assetUrl(project.id, reference.thumb || reference.file)}
                          alt={reference.note || reference.author || "参考图"}
                          draggable={false}
                        />
                      ) : (
                        <span className={styles.missing}>原图已不在口袋里</span>
                      )}
                    </div>
                    <div className={styles.cardMeta}>
                      <span className={styles.kindTag} data-kind={item.kind}>
                        {item.kind === "idea" ? "完整想法" : "组成元素"}
                      </span>
                      {item.elements.length > 0 ? (
                        <span className={styles.cardBadge}>{item.elements.length} 元素</span>
                      ) : null}
                    </div>
                    {item.kind === "idea" && (item.plan || item.note) ? (
                      <p className={styles.cardText}>{(item.plan || item.note).slice(0, 36)}…</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className={styles.panel}>
          {!selected ? (
            <>
              <h2 className={styles.panelTitle}>公共选取区</h2>
              <p className={styles.panelText}>
                公共区里有两类东西：<b>完整想法</b>是已经补全过的终态，不参与连线；
                <b>组成元素</b>必须和别的组成元素连起来，连成一组后再由 AI 或你来补全成完整想法。
              </p>
              <p className={styles.panelText}>
                一组里可以有两个以上的组成元素，连线会自己串成一组。
              </p>
            </>
          ) : (
            <>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>
                  {selected.kind === "idea" ? "这个完整想法" : "这个组成元素"}
                </h2>
                <button type="button" className={styles.linkBtn} onClick={() => setSelectedId(null)}>
                  取消选中
                </button>
              </div>

              {selected.elements.length > 0 ? (
                <div className={styles.chips}>
                  {selected.elements.map((element) => (
                    <span key={element.id} className={styles.chip} title={element.detail}>
                      {element.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={styles.panelMeta}>这个没有抽离元素。</p>
              )}

              {selected.kind === "idea" ? (
                <>
                  {selected.note ? (
                    <>
                      <h3 className={styles.panelSub}>人写的灵感</h3>
                      <p className={styles.panelText}>{selected.note}</p>
                    </>
                  ) : null}
                  {selected.plan ? (
                    <>
                      <h3 className={styles.panelSub}>完整策划</h3>
                      <p className={styles.panelText}>{selected.plan}</p>
                    </>
                  ) : null}
                  <p className={styles.panelMeta}>
                    这是终态：如果还想让它参与连线，把这张图重新取用一次、只带元素放进公共区即可。
                  </p>
                </>
              ) : (
                <>
                  {currentGroup && currentGroup.memberIds.length >= 2 ? (
                    <>
                      <h3 className={styles.panelSub}>
                        这一组（{currentGroup.memberIds.length} 个组成元素）
                      </h3>
                      <ul className={styles.memberList}>
                        {currentGroup.memberIds.map((id) => {
                          const member = items.find((item) => item.id === id);
                          return (
                            <li key={id} className={styles.memberItem}>
                              {member?.elements.map((element) => element.name).join("、") ||
                                "（没有元素）"}
                            </li>
                          );
                        })}
                      </ul>

                      <button
                        type="button"
                        className={styles.primary}
                        disabled={busy === "group"}
                        onClick={() => void completeGroupWithAi()}
                      >
                        {busy === "group" ? "AI 正在整合" : "AI 补全这组成完整想法"}
                      </button>

                      <h3 className={styles.panelSub}>或者自己写</h3>
                      <textarea
                        className={styles.noteArea}
                        rows={3}
                        value={groupNoteDraft}
                        placeholder="把这一组整合成一个完整想法"
                        onChange={(event) => setGroupNoteDraft(event.target.value)}
                      />
                      <button
                        type="button"
                        className={styles.ghost}
                        disabled={!groupNoteDraft.trim()}
                        onClick={() => void saveGroupByHand()}
                      >
                        保存这一组
                      </button>

                      {currentGroup.saved?.plan ? (
                        <div className={styles.planBox}>
                          <div className={styles.planHead}>这一组补全的完整想法</div>
                          <p className={styles.planText}>{currentGroup.saved.plan}</p>
                          {currentGroup.saved.note ? (
                            <p className={styles.planMeta}>用到：{currentGroup.saved.note}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className={styles.panelMeta}>
                      还没连上别的组成元素。点下面的「开始连线」，再点另一张，就可以连成一组；一组可以继续连第三个。
                    </p>
                  )}

                  <div className={styles.panelActions}>
                    <button
                      type="button"
                      className={linkFrom === selected.id ? styles.primary : styles.ghost}
                      onClick={() => setLinkFrom(linkFrom === selected.id ? null : selected.id)}
                    >
                      {linkFrom === selected.id ? "再点另一个组成元素" : "开始连线"}
                    </button>
                    <button
                      type="button"
                      className={styles.ghost}
                      onClick={() => void removeItem(selected.id)}
                    >
                      从公共区移除
                    </button>
                  </div>
                </>
              )}

              <h3 className={styles.panelSub}>整图维度分析</h3>
              <div className={styles.dimensions}>
                {ALL_DIMENSIONS.map((dimension) => {
                  const active = pickedDimensions.includes(dimension);
                  return (
                    <button
                      key={dimension}
                      type="button"
                      className={styles.dimension}
                      data-active={active || undefined}
                      onClick={() =>
                        setPickedDimensions((current) =>
                          active
                            ? current.filter((value) => value !== dimension)
                            : [...current, dimension],
                        )
                      }
                    >
                      {DIMENSION_LABEL[dimension]}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className={styles.primary}
                disabled={busy === "dimensions" || pickedDimensions.length === 0}
                onClick={() => void analyzeDimensions()}
              >
                {busy === "dimensions" ? "AI 正在看图" : `分析这 ${pickedDimensions.length} 个维度`}
              </button>

              {selected.analyses.map((analysis) => (
                <div key={analysis.id} className={styles.analysis}>
                  {analysis.text.split("\n").map((line) => (
                    <p key={line} className={styles.analysisLine}>
                      {line}
                    </p>
                  ))}
                </div>
              ))}
            </>
          )}

          {selectedLink ? (
            <>
              <h3 className={styles.panelSub}>这条连线</h3>
              <p className={styles.panelMeta}>
                连线只是把组成元素串成一组，真正的想法补全后记在「这一组」里。
              </p>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => setSelectedLinkId(null)}
              >
                收起
              </button>
            </>
          ) : null}

          {error ? <p className={styles.error}>{error}</p> : null}
        </aside>
      </div>
    </div>
  );
}
