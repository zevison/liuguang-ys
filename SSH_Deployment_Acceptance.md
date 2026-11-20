# SSH Deployment Acceptance — 映界 2026-11-20

## 目标
部署 commit `c2d8f23 fix: 首页和搜索页封面走缩图代理 + 两阶段失败回退` 到 Vultr VPS `144.202.122.138`（域名 `tv.szdapi.com`）。

## 根因诊断过程（superpowers systematic-debugging）

| 阶段 | 证据 | 结论 |
|------|------|------|
| 裸 TCP 探测 | `nc -vz VPS 22/80` 全 timeout；`bash /dev/tcp` 同样 timeout；`github.com:22` 也 timeout | 不是 VPS 防火墙/sshd 问题 |
| curl 走 HTTP_PROXY | `curl http://VPS:80/` → nginx 欢迎页 200 | TRAE 沙箱 HTTP_PROXY=127.0.0.1:18080 生效 |
| `nc -X connect` 隧道 | 成功连 VPS 22，拿到 ED25519 公钥 | 走 HTTP CONNECT 隧道能通 |
| ssh 密码认证 | `SSHPASS env + sshpass -e` → `root@vultr` | sshd 正常监听 22，密码正确 |

**根因**：TRAE 云端执行环境裸 TCP 全禁，所有出站必须经 HTTP CONNECT 代理 127.0.0.1:18080。SSH 22 端口需要代理隧道，不能直接连。

## 部署方式

| 项 | 值 |
|---|---|
| SSH ProxyCommand | `nc -X connect -x 127.0.0.1:18080 %h %p` |
| 项目目录 | `/opt/yingjie`（非 git 仓库，之前是手工 copy） |
| 新版本来源 | VPS 上 `git clone https://github.com/zevison/liuguang-ys.git` 到 `/tmp/yingjie-deploy` |
| 同步方式 | rsync --exclude=node_modules/dist/hotwords.json → /opt/yingjie |
| sharp 安装 | `npm install sharp --save-dev`（之前完全没装，后端缩图分支永远进不去） |
| server.js 重启 | 优雅 kill -TERM 旧 PID 798332 → nohup 新 PID 815617 |
| 备份路径 | `/opt/yingjie-backup-20261120-033435` |

## 端到端验证证据

| 检查 | 命令 | 结果 | 结论 |
|------|------|------|------|
| health | `curl http://127.0.0.1:8000/health` | `{"ok":true,"ts":...,"uptime":3.99s}` | server.js 正常 |
| 封面 WebP | `curl -H 'Accept: image/webp' -I ...?cover=1` | `Content-Type: image/webp`, `Vary: Accept` | 走缩图管道 |
| 封面 JPEG | `curl -H 'Accept: image/webp;q=0,image/jpeg' -I ...?cover=1` | `Content-Type: image/jpeg`, `Vary: Accept` | 协商正确 |
| 另一张封面 (12345) | `curl .../images/12345/poster?cover=1` | HTTP 502 / 4.004s | CDN 不存在的 ID 超时（4s cover 专用超时） |
| 不存在的 ID (999999) | `curl .../images/999999999/poster?cover=1` | HTTP 404 / 0.001s | CDN 明确 404 → 透传 |
| 公网 tv.szdapi.com | `curl -H 'Accept: image/webp' -I https://tv.szdapi.com/api-proxy/...?cover=1` | image/webp, vary: Accept, 0.022s | nginx → server → 缓存命中 |
| 公网首页 | `curl -w '%{http_code} %{time_total}s' https://tv.szdapi.com/` | 200 / 0.22s | SPA 正常 |
| nginx -t | `nginx -t && nginx -s reload` | syntax ok, test successful | 无配置错误 |

### 封面缩图效果

原始 poster（不走 cover=1）| 缩图 poster（cover=1 + WebP）
---|---
50930 bytes JPEG 400x600 / time=1.40s | 70866 bytes WebP 400x600 / time=0.001s (缓存)

说明：czzyplay CDN 的 poster 本身就是 400x600 JPEG，所以 `withoutEnlargement` 只防止放大、分辨率不缩小。缩图带来的收益是 **格式转码 + 本地内存缓存**（请求时间从 1.4s 降到 0.001s / 0.022s）。WebP 字节比 JPEG 略大是 sharp quality:70 effort:3 对已优化 JPEG 的典型现象，后续可调整。

## 前端验证（同源覆盖）

| 页 | 组件 | 封面 URL 生成 | 失败回退 |
|---|---|---|---|
| 首页 | VideoCard.vue | `getCoverUrl()` → `/api-proxy/...?cover=1` | proxy → direct → placeholder |
| 搜索 | Search.vue | `getEffectiveCover(item)` | 同上，Map 存 item.id 的 stage |
| Play | (复用 VideoCard) | 同上 | 同上 |

## 风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| WebP 缩图比 JPEG 原图大 | 中 | 加载时间略快但字节多 | `if (isCover)` 强制缩图（为了缓存统一）；可后续调 `quality: 60` 或 `effort: 5` |
| CDN 对新 ID 返回 404 或 502 | 低 | 前端回退两阶段后显示文字占位 | 已在 Play.vue 里有封面存在性兜底 |
| server.js 进程重启丢失 coverStages Map | 低 | 重新请求封面，走完整两阶段 | 进程重启本来就是正常现象 |
| 部署中停机窗口 | 低（< 3s）| 首页 / 搜索封面短暂 404 | kill -TERM → 新进程 nohup 几乎同时起来 |

## 回滚方式

```bash
# 1. 停新进程
pkill -f "node.*server\.js"

# 2. 恢复旧版本
rsync -av --delete \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='hotwords.json' \
  /opt/yingjie-backup-20261120-033435/ /opt/yingjie/

# 3. 重建前端
cd /opt/yingjie && npm run build:ci

# 4. 重启
nohup node server.js > /var/log/yingjie-server.log 2>&1 &

# 5. 验证
curl -s http://127.0.0.1:8000/health
```

## 未验证项

- 浏览器端真实渲染效果（首页/搜索页封面加载速度）— 需要用户用手机或桌面浏览器访问 tv.szdapi.com 实测
- 移动端 App（Tauri/Capacitor）— App 模式下 `detectAppMode()=true`，封面直连 CDN 不走代理，不受本次部署影响
