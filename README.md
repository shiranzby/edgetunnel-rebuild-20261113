# EdgeTunnel Rebuild

这是 ShyVPN 的隔离重建仓库。保留 [cmliu/edgetunnel](https://github.com/cmliu/edgetunnel) 的实际管理面板和当前协议核心，归档 [zitianya9110/cmliu-edgetunnel](https://github.com/zitianya9110/cmliu-edgetunnel) 供旧版协议、订阅和部署方式对照；新增完整公开排名与本地生成的订阅。

该部署使用 Cloudflare 直出，不配置个人香港/Oregon VPS、Cloudflare Tunnel、SOCKS5 或公共 ProxyIP 回退。

正式管理与排名入口由域名迁移后的 `shyvpn.cc.cd` 提供；中国移动 IPv4 的兼容入口为 `https://cf-sub.shw.de5.net/`。订阅用户使用带令牌的链接直接下载，不登录 Cloudflare。管理员登录只保护管理面板。

## 当前结构

- `gateway-worker.js`：外部 HTTP/WebSocket 入口，通过 Service Binding 转交内部业务 Worker。
- `worker.js`：内部业务入口，组合面板、排名、协议和订阅；不直接绑定生产域名。
- `node-worker.js`：调用 cmliu 原生协议核心，强制空反代地址、无代理类型、关闭反代回退。路径参数也不能开启外部代理。
- `panel-worker.js`：调用真实原版登录、管理页面及 KV API，将管理页订阅令牌连接到本项目的订阅生成器。
- `page.js`：两个栏目共用的页面。Worker 和 Pages 由同一份页面生成。
- `upstream/`：两个上游源码；cmliu 快照版本 `2026-11-10 23:26:46`，仅追加一个本地调用导出。
- `data/cfip.json`：由公开数据源和已保存快照合并得到的候选数据。
- `scripts/`：只同步公开数据，不从这台电脑或香港 VPS 重新测速。
- `local-cfst-dashboard/`：历史工具，运行本项目不需要启动它。

## 首页

Worker 首页有两个栏目：

1. `原版面板`：嵌入真实 EdgeTunnel 登录和管理页面，提供独立打开入口。
2. `节点排名`：完整来源记录，包括未发布和历史失败项；支持运营商、地区、IPv4/IPv6、发布状态、搜索、排序和分页。地区为来源标注的入口信息，不保证最终出口地区。

保留微测网移动、电信、联通全部行，cfhub 全部池与 IPv4/IPv6，以及已归档的 `test.shyvpn.cc.cd` 快照。来源检测方式、原始指标和更新时间分别保存，不将 cfhub 的 ECH/TLS 检测冒充下载测速。

## 订阅

部署后通过 `SUB_TOKEN` 或 `KEY` 保护订阅：

- `/sub?token=...&clash`：Clash/Mihomo YAML；
- `/sub?token=...&v2ray`：Base64 VLESS；
- `/singbox?token=...`：Sing-box JSON；
- `/rankings.json`：公开排名数据。

节点固定使用独立 CF 域名 `cf-sub.shw.de5.net` 作为 Host 和 SNI，Cloudflare 优选 IP 作为 TCP 入口。订阅提供运营商、地区和地址族代理组，保留同一 IP 的不同运营商记录，不截断为 200 个或 240 个。

Clash/Mihomo 代理组指定 `https://www.gstatic.com/generate_204` 进行延迟检测。

## 部署变量

必须设置：

- `ADMIN`：原版面板管理员密码；
- `UUID`：VLESS UUID；
- `KEY` 或 `SUB_TOKEN`：订阅访问密钥。

业务 Worker 可选：

- `CFIP_DATA_URL`：优选数据 JSON 地址；
- `HOST`：节点 HTTP Host；
- `PROXY_HOST`：订阅节点的 WebSocket Host；
- `PROXY_SNI`：订阅节点的 TLS SNI；
- `LEGACY_SUB_TOKEN`：兼容旧订阅链接；
- `KV`：本项目独立的上游管理面板配置存储，不复用个人 VPS 配置。

外部入口必须设置 Service Binding `BACKEND` 指向内部业务 Worker。线上经过验证的结构为：

```text
客户端 → Cloudflare 优选 IP → 入口 Worker
                              └─ Service Binding → 业务 Worker → 目标网站
```

`wrangler.gateway.toml` 对应入口，`wrangler.toml` 对应内部业务。UUID、管理员密码、订阅令牌通过 Cloudflare Secret 设置，不写入仓库。只有入口绑定域名；不要将业务 Worker 直接公开替代这条已经验收的链路。

## 自动更新

`.github/workflows/update-cfip.yml` 每小时第 17 分钟抓取公开结果并提交 `data/`。只抓取结果页，不连接候选 IP，不从 GitHub Actions 测速，也不依赖天翼云电脑。

业务 Worker 读取 GitHub raw JSON，缓存约 120 秒；数据提交后无需重发 Worker。某来源失败时保留其最后成功快照，并显示缓存状态和原始抓取时间。历史测速快照是归档，不能称为实时测速。

`npm run build:pages` 从同一页面生成 `pages/`。Pages 在浏览器中刷新 Worker 排名 API；刷新失败时明确显示构建时快照。代码更新需要重新部署，数据更新与代码部署分别处理。

## 验证和能力边界

```text
npm test
npm run check
npm run build:pages
```

线上验收绑定中国移动物理 IPv4 接口，使用临时 Mihomo、独立端口和无协议字节的本机中继，仅负责将连接固定到物理接口。测试不改日用 Sparkle、系统代理或 DNS。

Cloudflare TCP sockets 禁止连接 Cloudflare 自身 IP 等目标。因此，关闭所有外部回退的直出版本不能代理所有 Cloudflare CDN 网站。拆分 Worker 解决入口/业务部署兼容，不能消除这个出站限制。此边界不能用 Google 网页成功掩盖。

官方依据：<https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/>

## 来源与许可

保留上游 GPL 许可、完整协议源码及来源。本地适配没有将个人 API、UUID、订阅令牌或服务器凭据写入源码。
