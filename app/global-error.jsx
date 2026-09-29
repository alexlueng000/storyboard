"use client";
export default function GlobalError() {
  return (
    <html lang="zh-CN">
      <body>
        <main
          style={{
            maxWidth: 480,
            margin: "15vh auto",
            padding: 24,
            fontFamily: "sans-serif",
          }}
        >
          <h1>画册暂时没能打开</h1>
          <p>请检查网络后重试。不要清除网站数据，以免丢失已有画作。</p>
          <a href="/">重新打开</a>
        </main>
      </body>
    </html>
  );
}
