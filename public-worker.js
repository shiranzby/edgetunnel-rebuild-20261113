export default {
  async fetch(request, env) {
    const host = String(env.PROXY_HOST || env.HOST || 'shw.us.ci');
    return Response.json({
      HOST: host, HOSTS: [host], UUID: '', LINK: '', PATH: '/',
      协议类型: 'vless', 传输协议: 'ws', 指纹: 'chrome',
      优选订阅生成: { SUBNAME: 'ShyVPN', local: true, 本地IP库: { 随机IP: true, 随机数量: 16, 指定端口: 443 } },
      订阅转换配置: { SUBAPI: '', SUBCONFIG: '', SUBEMOJI: false },
      反代: { PROXYIP: '', SOCKS5: { 启用: null, 全局: false, 账号: '', 白名单: [] } },
      TG: {}, CF: {}, publicReadOnly: true,
    }, { headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
  },
};
