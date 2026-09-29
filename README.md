# 画活了 · Next.js

无需登录注册：上传一幅画，生成四页故事，阅读并导出四宫格分享图片。前端使用 **Next.js 16.3.7 App Router + React 19.3.0**，保留原有 Poixe 任务服务与浏览器匿名凭据。

## 本地运行

需要 Node.js 22 或以上版本。

```sh
npm ci
npm run dev
```

打开 http://localhost:5173 。开发服务只监听 `127.0.0.1`，线上通过 Nginx 转发。

生产运行必须先构建：

```sh
npm run build
npm start
```

`npm start` 启动的是自定义常驻 Node 服务，**不要改用 `next start`**：前端由 Next.js 处理，`/api/config`、`/api/jobs` 及持续执行的生成队列由同一进程内的原有任务服务处理。刷新、关闭网页不会停止服务端任务。文件队列只能由一个 Node 进程管理，不支持多实例共享数据目录或无持久磁盘的 serverless 部署。

## AI 配置

在终端设置 `POIXE_API_KEY` 后执行：

```sh
npm run ai:configure
```

该命令将密钥写入 Git 忽略的 `.env.local`，不打印密钥。也可直接将环境变量传给服务进程。未配置密钥时，可体验示例、保存原画和分享示例；真实生成不可用。更换已有密钥后需重启服务。

可选配置见 `.env.example`：

- `PORT`：默认 5173。
- `POIXE_BASE_URL`：默认 `https://api-eu-central-1-dc8.poixe.com`，仅允许代码中列明的 Poixe 地址。
- `STORY_DATA_DIR`：默认 `.local-data/jobs`，升级时必须保留。
- `STORY_CONCURRENCY`：默认 2，允许 1–8。后两页续画并行，因此默认最多同时请求 4 张图。

密钥不会传给客户端；任务文件、配置及后端源码不对外提供静态访问。

## 功能和数据兼容

- JPEG / PNG / WebP 上传，10 MB 限制；旋转、居中裁剪；原始文件独立保留。
- 一次描述，直接生成；可选名字、日期、孩子原话及本地录音。录音不会发给 AI。
- 原画首页＋三页 AI 续画，支持后台排队、取消、刷新找回、阅读位置保存。
- 1600×1600 四宫格 PNG，含三页旁白及 AI 来源标识；支持下载、长按预览保存，浏览器支持时可用系统分享。**当前不生成公开阅读链接。**
- 示例故事、色调调整演示、四页打印/PDF、原图下载、JSON 备份与删除。
- 继续使用 `huahuole-demo` IndexedDB v1、`artworks` 和 `client-token` 原键名；已有作品、凭据和未完成任务无需迁移操作。必须保持相同协议、域名和端口，切换来源的浏览器数据不会自动转移。
- 匿名凭据首次创建在单一事务内完成；作品更新读写也在单一事务内完成，多标签页通过 BroadcastChannel 同步，回到页面时重新读取记录。
- 记录仍绑定当前浏览器，清除网站数据可能丢失访问能力。授权生成后处理图与文字会保存到服务器并发送至 Poixe 及上游模型。

## 首屏与移动端

首页在构建时预渲染 HTML，标题、说明、插画和启动状态不依赖客户端脚本先执行。约 26 KB 的页面 CSS 随 HTML 内联（Next 的 `experimental.inlineCss`，依赖已锁定），避免独立样式请求阻塞首屏；不使用外部字体或 CDN。

客户端完成本机画册初始化后启用上传等操作。React 页面与全局错误边界、IndexedDB 超时提示、独立于 React 的加载提示和刷新链接共同处理启动异常。新版本使用 AbortController 管理接口超时；分享绘图不依赖 `CanvasRenderingContext2D.roundRect`。

这只能改善页面资源与初始化问题，不能修复 HTML 到达前的 DNS、TLS 或反向代理故障。上次访问域名的 HTTPS 链路问题仍需结合实际手机和服务器日志定位。重构不等于线上白屏已解决。

## 项目结构

```text
app/                  App Router 页面、布局、错误边界、全局样式
components/           画册、上传、弹窗、生成进度、阅读和分享 React 组件
lib/storage.js        原 IndexedDB 数据兼容和事务更新
lib/use-library.js    初始化、跨标签同步与任务轮询
lib/api.js            匿名 API 请求及超时处理
lib/media.js          上传图片处理、下载和兼容 UUID
lib/share.js          按需加载的四宫格绘图
public/assets/        示例 SVG 插画
server.mjs            Next 自定义服务入口及原 API
backend/              原任务队列、模型请求、持久化与找回
```

旧的 `app.js`、`index.html` 和根目录 `style.css` 已退役，不再有两套前端入口。

## 检查

```sh
npm run check
npm test
npm run build
PLAYWRIGHT_PATH=/absolute/path/to/playwright npm run test:ui
```

UI 测试使用独立临时服务、数据目录及浏览器上下文；默认使用 macOS Chrome，可通过 `CHROME_PATH` 指定可执行文件。测试模型请求全部模拟，不产生模型费用。UI 测试前必须完成生产构建。

- `tests/smoke.mjs`：示例阅读、调整撤销、分享、上传旋转、原图保真、保存刷新、演示取消找回、删除和手机布局。
- `tests/ai-ui.mjs`：上传授权→模拟真实任务接口→四页阅读→刷新恢复→分享；私有路径不公开。
- `tests/startup-ui.mjs`：阻断全部 JS 时首屏仍可见；内联 CSS；存储失败；旧超时 API；并发凭据；旧数据与未完成任务兼容；360/390/430/1440 布局。
- 原后端测试继续覆盖幂等、所有权隔离、并发、找回、删除竞态和队列重启。

## 部署与试用边界

升级服务器时执行 `npm ci && npm run build` 后再重启 Node 服务，保留 `.env.local` 和 `.local-data`，保持域名与 HTTPS 不变。现有 Nginx 代理继续转发到 `127.0.0.1:5173`，`/_next/` 构建资源也必须能访问。每次发布必须同时更新服务和对应的 `.next` 构建，不能只替换源文件。

不需要增加登录注册才能邀请测试。但公开试用前仍需完成真实手机访问、真实模型整册生成和保存分享验收，以及匿名调用的总量/预算限制。当前仅有并发上限，没有每日总量或费用熔断；内容审核和供应商完整留存政策尚未完成验证。详见 `tests/RELEASE-REVIEW-2026-09-30.md` 的评估与本次迁移说明。

框架配置参考：[Next.js 安装与运行](https://nextjs.org/docs/app/getting-started/installation)、[自定义常驻服务](https://nextjs.org/docs/app/guides/custom-server)。
