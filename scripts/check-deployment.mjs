// Read-only smoke check for the HTML and the exact assets referenced by it.
// Run on the server with its loopback URL to separate Node from TLS/proxy issues.
const base = new URL(process.argv[2] || "http://localhost:5173/");
if (!["http:", "https:"].includes(base.protocol))
  throw new Error("需要 HTTP 或 HTTPS 地址");
let failed = false;
async function check(url, expected) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const type = response.headers.get("content-type") || "";
    const ok = response.ok && expected.test(type);
    console.log(
      `${ok ? "OK" : "FAIL"} ${response.status} ${url.pathname} ${type}`,
    );
    if (!ok) failed = true;
    return ok ? await response.text() : "";
  } catch (error) {
    failed = true;
    console.log(`FAIL ${url.pathname} ${error.cause?.code || error.name}`);
    return "";
  }
}
const html = await check(base, /text\/html/i);
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(
  (match) => match[1],
);
const images = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(
  (match) => match[1],
);
if (!scripts.some((src) => src.includes("/_next/"))) {
  failed = true;
  console.log("FAIL 首页没有 Next.js 入口脚本；请检查服务或构建目录。");
}
for (const path of new Set([...scripts, ...images])) {
  const url = new URL(path.replaceAll("&amp;", "&"), base);
  if (url.origin !== base.origin) continue;
  await check(
    url,
    scripts.includes(path) ? /(?:java|ecma)script/i : /image\//i,
  );
}
console.log(
  failed
    ? "资源检查未通过；检查构建目录、服务进程与代理日志。"
    : "HTML 与所引用的资源可读取；仍需浏览器验证新建按钮及本地存储。",
);
process.exitCode = failed ? 1 : 0;
