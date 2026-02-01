<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text-dark.png">
        <img src="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text.png" alt="OpenClaw" width="500">
    </picture>
</p>

<p align="center">
  <strong>脱壳！脱壳！(EXFOLIATE! EXFOLIATE!)</strong>
</p>

<p align="center">
  <a href="https://github.com/openclaw/openclaw/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/openclaw/openclaw/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/openclaw/openclaw/releases"><img src="https://img.shields.io/github/v/release/openclaw/openclaw?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="https://pd.qq.com/s/46ogez1gd"><img src="https://img.shields.io/badge/%E8%85%BE%E8%AE%AF%E9%A2%91%E9%81%93-OpenClaw%E4%B8%AD%E6%96%87%E7%A4%BE-blue?style=for-the-badge" alt="腾讯频道"></a>
  <a href="https://discord.gg/clawd"><img src="https://img.shields.io/discord/1456350064065904867?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

### 模型选择与认证

- 模型配置 + CLI: [模型](https://docs.openclaw.ai/concepts/models)
- 认证配置轮换（OAuth vs API 密钥）+ 故障转移: [模型故障转移](https://docs.openclaw.ai/concepts/model-failover)

### 开发渠道

- **stable**: 标记的发布版本 (`vYYYY.M.D` 或 `vYYYY.M.D-<patch>`)，npm dist-tag `latest`
- **beta**: 预发布标签 (`vYYYY.M.D-beta.N`)，npm dist-tag `beta`（macOS 应用可能缺失）
- **dev**: `main` 分支的最新代码，npm dist-tag `dev`（发布时）

切换渠道（git + npm）: `openclaw update --channel stable|beta|dev`
详情: [开发渠道](https://docs.openclaw.ai/install/development-channels)

### 安全默认值（DM 访问）

OpenClaw 连接到真实消息传递表面。将入站 DM 视为**不受信任的输入**。

完整安全指南: [安全](https://docs.openclaw.ai/gateway/security)

在 Telegram/WhatsApp/Signal/iMessage/Microsoft Teams/Discord/Google Chat/Slack 上的默认行为:

- **DM 配对** (`dmPolicy="pairing"` / `channels.discord.dm.policy="pairing"` / `channels.slack.dm.policy="pairing"`): 未知发送者会收到一个简短的配对码，机器人不会处理他们的消息
- 使用以下命令批准: `openclaw pairing approve <channel> <code>`（然后发送者被添加到本地允许列表存储）
- 公开入站 DM 需要明确选择加入: 设置 `dmPolicy="open"` 并在频道允许列表中包含 `"*"`（`allowFrom` / `channels.discord.dm.allowFrom` / `channels.slack.dm.allowFrom`）

运行 `openclaw doctor` 来暴露有风险/配置错误的 DM 策略。

### 重点功能

- **[本地优先网关](https://docs.openclaw.ai/gateway)** — 会话、频道、工具和事件的单一控制平面
- **[多频道收件箱](https://docs.openclaw.ai/channels)** — WhatsApp、Telegram、Slack、Discord、Google Chat、Signal、iMessage、BlueBubbles、Microsoft Teams、Matrix、Zalo、Zalo Personal、WebChat、macOS、iOS/Android
- **[多代理路由](https://docs.openclaw.ai/gateway/configuration)** — 将入站频道/账户/对等方路由到隔离的代理（工作区 + 每代理会话）
- **[语音唤醒](https://docs.openclaw.ai/nodes/voicewake) + [对话模式](https://docs.openclaw.ai/nodes/talk)** — macOS/iOS/Android 的始终在线语音，支持 ElevenLabs
- **[实时画布](https://docs.openclaw.ai/platforms/mac/canvas)** — 代理驱动的可视化工作空间，支持 [A2UI](https://docs.openclaw.ai/platforms/mac/canvas#canvas-a2ui)
- **[一流工具](https://docs.openclaw.ai/tools)** — 浏览器、画布、节点、cron、会话和 Discord/Slack 操作
- **[配套应用](https://docs.openclaw.ai/platforms/macos)** — macOS 菜单栏应用 + iOS/Android [节点](https://docs.openclaw.ai/nodes)
- **[入职向导](https://docs.openclaw.ai/start/wizard) + [技能](https://docs.openclaw.ai/tools/skills)** — 向导驱动设置，内置/管理工作区技能

### Star History

[![Star History Chart](https://api.star-history.com/svg?repos=openclaw/openclaw&type=date&legend=top-left)](https://www.star-history.com/#openclaw/openclaw&type=date&legend=top-left)

### 我们构建的所有功能

#### 核心平台

- [网关 WS 控制平面](https://docs.openclaw.ai/gateway)，包含会话、在线状态、配置、cron、webhooks、[控制界面](https://docs.openclaw.ai/web)和[画布主机](https://docs.openclaw.ai/platforms/mac/canvas#canvas-a2ui)
- [CLI 界面](https://docs.openclaw.ai/tools/agent-send): gateway、agent、send、[向导](https://docs.openclaw.ai/start/wizard)和[医生](https://docs.openclaw.ai/gateway/doctor)
- [Pi 代理运行时](https://docs.openclaw.ai/concepts/agent)，RPC 模式，支持工具流和块流
- [会话模型](https://docs.openclaw.ai/concepts/session): `main` 用于直接聊天，群组隔离，激活模式，队列模式，回复模式。群组规则: [群组](https://docs.openclaw.ai/concepts/groups)
- [媒体管道](https://docs.openclaw.ai/nodes/images): 图片/音频/视频，转录钩子，大小限制，临时文件生命周期。音频详情: [音频](https://docs.openclaw.ai/nodes/audio)

#### 频道

- [频道](https://docs.openclaw.ai/channels): [WhatsApp](https://docs.openclaw.ai/channels/whatsapp) (Baileys)、[Telegram](https://docs.openclaw.ai/channels/telegram) (grammY)、[Slack](https://docs.openclaw.ai/channels/slack) (Bolt)、[Discord](https://docs.openclaw.ai/channels/discord) (discord.js)、[Google Chat](https://docs.openclaw.ai/channels/googlechat) (Chat API)、[Signal](https://docs.openclaw.ai/channels/signal) (signal-cli)、[iMessage](https://docs.openclaw.ai/channels/imessage) (imsg)、[BlueBubbles](https://docs.openclaw.ai/channels/bluebubbles) (扩展)、[Microsoft Teams](https://docs.openclaw.ai/channels/msteams) (扩展)、[Matrix](https://docs.openclaw.ai/channels/matrix) (扩展)、[Zalo](https://docs.openclaw.ai/channels/zalo) (扩展)、[Zalo Personal](https://docs.openclaw.ai/channels/zalouser) (扩展)、[WebChat](https://docs.openclaw.ai/web/webchat)
- [群组路由](https://docs.openclaw.ai/concepts/group-messages): 提及限制、回复标签、每频道分块和路由。频道规则: [频道](https://docs.openclaw.ai/channels)

#### 应用 + 节点

- [macOS 应用](https://docs.openclaw.ai/platforms/macos): 菜单栏控制平面、[语音唤醒](https://docs.openclaw.ai/nodes/voicewake)/PTT、[对话模式](https://docs.openclaw.ai/nodes/talk)覆盖层、[WebChat](https://docs.openclaw.ai/web/webchat)、调试工具、[远程网关](https://docs.openclaw.ai/gateway/remote)控制
- [iOS 节点](https://docs.openclaw.ai/platforms/ios): [画布](https://docs.openclaw.ai/platforms/mac/canvas)、[语音唤醒](https://docs.openclaw.ai/nodes/voicewake)、[对话模式](https://docs.openclaw.ai/nodes/talk)、相机、屏幕录制、Bonjour 配对
- [Android 节点](https://docs.openclaw.ai/platforms/android): [画布](https://docs.openclaw.ai/platforms/mac/canvas)、[对话模式](https://docs.openclaw.ai/nodes/talk)、相机、屏幕录制、可选 SMS
- [macOS 节点模式](https://docs.openclaw.ai/nodes): system.run/notify + 画布/相机暴露

#### 工具 + 自动化

- [浏览器控制](https://docs.openclaw.ai/tools/browser): 专用的 openclaw Chrome/Chromium、快照、操作、上传、配置文件
- [画布](https://docs.openclaw.ai/platforms/mac/canvas): [A2UI](https://docs.openclaw.ai/platforms/mac/canvas#canvas-a2ui) 推送/重置、eval、快照
- [节点](https://docs.openclaw.ai/nodes): 相机快照/剪辑、屏幕录制、[location.get](https://docs.openclaw.ai/nodes/location-command)、通知
- [Cron + 唤醒](https://docs.openclaw.ai/automation/cron-jobs); [webhooks](https://docs.openclaw.ai/automation/webhook); [Gmail Pub/Sub](https://docs.openclaw.ai/automation/gmail-pubsub)
- [技能平台](https://docs.openclaw.ai/tools/skills): 内置、管理和工作区技能，支持安装限制 + UI

#### 运行时 + 安全

- [频道路由](https://docs.openclaw.ai/concepts/channel-routing)、[重试策略](https://docs.openclaw.ai/concepts/retry)和[流式传输/分块](https://docs.openclaw.ai/concepts/streaming)
- [在线状态](https://docs.openclaw.ai/concepts/presence)、[正在输入指示器](https://docs.openclaw.ai/concepts/typing-indicators)和[使用跟踪](https://docs.openclaw.ai/concepts/usage-tracking)
- [模型](https://docs.openclaw.ai/concepts/models)、[模型故障转移](https://docs.openclaw.ai/concepts/model-failover)和[会话修剪](https://docs.openclaw.ai/concepts/session-pruning)
- [安全](https://docs.openclaw.ai/gateway/security)和[故障排除](https://docs.openclaw.ai/channels/troubleshooting)

#### 运维 + 打包

- [控制界面](https://docs.openclaw.ai/web) + [WebChat](https://docs.openclaw.ai/web/webchat)直接从网关提供
- [Tailscale Serve/Funnel](https://docs.openclaw.ai/gateway/tailscale)或[SSH 隧道](https://docs.openclaw.ai/gateway/remote)，支持令牌/密码认证
- [Nix 模式](https://docs.openclaw.ai/install/nix)用于声明式配置；基于[Docker](https://docs.openclaw.ai/install/docker)的安装
- [Doctor](https://docs.openclaw.ai/gateway/doctor)迁移、[日志记录](https://docs.openclaw.ai/logging)

### 工作原理（简述）

```
WhatsApp / Telegram / Slack / Discord / Google Chat / Signal / iMessage / BlueBubbles / Microsoft Teams / Matrix / Zalo / Zalo Personal / WebChat
               │
               ▼
┌───────────────────────────────┐
│            Gateway            │
│       (control plane)         │
│     ws://127.0.0.1:18789      │
└──────────────┬────────────────┘
               │
               ├─ Pi agent (RPC)
               ├─ CLI (openclaw …)
               ├─ WebChat UI
               ├─ macOS app
               └─ iOS / Android nodes
```

### 关键子系统

- **[网关 WebSocket 网络](https://docs.openclaw.ai/concepts/architecture)** — 客户端、工具和事件的单一 WS 控制平面（以及运维: [网关运行手册](https://docs.openclaw.ai/gateway)）
- **[Tailscale 暴露](https://docs.openclaw.ai/gateway/tailscale)** — 用于网关仪表板 + WS 的 Serve/Funnel（远程访问: [远程](https://docs.openclaw.ai/gateway/remote)）
- **[浏览器控制](https://docs.openclaw.ai/tools/browser)** — 通过 CDP 控制的 openclaw 管理的 Chrome/Chromium
- **[画布 + A2UI](https://docs.openclaw.ai/platforms/mac/canvas)** — 代理驱动的可视化工作空间（A2UI 主机: [画布/A2UI](https://docs.openclaw.ai/platforms/mac/canvas#canvas-a2ui)）
- **[语音唤醒](https://docs.openclaw.ai/nodes/voicewake) + [对话模式](https://docs.openclaw.ai/nodes/talk)** — 始终在线的语音和连续对话
- **[节点](https://docs.openclaw.ai/nodes)** — 画布、相机快照/剪辑、屏幕录制、`location.get`、通知，以及 macOS 独有的 `system.run`/`system.notify`

### Tailscale 访问（网关仪表板）

OpenClaw 可以在网关保持绑定到 loopback 时自动配置 Tailscale **Serve**（仅 tailnet）或 **Funnel**（公开）。配置 `gateway.tailscale.mode`:

- `off`: 无 Tailscale 自动化（默认）
- `serve`: 通过 `tailscale serve` 提供 tailnet-only HTTPS（默认使用 Tailscale 身份标头）
- `funnel`: 通过 `tailscale funnel` 提供公开 HTTPS（需要共享密码认证）

注意事项:

- 启用 Serve/Funnel 时 `gateway.bind` 必须保持 `loopback`（OpenClaw 强制执行此操作）
- 可以通过设置 `gateway.auth.mode: "password"` 或 `gateway.auth.allowTailscale: false` 来强制 Serve 需要密码
- Funnel 除非设置了 `gateway.auth.mode: "password"`，否则拒绝启动
- 可选: `gateway.tailscale.resetOnExit` 在关闭时撤消 Serve/Funnel

详情: [Tailscale 指南](https://docs.openclaw.ai/gateway/tailscale) · [Web 界面](https://docs.openclaw.ai/web)

### 远程网关（Linux 非常适合）

在小型 Linux 实例上运行网关是完全没问题的。客户端（macOS 应用、CLI、WebChat）可以通过 **Tailscale Serve/Funnel** 或 **SSH 隧道**连接，您仍然可以配对设备节点（macOS/iOS/Android）在需要时执行设备本地操作。

- **网关主机**默认运行 exec 工具和频道连接
- **设备节点**通过 `node.invoke`运行设备本地操作（`system.run`、相机、屏幕录制、通知）
  简而言之: exec 运行在网关所在的地方；设备操作运行在设备所在的地方

详情: [远程访问](https://docs.openclaw.ai/gateway/remote) · [节点](https://docs.openclaw.ai/nodes) · [安全](https://docs.openclaw.ai/gateway/security)

### 通过网关协议的 macOS 权限

macOS 应用可以在**节点模式**下运行，并通过网关 WebSocket（`node.list` / `node.describe`）通告其能力 + 权限映射。然后客户端可以通过 `node.invoke` 执行本地操作:

- `system.run` 运行本地命令并返回 stdout/stderr/退出代码；设置 `needsScreenRecording: true` 以需要屏幕录制权限（否则你会得到 `PERMISSION_MISSING`）
- `system.notify` 发布用户通知，如果通知被拒绝则失败
- `canvas.*`、`camera.*`、`screen.record` 和 `location.get` 也通过 `node.invoke` 路由并遵循 TCC 权限状态

提升的 bash（主机权限）与 macOS TCC 分离:

- 使用 `/elevated on|off` 在启用 + 允许列表时切换每会话提升访问
- 网关通过 `sessions.patch`（WS 方法）持久化每会话切换，与 `thinkingLevel`、`verboseLevel`、`model`、`sendPolicy` 和 `groupActivation` 一起

详情: [节点](https://docs.openclaw.ai/nodes) · [macOS 应用](https://docs.openclaw.ai/platforms/macos) · [网关协议](https://docs.openclaw.ai/concepts/architecture)

### 代理到代理（sessions\_\* 工具）

- 使用这些工具跨会话协调工作，而无需在聊天界面之间跳转
- `sessions_list` — 发现活动会话（代理）及其元数据
- `sessions_history` — 获取会话的转录日志
- `sessions_send` — 向另一个会话发送消息；可选的回复回 ping-pong + 宣布步骤（`REPLY_SKIP`、`ANNOUNCE_SKIP`）

详情: [会话工具](https://docs.openclaw.ai/concepts/session-tool)

### 技能注册表（ClawHub）

ClawHub 是一个极简的技能注册表。启用 ClawHub 后，代理可以自动搜索技能并根据需要拉取新技能。

[ClawHub](https://clawhub.com)

### 聊天命令

在 WhatsApp/Telegram/Slack/Google Chat/Microsoft Teams/WebChat 中发送这些命令（群组命令仅所有者可用）:

- `/status` — 紧凑的会话状态（模型 + 令牌，可用时显示成本）
- `/new` 或 `/reset` — 重置会话
- `/compact` — 压缩会话上下文（摘要）
- `/think <level>` — off|minimal|low|medium|high|xhigh（仅 GPT-5.2 + Codex 模型）
- `/verbose on|off`
- `/usage off|tokens|full` — 每响应使用情况页脚
- `/restart` — 重启网关（群组中仅所有者）
- `/activation mention|always` — 群组激活切换（仅群组）

### 应用（可选）

仅网关就能提供出色的体验。所有应用都是可选的，并添加额外功能。

如果您计划构建/运行配套应用，请遵循以下平台运行手册。

#### macOS（OpenClaw.app）（可选）

- 网关和健康的菜单栏控制
- 语音唤醒 + 按下说话覆盖层
- WebChat + 调试工具
- 通过 SSH 的远程网关控制

注意: 需要签名构建才能使 macOS 权限在重建后保持不变（参见 `docs/mac/permissions.md`）

#### iOS 节点（可选）

- 通过 Bridge 配对为节点
- 语音触发转发 + 画布表面
- 通过 `openclaw nodes …` 控制

运行手册: [iOS 连接](https://docs.openclaw.ai/platforms/ios)

#### Android 节点（可选）

- 通过与 iOS 相同的 Bridge + 配对流进行配对
- 暴露画布、相机和屏幕捕获命令
- 运行手册: [Android 连接](https://docs.openclaw.ai/platforms/android)

### 代理工作区 + 技能

- 工作区根目录: `~/.openclaw/workspace`（通过 `agents.defaults.workspace` 配置）
- 注入的提示文件: `AGENTS.md`、`SOUL.md`、`TOOLS.md`
- 技能: `~/.openclaw/workspace/skills/<skill>/SKILL.md`

### 配置

最小的 `~/.openclaw/openclaw.json`（模型 + 默认值）:

```json5
{
  agent: {
    model: "anthropic/claude-opus-4-5",
  },
}
```

[完整配置参考（所有键 + 示例）。](https://docs.openclaw.ai/gateway/configuration)

### 安全模型（重要）

- **默认:** 工具在主机上为 **main** 会话运行，因此代理在只有您时拥有完全访问权限
- **群组/频道安全:** 设置 `agents.defaults.sandbox.mode: "non-main"` 在每会话 Docker 沙箱中运行 **非主会话**（群组/频道）；bash 然后在这些会话的 Docker 中运行
- **沙箱默认值:** 允许列表 `bash`、`process`、`read`、`write`、`edit`、`sessions_list`、`sessions_history`、`sessions_send`、`sessions_spawn`；拒绝列表 `browser`、`canvas`、`nodes`、`cron`、`discord`、`gateway`

详情: [安全指南](https://docs.openclaw.ai/gateway/security) · [Docker + 沙箱](https://docs.openclaw.ai/install/docker) · [沙箱配置](https://docs.openclaw.ai/gateway/configuration)

### 频道配置

#### [WhatsApp](https://docs.openclaw.ai/channels/whatsapp)

- 链接设备: `pnpm openclaw channels login`（将凭据存储在 `~/.openclaw/credentials` 中）
- 通过 `channels.whatsapp.allowFrom` 允许谁可以与助手交谈
- 如果设置了 `channels.whatsapp.groups`，它将成为群组允许列表；包含 `"*"` 以允许所有

#### [Telegram](https://docs.openclaw.ai/channels/telegram)

- 设置 `TELEGRAM_BOT_TOKEN` 或 `channels.telegram.botToken`（环境变量优先）
- 可选: 设置 `channels.telegram.groups`（使用 `channels.telegram.groups."*".requireMention`）；设置后，它是群组允许列表（包含 `"*"` 以允许所有）。还需要时设置 `channels.telegram.allowFrom` 或 `channels.telegram.webhookUrl`

```json5
{
  channels: {
    telegram: {
      botToken: "123456:ABCDEF",
    },
  },
}
```

#### [Slack](https://docs.openclaw.ai/channels/slack)

- 设置 `SLACK_BOT_TOKEN` + `SLACK_APP_TOKEN`（或 `channels.slack.botToken` + `channels.slack.appToken`）

#### [Discord](https://docs.openclaw.ai/channels/discord)

- 设置 `DISCORD_BOT_TOKEN` 或 `channels.discord.token`（环境变量优先）
- 可选: 设置 `commands.native`、`commands.text` 或 `commands.useAccessGroups`，以及根据需要设置 `channels.discord.dm.allowFrom`、`channels.discord.guilds` 或 `channels.discord.mediaMaxMb`

```json5
{
  channels: {
    discord: {
      token: "1234abcd",
    },
  },
}
```

#### [Signal](https://docs.openclaw.ai/channels/signal)

- 需要 `signal-cli` 和 `channels.signal` 配置部分

#### [iMessage](https://docs.openclaw.ai/channels/imessage)

- 仅 macOS；Messages 必须已登录
- 如果设置了 `channels.imessage.groups`，它将成为群组允许列表；包含 `"*"` 以允许所有

#### [Microsoft Teams](https://docs.openclaw.ai/channels/msteams)

- 配置 Teams 应用 + Bot Framework，然后添加 `msteams` 配置部分
- 通过 `msteams.allowFrom` 允许谁可以交谈；通过 `msteams.groupAllowFrom` 或 `msteams.groupPolicy: "open"` 进行群组访问

#### [WebChat](https://docs.openclaw.ai/web/webchat)

- 使用网关 WebSocket；没有单独的 WebChat 端口/配置

浏览器控制（可选）:

```json5
{
  browser: {
    enabled: true,
    color: "#FF4500",
  },
}
```

### 文档

当您完成入职流程并想要更深入的参考时，请使用这些文档。

- [从文档索引开始，了解导航和"内容在哪里"。](https://docs.openclaw.ai)
- [阅读架构概述，了解网关 + 协议模型。](https://docs.openclaw.ai/concepts/architecture)
- [当您需要每个键和示例时，使用完整的配置参考。](https://docs.openclaw.ai/gateway/configuration)
- [按照操作运行手册规范运行网关。](https://docs.openclaw.ai/gateway)
- [了解控制界面/Web 界面如何工作以及如何安全地暴露它们。](https://docs.openclaw.ai/web)
- [了解通过 SSH 隧道或 tailnet 进行远程访问。](https://docs.openclaw.ai/gateway/remote)
- [遵循入职向导流程进行引导式设置。](https://docs.openclaw.ai/start/wizard)
- [通过 webhook 表面连接外部触发器。](https://docs.openclaw.ai/automation/webhook)
- [设置 Gmail Pub/Sub 触发器。](https://docs.openclaw.ai/automation/gmail-pubsub)
- [了解 macOS 菜单栏配套详情。](https://docs.openclaw.ai/platforms/mac/menu-bar)
- [平台指南: Windows (WSL2)](https://docs.openclaw.ai/platforms/windows)、[Linux](https://docs.openclaw.ai/platforms/linux)、[macOS](https://docs.openclaw.ai/platforms/macos)、[iOS](https://docs.openclaw.ai/platforms/ios)、[Android](https://docs.openclaw.ai/platforms/android)
- [使用故障排除指南调试常见故障。](https://docs.openclaw.ai/channels/troubleshooting)
- [在暴露任何内容之前查看安全指南。](https://docs.openclaw.ai/gateway/security)

### 高级文档（发现 + 控制）

- [发现 + 传输](https://docs.openclaw.ai/gateway/discovery)
- [Bonjour/mDNS](https://docs.openclaw.ai/gateway/bonjour)
- [网关切点](https://docs.openclaw.ai/gateway/pairing)
- [远程网关 README](https://docs.openclaw.ai/gateway/remote-gateway-readme)
- [控制界面](https://docs.openclaw.ai/web/control-ui)
- [仪表板](https://docs.openclaw.ai/web/dashboard)

### 运维和故障排除

- [健康检查](https://docs.openclaw.ai/gateway/health)
- [网关锁](https://docs.openclaw.ai/gateway/gateway-lock)
- [后台进程](https://docs.openclaw.ai/gateway/background-process)
- [浏览器故障排除（Linux）](https://docs.openclaw.ai/tools/browser-linux-troubleshooting)
- [日志记录](https://docs.openclaw.ai/logging)

### 深入探讨

- [代理循环](https://docs.openclaw.ai/concepts/agent-loop)
- [在线状态](https://docs.openclaw.ai/concepts/presence)
- [TypeBox 模式](https://docs.openclaw.ai/concepts/typebox)
- [RPC 适配器](https://docs.openclaw.ai/reference/rpc)
- [队列](https://docs.openclaw.ai/concepts/queue)

### 工作区 & 技能

- [技能配置](https://docs.openclaw.ai/tools/skills-config)
- [默认 AGENTS](https://docs.openclaw.ai/reference/AGENTS.default)
- [模板: AGENTS](https://docs.openclaw.ai/reference/templates/AGENTS)
- [模板: BOOTSTRAP](https://docs.openclaw.ai/reference/templates/BOOTSTRAP)
- [模板: IDENTITY](https://docs.openclaw.ai/reference/templates/IDENTITY)
- [模板: SOUL](https://docs.openclaw.ai/reference/templates/SOUL)
- [模板: TOOLS](https://docs.openclaw.ai/reference/templates/TOOLS)
- [模板: USER](https://docs.openclaw.ai/reference/templates/USER)

### 平台内部

- [macOS 开发设置](https://docs.openclaw.ai/platforms/mac/dev-setup)
- [macOS 菜单栏](https://docs.openclaw.ai/platforms/mac/menu-bar)
- [macOS 语音唤醒](https://docs.openclaw.ai/platforms/mac/voicewake)
- [iOS 节点](https://docs.openclaw.ai/platforms/ios)
- [Android 节点](https://docs.openclaw.ai/platforms/android)
- [Windows (WSL2)](https://docs.openclaw.ai/platforms/windows)
- [Linux 应用](https://docs.openclaw.ai/platforms/linux)

### 电子邮件钩子（Gmail）

- [docs.openclaw.ai/gmail-pubsub](https://docs.openclaw.ai/automation/gmail-pubsub)

### 关于 Molty

OpenClaw 是为 **Molty** 构建的，一只太空龙虾 AI 助手。🦞
由 Peter Steinberger 和社区构建。

- [openclaw.ai](https://openclaw.ai)
- [soul.md](https://soul.md)
- [steipete.me](https://steipete.me)
- [@openclaw](https://x.com/openclaw)

---

## 中文版说明

这是 OpenClaw 的**中文本地化版本**，由 [JC0v0](https://github.com/JC0v0) 维护。

### 安装中文版

使用中文版安装脚本:

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/JC0v0/openclaw_zh/main/scripts/install-zh.sh | bash
```

### 仓库地址

- **中文版**: https://github.com/JC0v0/openclaw_cn
- **原版**: https://github.com/openclaw/openclaw

### 中文社区

加入腾讯频道【OpenClaw中文版】与其他用户交流：https://pd.qq.com/s/46ogez1gd

### 贡献者

感谢所有 clawtributors 的贡献！

特别感谢 [Mario Zechner](https://mariozechner.at/) 对他的支持以及 [pi-mono](https://github.com/badlogic/pi-mono)。
特别感谢 Adam Doppelt 制作了 lobster.bot。

---

<a href="LICENSE">MIT License</a> · Copyright © Peter Steinberger
