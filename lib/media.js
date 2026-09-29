export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => {
      image.src = "";
      reject(new Error("图片加载超时，请重试。"));
    }, 20000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error("无法读取这张图片"));
    };
    image.src = src;
  });
}
export async function transformImage(src, mode) {
  const image = await loadImage(src),
    canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d");
  if (mode === "rotate") {
    canvas.width = image.height;
    canvas.height = image.width;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
  } else {
    canvas.width = canvas.height = Math.min(image.width, image.height);
    ctx.drawImage(
      image,
      (image.width - canvas.width) / 2,
      (image.height - canvas.height) / 2,
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }
  return canvas.toDataURL("image/png");
}
export async function processingImage(src) {
  const image = await loadImage(src),
    scale = Math.min(1, 1024 / Math.max(image.width, image.height)),
    canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}
export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = Array.from(bytes, (v) => v.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export function download(data, name) {
  const url = typeof data === "string" ? data : URL.createObjectURL(data),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  if (typeof data !== "string")
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function downloadJSON(data, name) {
  download(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    name,
  );
}
