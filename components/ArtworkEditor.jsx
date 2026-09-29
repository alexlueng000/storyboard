"use client";
import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import Icon from "./Icon";
import { AiNotice } from "./Disclosure";
import { readFile, loadImage, transformImage } from "../lib/media";
import { today } from "../lib/stories";

export default function ArtworkEditor({ onSave, onClose, notify }) {
  const [draft, setDraft] = useState({}),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false),
    [recording, setRecording] = useState(false);
  const form = useRef(null),
    dirty = useRef(false),
    recorder = useRef(null),
    recTimer = useRef(null),
    alive = useRef(true),
    uploadVersion = useRef(0),
    saving = useRef(false);
  useEffect(() => {
    alive.current = true;
    const beforeUnload = (e) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      alive.current = false;
      uploadVersion.current++;
      clearTimeout(recTimer.current);
      const r = recorder.current;
      if (r) {
        if (r.state === "recording") r.stop();
        r.stream.getTracks().forEach((t) => t.stop());
      }
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);
  function close() {
    if (busy) return;
    if (dirty.current && !confirm("这幅画还没有保存，确定离开吗？")) return;
    onClose();
  }
  async function select(event) {
    const file = event.target.files[0],
      input = event.target;
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      input.value = "";
      notify("请选择不超过 10 MB 的 JPEG、PNG 或 WebP 图片。");
      return;
    }
    const version = ++uploadVersion.current;
    setEditing(true);
    try {
      const original = await readFile(file);
      await loadImage(original);
      if (alive.current && version === uploadVersion.current) {
        setDraft((old) => ({
          ...old,
          original,
          image: original,
          fileName: file.name,
        }));
        dirty.current = true;
      }
    } catch (error) {
      if (version === uploadVersion.current) {
        input.value = "";
        notify(error.message);
      }
    } finally {
      if (alive.current && version === uploadVersion.current) setEditing(false);
    }
  }
  async function transform(mode) {
    if (!draft.image) {
      notify("请先选择一幅画");
      return;
    }
    setEditing(true);
    try {
      const image =
        mode === "restore"
          ? draft.original
          : await transformImage(draft.image, mode);
      if (alive.current) setDraft((old) => ({ ...old, image }));
    } catch (error) {
      notify(error.message);
    } finally {
      if (alive.current) setEditing(false);
    }
  }
  async function record() {
    if (recorder.current?.state === "recording") {
      recorder.current.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      notify("当前浏览器无法录音，可以填写文字后继续保存。");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      let instance;
      try {
        instance = new MediaRecorder(stream);
      } catch (error) {
        stream.getTracks().forEach((t) => t.stop());
        throw error;
      }
      const chunks = [];
      recorder.current = instance;
      instance.ondataavailable = (e) => chunks.push(e.data);
      instance.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearTimeout(recTimer.current);
        recorder.current = null;
        if (!alive.current) return;
        setRecording(false);
        const blob = new Blob(chunks, {
          type: instance.mimeType || chunks[0]?.type || "audio/webm",
        });
        if (blob.size > 10 * 1024 * 1024) {
          notify("录音超过 10 MB，请重录。");
          return;
        }
        try {
          const audio = await readFile(blob);
          if (alive.current) {
            setDraft((old) => ({ ...old, audio }));
            dirty.current = true;
          }
        } catch (error) {
          notify(error.message);
        }
      };
      instance.start();
      setRecording(true);
      recTimer.current = setTimeout(() => {
        if (instance.state === "recording") instance.stop();
      }, 60000);
    } catch {
      notify("未能获得麦克风权限，仍可用文字记录或直接保存。");
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (saving.current || editing) return;
    const intent = event.nativeEvent.submitter?.value || "generate",
      data = new FormData(form.current);
    if (intent === "generate" && !data.get("ai-consent")) {
      notify("请先确认 AI 使用说明；也可以选择只保存原画。");
      return;
    }
    if (!draft.original) {
      notify("请先选择一幅画");
      return;
    }
    if (recording) {
      notify("请先结束录音，再保存。");
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      await onSave(
        {
          ...draft,
          title: String(data.get("title") || "").trim(),
          date: data.get("date") || today(),
          words: String(data.get("words") || "").trim(),
          parent: String(data.get("parent") || "").trim(),
          consentAt: new Date().toISOString(),
        },
        intent === "generate",
      );
      dirty.current = false;
    } catch (error) {
      notify(error.message || "保存失败，当前填写内容已保留。");
    } finally {
      saving.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <Modal title="留下一幅小小想象" onClose={close}>
      <p className="muted">先把画留下来。故事，可以慢慢讲。</p>
      <form
        id="art-form"
        ref={form}
        onSubmit={submit}
        onChange={() => {
          dirty.current = true;
        }}
      >
        <fieldset disabled={busy} className="form-fields">
          <label className="upload" style={{ marginTop: 18 }}>
            <div id="upload-preview">
              {draft.image ? (
                <img src={draft.image} alt="处理图预览" />
              ) : (
                <Icon name="image" size={35} />
              )}
            </div>
            <span>
              {editing
                ? "正在处理图片…"
                : draft.image
                  ? "点击可重新选择 · 编辑只作用于副本"
                  : "选择一幅画 · JPEG / PNG / WebP，最大 10 MB"}
            </span>
            <input
              type="file"
              id="image-file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="选择画作"
              required
              onChange={select}
              disabled={editing}
            />
          </label>
          <div className="editor-tools" role="group" aria-label="调整画作">
            {[
              ["rotate", "旋转 90°"],
              ["crop", "居中裁成方形"],
              ["restore", "恢复原图"],
            ].map(([action, title]) => (
              <button
                key={action}
                type="button"
                disabled={editing}
                onClick={() => transform(action)}
              >
                {title}
              </button>
            ))}
          </div>
          <label className="field">
            说说这幅画 <span className="muted">· 可选</span>
            <textarea
              name="parent"
              maxLength={500}
              placeholder="比如：蓝色和粉色的小伙伴，想带小兔子一起去探险。"
            />
          </label>
          <p className="muted" style={{ marginTop: 8 }}>
            写一句就好，做故事时会直接沿用。也可以不写，先把画收藏起来。
          </p>
          <details className="more-records">
            <summary>
              更多记录 <span>名字、日期、孩子原话或录音 · 可选</span>
            </summary>
            <label className="field">
              画的名字
              <input
                name="title"
                type="text"
                maxLength={40}
                placeholder="不用填写，会根据描述自动命名"
              />
            </label>
            <label className="field">
              创作日期
              <input type="date" name="date" defaultValue={today()} />
            </label>
            <label className="field">
              单独记下孩子的原话 · 可选
              <textarea name="words" maxLength={500} />
            </label>
            <div className="settings-row">
              <div>
                <strong>留住孩子的声音 · 可选</strong>
                <p className="muted">
                  最长 60 秒，仅保存和回听，不转写、不用于生成。
                </p>
              </div>
              <button type="button" className="secondary" onClick={record}>
                {recording ? "结束录音" : draft.audio ? "重新录音" : "开始录音"}
              </button>
            </div>
            {draft.audio && (
              <audio
                controls
                src={draft.audio}
                style={{ width: "100%", marginTop: 15 }}
              />
            )}
          </details>
          <label className="check">
            <input type="checkbox" required />
            我是监护人，理解原始记录默认保存在当前浏览器、没有云端备份，可导出或删除；AI
            发送另行授权。
          </label>
          <AiNotice />
          <label className="check">
            <input type="checkbox" id="ai-upload-consent" name="ai-consent" />
            同意将处理图和文字发送给 Poixe 及其上游 AI
            生成故事，已阅读数据使用与费用说明。
          </label>
          <div className="actions">
            <button
              type="submit"
              value="save"
              className="secondary"
              disabled={editing || recording}
            >
              只保存原画
            </button>
            <button
              type="submit"
              value="generate"
              className="primary"
              disabled={editing || recording}
            >
              {busy ? "正在保存…" : "生成故事"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
