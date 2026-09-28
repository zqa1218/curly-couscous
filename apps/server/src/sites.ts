import type { SiteRecommendation } from "@studio/shared";

/**
 * 找例图的推荐站点。searchUrl 里的 {q} 由前端替换成用户输入的关键词。
 * 这些链接都做过连通性实测：标了"仅浏览器"或"需要登录"的，
 * 是站点对程序访问返回 403，用浏览器打开是正常的。
 */
export const SITE_RECOMMENDATIONS: SiteRecommendation[] = [
  {
    id: "pixiv",
    name: "Pixiv",
    category: "artwork",
    searchUrl: "https://www.pixiv.net/tags/{q}",
    what: "画师原画主站，同角色同风格的作品最集中",
    note: "看全需要登录；图片不能直接抓，手动保存后再拖进来",
  },
  {
    id: "danbooru",
    name: "Danbooru",
    category: "artwork",
    searchUrl: "https://danbooru.donmai.us/posts?tags={q}",
    what: "标签体系最细，适合按发型、服装、姿势、配色精确检索",
    note: "标签用英文或罗马音，多个标签用下划线连接；程序访问被拦，仅浏览器可用",
  },
  {
    id: "gelbooru",
    name: "Gelbooru",
    category: "artwork",
    searchUrl: "https://gelbooru.com/index.php?page=post&s=list&tags={q}",
    what: "出图量大，适合找同一角色的不同画师版本",
    note: "标签用英文，多个标签用空格分隔",
  },
  {
    id: "yandere",
    name: "yande.re",
    category: "artwork",
    searchUrl: "https://yande.re/post?tags={q}",
    what: "高清壁纸级原画，适合看细节与材质",
    note: "标签用英文",
  },
  {
    id: "safebooru",
    name: "Safebooru",
    category: "artwork",
    searchUrl: "https://safebooru.org/index.php?page=post&s=list&tags={q}",
    what: "内容干净的同类图库，适合找能安全引用的参考",
    note: "标签用英文",
  },
  {
    id: "artstation",
    name: "ArtStation",
    category: "artwork",
    searchUrl: "https://www.artstation.com/search?q={q}",
    what: "游戏原画与概念设定最强，适合找场景与角色设计稿",
    note: "程序访问被拦，仅浏览器可用",
  },
  {
    id: "huaban",
    name: "花瓣",
    category: "abstract",
    searchUrl: "https://huaban.com/search?q={q}",
    what: "氛围、配色、版面类的抽象参考，适合定调",
    note: "中文关键词即可",
  },
  {
    id: "zcool",
    name: "站酷",
    category: "abstract",
    searchUrl: "https://www.zcool.com.cn/search/content?word={q}",
    what: "国内摄影师与设计师的成片，适合找整体调性",
    note: "中文关键词即可",
  },
  {
    id: "lofter",
    name: "Lofter 标签",
    category: "cosplay",
    searchUrl: "https://www.lofter.com/tag/{q}",
    what: "国内 Cos 与写真的成片聚集地，能看到完整企划",
    note: "中文关键词即可",
  },
  {
    id: "worldcosplay",
    name: "WorldCosplay",
    category: "cosplay",
    searchUrl: "https://worldcosplay.net/search?q={q}",
    what: "按角色与作品筛选的 Cos 站，有原作者授权体系",
    note: "关键词用角色英文名命中率更高",
  },
  {
    id: "bilibili",
    name: "哔哩哔哩",
    category: "cosplay",
    searchUrl: "https://search.bilibili.com/all?keyword={q}+cos",
    what: "图片与视频都有，能看到动作和造型的完整过程",
    note: "中文关键词即可",
  },
  {
    id: "weibo",
    name: "微博",
    category: "cosplay",
    searchUrl: "https://s.weibo.com/weibo?q={q}+cos",
    what: "最新最快的 Cos 出片，适合找近期流行的拍摄手法",
    note: "搜索需要登录",
  },
];
