import type {
  BriefInput,
  IdeaEntry,
  LightingPlan,
  ProjectMeta,
  ProjectResearch,
  ShootPlan,
  SiteRecommendation,
  StageDefinition,
} from "@studio/shared";

import { StagePlaceholder } from "@/stages/StagePlaceholder";
import { STAGE_ACCENT, STAGE_GROUP } from "@/lib/stageColors";
import { STAGES } from "@studio/shared";
import type { StageId } from "@studio/shared";

import { BriefForm } from "./BriefForm";
import { Board } from "./Board";
import { CharacterTheme } from "./CharacterTheme";
import { IdeaList } from "./IdeaList";
import { LightingPlans } from "./LightingPlans";
import { ExportPanel } from "./ExportPanel";
import { LocationPlan } from "./LocationPlan";
import { ReferenceImport } from "./ReferenceImport";
import styles from "./StageWorkspace.module.css";

interface StageWorkspaceProps {
  stage: StageDefinition;
  project: ProjectMeta | null;
  savingBrief: boolean;
  onSaveBrief: (brief: BriefInput) => Promise<void>;
  onNeedSettings: () => void;
  onRefreshProject: () => Promise<void>;
  sites: SiteRecommendation[];
  onOpenInBoard: (referenceId: string) => void;
  boardRequest: { referenceId: string; at: number } | null;
  onSavePlan: (plan: ShootPlan) => Promise<void>;
  onSaveResearch: (research: ProjectResearch) => Promise<void>;
  onSaveIdeaList: (list: IdeaEntry[]) => Promise<void>;
  onSaveLighting: (plans: LightingPlan[]) => Promise<void>;
}

export function StageWorkspace({
  stage,
  project,
  savingBrief,
  onSaveBrief,
  onNeedSettings,
  onRefreshProject,
  sites,
  onOpenInBoard,
  boardRequest,
  onSavePlan,
  onSaveResearch,
  onSaveIdeaList,
  onSaveLighting,
}: StageWorkspaceProps) {
  return (
    <section className={styles.workspace} aria-label={`${stage.id} ${stage.title}`}>
      <header className={styles.head}>
        <div className={styles.band} aria-hidden="true">
          {STAGES.map((item) => (
            <span
              key={item.id}
              className={styles.bandSegment}
              data-current={item.id === stage.id || undefined}
              data-done={STAGES.findIndex((s) => s.id === stage.id) > STAGES.findIndex((s) => s.id === item.id) || undefined}
              style={{ background: STAGE_ACCENT[item.id as StageId] }}
            />
          ))}
        </div>
        <div className={styles.titleRow}>
          <span className={styles.code}>{stage.id}</span>
          <h1 className={styles.title}>{stage.title}</h1>
          <span className={styles.group}>{STAGE_GROUP[stage.id]}</span>
        </div>
        <span className={styles.underline} aria-hidden="true" />
        <dl className={styles.meta}>
          <div className={styles.metaItem}>
            <dt>产出</dt>
            <dd>{stage.produce}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt>你的决定</dt>
            <dd>{stage.decision}</dd>
          </div>
        </dl>
      </header>
      <div className={styles.body}>
        {project === null ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>还没有打开企划</h2>
            <p className={styles.emptyText}>
              在上方新建一个企划，或者从列表里选一个已有的。企划建好后，这里的输入内容会自动存进
              <code className={styles.code}>project.json</code>。
            </p>
          </div>
        ) : stage.kind === "input" ? (
          <BriefForm
            project={project}
            saving={savingBrief}
            onSave={onSaveBrief}
            onNeedSettings={onNeedSettings}
          />
        ) : stage.id === "S3" ? (
          <ReferenceImport
            project={project}
            sites={sites}
            onChanged={onRefreshProject}
            onOpenInBoard={onOpenInBoard}
          />
        ) : stage.id === "S4" ? (
          <Board project={project} onChanged={onRefreshProject} stageRequest={boardRequest} />
        ) : stage.id === "S1" ? (
          <LocationPlan
            project={project}
            saving={savingBrief}
            onSave={onSavePlan}
            onNeedSettings={onNeedSettings}
          />
        ) : stage.id === "S2" ? (
          <CharacterTheme
            project={project}
            saving={savingBrief}
            onSave={onSaveResearch}
            onNeedSettings={onNeedSettings}
          />
        ) : stage.id === "S5" ? (
          <IdeaList project={project} saving={savingBrief} onSave={onSaveIdeaList} />
        ) : stage.id === "S6" ? (
          <LightingPlans project={project} saving={savingBrief} onSave={onSaveLighting} />
        ) : stage.id === "S7" ? (
          <ExportPanel project={project} />
        ) : (
          <StagePlaceholder stage={stage} />
        )}
      </div>
    </section>
  );
}
