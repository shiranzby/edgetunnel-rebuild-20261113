# EdgeTunnel Rebuild

这是 ShyVPN 的隔离重建仓库。主体来自 [cmliu/edgetunnel](https://github.com/cmliu/edgetunnel)，同时保留 [zitianya9110/cmliu-edgetunnel](https://github.com/zitianya9110/cmliu-edgetunnel) 作为旧版协议与部署方式的对照。项目提供原版 EdgeTunnel 管理页面、公开节点排名和 Cloudflare 优选订阅。

正式分发域名只有 `shw.us.ci`。默认订阅和节点均由 Cloudflare 直出，不经过个人香港 VPS、Google Oregon VPS、Cloudflare Tunnel 或 SOCKS5。订阅链接直接返回配置，不要求订阅者登录 Cloudflare；管理员账号密码只用于保护面板中的私有配置、节点链接、详细配置和操作日志。

`shyvpn.cc.cd`、`cf-sub.shw.de5.net` 等旧入口不再作为正式分发域名。若保留旧 DNS 或旧路由，只用于兼容跳转到 `shw.us.ci`，不写入新的节点 Host、TLS SNI 或订阅地址。这样可以把正式使用收敛到一个域名，最多只保留旧域名作为过渡别名。

## 当前结构

- `page-bootstrap2.js`：正式首页入口，保留原版 EdgeTunnel 页面布局，并在右上角增加“节点排名”。
- `panel-view-no-script1.js`、`upstream/panel-template-no-script1.js`：原版面板模板；CFST 增强脚本按需从 `/__shy_panel_cfst.js` 加载，避免首页一次性执行过多内嵌脚本。
- `panel-worker.js`：公开页面、安全配置投影和管理页面；游客可以查看普通内容，三个私有区域在登录后解锁。
- `panel-auth.js`：管理员账号、密码登录和签名会话；订阅令牌、UUID、Cloudflare 密钥和旧上游 Cookie 不授予面板管理权限。
- `settings-page.js`：独立 `/settings` 设置页；账号密码使用 KV 哈希记录在线修改，网页标题、Logo、Favicon 和壁纸使用安全公开字段在线修改。
- `session-worker.js`、`login-worker.js`、`admin-worker.js`、`public-worker.js`：将登录、会话、管理员接口和公开接口分开部署。
- `subscription-worker.js`：读取公开合并快照，生成 Clash/Mihomo、V2Ray 和 Sing-box 订阅以及排名数据。
- `node-worker.js`：只处理 VLESS over WebSocket 节点连接；节点入口是 Cloudflare 优选 IP，WebSocket Host 和 TLS SNI 都使用 `shw.us.ci`。
- `gateway-worker.js`、`worker.js`：保留单 Worker 部署和旧链接兼容逻辑，正式拆分部署使用独立入口和 Service Binding。
- `upstream/`：上游源码和本地模板归档；更新面板模板后运行 `node scripts/vendor-panel.mjs`。
- `data/cfip.json`、`data/snapshot.js`：公开优选结果与内置快照；数据只同步公开来源已经测试过的结果，不从 GitHub Actions 海外机器重新测速。

正式线上拆分为页面、认证、管理员、订阅、节点和会话几个 Worker。它们共同使用 `shw.us.ci` 的路径路由；订阅和节点路由不会经过香港或 Oregon 服务器。

## 首页和权限

首页直接使用原版 EdgeTunnel 设置页面，不套额外的外层 iframe 或管理面板。右上角保留原版“我是高手！我就要折腾！”入口，并在其右侧增加“节点排名”。排名页 `/best` 对游客开放，显示完整来源记录、运营商、地区、IPv4/IPv6、发布状态、搜索、排序和分页。

游客可以查看当前网络信息、公开排名、普通说明和公开数据。以下三个区域要求管理员账号和密码后才显示完整内容：

- 获取节点链接；
- 详细配置信息；
- 查看操作日志。

未登录时这些区域只显示登录入口，不把 UUID、订阅令牌、节点链接或后台配置写进 HTML。登录后由签名会话访问 `/admin/config.json`、`/admin/log.json` 等私有接口；写操作仍要求同源请求和管理员会话。

登录表单默认不预填管理员账号或密码。管理员登录后可以打开 `/settings` 修改账号密码和网站外观；账号或密码保存后旧会话立即失效。图片字段只接受 `http(s)` 或安全相对路径，密码不会回传到页面。

## 订阅

正式订阅地址使用 `shw.us.ci`：

- `/sub?token=...&clash`：Clash/Mihomo YAML；
- `/sub?token=...&v2ray`：Base64 VLESS；
- `/singbox?token=...`：Sing-box JSON；
- `/best`：公开节点排名页面；
- `/rankings.json`：公开排名数据；
- `/cfip.json`：公开合并数据。

节点连接方式为 VLESS over WebSocket。每个节点使用 Cloudflare 优选 IP 作为 TCP 入口，`Host` 和 `TLS servername` 均为 `shw.us.ci`，因此节点不会把流量转发到个人 VPS。订阅提供运营商、地区和地址族代理组，并由 `🚀 节点选择` 主组实际引用这些子组。

默认订阅是 Cloudflare 直出。若部署时明确启用 `ENABLE_PUBLIC_FALLBACK=true`，增加 `compat=1` 的公共兼容模式；该模式会在直连失败时使用公开兼容回退，名称和路径会单独标记，不能把它当作默认纯 Cloudflare 直出模式。

## 数据更新

`.github/workflows/update-cfip.yml` 定时抓取微测网移动、电信、联通结果、cfhub 全部公开池以及已保存的历史公开快照。Actions 只同步来源页面，不连接候选 IP，也不使用天翼云电脑作为测速设备。源暂时不可读时保留最后一次成功快照，并记录原始更新时间；所有来源记录和失败/未发布项仍可在排名页查看。

Worker 对公开 JSON 使用短缓存并保留内置快照。数据提交后不需要重新部署 Worker，最多等待缓存周期即可读取新数据；在线源失败时订阅仍优先使用可追溯的旧快照，避免因上游页面暂时异常导致订阅超时。

## 部署变量

必须设置：

- `ADMIN`：管理员密码；
- `ADMIN_USER`：管理员账号；当前生产值为 `shiran`，未设置时默认值为 `admin`；
- `UUID`：VLESS UUID；
- `KEY` 或 `SUB_TOKEN`：订阅访问密钥。

常用变量：

- `CFIP_DATA_URL`：公开合并数据 JSON 地址；
- `HOST`：正式节点 Host，生产值为 `shw.us.ci`；
- `PROXY_HOST`：订阅节点 WebSocket Host，生产值为 `shw.us.ci`；
- `PROXY_SNI`：订阅节点 TLS SNI，生产值为 `shw.us.ci`；
- `LEGACY_SUB_TOKEN`：兼容旧订阅令牌；
- `ENABLE_PUBLIC_FALLBACK=true`：显式开启公共兼容订阅；
- `KV`：管理面板配置存储。

凭据通过 Cloudflare Secret 或本机私密部署文件设置，不写入 Git、网页、截图或日志。正式域名只绑定公开入口；拆分部署时由路径路由把页面、订阅和节点转给对应 Worker。

在线设置使用两个 KV 键：`admin-auth.json` 保存随机盐和密码哈希，`site-settings.json` 保存公开外观字段。认证和会话 Worker 必须同时绑定同一个 KV 命名空间。

上游 `cmliu/edgetunnel` 当前主分支的 1101 修复已经包含在本地 `upstream/cmliu-worker.js` 中。本地文件与上游当前协议文件一致，只有拆分部署所需的少量导出适配，因此没有整体覆盖协议核心。

## 本地检查

```text
npm test
npm run check
npm run build:pages
```

真实线上验收必须使用本机中国移动物理 IPv4 接口 10、源地址 `192.168.6.153`，并区分以下三个层级：

1. 订阅 HTTP 200，确认客户端拿到有效配置；
2. Cloudflare TCP/TLS/WS 握手成功，确认节点入口可连接；
3. Sparkle 附带的 Mihomo 实际代理业务成功，依次访问网页、下载内容和再次访问网页。

其中前两项不能替代第三项。当前验收使用 Mihomo Meta 1.19.33，真实移动物理 IPv4 下两个 Cloudflare 入口均已完成订阅、延迟和网页/下载/再次网页检查；这代表当前样本通过，不代表所有候选 IP、所有运营商或所有网站永久可用。

## 来源与许可

保留上游 GPL 许可、完整协议源码及来源。本地适配没有把个人 API、UUID、订阅令牌或服务器凭据写入源码。
