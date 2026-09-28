import styles from "./HomePage.module.css";

interface HomePageProps {
  projectCount: number;
  onEnter: () => void;
  onCreate: () => void;
}

const FLOW = [
  { code: "S0-S2", title: "从需求出发", text: "填人物、道具、场景与风格，AI 给选址、时段、人物档案与主题定调，你挑。" },
  { code: "S3-S4", title: "找图与拆解", text: "按用途去对应站点找例图，收进口袋；在黑板抽元素、写灵感，或把元素连成一组让 AI 补全。" },
  { code: "S5-S7", title: "收成方案", text: "定稿灵感自动带上来源图，每条配一份布光，最后输出图文 PDF 与可继续编辑的 docx。" },
];

export function HomePage({ projectCount, onEnter, onCreate }: HomePageProps) {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>摄影企划工作台</p>
        <h1 className={styles.title}>印样台</h1>
        <p className={styles.lead}>
          把一句风格关键词，变成一份能直接开拍的方案。
          <br />
          从人物与场景开始，经过例图拆解、元素抽离与灵感连缀，最后落到一份带布光的图文方案。
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onEnter}>
            进入项目
          </button>
          <button type="button" className={styles.ghost} onClick={onCreate}>
            新建一个拍摄
          </button>
          <span className={styles.meta}>
            {projectCount > 0 ? `已有 ${projectCount} 个项目` : "还没有项目，从第一个开始"}
          </span>
        </div>
      </section>

      <section className={styles.flow}>
        {FLOW.map((item) => (
          <article key={item.code} className={styles.step}>
            <span className={styles.code}>{item.code}</span>
            <h2 className={styles.stepTitle}>{item.title}</h2>
            <p className={styles.stepText}>{item.text}</p>
          </article>
        ))}
      </section>

      <section className={styles.notes}>
        <p>AI 只提议，人做决定：所有 AI 产出都是候选，采纳之后才写进企划。</p>
        <p>每条灵感都能反查到来源图与抽离出的元素，导出时也带着走。</p>
        <p>时间不由模型猜：日出日落、黄金与蓝调时刻都是程序按经纬度算出来的。</p>
      </section>
    </div>
  );
}
