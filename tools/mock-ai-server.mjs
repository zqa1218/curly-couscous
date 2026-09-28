#!/usr/bin/env node
/**
 * 开发期用的假 AI 接口，模拟 OpenAI 兼容的 /chat/completions。
 * 用途：在没有真实密钥的情况下验证「点 AI 按钮 → 出候选 → 采纳进表单」这条链路。
 *
 *   node tools/mock-ai-server.mjs          # 监听 127.0.0.1:4399
 *
 * 把设置页的接口地址改成 http://127.0.0.1:4399，密钥随便填，就能跑通。
 * 密钥填 bad-key 时返回 401，用来验证错误提示。
 */

import { createServer } from "node:http";

const PORT = 4399;

const FIXTURES = {
  道具: [
    ["藤编提篮", "浅棕色原色藤编，装一束干花，给画面补一个自然的重量点"],
    ["黄铜台灯", "暖光 2700K，放在画面边缘做点光源，能带出皮肤的通透感"],
    ["亚麻毯", "米灰色粗织亚麻，搭在肩上或椅背，增加材质层次"],
    ["旧书与信封", "泛黄纸张，平放在桌面作前景，虚化后形成暖色块"],
    ["玻璃花瓶", "透明直筒瓶配一枝尤加利，逆光下产生通透的高光"],
  ],
  风格: [
    ["暖调胶片", "低饱和暖黄调，适合木质与藤编道具，高光轻微溢出"],
    ["秋日森系", "以落叶与绿植为背景，光线从侧面进来，皮肤保留暖调"],
    ["复古港风", "偏青绿的暗部配红光，湿地面反光能强化夜晚质感"],
    ["日系清透", "高调低对比，曝光往上半档，适合窗光与浅色服装"],
    ["复古暗调", "压暗周围留一束主光，突出人物轮廓和道具质感"],
    ["松弛纪实", "手持抓拍为主，轻微颗粒，减少摆拍痕迹"],
  ],
  场景: [
    ["老城红砖墙", "下午三点到五点的斜射光，墙面纹理清晰，适合半身与近景"],
    ["有天光的旧厂房", "顶部均匀散射光，阴天也能拍，适合大场景全身"],
    ["日系杂货铺门口", "招牌与门框能当天然画框，上午侧光，人流较少"],
    ["有窗光的旧公寓", "单侧窗光，光比约一比三，适合安静特写"],
    ["湖边芦苇滩", "日落前一小时逆光，芦苇边缘会有轮廓光"],
  ],
  手法: [
    ["低位仰拍", "机位放到腰以下，人物显得挺拔，适合全身展示服装廓形"],
    ["跟拍抓拍", "与人物同步行走，快门保持 1/250 以上，抓自然状态"],
    ["前景遮挡", "用树叶或玻璃当前景压出层次，焦点留在眼睛上"],
    ["长焦压缩", "85mm 以上离远拍，背景压缩后更容易分离主体"],
    ["低角度逆光", "让太阳落在人物后方，用反光板补面部，能得到发光发丝"],
  ],
  前期: [
    ["烟饼薄雾", "需要通风场地与灭火准备，薄雾能让逆光形成可见光柱"],
    ["手持喷雾水汽", "对着逆光喷水，得到细碎高光，注意保护镜头"],
    ["风扇吹动衣料", "小风扇放在镜头侧下方，让衣摆和发丝有轻微动态"],
    ["彩色道具光", "用色片给背景打一块冷光，与暖色主光形成互补"],
    ["镜面反射", "地上铺薄水或放镜面道具，得到对称构图"],
  ],
  后期: [
    ["暖调胶片质感", "高光加暖、暗部偏青，加轻微颗粒，注意肤色不要偏黄"],
    ["柔和光晕", "对高光区域做轻微扩散，强度控制在十以内"],
    ["双重曝光", "需要同机位拍一张空景，后期叠加时保留人物边缘"],
    ["背景替换合成", "前期背景要拍干净，边缘留出足够的虚化过渡"],
    ["局部提亮", "只提亮面部和道具受光面，不要整体拉曝光"],
  ],
  细化: [
    ["补上光线条件", "改成：阳伞遮挡的柔光下拍摄，主光来自侧前方四十五度，光比控制在一比二"],
    ["补上具体程度", "改成：轻微烟雾，只在逆光镜头里使用，浓度以能看见光柱但不遮挡人物为准"],
    ["补上执行顺序", "改成：先拍干净背景，再补前景道具，最后加烟雾拍逆光"],
  ],
};

function pick(text) {
  // 按「本次任务」那一行的特征短语判断，顺序从最具体到最宽泛
  const taskLine = text.split("本次任务：")[1]?.split("\n")[0] ?? text;
  if (taskLine.includes("细化")) return FIXTURES.细化;
  if (taskLine.includes("推荐几件可用道具")) return FIXTURES.道具;
  if (taskLine.includes("推荐风格关键词")) return FIXTURES.风格;
  if (taskLine.includes("拍摄场景类型")) return FIXTURES.场景;
  if (taskLine.includes("推荐前期拍摄手法")) return FIXTURES.手法;
  if (taskLine.includes("实拍阶段就能做出来")) return FIXTURES.前期;
  if (taskLine.includes("推荐后期可以做的效果")) return FIXTURES.后期;
  return FIXTURES.道具;
}

const server = createServer((request, response) => {
  if (request.method !== "POST" || !request.url?.startsWith("/chat/completions")) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: { message: "not found" } }));
    return;
  }

  let raw = "";
  request.on("data", (chunk) => {
    raw += chunk;
  });
  request.on("end", () => {
    const auth = request.headers.authorization ?? "";
    if (auth.includes("bad-key")) {
      response.writeHead(401, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: "invalid api key" } }));
      return;
    }

    const body = JSON.parse(raw || "{}");
    const userText = body.messages?.find((item) => item.role === "user")?.content ?? "";
    console.log("---- 收到的用户提示词 ----");
    console.log(userText.slice(0, 500));
    const suggestions = pick(userText).map(([title, detail]) => ({ title, detail }));

    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        id: "mock",
        model: body.model ?? "mock-model",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: JSON.stringify({ suggestions }) },
            finish_reason: "stop",
          },
        ],
      }),
    );
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock ai server: http://127.0.0.1:${PORT}`);
});
