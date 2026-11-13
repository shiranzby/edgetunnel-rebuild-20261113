# 当前交付入口

本仓库为隔离重建版本；原 `shiranzby/edgetunnel` 保留。正式域名已在移动 IPv4 业务通过后迁移，当前根域名的 9 条路由均指向下述入口。

- 外部入口：`shy-runtime-observer-20261113`，源码 `gateway-worker.js`。
- 内部业务：`shy-edge-20261113`，源码 `worker.js`，仅经 Service Binding 使用。
- `BACKEND` 指向内部业务；正式域名绑定外部入口。直接绑定内部脚本曾复现 1101，服务绑定结构已通过移动 IPv4；未将平台内部原因视为已确定。
- 移动兼容入口 `cf-sub.shw.de5.net`，节点 Host/SNI 都使用此域名，不占用香港 Tunnel。
- 默认直出订阅与 `compat=1` 公共兼容订阅明确区分；两者均不配置个人 VPS。公共回退来自上游，不能称为纯 Cloudflare 出站。
- 数据来自三类公开/归档结果，Actions 仅同步，不从海外测速。完整记录与订阅候选分开，保留失败和未发布项。
- 读取在线源设置超时、后台刷新和内置快照；快照标注实际日期，不冒充在线新数据。
- 认证只从 Cloudflare Secret/本机私有文件取得，不入仓库、截图或日志。

实网证据保存在设备管理工作区 `shyvpn-review-20261113/`，包括 `final-live-subscription-mobile.json`、`public-compatibility-final.json`、`automatic-data-refresh-verification.json`。测试固定本机物理接口与 IPv4 源地址，不修改日用 Sparkle 或系统网络。

正式域名迁移后，已从移动 IPv4 经新公共兼容节点取得 `shyvpn.cc.cd` 的有效旧令牌订阅；不使用跨域 SNI/Host 的 403 作为路由失败依据。代理组必须从 `🚀 节点选择` 引用全部非空运营商、地区和地址族子组，不能只生成可见列表却让选择不参与实际路由。已增加对应回归检查。

最终验收使用 Sparkle 实际附带的 `E:/工具/Sparkle/resources/sidecar/mihomo.exe`，版本 1.19.33，并在报告中记录实际版本。移动 IPv4 的首选 104.18.39.37 延迟检测 2730 ms，example.com、87,533 字节 cdnjs 文件和 Google 全部 200，旧令牌正式域名订阅也为 200。域名正常解析的两个 IPv4 地址均已直连下载有效订阅；不只验证手工指定的优选地址。

最终部署后已触发公开源更新，线上数据与 GitHub 生成时间一致，非内置快照；该次为 235 条完整记录、198 个候选、16 个代理组，数量随后随公开源变化。51 个本轮过期诊断 Worker 及其 16 条临时路由、16 条 DNS 已清理，正式两个 Worker、Pages、用户原有资源保留。

私有一键导入页与离线备用 YAML 均在设备管理证据目录，禁止提交 Git 或公开上传。离线 YAML 只用于首次导入救援，正常使用应添加远程订阅。保留偶发延迟超时、Google TLS 中断等失败证据，不宣称全池或全部网站永久正常。工作区 `CONTINUOUS_DELIVERY.md` 和同目录 `RESULT.md` 为交付入口。
