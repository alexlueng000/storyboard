"use client";
import { useState } from "react";
import Modal from "./Modal";
import { AiNotice } from "./Disclosure";
import { pageImage } from "../lib/stories";

export function StorySetup({
  item,
  config,
  busy,
  onGenerate,
  onClose,
  onDetail,
  onRefresh,
}) {
  const [setting, setSetting] = useState(
      (
        item.parent ||
        item.words ||
        "围绕原画中的主体，发生一件温和的小事。"
      ).slice(0, 150),
    ),
    [consent, setConsent] = useState(false);
  return (
    <Modal
      title={item.sample ? "故事，从一句想象开始" : "让这幅画，真的讲个故事"}
      onClose={onClose}
    >
      <p className="muted">
        {item.sample
          ? "示例画作使用预设文字和插画，不调用 AI。"
          : "原画已独立保存。第 1 页使用原画，第 2–4 页由 AI 参考这幅画续绘，保留主色、独特特征与童趣。"}
      </p>
      <div className="story-premise">
        <span className="source">
          {item.parent || item.words ? "沿用刚才的描述" : "没有填写也没关系"}
        </span>
        <p>
          {item.parent || item.words || "围绕画里的主体，发生一件温和的小事。"}
        </p>
      </div>
      {item.sample ? (
        <>
          <label className="field">
            一句话设定
            <textarea
              id="setting"
              maxLength={150}
              value={setting}
              onChange={(e) => setSetting(e.target.value)}
            />
          </label>
          <div className="preview-grid">
            {[0, 1, 2, 3].map((n) => (
              <div key={n}>
                <img src={pageImage(item, n)} alt={`第 ${n + 1} 页示例`} />
                <small>{n === 0 ? "01 原画记录" : `0${n + 1} 预设续画`}</small>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <details className="more-records">
            <summary>
              想换个故事方向？ <span>可选</span>
            </summary>
            <label className="field">
              故事方向
              <textarea
                maxLength={150}
                value={setting}
                onChange={(e) => setSetting(e.target.value)}
              />
            </label>
          </details>
          <AiNotice />
          {!config.configured && (
            <div className="notice">
              {config.loading
                ? "正在连接生成服务…"
                : config.error ||
                  "生成暂不可用，请联系体验负责人；原画仍可保存。"}
              <button className="text-btn" onClick={onRefresh}>
                重新连接
              </button>
            </div>
          )}
        </>
      )}
      <label className="check">
        <input
          type="checkbox"
          id={item.sample ? "demo-consent" : "real-consent"}
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        {item.sample
          ? "我了解这是预设故事演示，不代表真实模型效果，也不消耗正式体验资格。"
          : "同意将处理图和文字发送给 Poixe 及其上游 AI 生成故事，已阅读数据使用与费用说明。"}
      </label>
      <div className="actions">
        <button className="secondary" onClick={onDetail}>
          先只保存原画
        </button>
        <button
          className="primary"
          disabled={busy || (!item.sample && !config.configured)}
          onClick={() => onGenerate(setting, consent)}
        >
          {busy ? "正在提交…" : item.sample ? "开始免费演示" : "生成故事"}
        </button>
      </div>
    </Modal>
  );
}

export function JobStatus({
  item,
  onClose,
  onCancel,
  onRecover,
  onDismiss,
  busy,
}) {
  const job = item.job;
  if (!job) return null;
  const failed = ["FAILED", "CANCELLED"].includes(job.state);
  return (
    <Modal
      title={job.real ? "故事正在准备" : "小小故事，正在准备"}
      onClose={onClose}
    >
      <div className="wait-graphic">{failed ? "!" : "✧"}</div>
      <h3 className="wait-title">{job.stage || "正在准备四页示例故事"}</h3>
      <p className="muted" style={{ textAlign: "center" }}>
        原画已保存。可以离开页面，稍后从这幅画找回。
        <br />
        四页完成后一起阅读，请家长先看一遍。
      </p>
      {job.error && (
        <div className="notice" role="alert">
          {job.error}
        </div>
      )}
      <details className="ai-disclosure">
        <summary>查看任务信息</summary>
        <p className="source">
          任务：{job.id}
          <br />
          {job.real
            ? "30 分钟未完成则停止，原画不受影响。"
            : "预设故事演示，不调用 AI。"}
        </p>
      </details>
      <div className="actions">
        {["WAITING_RECOVERY", "SUBMITTING"].includes(job.state) && (
          <button className="primary" disabled={busy} onClick={onRecover}>
            {job.state === "SUBMITTING" ? "确认提交状态" : "找回已有结果"}
          </button>
        )}
        {failed ? (
          <button className="secondary" disabled={busy} onClick={onDismiss}>
            返回原画
          </button>
        ) : (
          <button className="secondary" disabled={busy} onClick={onCancel}>
            {job.real ? "取消任务" : "取消本次演示"}
          </button>
        )}
        <button className="secondary" onClick={onClose}>
          返回画册
        </button>
      </div>
    </Modal>
  );
}
