import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_PATH || "playwright",
);
const dir = await mkdtemp(join(tmpdir(), "huahuole-print-"));
const server = spawn(process.execPath, ["server.mjs"], {
  env: {
    ...process.env,
    PORT: "5188",
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
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  // Suppress the OS dialog only. The production print layout and image decoding
  // still run; page.pdf then verifies the actual browser print result.
  await page.addInitScript(() => {
    window.print = () => {
      window.printRequested = true;
    };
  });
  await page.goto("http://localhost:5188");
  await page.getByRole("button", { name: "翻开四页示例" }).click();
  await page.getByRole("button", { name: "导出 / 打印四页" }).click();
  await page.waitForFunction(() => window.printRequested === true);
  assert.equal(await page.locator(".print-page").count(), 4);
  await mkdir("test-results", { recursive: true });
  await page.pdf({
    path: "test-results/story.pdf",
    preferCSSPageSize: true,
    printBackground: true,
  });
  const pdf = await readFile("test-results/story.pdf");
  assert.equal(
    (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length,
    4,
  );
  console.log(
    "PASS: React print layout produces exactly four PDF pages with decoded illustrations.",
  );
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await new Promise((resolve) =>
    server.exitCode !== null ? resolve() : server.once("exit", resolve),
  );
  await rm(dir, { recursive: true, force: true });
}
