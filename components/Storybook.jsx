"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Shell, Gallery, Profile } from "./Gallery";
import Modal from "./Modal";
import ArtworkEditor from "./ArtworkEditor";
import { StoryReader, ShareDialog } from "./StoryReader";
import { StorySetup, JobStatus } from "./StorySetup";
import { Privacy } from "./Disclosure";
import { useLibrary } from "../lib/use-library";
import {
  seed,
  automaticTitle,
  pageImage,
  pageCaption,
  toneStyle,
} from "../lib/stories";
import { newId, processingImage, download, downloadJSON } from "../lib/media";

export default function Storybook() {
  const [tab, setTab] = useState("album"),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState("new");
  const [dialog, setDialog] = useState(""),
    [activeId, setActiveId] = useState(null),
    [page, setPage] = useState(0),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [tone, setTone] = useState("warm"),
    [printItem, setPrintItem] = useState(null);
  const toastTimer = useRef(null),
    locked = useRef(false);
  const notify = useCallback((message) => {
    setMessage(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(""), 4000);
  }, []);
  const library = useLibrary(notify),
    { items, ready, error, config, request, update } = library;
  const item = items.find((i) => i.id === activeId);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (ready) document.documentElement.dataset.appReady = "true";
    return () => {
      delete document.documentElement.dataset.appReady;
    };
  }, [ready]);
  useEffect(() => {
    if (dialog === "status" && item?.story?.ready) {
      setPage(item.story.position || 0);
      setDialog("reader");
    }
    if (
      dialog &&
      dialog !== "edit" &&
      dialog !== "privacy" &&
      activeId &&
      !item &&
      ready
    )
      setDialog("");
  }, [dialog, item, activeId, ready]);
  const close = () => setDialog("");
  async function run(work) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await work();
    } catch (error) {
      notify(error.message || "操作未完成，请稍后重试。");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function detail(id = activeId) {
    setActiveId(id);
    setDialog("detail");
  }
  function read() {
    setPage(Math.min(3, item?.story?.position || 0));
    setDialog("reader");
  }
  function changePage(next) {
    setPage(Math.max(0, Math.min(3, next)));
    update(activeId, (current) => ({
      ...current,
      story: { ...current.story, position: next },
    })).catch(() => notify("阅读位置保存失败，请稍后重试。"));
  }
  async function showSample() {
    let sample = items.find((i) => i.id === "sample-dog");
    if (!sample) {
      sample = seed()[0];
      await update(sample.id, () => sample, { create: true });
    }
    setActiveId(sample.id);
    setPage(0);
    setDialog("reader");
  }
  async function submitJob(artwork, setting) {
    const image = await processingImage(artwork.image),
      id = newId();
    const job = {
      id,
      real: true,
      started: Date.now(),
      state: "SUBMITTING",
      stage: "正在提交",
      request: {
        id,
        image,
        setting,
        words: artwork.words || "",
        parent: artwork.parent || "",
        consent: true,
      },
    };
    const saved = await update(artwork.id, (current) =>
      current.job ? current : { ...current, job },
    );
    if (!saved) throw new Error("这幅作品已删除，请返回画册。");
    setActiveId(artwork.id);
    setDialog("status");
    if (saved.job.id !== id) return;
    try {
      const result = await request("/api/jobs", {
        method: "POST",
        body: JSON.stringify(job.request),
      });
      await update(artwork.id, (current) =>
        current.job?.id === id
          ? {
              ...current,
              job: { ...current.job, ...result, request: undefined },
            }
          : current,
      );
    } catch (error) {
      const definite = error.status >= 400 && error.status < 500;
      await update(artwork.id, (current) =>
        current.job?.id === id
          ? {
              ...current,
              job: {
                ...current.job,
                error: error.message,
                state: definite ? "FAILED" : "SUBMITTING",
                stage: definite ? "提交未完成" : "提交结果待确认",
              },
            }
          : current,
      );
    }
  }
  async function saveArtwork(draft, generate) {
    const artwork = {
      ...draft,
      id: newId(),
      title: draft.title || automaticTitle(draft.parent, draft.date),
    };
    await update(artwork.id, () => artwork, { create: true });
    setActiveId(artwork.id);
    setDialog(generate ? "detail" : "");
    if (generate) {
      try {
        await submitJob(
          artwork,
          (
            artwork.parent ||
            artwork.words ||
            "围绕原画中的主体，发生一件温和的小事。"
          ).slice(0, 150),
        );
      } catch (error) {
        notify("原画已保存。" + error.message);
      }
    } else notify("原画已保存，随时可以回来查看。");
  }
  async function generate(setting, consent) {
    if (!consent) {
      notify(item.sample ? "请先确认演示说明" : "请先确认 AI 数据使用说明");
      return;
    }
    setting = setting.trim();
    if (!setting) {
      notify("请填写一句话设定");
      return;
    }
    await run(async () => {
      if (item.sample) {
        const job = { id: newId(), started: Date.now(), setting };
        await update(item.id, (current) =>
          current.job ? current : { ...current, job },
        );
        setDialog("status");
      } else await submitJob(item, setting);
    });
  }
  async function recover() {
    const job = item.job;
    const result =
      job.state === "SUBMITTING"
        ? await request("/api/jobs", {
            method: "POST",
            body: JSON.stringify(job.request),
          })
        : await request("/api/jobs/" + job.id + "/recover", {
            method: "POST",
            body: "{}",
          });
    await update(item.id, (current) =>
      current.job?.id === job.id
        ? { ...current, job: { ...current.job, ...result, request: undefined } }
        : current,
    );
  }
  async function cancel() {
    const job = item.job;
    if (job.real) {
      try {
        await request("/api/jobs/" + job.id + "/cancel", {
          method: "POST",
          body: "{}",
        });
      } catch (error) {
        if (error.status !== 404) throw error;
      }
    }
    await update(item.id, (current) =>
      current.job?.id === job.id ? { ...current, job: undefined } : current,
    );
    setDialog("detail");
    notify(
      job.real
        ? "已取消。已发送的上游请求可能仍计费。"
        : "故事演示已取消，原画仍然保留",
    );
  }
  async function remove() {
    const remoteId = item.job?.real
      ? item.job.id
      : item.story?.real
        ? item.story.jobId
        : null;
    if (remoteId) {
      try {
        await request("/api/jobs/" + remoteId, { method: "DELETE" });
      } catch (error) {
        if (error.status !== 404) throw error;
      }
    }
    await update(item.id, () => null);
    close();
    notify("这幅作品及其关联记录已删除。");
  }
  async function previewAdjustment() {
    if (
      item.story.adjustments >= 2 ||
      Date.now() - item.story.delivered > 30 * 86400000
    ) {
      notify("调整权益已用完或已过期");
      return;
    }
    await update(item.id, (current) => ({
      ...current,
      story: {
        ...current.story,
        adjustments: (current.story.adjustments || 0) + 1,
      },
    }));
    setDialog("adjust-preview");
  }
  async function adopt() {
    await update(item.id, (current) => ({
      ...current,
      story: {
        ...current.story,
        previous: {
          ...current.story.previous,
          [page]: current.story.variants?.[page] || null,
        },
        variants: { ...current.story.variants, [page]: tone },
      },
    }));
    setDialog("reader");
  }
  async function undo() {
    await update(item.id, (current) => {
      const previous = { ...current.story.previous };
      const value = previous[page];
      delete previous[page];
      return {
        ...current,
        story: {
          ...current.story,
          previous,
          variants: { ...current.story.variants, [page]: value },
        },
      };
    });
    setDialog("reader");
  }
  useEffect(() => {
    if (!printItem) return;
    let alive = true;
    const images = [...document.querySelectorAll(".print-page img")];
    Promise.all(images.map((image) => image.decode()))
      .then(() => {
        if (alive) window.print();
      })
      .catch(() => notify("导出图片加载失败，请重试"));
    const done = () => setPrintItem(null);
    window.addEventListener("afterprint", done);
    return () => {
      alive = false;
      window.removeEventListener("afterprint", done);
    };
  }, [printItem, notify]);
  return (
    <>
      <div id="app">
        <Shell tab={tab} onTab={setTab}>
          {tab === "me" ? (
            <Profile
              items={items}
              onBackup={() =>
                downloadJSON(
                  {
                    schema: "huahuole-local-demo-v1",
                    exportedAt: new Date().toISOString(),
                    artworks: items,
                  },
                  "画活了_本地画册备份.json",
                )
              }
              onPrivacy={() => setDialog("privacy")}
            />
          ) : (
            <Gallery
              items={items}
              tab={tab}
              filter={filter}
              setFilter={setFilter}
              sort={sort}
              setSort={setSort}
              ready={ready}
              onNew={() =>
                items.length >= 30
                  ? notify("已达到 30 幅上限，请先导出或删除部分作品。")
                  : setDialog("edit")
              }
              onSample={() => run(showSample)}
              onDetail={detail}
              onAlbum={() => setTab("album")}
            />
          )}
          {!ready && (
            <section
              className="startup-panel"
              role={error ? "alert" : "status"}
              id="startup-status"
            >
              <h2>{error ? "画册暂时没能打开" : "正在打开你的画册…"}</h2>
              {error && <p>{error}</p>}
              <p>记录保存在当前浏览器，请勿清除网站数据，以免丢失已有画作。</p>
              {error ? (
                <button className="secondary" onClick={library.retry}>
                  重新打开
                </button>
              ) : (
                <a href="/" className="startup-retry">
                  等待较久？重新打开
                </a>
              )}
            </section>
          )}
        </Shell>
      </div>
      {dialog === "edit" && (
        <ArtworkEditor onClose={close} onSave={saveArtwork} notify={notify} />
      )}
      {dialog === "privacy" && (
        <Modal title="让记录，安心留在这里" onClose={close}>
          <Privacy />
          <div className="actions">
            <button className="primary" onClick={close}>
              知道了
            </button>
          </div>
        </Modal>
      )}
      {item && dialog === "detail" && (
        <Modal title="这一幅，值得记住" wide onClose={close}>
          <div className="detail-grid">
            <div>
              <img className="detail-image" src={item.image} alt={item.title} />
              <p className="source">
                {item.sample ? "示例插画" : "处理图 · 原始文件独立保留"} ·{" "}
                {item.date}
              </p>
              <button
                className="text-btn"
                onClick={() =>
                  download(item.original, item.fileName || item.title + ".svg")
                }
              >
                下载原图 ↗
              </button>
            </div>
            <div className="detail-copy">
              <div className="eyebrow">A LITTLE PIECE OF IMAGINATION</div>
              <h3>{item.title}</h3>
              <p className="quote-full">
                {item.words
                  ? `“${item.words}”`
                  : item.parent || "有些想象，不需要解释。"}
              </p>
              <p className="source">
                {item.sample
                  ? "预设示例文字"
                  : item.words
                    ? "家长记录的孩子原话"
                    : "家长描述"}
              </p>
              {item.words && item.parent && (
                <p className="muted">家长描述：{item.parent}</p>
              )}
              {item.audio && (
                <audio
                  controls
                  src={item.audio}
                  style={{ width: "100%", marginTop: 15 }}
                />
              )}
              <div className="notice">
                画已收藏。是否做成故事，由你和孩子一起决定。
              </div>
              <button
                className="primary"
                onClick={() =>
                  item.story?.ready
                    ? read()
                    : setDialog(item.job ? "status" : "setup")
                }
              >
                {item.story?.ready
                  ? "一起读这个故事"
                  : item.job
                    ? item.job.real
                      ? "查看生成进度"
                      : "查看演示进度"
                    : "一起做个故事"}
              </button>
            </div>
          </div>
          <div className="actions">
            <button
              className="text-btn danger left"
              onClick={() => setDialog("delete")}
            >
              删除这幅作品
            </button>
            <button className="secondary" onClick={close}>
              回到画册
            </button>
          </div>
        </Modal>
      )}
      {item && dialog === "setup" && (
        <StorySetup
          key={item.id}
          item={item}
          config={config}
          busy={busy}
          onGenerate={generate}
          onClose={close}
          onDetail={() => detail()}
          onRefresh={library.refreshConfig}
        />
      )}
      {item && dialog === "status" && (
        <JobStatus
          item={item}
          busy={busy}
          onClose={close}
          onCancel={() => run(cancel)}
          onRecover={() => run(recover)}
          onDismiss={() =>
            run(async () => {
              await update(item.id, (current) => ({
                ...current,
                job: undefined,
              }));
              setDialog("detail");
            })
          }
        />
      )}
      {item?.story?.ready && dialog === "reader" && (
        <StoryReader
          item={item}
          page={page}
          onPage={changePage}
          onClose={close}
          onDetail={() => detail()}
          onShare={() => setDialog("share")}
          onAdjust={() => {
            setTone("warm");
            setDialog("adjust");
          }}
          onPrint={() => setPrintItem(JSON.parse(JSON.stringify(item)))}
        />
      )}
      {item?.story?.ready && dialog === "share" && (
        <ShareDialog
          item={item}
          onClose={close}
          onRead={() => setDialog("reader")}
          notify={notify}
        />
      )}
      {item && dialog === "delete" && (
        <Modal title="确定告别这幅画吗？" onClose={close}>
          <p className="muted">
            将删除「{item.title}
            」的原图、处理图、文字、录音和关联故事；未完成的任务也会取消。
          </p>
          <div className="notice">
            删除后无法在此恢复。需要的话，请先返回导出。
          </div>
          <div className="actions">
            <button className="secondary" onClick={() => detail()}>
              留着这份想象
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => run(remove)}
            >
              确认删除
            </button>
          </div>
        </Modal>
      )}
      {item?.story && !item.story.real && dialog === "adjust" && (
        <Modal title="给这一页，一点小变化" onClose={close}>
          <p className="muted">
            第 {page + 1} 页 · 剩余 {Math.max(0, 2 - item.story.adjustments)}{" "}
            次演示调整
          </p>
          <div className="notice">
            仅演示本地色调变化，不调用 AI。30 天内可进行 2
            次预览；预览成功后计次。
          </div>
          <div className="adjust-options">
            {[
              ["warm", "暖一点的光"],
              ["soft", "柔一点的颜色"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`secondary ${tone === value ? "selected" : ""}`}
                onClick={() => setTone(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="actions">
            {Object.prototype.hasOwnProperty.call(
              item.story.previous || {},
              page,
            ) && (
              <button className="text-btn left" onClick={() => run(undo)}>
                撤销最近采用的调整
              </button>
            )}
            <button className="secondary" onClick={() => setDialog("reader")}>
              返回阅读
            </button>
            <button
              className="primary"
              disabled={
                busy ||
                item.story.adjustments >= 2 ||
                Date.now() - item.story.delivered > 30 * 86400000
              }
              onClick={() => run(previewAdjustment)}
            >
              生成演示预览
            </button>
          </div>
        </Modal>
      )}
      {item && dialog === "adjust-preview" && (
        <Modal title="看看这次的小变化" onClose={close}>
          <img
            className="reader-image"
            src={pageImage(item, page)}
            style={toneStyle(tone)}
            alt="色调调整预览"
          />
          <div className="notice">
            预览已成功，本次演示调整已计次。剩余 {2 - item.story.adjustments}{" "}
            次。
          </div>
          <div className="actions">
            <button className="secondary" onClick={() => setDialog("reader")}>
              保留旧图
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => run(adopt)}
            >
              采用这张
            </button>
          </div>
        </Modal>
      )}
      {printItem && (
        <div className="print-pages">
          {[0, 1, 2, 3].map((n) => (
            <section className="print-page" key={n}>
              <h1>{printItem.title}</h1>
              <img
                src={pageImage(printItem, n)}
                style={toneStyle(printItem.story.variants?.[n])}
                alt={`第 ${n + 1} 页`}
              />
              <p>{pageCaption(printItem, n)}</p>
              <small>
                画活了 ·{" "}
                {n === 0
                  ? "原画记录"
                  : printItem.story.real
                    ? "AI 生成续页 · 请家长先阅"
                    : "预设故事续页"}{" "}
                · {n + 1} / 4
              </small>
            </section>
          ))}
        </div>
      )}
      <div id="toast" role="status" className={message ? "show" : ""}>
        {message}
      </div>
    </>
  );
}
