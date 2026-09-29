import "./globals.css";

export const metadata = {
  title: "画活了 · 把小小想象，好好收藏",
  description: "从一幅画到四页故事，收藏小小想象，无需注册。",
  icons: { icon: "/assets/logo.svg" },
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf8f2",
};

// Independent of React hydration. If the JS chunks never arrive, the HTML and
// this retry link remain usable. It never clears data or reloads automatically.
const startupWatchdog = `setTimeout(function(){if(document.documentElement.dataset.appReady!=='true'){var help=document.getElementById('load-help');if(help)help.hidden=false;}},12000);`;
export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <aside id="load-help" hidden className="load-help" role="status">
          <p>打开页面比平时慢一些，请检查网络或在系统浏览器中打开。</p>
          <a href="/">重新打开</a>
          <p>请勿清除网站数据，以免丢失画作。</p>
        </aside>
        <noscript>
          <p className="startup-panel">
            页面内容已显示。上传、生成和分享需要启用 JavaScript 后使用。
          </p>
        </noscript>
        <script dangerouslySetInnerHTML={{ __html: startupWatchdog }} />
      </body>
    </html>
  );
}
