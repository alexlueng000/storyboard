import { pageImage, pageCaption } from "./stories.js";
import { loadImage } from "./media.js";
function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export async function createShareImage(i) {
  const snapshot = JSON.parse(JSON.stringify(i)),
    images = await Promise.all(
      [0, 1, 2, 3].map((n) => loadImage(pageImage(snapshot, n))),
    );
  const c = document.createElement("canvas");
  c.width = c.height = 1600;
  const x = c.getContext("2d");
  const rounded = (left, top, w, h, r, fill) => {
    x.beginPath();
    roundRect(x, left, top, w, h, r);
    x.fillStyle = fill;
    x.fill();
  };
  const star = (cx, cy, r, color) => {
    x.save();
    x.translate(cx, cy);
    x.beginPath();
    for (let k = 0; k < 8; k++) {
      const angle = (k * Math.PI) / 4,
        rad = k % 2 ? r * 0.35 : r;
      x.lineTo(Math.cos(angle) * rad, Math.sin(angle) * rad);
    }
    x.closePath();
    x.fillStyle = color;
    x.fill();
    x.restore();
  };
  x.fillStyle = "#fff8eb";
  x.fillRect(0, 0, 1600, 1600);
  for (let k = 0; k < 26; k++) {
    x.beginPath();
    x.arc(
      20 + ((k * 137) % 1560),
      18 + ((k * 211) % 1560),
      3 + (k % 3),
      0,
      Math.PI * 2,
    );
    x.fillStyle = ["#efdaca", "#dbe6cd", "#f4e4b4"][k % 3];
    x.fill();
  }
  rounded(44, 30, 160, 52, 26, "#e4ecd8");
  x.fillStyle = "#58734c";
  x.font = "bold 28px sans-serif";
  x.fillText("画活了", 80, 66);
  x.fillStyle = "#967e69";
  x.font = "22px sans-serif";
  x.fillText("把小小想象，变成一个故事", 226, 65);
  star(1498, 59, 21, "#e4b65e");
  star(1537, 91, 12, "#dba6aa");
  x.fillStyle = "#526547";
  x.font = "bold 36px sans-serif";
  x.fillText(snapshot.title, 48, 123, 1430);
  const wrap = (text, width) => {
    const lines = [];
    let line = "";
    for (const ch of String(text)) {
      if (ch === "\n") {
        lines.push(line);
        line = "";
        continue;
      }
      if (line && x.measureText(line + ch).width > width) {
        lines.push(line);
        line = ch;
      } else line += ch;
    }
    if (line) lines.push(line);
    return lines;
  };
  const colors = ["#e8efdd", "#f8e7dc", "#e5eef2", "#f3e5ef"];
  images.forEach((im, n) => {
    const left = 44 + (n % 2) * 768,
      top = 153 + Math.floor(n / 2) * 677,
      w = 744,
      h = 653;
    x.save();
    x.shadowColor = "#917d5c18";
    x.shadowBlur = 14;
    x.shadowOffsetY = 5;
    rounded(left, top, w, h, 25, "#fffefb");
    x.restore();
    x.save();
    x.beginPath();
    roundRect(x, left, top, w, h, 25);
    x.clip();
    x.fillStyle = colors[n];
    x.fillRect(left, top, w, 57);
    x.restore();
    rounded(left + 16, top + 11, 36, 36, 18, "#fffefa");
    x.fillStyle = "#617455";
    x.font = "bold 22px sans-serif";
    x.fillText(String(n + 1).padStart(2, "0"), left + 20, top + 37);
    x.font = "22px sans-serif";
    x.fillText(
      n === 0
        ? "想象的起点"
        : n === 1
          ? "故事开始啦"
          : n === 2
            ? "接着发生了…"
            : "暖暖的结尾",
      left + 66,
      top + 37,
    );
    // A quiet brand watermark lives in each card's margin, never over the art.
    x.save();
    x.globalAlpha = 0.48;
    x.textAlign = "right";
    x.font = "20px sans-serif";
    x.fillText("画活了 ✧", left + w - 22, top + 36);
    x.restore();
    const imageX = left + 18,
      imageY = top + 70,
      imageW = w - 36,
      imageH = 419;
    rounded(imageX, imageY, imageW, imageH, 15, "#f7f5ec");
    const scale = Math.min(imageW / im.width, imageH / im.height),
      iw = im.width * scale,
      ih = im.height * scale;
    const variant = snapshot.story.variants?.[n];
    x.save();
    x.beginPath();
    roundRect(x, imageX, imageY, imageW, imageH, 15);
    x.clip();
    x.filter =
      variant === "warm"
        ? "sepia(.28) saturate(1.15)"
        : variant === "soft"
          ? "saturate(.65) brightness(1.04)"
          : "none";
    x.drawImage(
      im,
      imageX + (imageW - iw) / 2,
      imageY + (imageH - ih) / 2,
      iw,
      ih,
    );
    x.restore();
    const caption =
      n === 0 ? "故事，从这幅小小的画开始。" : pageCaption(snapshot, n);
    let font = 27,
      lines,
      lineHeight;
    do {
      x.font = `${font}px sans-serif`;
      lines = wrap(caption, w - 56);
      lineHeight = Math.ceil(font * 1.45);
      if (lines.length * lineHeight <= 132 || font <= 12) break;
      font--;
    } while (true);
    x.fillStyle = "#505c47";
    lines.forEach((line, k) =>
      x.fillText(line, left + 28, top + 523 + k * lineHeight),
    );
  });
  star(61, 1524, 15, "#dcb86f");
  x.fillStyle = "#8c927d";
  x.font = "20px sans-serif";
  x.fillText(
    snapshot.story.real
      ? "第 1 页为原画 · 第 2–4 页为 AI 生成 · 请家长先阅"
      : "预设故事示例",
    87,
    1532,
  );
  x.fillStyle = "#9b8c79";
  x.font = "22px sans-serif";
  x.textAlign = "center";
  x.fillText("画活了  ·  珍藏每一份小小想象", 800, 1578);
  x.textAlign = "left";
  const output = c.toDataURL("image/png");
  return output;
}
