"use client";
export default function ErrorPage({ reset }) {
  return (
    <main className="startup-panel" role="alert">
      <h1>画册暂时没能打开</h1>
      <p>请重试或在系统浏览器中打开。不要清除网站数据，以免丢失已有画作。</p>
      <button className="primary" onClick={() => reset()}>
        重试
      </button>{" "}
      <a href="/">重新打开</a>
    </main>
  );
}
