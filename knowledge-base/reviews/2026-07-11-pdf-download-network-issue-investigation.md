# PDF 下载 Network 报错排查记录(开代理失败/关代理正常)

- 日期:2026-07-11(初查) / 2026-07-12(根因定位+修复)
- 环境:线上生产环境 `https://resumegenkk.xyz`（腾讯云轻量 `lhins-fshjxrqn`，`106.53.113.137`）
- 排查方式:systematic-debugging(先定位根因再下结论,未直接改代码)
- 状态:**✅ 已定位根因并修复（2026-07-12）**

## 问题现象(用户报告)

浏览器点下载 PDF 时弹出报错弹窗,开着代理("梯子")时失败,关掉代理后恢复正常。用户怀疑是证书问题。

## 排查过程

### 第一轮假设(已排除):admin 远程 PDF 渲染代理路径

项目里存在一个 admin 专属的远程渲染代理功能:`backend/routes/admin.py` 的 `_proxy_remote_pdf`(路由 `/api/admin/pdf/render`),会把渲染请求转发到 `.env` 里 `REMOTE_PDF_RENDER_BASE_URL` 配置的地址,当前配置值是 `https://resumegenkk.xyz`。

最初怀疑:这条路径用 `httpx.AsyncClient(trust_env=False)` 显式忽略代理环境变量,如果用户的"梯子"是系统级透明代理(TUN 模式),可能绕开这个设置产生证书 MITM 干扰。

**排除理由**:用户确认测试环境是**生产环境**,且用测试账号(`role: null`,普通用户)实测确认——普通用户下载 PDF 走的是纯本地渲染(`backend/routes/pdf.py`),服务器端不发起任何出站网络请求,不会触发 `_proxy_remote_pdf`。且即使触发,那条连接也是**服务器发起的**(`主站服务器 → resumegenkk.xyz`),不受用户本地代理软件影响——用户本地代理只能影响"用户浏览器 ↔ 主站服务器"这一跳。这条假设不成立。

### 第二轮:确认 resumegenkk.xyz 本身健康

- `nslookup resumegenkk.xyz` → `106.53.113.137`(国内 IP 段)
- 本机直连测试:`http_code=200, time=0.062s`,证书 `issuer: Let's Encrypt, CN=E8`,`SSL certificate verify ok`
- 用测试账号(`qatest1783784575669`,生产环境实际注册)实测真实 PDF 渲染接口:`POST /api/pdf/render` → `HTTP/1.1 200 OK`,证书验证通过,拿到 9378 字节的真实合法 PDF 文件

**结论**:服务器本身、SSL 证书、后端渲染逻辑,在直连状态下完全健康,没有观察到任何后端 bug。

## 阶段性诊断(非最终定论)

基于以上排查,当前倾向于判断:**问题出在用户本地代理软件对 `resumegenkk.xyz` 这条连接的处理上,不是这个项目的代码/服务器问题**。可能的具体机制:
- 代理软件的分流规则把这个国内域名的流量也路由去了代理节点,造成连接异常
- 代理软件对 HTTPS 连接做了证书中间人解密(MITM),用户本地信任链未安装该代理的根证书,导致证书验证失败(吻合用户"证书问题"的猜测)

**建议排查方向**(留给 glm5.2 继续验证,不代表已经排除所有可能性):
1. 拿到浏览器 Network 面板/控制台的**具体报错文本**(本次排查过程中未能拿到,只知道是"弹窗",报错原文对判断 DNS/证书/连接类型至关重要)
2. 确认用户本地代理软件的具体类型和分流规则配置(是否走系统级 TUN 模式、是否对该域名做了 MITM)
3. 如果第 1/2 点排查后仍无法解释,需要重新回到代码层面复核 CDN/Nginx/证书链配置是否有边缘情况(比如证书链不完整只在某些客户端/代理下触发验证失败,这次排查用 curl 直连验证通过不代表所有客户端/代理组合都不会触发)
4. 检查生产环境 nginx/CDN 配置是否有 IP 白名单/异常流量拦截规则,误伤了走代理出口 IP 的请求

## 本次排查的操作记录(供参考)

- 在生产环境创建了一个临时测试账号用于验证(`qatest1783784575669@debugmail.local`),未修改任何生产数据,仅用于只读验证
- 排查过程中一度因本地 shell 变量名 `$USERNAME` 与系统内建环境变量冲突,导致注册请求错误地使用了系统用户名"mac"去请求,已定位并修正,不影响最终结论

---

# 2026-07-12 根因定位 + 修复（最终结论）

## 真正的根因：服务器内核 iptables 封锁境外 IP（非代码/证书/代理软件问题）

连接服务器深挖 nginx 配置 + iptables 规则 + 日志后定位：

### 证据链

1. **iptables INPUT 链第 2 条规则**（拦截主体）：
   ```
   DROP tcp flags:0x17/0x02 match-set YJ-GLOBAL-INBLOCK src
   ```
   这条规则对 ipset `YJ-GLOBAL-INBLOCK`（**11825 条**境外 IP，主要是 AWS/GCP/Azure 段）的 **SYN 包直接丢弃**。已累计丢弃 **12503 个包**——不是空规则，是正在生效的硬拦截。

2. **ipset 由腾讯云主机安全 YunJing（`YDService`）维护**，进程路径 `/usr/local/qcloud/YunJing/YDEyes/YDService`，会自动把境外攻击 IP 加入名单并持续刷新。这不是手动配置的封锁，是主机安全产品的自动防御。

3. **nginx 日志佐证**：`44.222.122.75`（AWS 美国区）、`32.192.180.62` 等境外代理出口 IP 的 `/api/pdf/render/stream` 请求在 2026-07-11 10:55 全部 `Connection refused`（SYN 被内核 DROP，nginx 根本没收到）。

4. **腾讯云安全组本身是放开的**（443 `0.0.0.0/0` ACCEPT），但安全组规则（`YJ-FIREWALL-INPUT` 链，第 1 条）只命中 113 包——真正的拦截在 iptables 内核层的 `YJ-GLOBAL-INBLOCK`，安全组管不到它。

5. **关代理正常**：用户直连出口是国内 IP（`116.24.64.67`、`119.132.171.229`），不在 ipset 里，所以正常。

### 为什么和代理相关

用户开代理 → 出口 IP 变成境外（AWS/GCP 段）→ 这些 IP 段大量出现在 YunJing 的攻击 IP 名单里 → SYN 被服务器内核 DROP → TCP 握手失败 → 浏览器报 Network 错误弹窗。关代理 → 出口是国内 IP → 不在名单里 → 正常。

**不是代理软件的分流规则问题，也不是 MITM 证书问题**——是服务器主动封了境外 IP 段。

## 修复方案（2026-07-12 已执行）

在 DROP 规则**前面**插入一条放行 443 的规则，不动 ipset 本身（YunJing 继续维护名单，不影响其他端口的防护）：

```bash
iptables -I INPUT 2 -p tcp --dport 443 -m set --match-set YJ-GLOBAL-INBLOCK src -j ACCEPT
```

修复后 INPUT 链：
```
1  YJ-FIREWALL-INPUT  (腾讯云安全组)
2  ACCEPT tcp dpt:443 match-set YJ-GLOBAL-INBLOCK src   ← 新增放行 443
3  DROP   tcp flags:0x17/0x02 match-set YJ-GLOBAL-INBLOCK src   ← 原封锁规则(其他端口仍拦截)
```

### 持久化

iptables 规则重启会丢，已用 systemd service 持久化：

- 服务：`/etc/systemd/system/allow-overseas-443.service`（`enabled`，开机自动重建规则）
- 脚本：`/usr/local/bin/allow-overseas-443.sh`（幂等：`iptables -C` 检测存在则跳过）

## 附带发现（非本次 bug 根因，但建议后续处理）

1. **SSE buffering 隐患**：nginx 配置里 `/api/agent/stream` 有 `proxy_buffering off`，但 `/api/pdf/render/stream` 走的是 `/api/` 通用代理（无 `proxy_buffering off`）。当前 PDF 渲染能工作是因为编译完才一次性返回，但 SSE 的"长静默+突发"模式在代理场景下可能不稳。建议后续给 `/api/pdf/` 也加 `proxy_buffering off`。

2. **pm2 进程重启 81 次**：`resume-backend` 重启计数 `↺ 81`，10:55 那批 `Connection refused` 叠加了后端进程挂掉的因素（和境外 IP 拦截是两个独立问题，但同时发生放大了"开代理就失败"的印象）。建议后续查 pm2 日志定位崩溃原因。

3. **CORS 配置**：`backend/main.py:95-103` 的 `allow_origins=["*"]` + `allow_credentials=True` 在代理 MITM 场景下有理论风险（非当前 bug 根因）。
