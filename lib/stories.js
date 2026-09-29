export const seed = () => [
  {
    id: "sample-dog",
    title: "小蓝的月亮",
    words: "小狗想把月亮带回家，给妈妈当小夜灯。",
    parent: "蓝色小狗戴着红围巾。",
    date: "2026-09-23",
    original: "/assets/dog.svg",
    image: "/assets/dog.svg",
    sample: true,
    kind: "dog",
    story: {
      ready: true,
      delivered: Date.now(),
      setting: "蓝色小狗和月亮一起散步。",
      adjustments: 0,
      variants: {},
      previous: {},
      position: 0,
    },
  },
  {
    id: "sample-garden",
    title: "会唱歌的花园",
    words: "每一朵花，都有自己的声音。",
    date: "2026-09-21",
    original: "/assets/garden.svg",
    image: "/assets/garden.svg",
    sample: true,
    kind: "garden",
  },
  {
    id: "sample-space",
    title: "去星星上做客",
    words: "我的火箭里，要带上小熊和饼干。",
    date: "2026-09-18",
    original: "/assets/space.svg",
    image: "/assets/space.svg",
    sample: true,
    kind: "space",
  },
];

const captions = {
  dog: [
    "小狗想把月亮带回家，给妈妈当小夜灯。",
    "小蓝走进安静的树林。树梢上，月亮露出半张脸，好像也想和它玩捉迷藏。",
    "小蓝来到池塘边，水里也藏着一轮月亮。它没有跳进去，只轻轻坐下，陪月亮看了一会儿星星。",
    "回家的路上，月亮一直跟着小蓝。原来不用把月亮装进口袋，它也可以陪自己走很远。",
  ],
  garden: [
    "每一朵花，都有自己的声音。",
    "风经过花园，粉色的小花轻轻摇头。它听见隔壁传来一个细细的声音，像雨滴落在叶子上。",
    "紫色的花没有急着唱。它先听了听朋友的声音，再把自己小小的旋律，放进风里。",
    "傍晚，每一朵花都唱得不一样。风把那些小小的声音装在一起，变成了花园自己的歌。",
  ],
  space: [
    "我的火箭里，要带上小熊和饼干。",
    "小火箭穿过软软的云，来到一颗安静的星星旁。窗外闪着一点光，好像有人在打招呼。",
    "星星上没有饼干店。小火箭里的朋友想了想，把带来的饼干分成两半，留一半给新朋友。",
    "回家时，星星送来一小片温暖的光。小火箭慢慢飞着，窗外的夜空，比来时更亲切了。",
  ],
};
export function pageImage(i, n) {
  if (i.story?.real)
    return n === 0 ? i.story.sourceImage : i.story.pages[n - 1].image;
  return n === 0
    ? i.image
    : i.kind === "dog"
      ? `/assets/story-${n}.svg`
      : i.image;
}
export function pageCaption(i, n) {
  if (i.story?.real)
    return n === 0
      ? i.story.words || i.story.setting
      : i.story.pages[n - 1].text;
  return n === 0 ? i.words : (captions[i.kind] || captions.dog)[n];
}

export const toneStyle = (tone) => ({
  filter:
    tone === "warm"
      ? "sepia(.28) saturate(1.15)"
      : tone === "soft"
        ? "saturate(.65) brightness(1.04)"
        : undefined,
});
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function automaticTitle(description, date) {
  const text = String(description || "")
    .trim()
    .replace(/\s+/g, " ");
  return text
    ? Array.from(text.split(/[。！？!?\n]/)[0])
        .slice(0, 16)
        .join("") || "小小想象"
    : `${date} 的小小想象`;
}
