---
summary: "OpenClaw 常见问题解答"
title: "常见问题"
---

# 常见问题 (FAQ)

## 一般问题

### OpenClaw 是什么？

OpenClaw 是一个个人 AI 助手，运行在你自己的设备上。它可以通过你已有的聊天平台（WhatsApp、Telegram、Slack 等）与你对话，并可以执行各种任务。

### OpenClaw 是免费的吗？

OpenClaw 本身是开源软件（MIT 许可证），免费使用。但你可能需要为 AI 模型付费（如 Anthropic Claude 或 OpenAI ChatGPT）。

### OpenClaw 与 ChatGPT/Claude.ai 有什么区别？

- **本地控制**：OpenClaw 运行在你的设备上，你完全控制数据和配置
- **多平台集成**：可以连接到 WhatsApp、Telegram 等多个聊天平台
- **可定制性**：可以配置技能、工具和工作流

## 安装与设置

### 需要什么系统要求？

- **Node.js >= 22**（推荐使用最新版本）
- **操作系统**：macOS、Linux 或 Windows（通过 WSL2）
- **内存**：建议至少 4GB RAM
- **存储**：至少 1GB 可用空间

### 如何安装？

使用以下命令安装：

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

详情参见：[快速入门](/start/getting-started-zh)

### 如何更新？

```bash
npm update -g openclaw@latest
openclaw doctor
```

详情参见：[更新指南](/install/updating)

## 使用问题

### 如何添加 WhatsApp？

```bash
openclaw channels login
```

然后使用 WhatsApp 扫描二维码。详情：[WhatsApp 配置](/channels/whatsapp)

### 如何添加 Telegram？

1. 创建一个 Telegram 机器人（通过 @BotFather）
2. 获取 API 令牌
3. 运行 `openclaw configure` 设置令牌

详情：[Telegram 配置](/channels/telegram)

### 私信安全吗？

默认情况下，OpenClaw 使用"配对"机制：
- 未知发送者会收到一个配对码
- 你需要批准该码才能让他们与机器人对话
- 这可以防止垃圾消息和未经授权的访问

详情：[安全指南](/gateway/security)

### 如何更改 AI 模型？

```bash
openclaw configure
```

或编辑 `~/.openclaw/openclaw.json`：

```json5
{
  agent: {
    model: "anthropic/claude-opus-4-5"
  }
}
```

## 故障排除

### 网关无法启动？

运行诊断：

```bash
openclaw doctor
openclaw status --deep
```

### 消息没有回复？

检查：
1. AI 模型是否已配置（`openclaw models list`）
2. 网关是否正在运行（`openclaw gateway status`）
3. 消息是否来自已批准的发件人（`openclaw pairing list`）

### 如何查看日志？

```bash
openclaw logs
```

或使用特定命令：

```bash
# macOS
./scripts/clawlog.sh

# Linux
journalctl -u openclaw -f
```

## 高级问题

### 可以在远程服务器上运行吗？

可以！OpenClaw 支持：
- Tailscale Serve/Funnel 用于远程访问
- SSH 隧道
- Docker 部署

详情：[远程访问](/gateway/remote)

### 如何设置技能？

```bash
openclaw skills list
openclaw skills install <skill-name>
```

详情：[技能文档](/tools/skills)

### 如何配置沙箱？

在 `~/.openclaw/openclaw.json` 中设置：

```json5
{
  routing: {
    agents: {
      main: {
        sandbox: { mode: "off" }
      }
    }
  }
}
```

详情：[安全与沙箱](/gateway/security)

## 更多帮助

- **文档**：https://docs.openclaw.ai
- **Discord 社区**：https://discord.gg/clawd
- **GitHub Issues**：https://github.com/openclaw/openclaw/issues
