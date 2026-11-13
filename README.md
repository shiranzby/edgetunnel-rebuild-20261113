# EdgeTunnel Rebuild

这是一个隔离重建版本，代理核心来自 [cmliu/edgetunnel](https://github.com/cmliu/edgetunnel)，订阅与 Pages 首页融合了 `zitianya9110/cmliu-edgetunnel` 的部署思路和本项目公开优选数据。

## 当前结构

- `worker.js`：上游 EdgeTunnel VLESS / WebSocket 核心，加上本项目的双栏目首页、公开优选排名和 Clash/Mihomo、V2Ray、Sing-box 订阅。
- `data/cfip.json`：由公开数据源和已保存快照合并得到的候选数据。
- `scripts/`：只同步公开数据，不从这台电脑或香港 VPS 重新测速。
- `local-cfst-dashboard/`：需要中国大陆出口实测时使用的独立本地测速服务，不参与 Worker 运行。

## 首页

Worker 首页有两个栏目：

1. `原版面板`：EdgeTunnel 入口说明和数据摘要。
2. `节点排名`：按运营商、地区、Colo、延迟和公开测速信息筛选的完整候选表。

## 订阅

部署后通过 `SUB_TOKEN` 或 `KEY` 保护订阅：

- `/sub?token=...&clash`：Clash/Mihomo YAML；
- `/sub?token=...&v2ray`：Base64 VLESS；
- `/singbox?token=...`：Sing-box JSON；
- `/rankings.json`：公开排名数据。

节点使用当前 Worker 的 Host/SNI，Cloudflare 优选 IP 只是 TCP 入口。没有把香港 VPS Tunnel 写入这组节点。

## 部署变量

必须设置：

- `ADMIN`：上游管理/代理核心启用所需的管理员变量；
- `UUID`：VLESS UUID；
- `KEY` 或 `SUB_TOKEN`：订阅访问密钥。

可选：

- `CFIP_DATA_URL`：优选数据 JSON 地址；
- `HOST`：节点 HTTP Host；
- `PROXY_HOST`：订阅节点的 WebSocket Host；
- `PROXY_SNI`：订阅节点的 TLS SNI；
- `KV`：上游管理面板配置存储。

测试阶段只使用新 Worker 的 `workers.dev` 地址。新地址完成订阅、直连 TCP/TLS、WebSocket/VLESS 和页面检查后，再迁移自定义域名。

## 来源与许可

上游协议核心和相关文件遵循其仓库许可证；本仓库保留上游 `LICENSE` 和来源说明。
