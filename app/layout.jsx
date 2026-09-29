import "./globals.css";
import { startupScript } from "../lib/startup-script";

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

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        <script dangerouslySetInnerHTML={{ __html: startupScript }} />
      </head>
      <body>
        {children}
        <aside id="load-help" hidden className="load-help" role="status">
          <p id="load-help-message">页面交互程序正在加载，暂时无法新建画作。</p>
          <a id="load-help-retry" href="/?__startup_retry=manual">
            重新加载页面
          </a>
          <details>
            <summary>查看加载详情</summary>
            <p id="load-help-details" />
          </details>
          <p>请勿清除网站数据，以免丢失画作。</p>
        </aside>
        <noscript>
          <p className="startup-panel">
            页面内容已显示。上传、生成和分享需要启用 JavaScript 后使用。
          </p>
        </noscript>
      </body>
    </html>
  );
}
