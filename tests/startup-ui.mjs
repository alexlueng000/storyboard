import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_PATH || "playwright",
);
const dir = await mkdtemp(join(tmpdir(), "huahuole-startup-"));
const server = spawn(process.execPath, ["server.mjs"], {
  env: {
    ...process.env,
    PORT: "5186",
    STORY_DATA_DIR: dir,
    POIXE_API_KEY: "fixture-only",
    NEXT_TELEMETRY_DISABLED: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let browser;
let diagnostics = "";
server.stderr.on("data", (data) => (diagnostics += data));
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (data) => {
      if (data.toString().includes("画活了 →")) resolve();
    });
    server.once("exit", (c) =>
      reject(new Error(`Server exit ${c}: ${diagnostics}`)),
    );
  });
  await mkdir("test-results", { recursive: true });
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  // Block every application chunk: first-screen content still comes from HTML.
  await page.route("**/_next/**/*.js", (route) => route.abort());
  await page.addInitScript(() => {
    const original = setTimeout;
    window.setTimeout = (callback, delay, ...args) =>
      original(callback, delay === 12000 ? 100 : delay, ...args);
  });
  const response = await page.goto(
    "http://localhost:5186/?__startup_retry=test",
    {
      waitUntil: "domcontentloaded",
    },
  );
  assert.match(response.headers()["cache-control"], /no-store/);
  const html = await response.text();
  assert.match(html, /小小画册，大大世界/);
  assert.match(html, /<style/);
  assert.doesNotMatch(html, /rel="stylesheet"/);
  await page.getByRole("heading", { name: "小小画册，大大世界" }).waitFor();
  await page.locator("#load-help").waitFor({ state: "visible" });
  assert.equal(
    await page
      .getByRole("button", { name: "留下一幅画", exact: true })
      .isDisabled(),
    true,
  );
  await page.screenshot({ path: "test-results/next-blocked-js.png" });
  await page.close();
  const denied = await context.newPage();
  await denied.addInitScript(() => {
    indexedDB.open = () => {
      throw new Error("Storage unavailable");
    };
  });
  await denied.goto("http://localhost:5186");
  await denied.getByText("画册暂时没能打开", { exact: true }).waitFor();
  assert.equal(
    await denied
      .getByRole("button", { name: "重新打开", exact: true })
      .isVisible(),
    true,
  );
  await denied.close();
  const fresh = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await fresh.addInitScript(() => {
    AbortSignal.timeout = undefined;
  });
  const pages = await Promise.all([fresh.newPage(), fresh.newPage()]);
  const pageErrors = [];
  pages.forEach((p) => p.on("pageerror", (e) => pageErrors.push(e.message)));
  const config = pages.map((p) =>
    p.waitForResponse((r) => r.url().endsWith("/api/config")),
  );
  await Promise.all(pages.map((p) => p.goto("http://localhost:5186")));
  assert.deepEqual(
    (await Promise.all(config)).map((r) => r.status()),
    [200, 200],
  );
  const tokens = await Promise.all(
    pages.map((p) =>
      p.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const request = indexedDB.open("huahuole-demo", 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const tx = db.transaction("data", "readonly");
              const r = tx.objectStore("data").get("client-token");
              tx.oncomplete = () => {
                db.close();
                resolve(r.result);
              };
            };
          }),
      ),
    ),
  );
  assert.match(tokens[0], /^[a-f0-9]{64}$/);
  assert.equal(tokens[0], tokens[1]);
  assert.deepEqual(pageErrors, []);
  // One entry chunk fails transiently. Recovery must restore actual interaction,
  // preserve the anonymous credential, and not simply repaint the static shell.
  const recovering = pages[0];
  let blockedChunk = false,
    recoveredToken,
    documentRequests = 0;
  recovering.on("request", (request) => {
    if (request.url().endsWith("/api/config"))
      recoveredToken = request.headers()["x-client-token"];
    if (
      request.isNavigationRequest() &&
      request.frame() === recovering.mainFrame()
    )
      documentRequests++;
  });
  await recovering.route("**/_next/**/*.js", (route) => {
    if (!blockedChunk) {
      blockedChunk = true;
      return route.abort();
    }
    return route.continue();
  });
  await recovering.reload({ waitUntil: "domcontentloaded" });
  await recovering
    .getByRole("button", { name: "留下一幅画", exact: true })
    .click({ timeout: 15000 });
  await recovering.getByRole("dialog", { name: "留下一幅小小想象" }).waitFor();
  assert.equal(await recovering.getByLabel("选择画作").isEnabled(), true);
  assert.equal(
    documentRequests,
    2,
    "one bounded automatic reload recovers the failed entry chunk",
  );
  assert.equal(
    recoveredToken,
    tokens[0],
    "recovery preserves the existing anonymous credential",
  );
  assert.equal(
    new URL(recovering.url()).searchParams.has("__startup_retry"),
    false,
  );
  await recovering.getByRole("button", { name: "关闭", exact: true }).click();
  await recovering.unroute("**/_next/**/*.js");
  for (const width of [360, 390, 430, 1440]) {
    await pages[0].setViewportSize({ width, height: 844 });
    assert.equal(
      await pages[0].evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await pages[0].screenshot({
      path: `test-results/next-${width}.png`,
      fullPage: true,
    });
  }
  // Seed exactly the old v1 schema, including an unfinished real job. The new
  // React application must retain the token and retrieve, never resubmit, it.
  const migrated = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    old = await migrated.newPage();
  await old.route("**/_next/**/*.js", (route) => route.abort());
  await old.goto("http://localhost:5186");
  const oldToken = "a".repeat(64),
    jobId = "12345678-1234-4234-8234-123456789abc";
  await old.evaluate(
    async ({ oldToken, jobId }) => {
      await new Promise((resolve, reject) => {
        const request = indexedDB.open("huahuole-demo", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("data");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("data", "readwrite"),
            store = tx.objectStore("data");
          store.put(oldToken, "client-token");
          store.put(
            [
              {
                id: "legacy-art",
                title: "迁移前的画作",
                date: "2026-09-20",
                words: "保留原话",
                original: "/assets/dog.svg",
                image: "/assets/dog.svg",
                job: {
                  id: jobId,
                  real: true,
                  state: "GENERATING",
                  started: Date.now(),
                },
              },
            ],
            "artworks",
          );
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      });
    },
    { oldToken, jobId },
  );
  let submissions = 0,
    seenToken = "";
  old.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/api/jobs")) submissions++;
  });
  await old.route("**/api/jobs/" + jobId, (route) => {
    seenToken = route.request().headers()["x-client-token"];
    return route.fulfill({
      json: {
        id: jobId,
        state: "READY",
        pages: [1, 2, 3].map((n) => ({
          image: `/assets/story-${n}.svg`,
          text: "迁移后继续阅读。",
        })),
        sourceImage: "/assets/dog.svg",
        words: "保留原话",
        setting: "旧设定",
      },
    });
  });
  await old.unroute("**/_next/**/*.js");
  await old.reload();
  await old
    .getByRole("button")
    .filter({
      has: old.getByRole("heading", { name: "迁移前的画作", exact: true }),
    })
    .click();
  await old.getByRole("button", { name: "一起读这个故事" }).waitFor();
  await old.getByRole("button", { name: "一起读这个故事" }).click();
  await old.getByText("保留原话", { exact: true }).waitFor();
  assert.equal(seenToken, oldToken);
  assert.equal(submissions, 0);
  await old.reload();
  await old
    .getByRole("heading", { name: "迁移前的画作", exact: true })
    .waitFor();
  assert.equal(submissions, 0);
  console.log(
    "PASS: transient chunk failure recovers once and New opens editor; Next SSR with all JS blocked + retry; inline CSS; denied storage; older timeout API; shared credential; 360/390/430/1440 layouts; v1 artwork + token + unfinished job migration without resubmission.",
  );
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await new Promise((resolve) =>
    server.exitCode !== null ? resolve() : server.once("exit", resolve),
  );
  await rm(dir, { recursive: true, force: true });
}
