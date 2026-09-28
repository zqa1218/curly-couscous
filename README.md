# 印样台 · 摄影企划工作台

把"一句风格关键词 + 人物和道具"变成可以直接开拍的完整方案，最后输出图文并茂的 PDF。

当前进度：**S0 到 S7 全流程可用**（立项 → 选址与时间 → 人物与主题 → 参考例图 → 黑板 → 灵感归档 → 布光 → 导出图文方案），并带首页与项目页。

- 使用教程：[docs/印样台使用教程.pdf](docs/印样台使用教程.pdf)（同目录也有 docx）
- 产品流程：[docs/01-产品流程方案.md](docs/01-产品流程方案.md)
- 开发计划与完成记录：[docs/02-执行计划.md](docs/02-执行计划.md)

## 快速启动

双击桌面上的「印样台」快捷方式，或直接运行仓库根目录的 `启动印样台.cmd`：它会拉起前后端并在就绪后打开浏览器。

也可以手工启动：

```powershell
pnpm install
pnpm dev
```

打开 http://localhost:5317。

## 启动

```powershell
pnpm install
pnpm dev
```

打开 http://localhost:5317。前端端口 5317，本地服务端口 4317，前端的 `/api` 会自动代理到服务端。

需要 Node 20 以上和 pnpm。本机已有 Node 24 与 pnpm 11，无需额外安装。

## 目录

```
apps/web/          前端应用（Vite + React + TypeScript）
apps/server/       本地服务（Fastify）
packages/shared/   前后端共用的类型与阶段定义
projects/          用户企划数据，每个企划一个文件夹，不进版本库
data/settings.json AI 配置，不进版本库
docs/              产品流程方案、执行计划、界面截图
tools/             已有的策划书生成器
```

## 企划数据怎么存

每个企划一个文件夹，`project.json` 是唯一真相源：

```
projects/项目名-20260928/
  project.json            阶段进度与立项信息
  assets/refs/            参考例图
  assets/uploads/         上传的布光图、模特照、道具照
  assets/generated/       AI 生成的图
  assets/thumbs/          缩略图
  board/board.excalidraw  黑板场景
  docs/                   各阶段导出的 Markdown
  output/                 导出的 PDF 与 docx
```

拷走整个文件夹就能换台机器继续。

## AI 配置

接口固定为 DeepSeek：`https://api.deepseek.com`，模型 `deepseek-flash`。

注意 DeepSeek 只有 `deepseek-flash` 支持图片输入，`deepseek-v4-pro` 不支持视觉，图片分析相关调用不要改成 pro。

密钥存在 `data/settings.json`，不进版本库，也不会打包进前端。

## 设计系统

视觉母题是蓝晒印相工艺：冷灰纸面、普鲁士蓝图像色、红笔批注。界面只用单一无衬线字族，靠字阶与字重建立层次；衬线体留给导出的文档。

改动设计令牌只需要动 `apps/web/src/styles/tokens.css`，全局生效。

## 开发期工具

`apps/web/public/_layout-probe.html` 把界面按 1440×900 渲染后整体缩小，用来在窄面板里检查桌面三栏布局，只用于开发期视觉检查。

## 附：已有的策划书生成器

`tools/build_shoot_plan.py` 与 `briefs/` 是上一阶段的成果，读一份 JSON 生成排版完整的策划书 docx，M7 的 PDF 导出会复用它。

```powershell
$py="C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
& $py "tools\build_shoot_plan.py" "briefs\示例-秋冬人像样片.json" -o "输出.docx"
```
