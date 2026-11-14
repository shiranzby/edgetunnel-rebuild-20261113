# 当前交付入口

## 2026-11-14 代理组与 AI 访问验收

登录表单账号框已增加灰色 `请输入管理员账号` placeholder，密码框保留 `请输入管理员密码`；正式页面已重新部署，移动物理 IPv4 首页 HTTP 200 且两个 placeholder 都存在。订阅 Worker 已重新部署，线上 Clash 配置包含 17 个代理组：主 `Selector`、全节点 `⚡ 自动选择`、全节点 `🤖 AI 代理`、运营商组、地区组和 IPv4/IPv6 组。

运营商、地区和地址族子组改为 `url-test`，因此用户选择地区组后会在该组内部自动测速；单个 VLESS 条目仍是直接节点。AI 组用 `https://chatgpt.com/`、HTTP 200 做本地客户端测试，ChatGPT/OpenAI 规则指向该组。独立 Mihomo Meta 1.19.33 使用中国移动物理 IPv4 接口 10、源 `192.168.6.153`，没有启动 Sparkle，没有使用系统代理、香港 VPS 或 Oregon VPS，也没有占用正式 `7890/7891/7892`。当前 48 个跨地区候选对 ChatGPT/OpenAI API 延迟均返回 503，实际请求为 TLS EOF；因此没有宣称 AI 业务完成，也没有把未验证节点写成 AI 专用节点。证据在 `shyvpn-review-20261113/ai-openai-scan-48-20261114.json`。

上游对照提交为 `5b2aaf0daf7fa1b126170877f64dd8d2e34c2746`；本地和上游 `CHANGELOG` 顶部一致，包含连接复用、连接参数调节和 1101 修复。本地协议文件只保留拆分 Worker 所需的导出适配，不整体覆盖上游。

## 2026-11-14 临时 Mihomo 核心验收

用户明确禁止再次启动隔离 Sparkle 客户端；后续真实业务验收只启动 `E:\工具\Sparkle\resources\sidecar\mihomo.exe`，不修改正式 Sparkle 数据目录，也不占用正式 `7890/7891/7892`。临时 Mihomo 使用一次性 C 盘工作目录和独立端口，结束后删除核心、配置和临时目录。

本轮在本机中国移动物理 IPv4 接口 10、源地址 `192.168.6.153` 下验证 `shw.us.ci` 当前实时订阅：订阅 HTTP 200、Clash 配置校验通过；`104.18.39.37`（新加坡 SIN 004）使用 `17890/17891`，Mihomo 延迟 3873 ms；`172.64.229.7`（日本 NRT 001）使用 `17892/17893`，Mihomo 延迟 2074 ms。两个节点均完成第一次网页、下载、第二次网页，三次请求均 HTTP 200。未使用系统代理、香港 VPS、Google Oregon VPS 或 Sparkle 图形客户端。脱敏截图和 JSON 证据位于 `F:/WorkSpace/设备管理/shyvpn-review-20261113/acceptance-20261114/`。

测试脚本若将 `tempfile.mkdtemp(..., dir=F:)` 作为工作目录，可能在当前 Windows 环境卡住；一次性工作目录应放在 C 盘并在退出时校验删除。不要把这个环境问题误判成节点超时。

## 2026-11-14 管理员凭据切换

按用户明确要求，`shw.us.ci` 当前生产管理员账号已切换为 `shiran`；密码只保存在本机私密部署文件和 Cloudflare Secret，不写入仓库、文档、截图或回复。认证、会话、管理员接口和首页四个 Worker 已同步更新。中国移动物理 IPv4 验证新账号登录成功、会话保持、私有配置读取成功，退出后私有接口返回 401；旧 `admin` 账号已失效。

## ShyVPN EdgeTunnel 重建（2026-11-14）

这是当前权威状态。原始仓库 `shiranzby/edgetunnel` 保留；重建仓库为 `F:/WorkSpace/Myproject/edgetunnel-rebuild-20261113/repo`。

- 正式分发域名只有 `shw.us.ci`。
- 首页保留 cmliu EdgeTunnel 原版页面；右上角在“我是高手！我就要折腾！”右侧增加“节点排名”。
- 游客可查看普通页面和完整公开排名；获取节点链接、详细配置、操作日志三个区域要求管理员账号和密码。
- 订阅无需登录 Cloudflare。订阅和节点由 Cloudflare 直出，不经过个人香港 VPS、Google Oregon VPS、Cloudflare Tunnel 或 SOCKS5。
- 新节点的 WebSocket Host 和 TLS SNI 均为 `shw.us.ci`。`shyvpn.cc.cd`、`cf-sub.shw.de5.net` 等旧入口不得再写入新的订阅或节点配置；若保留，只做兼容跳转。
- 公开数据只同步微测网移动/电信/联通、cfhub 全部公开池及归档快照已经测试过的结果；GitHub Actions 不重新连接候选 IP，不依赖天翼云电脑。
- 页面、认证、管理员、订阅、节点和会话按路径拆分为多个 Worker；同一正式域名承载路由，不使用个人服务器做转发出口。

## 当前证据

- 本机中国移动物理 IPv4：接口 10，源地址 `192.168.6.153`。
- `shw.us.ci` 正常 DNS 的两个 IPv4 均可直接取得订阅；订阅 HTTP 200，Clash/Mihomo YAML 有 205 个节点、15 个代理组，Host/SNI 均为 `shw.us.ci`。
- `/session` 返回 `{"authenticated":false}`；首页、管理页、排名页、排名 JSON 和按需 CFST 脚本均为 HTTP 200。
- Sparkle 附带 Mihomo Meta 1.19.33 已用当前订阅完成真实移动 IPv4 业务：Cloudflare 入口延迟检测、网页、下载、再次网页均通过；测试没有使用系统代理、香港 VPS 或 Oregon VPS。
- 订阅 HTTP 200、TCP/TLS/WS 成功和 Mihomo 实际代理业务必须分别记录，不能用前两项代替最后一项。

证据目录：`F:/WorkSpace/设备管理/shyvpn-review-20261113/`。当前关键收据为 `shw-us-ci-session-mobile-20261114.json`、`shw-us-ci-dns-subscription-mobile-20261114.json` 和 `shw-us-ci-mobile-business-final-20261114.json`。其中订阅令牌、UUID、管理员密码和 API 凭据不得复制到仓库或回复。

## 后续维护

1. 先读本文件、`SOUL.md` 和工作区 `F:/WorkSpace/设备管理/CONTINUOUS_DELIVERY.md`。
2. 用户反馈超时后重新打开真实移动 IPv4 验收，不以海外 Actions 或公开源结果替代。
3. 不重新创建大量诊断 Worker；复用现有正式资源并清理临时资源。
4. 默认订阅保持 Cloudflare 直出；任何公共兼容回退都必须单独标记，不能悄悄经过个人 VPS。
5. 数据源失败时保留最后成功快照和原始时间，订阅快速返回，不把快照冒充实时测速。
6. 代码修改后运行 `npm test`、`npm run check`、`npm run build:pages`，并用物理移动 IPv4复核订阅和实际业务。
7. 2026-11-14 已增加独立 `https://shw.us.ci/settings` 设置页。认证 Worker、会话 Worker 和管理员 Worker 共用同一 KV；`admin-auth.json` 保存随机盐与密码哈希，账号或密码修改后旧 Cookie 自动失效；`site-settings.json` 保存页面标题、浏览器标题、Logo、Favicon 和壁纸 URL。
8. 登录表单已去掉账号预填，游客页面不会输出管理员密码、UUID 或订阅令牌。外观 URL 只接受 `http(s)` 或安全相对路径，线上移动物理 IPv4 已验证设置页、会话和私有外观接口。
9. 对照上游 `cmliu/edgetunnel` 当前主分支 `5b2aaf0` 后确认，本地 `upstream/cmliu-worker.js` 已包含 1101 修复；文件差异仅是本地拆分架构使用的导出适配，不要整体覆盖协议核心。
