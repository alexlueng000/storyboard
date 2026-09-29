// Runs before hydration and contains no artwork, credentials or network writes.
// A failed entry chunk gets one cache-bypassing reload. The URL marker survives
// even when storage is unavailable, preventing reload loops on broken deploys.
export const startupScript = `
(function () {
  var failures = [], retryTimer;
  var marker = '__startup_retry';
  function hydrated() { return document.documentElement.dataset.appHydrated === 'true'; }
  function retryUrl() {
    var url = new URL(location.href);
    url.searchParams.set(marker, String(Date.now()));
    return url.href;
  }
  function show() {
    if (document.documentElement.dataset.appReady === 'true') return;
    var help = document.getElementById('load-help');
    if (!help) return;
    help.hidden = false;
    var text = document.getElementById('load-help-message');
    if (text) text.textContent = hydrated()
      ? '页面已连接，但本机画册尚未打开。请查看画册的错误提示后重试。'
      : '页面交互程序尚未加载完成，暂时无法新建画作。请重新加载页面。';
    var link = document.getElementById('load-help-retry');
    if (link) link.href = retryUrl();
    var details = document.getElementById('load-help-details');
    if (details) details.textContent = failures.length ? '未加载的资源：' + failures.join('、') : '页面交互尚未就绪';
  }
  window.addEventListener('error', function (event) {
    var el = event.target;
    if (!el || el.tagName !== 'SCRIPT' || !el.src) return;
    var url = new URL(el.src, location.href);
    if (url.origin !== location.origin || url.pathname.indexOf('/_next/static/') !== 0) return;
    if (failures.indexOf(url.pathname) < 0) failures.push(url.pathname);
    show();
    if (hydrated() || retryTimer || new URL(location.href).searchParams.has(marker)) return;
    retryTimer = setTimeout(function () {
      if (!hydrated()) location.replace(retryUrl());
    }, 1000);
  }, true);
  window.addEventListener('DOMContentLoaded', function () { if (failures.length) show(); });
  setTimeout(show, 12000);
})();
`;
