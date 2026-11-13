# 当前交付入口

本仓库为隔离重建版本；原 `shiranzby/edgetunnel` 保留。只在移动 IPv4 业务通过后迁移正式域名。

- 外部入口：`shy-runtime-observer-20261113`，源码 `gateway-worker.js`。
- 内部业务：`shy-edge-20261113`，源码 `worker.js`，仅经 Service Binding 使用。
- `BACKEND` 指向内部业务；正式域名绑定外部入口。直接绑定内部脚本曾复现 1101，服务绑定结构已通过移动 IPv4；未将平台内部原因视为已确定。
- 移动兼容入口 `cf-sub.shw.de5.net`，节点 Host/SNI 都使用此域名，不占用香港 Tunnel。
- 默认直出订阅与 `compat=1` 公共兼容订阅明确区分；两者均不配置个人 VPS。公共回退来自上游，不能称为纯 Cloudflare 出站。
- 数据来自三类公开/归档结果，Actions 仅同步，不从海外测速。完整记录与订阅候选分开，保留失败和未发布项。
- 读取在线源设置超时、后台刷新和内置快照；快照标注实际日期，不冒充在线新数据。
- 认证只从 Cloudflare Secret/本机私有文件取得，不入仓库、截图或日志。

实网证据保存在设备管理工作区 `shyvpn-review-20261113/`，包括 `final-live-subscription-mobile.json`、`public-compatibility-final.json`、`automatic-data-refresh-verification.json`。测试固定本机物理接口与 IPv4 源地址，不修改日用 Sparkle 或系统网络。
