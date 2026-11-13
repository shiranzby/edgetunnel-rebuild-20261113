# EdgeTunnel Rebuild

这是 ShyVPN 的隔离重建仓库。保留 [cmliu/edgetunnel](https://github.com/cmliu/edgetunnel) 的实际管理面板和当前协议核心，归档 [zitianya9110/cmliu-edgetunnel](https://github.com/zitianya9110/cmliu-edgetunnel) 供旧版协议、订阅和部署方式对照；新增完整公开排名与本地生成的订阅。

默认订阅使用 Cloudflare 直出，不配置个人香港/Oregon VPS、Cloudflare Tunnel 或 SOCKS5。另提供明确分开的“公共兼容”订阅，只在直连失败时使用上游公共回退；这同样不使用个人两台 VPS，但不能称为全程仅 Cloudflare。

正式管理与排名入口由域名迁移后的 `shyvpn.cc.cd` 提供；中国移动 IPv4 的兼容入口为 `https://cf-sub.shw.de5.net/`。订阅用户使用带令牌的链接直接下载，不登录 Cloudflare。管理员登录只保护管理面板。

## 当前结构

- `gateway-worker.js`：外部 HTTP/WebSocket 入口，通过 Service Binding 转交内部业务 Worker。
- `worker.js`：内部业务入口，组合面板、排名、协议和订阅；不直接绑定生产域名。
- `node-worker.js`：默认强制空反代地址、无代理类型、关闭反代回退。`/compat` 仅在显式启用后调用独立的上游公共兼容入口；不解析用户提供的外部代理地址。
- `panel-worker.js`：调用真实原版登录、管理页面及 KV API，将管理页订阅令牌连接到本项目的订阅生成器。
- `page.js`：两个栏目共用的页面。Worker 和 Pages 由同一份页面生成。
- `upstream/`：两个上游源码；cmliu 快照版本 `2026-11-10 23:26:46`，末尾追加本地调用适配，保留主体。
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
- 在上述订阅地址增加 `&compat=1`：公共兼容模式，节点名含“公共兼容”、WebSocket 路径为 `/compat`；
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
- `ENABLE_PUBLIC_FALLBACK=true`：提供单独的公共兼容选项，默认订阅仍为仅直出；
- `KV`：本项目独立的上游管理面板配置存储，不复用个人 VPS 配置。

外部入口必须设置 Service Binding `BACKEND` 指向内部业务 Worker。线上经过验证的结构为：

```text
客户端 → Cloudflare 优选 IP → 入口 Worker
                              └─ Service Binding → 业务 Worker → 目标网站
```

`wrangler.gateway.toml` 对应入口，`wrangler.toml` 对应内部业务。UUID、管理员密码、订阅令牌通过 Cloudflare Secret 设置，不写入仓库。只有入口绑定域名；不要将业务 Worker 直接公开替代这条已经验收的链路。

## 自动更新

`.github/workflows/update-cfip.yml` 每小时第 17 分钟抓取公开结果并提交 `data/`。只抓取结果页，不连接候选 IP，不从 GitHub Actions 测速，也不依赖天翼云电脑。

业务 Worker 读取 GitHub raw JSON，缓存约 120 秒；数据提交后无需重发 Worker。冷启动最多等待约 800 ms 的在线数据，之后先返回内置快照，后台继续刷新；在线读取失败不会卡住订阅更新，页面标注快照状态和原始时间。`data/snapshot.js` 是同步导出的公开快照，不含凭据。

某来源失败时，Actions 保留其最后成功快照并标注原始抓取时间。历史测速快照是归档，不能称为实时测速。

`npm run build:pages` 从同一页面生成 `pages/`。Pages 在浏览器中刷新 Worker 排名 API；刷新失败时明确显示构建时快照。代码更新需要重新部署，数据更新与代码部署分别处理。

## 验证和能力边界

```text
npm test
npm run check
npm run build:pages
```

线上验收绑定中国移动物理 IPv4 接口，使用临时 Mihomo、独立端口和无协议字节的本机中继，仅负责将连接固定到物理接口。测试不改日用 Sparkle、系统代理或 DNS。

Cloudflare TCP sockets 限制访问 Cloudflare 自身 IP 等目标；仅直出模式存在这类目标的兼容限制。公共兼容模式保留直连优先，在失败时使用上游公共地址。

移动 IPv4 实测：直出模式两个订阅节点完成 Google 网页、13 KB 图片、第二次网页；公共兼容模式完成 example.com、cdnjs 87,533 字节资源、Google 网页。另一次 `speed.cloudflare.com` 探测超时，保留失败记录，不能承诺所有网站或所有候选永久可用。电信、联通和 IPv6 未由本机实际验收。

官方依据：<https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/>

## 来源与许可

保留上游 GPL 许可、完整协议源码及来源。本地适配没有将个人 API、UUID、订阅令牌或服务器凭据写入源码。
