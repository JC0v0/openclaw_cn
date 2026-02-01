---
summary: "新手指南：从零到首次对话（向导、认证、频道、配对）"
read_when:
  - 首次从零开始设置
  - 你想要最快的安装 → 入门 → 首次对话路径
title: "快速入门"
---

# 快速入门

目标：从 **零** → **首次有效对话**（使用合理的默认设置）尽快完成。

最快对话方式：打开控制 UI（无需频道设置）。运行 `openclaw dashboard`
在浏览器中聊天，或在网关主机上打开 `http://127.0.0.1:18789/`。
文档：[仪表板](/web/dashboard) 和 [控制 UI](/web/control-ui)。

推荐路径：使用 **CLI 入门向导** (`openclaw onboard`)。它会设置：

- 模型/认证（推荐 OAuth）
- 网关设置
- 频道（WhatsApp/Telegram/Discord/Mattermost (插件)/...）
- 配对默认设置（安全的私信）
- 工作区初始化 + 技能
- 可选的后台服务

如果需要更深入的参考页面，跳转到：[向导](/start/wizard)、[设置](/start/setup)、[配对](/start/pairing)、[安全](/gateway/security)。

沙箱说明：`agents.defaults.sandbox.mode: "non-main"` 使用 `session.mainKey`（默认 `"main"`），
因此群组/频道会话是沙箱化的。如果你希望主代理始终在主机上运行，
请设置显式的每代理覆盖：

```json
{
  "routing": {
    "agents": {
      "main": {
        "workspace": "~/.openclaw/workspace",
        "sandbox": { "mode": "off" }
      }
    }
  }
}
```

## 0) 前置要求

- Node `>=22`
- `pnpm`（可选；如果从源代码构建则推荐）
- **推荐：** Brave Search API 密钥用于网络搜索。最简单的方法：
  `openclaw configure --section web`（存储 `tools.web.search.apiKey`）。
  参见 [网络工具](/tools/web)。

macOS：如果计划构建应用，请安装 Xcode / CLT。仅用于 CLI + 网关，Node 就足够了。
Windows：使用 **WSL2**（推荐 Ubuntu）。强烈推荐 WSL2；原生 Windows 未测试，问题更多，工具兼容性较差。先安装 WSL2，然后在 WSL 内运行 Linux 步骤。参见 [Windows (WSL2)](/platforms/windows)。

## 1) 安装 CLI（推荐）

```bash
curl -fsSL https://openclaw.bot/install.sh | bash
```

安装程序选项（安装方法、非交互式、从 GitHub）：[安装](/install)。

Windows (PowerShell)：

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

替代方案（全局安装）：

```bash
npm install -g openclaw@latest
```

```bash
pnpm add -g openclaw@latest
```

## 2) 运行入门向导（并安装服务）

```bash
openclaw onboard --install-daemon
```

你需要选择：

- **本地 vs 远程** 网关
- **认证**：OpenAI Code (Codex) 订阅（OAuth）或 API 密钥。对于 Anthropic，我们推荐 API 密钥；也支持 `claude setup-token`。
- **提供商**：WhatsApp QR 登录、Telegram/Discord 机器人令牌、Mattermost 插件令牌等。
- **守护进程**：后台安装（launchd/systemd；WSL2 使用 systemd）
  - **运行时**：Node（推荐；WhatsApp/Telegram 必需）。**不推荐** Bun。
- **网关令牌**：向导默认生成一个（即使在回环上）并存储在 `gateway.auth.token` 中。

向导文档：[向导](/start/wizard)

### 认证：存储位置（重要）

- **推荐的 Anthropic 路径：**设置 API 密钥（向导可以将其存储供服务使用）。如果想重用 Claude Code 凭据，也支持 `claude setup-token`。

- OAuth 凭据（旧版导入）：`~/.openclaw/credentials/oauth.json`
- 认证配置文件（OAuth + API 密钥）：`~/.openclaw/agents/<agentId>/agent/auth-profiles.json`

无头/服务器提示：先在普通机器上进行 OAuth，然后将 `oauth.json` 复制到网关主机。

## 3) 启动网关

如果在入门期间安装了服务，网关应该已经在运行：

```bash
openclaw gateway status
```

手动运行（前台）：

```bash
openclaw gateway --port 18789 --verbose
```

仪表板（本地回环）：`http://127.0.0.1:18789/`
如果配置了令牌，请将其粘贴到控制 UI 设置中（存储为 `connect.params.auth.token`）。

⚠️ **Bun 警告（WhatsApp + Telegram）：** Bun 在这些频道上有已知问题。
如果你使用 WhatsApp 或 Telegram，请使用 **Node** 运行网关。

## 3.5) 快速验证（2 分钟）

```bash
openclaw status
openclaw health
openclaw security audit --deep
```

## 4) 配对 + 连接你的第一个聊天平台

### WhatsApp（QR 登录）

```bash
openclaw channels login
```

通过 WhatsApp → 设置 → 链接设备扫描。

WhatsApp 文档：[WhatsApp](/channels/whatsapp)

### Telegram / Discord / 其他

向导可以为你写入令牌/配置。如果更喜欢手动配置，从以下开始：

- Telegram：[Telegram](/channels/telegram)
- Discord：[Discord](/channels/discord)
- Mattermost（插件）：[Mattermost](/channels/mattermost)

**Telegram 私信提示：**你的第一条私信会返回一个配对代码。批准它（见下一步），否则机器人不会响应。

## 5) 私信安全（配对批准）

默认姿态：未知私信会获得一个短代码，在批准之前不会处理消息。
如果你的第一条私信没有回复，请批准配对：

```bash
openclaw pairing list whatsapp
openclaw pairing approve whatsapp <code>
```

配对文档：[配对](/start/pairing)

## 从源代码构建（开发）

如果你正在开发 OpenClaw 本身，从源代码运行：

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm ui:build # 首次运行时自动安装 UI 依赖
pnpm build
openclaw onboard --install-daemon
```

如果还没有全局安装，请从仓库通过 `pnpm openclaw ...` 运行入门步骤。
`pnpm build` 也会打包 A2UI 资源；如果只需要运行该步骤，请使用 `pnpm canvas:a2ui:bundle`。

网关（从此仓库）：

```bash
node openclaw.mjs gateway --port 18789 --verbose
```

## 7) 端到端验证

在新终端中，发送测试消息：

```bash
openclaw message send --target +15555550123 --message "你好，来自 OpenClaw"
```

如果 `openclaw health` 显示"未配置认证"，请返回向导并设置 OAuth/密钥认证——代理无法在没有认证的情况下响应。

提示：`openclaw status --all` 是最好的可粘贴、只读调试报告。
健康探测：`openclaw health`（或 `openclaw status --deep`）向运行中的网关询问健康快照。

## 下一步（可选，但很棒）

- macOS 菜单栏应用 + 语音唤醒：[macOS 应用](/platforms/macos)
- iOS/Android 节点（Canvas/摄像头/语音）：[节点](/nodes)
- 远程访问（SSH 隧道 / Tailscale Serve）：[远程访问](/gateway/remote) 和 [Tailscale](/gateway/tailscale)
- 始终在线 / VPN 设置：[远程访问](/gateway/remote)、[exe.dev](/platforms/exe-dev)、[Hetzner](/platforms/hetzner)、[macOS 远程](/platforms/mac/remote)
