"use client";
import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { pageImage, pageCaption, toneStyle } from "../lib/stories";
import { download } from "../lib/media";

export function StoryReader({
  item,
  page,
  onPage,
  onClose,
  onDetail,
  onShare,
  onAdjust,
  onPrint,
}) {
  useEffect(() => {
    function keydown(e) {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.key === "ArrowRight" && page < 3) onPage(page + 1);
      if (e.key === "ArrowLeft" && page > 0) onPage(page - 1);
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [page, onPage]);
  return (
    <Modal title={item.title} wide onClose={onClose}>
      <div className="reader-top">
        <span>
          {page === 0
            ? "01 / 原画与原话"
            : `0${page + 1} / ${item.story.real ? "AI 生成续页" : "预设故事续页"}`}
        </span>
        <span>
          {item.story.real ? "AI 创作 · 请家长先阅" : "静态图文 · 故事示例"}
        </span>
      </div>
      <img
        className="reader-image"
        style={toneStyle(item.story.variants?.[page])}
        src={pageImage(item, page)}
        alt={`${item.title}第 ${page + 1} 页`}
      />
      <p className="reader-copy">{pageCaption(item, page)}</p>
      <div className="reader-nav">
        <button
          className="secondary"
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
        >
          ← 上一页
        </button>
        <div className="dots">
          {[0, 1, 2, 3].map((n) => (
            <button
              key={n}
              className={page === n ? "active" : ""}
              onClick={() => onPage(n)}
              aria-label={`第 ${n + 1} 页`}
            />
          ))}
        </div>
        <button
          className="secondary"
          onClick={() => onPage(page + 1)}
          disabled={page === 3}
        >
          下一页 →
        </button>
      </div>
      <p className="reader-label">
        {item.story.real
          ? page === 0
            ? item.story.words
              ? "原画 · 家长记录大意"
              : "原画 · 家长确认设定"
            : "AI 生成 · 请家长先阅"
          : page === 0
            ? "示例原画 · 预设文字"
            : "预设故事示例"}{" "}
        · {page + 1} / 4
      </p>
      <div className="actions">
        <button className="text-btn left" onClick={onDetail}>
          查看原画记录
        </button>
        {page > 0 && !item.story.real && (
          <button className="secondary" onClick={onAdjust}>
            调整这一页
          </button>
        )}
        <button className="secondary" onClick={onPrint}>
          导出 / 打印四页
        </button>
        <button className="primary" onClick={onShare}>
          分享图片
        </button>
      </div>
    </Modal>
  );
}

export function ShareDialog({ item, onClose, onRead, notify }) {
  const [snapshot] = useState(() => JSON.parse(JSON.stringify(item)));
  const [image, setImage] = useState(""),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    file = useRef(null);
  useEffect(() => {
    let alive = true;
    setError("");
    setImage("");
    file.current = null;
    import("../lib/share")
      .then((module) => module.createShareImage(snapshot))
      .then(async (output) => {
        if (!alive) return;
        setImage(output);
        const response = await fetch(output),
          blob = await response.blob();
        if (alive)
          file.current = new File([blob], "画活了_四页故事.png", {
            type: "image/png",
          });
      })
      .catch((error) => {
        if (alive) setError(error.message);
      });
    return () => {
      alive = false;
    };
  }, [snapshot, attempt]);
  async function nativeShare() {
    try {
      if (file.current && navigator.canShare?.({ files: [file.current] })) {
        await navigator.share({
          files: [file.current],
          title: "画活了 · 四页故事",
        });
      } else {
        notify("请保存图片，或长按预览图片分享。");
      }
    } catch (error) {
      if (error.name !== "AbortError")
        notify("分享未完成，可以保存图片后分享。");
    }
  }
  return (
    <Modal title="分享完整的四页故事" onClose={onClose}>
      <p className="muted">
        原画与三页续画组成四宫格，按左上、右上、左下、右下阅读。包含三页故事旁白，不附孩子原话或原声。请检查标题与预览后保存。
      </p>
      {error ? (
        <div className="notice" role="alert">
          {error}
          <button
            className="secondary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            重新生成分享图
          </button>
        </div>
      ) : image ? (
        <img
          src={image}
          alt="四页故事四宫格分享预览"
          style={{
            display: "block",
            width: "100%",
            maxWidth: 560,
            margin: "20px auto",
            borderRadius: 6,
          }}
        />
      ) : (
        <p role="status" className="notice">
          正在准备分享图片…
        </p>
      )}
      <p className="muted">
        可长按预览图片保存。接收者保存的图片无法撤回；不会生成公开阅读链接。
      </p>
      <div className="actions">
        <button className="secondary" onClick={onRead}>
          返回故事
        </button>
        {typeof navigator !== "undefined" && navigator.share && (
          <button className="secondary" disabled={!image} onClick={nativeShare}>
            系统分享
          </button>
        )}
        <button
          className="primary"
          disabled={!image}
          onClick={() => download(image, "画活了_四页故事.png")}
        >
          保存四宫格图片
        </button>
      </div>
    </Modal>
  );
}
