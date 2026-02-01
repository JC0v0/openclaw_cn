---
summary: "OpenClaw 命令行界面完整参考"
title: "CLI 参考"
---

# CLI 命令行参考

## 概览

OpenClaw 提供了一个统一的命令行界面（CLI）用于所有操作。

```bash
openclaw [command] [options]
```

## 主要命令

### 网关命令

#### `openclaw gateway`

启动和管理网关服务。

```bash
# 启动网关
openclaw gateway --port 18789

# 后台运行
openclaw gateway --port 18789 --force

# 查看状态
openclaw gateway status

# 重启网关
openclaw gateway restart
```

**选项：**
- `--port <number>` - 指定端口号（默认：18789）
- `--bind <address>` - 绑定地址（默认：loopback）
- `--verbose` - 详细输出
- `--force` - 强制启动（即使已运行）

### 代理命令

#### `openclaw agent`

与 AI 助手对话。

```bash
# 发送消息
openclaw agent --message "你好"

# 设置思考级别
openclaw agent --message "解释这段代码" --thinking high

# 交互模式
openclaw agent
```

**选项：**
- `--message <text>` - 要发送的消息
- `--thinking <level>` - 思考级别：off|minimal|low|medium|high|xhigh
- `--model <model>` - 临时覆盖模型
- `--session <key>` - 指定会话

### 消息命令

#### `openclaw message`

发送消息到特定频道。

```bash
# 发送到 WhatsApp
openclaw message send --to +1234567890 --message "你好"

# 发送到 Telegram
openclaw message send --to @username --message "消息"

# 发送文件
openclaw message send --to +1234567890 --file /path/to/file.jpg
```

**选项：**
- `--to <target>` - 目标频道或用户
- `--message <text>` - 消息内容
- `--file <path>` - 附件文件路径
- `--wait` - 等待回复

### 频道命令

#### `openclaw channels`

管理聊天频道。

```bash
# 列出所有频道
openclaw channels list

# 查看频道状态
openclaw channels status --probe

# 登录 WhatsApp
openclaw channels login

# 添加频道
openclaw channels add telegram
```

### 配置命令

#### `openclaw configure`

编辑配置。

```bash
# 打开配置编辑器
openclaw configure

# 设置特定部分
openclaw configure --section agent
openclaw configure --section channels.whatsapp

# 设置值
openclaw config set agent.model anthropic/claude-opus-4-5
```

### 诊断命令

#### `openclaw doctor`

诊断和修复问题。

```bash
# 运行诊断
openclaw doctor

# 修复模式
openclaw doctor --fix

# 深度检查
openclaw doctor --deep
```

### 状态命令

#### `openclaw status`

查看系统状态。

```bash
# 简要状态
openclaw status

# 详细状态
openclaw status --deep

# 所有状态
openclaw status --all
```

### 模型命令

#### `openclaw models`

管理 AI 模型。

```bash
# 列出可用模型
openclaw models list

# 扫描新模型
openclaw models scan

# 设置认证
openclaw models auth
```

### 会话命令

#### `openclaw sessions`

管理会话。

```bash
# 列出会话
openclaw sessions list

# 查看会话历史
openclaw sessions history <session-key>

# 重置会话
openclaw sessions reset <session-key>
```

### 技能命令

#### `openclaw skills`

管理技能包。

```bash
# 列出技能
openclaw skills list

# 安装技能
openclaw skills install <skill-name>

# 更新技能
openclaw skills update --all
```

### 配对命令

#### `openclaw pairing`

管理配对（DM 安全）。

```bash
# 列出待批准配对
openclaw pairing list whatsapp

# 批准配对
openclaw pairing approve whatsapp <code>
```

### 向导命令

#### `openclaw onboard`

运行入门向导。

```bash
# 完整向导
openclaw onboard

# 跳过守护进程安装
openclaw onboard --no-daemon

# 重新配置
openclaw onboard --reset
```

### 更新命令

#### `openclaw update`

更新 OpenClaw。

```bash
# 更新到最新版本
openclaw update

# 切换频道
openclaw update --channel beta

# 重启
openclaw update --restart
```

## 全局选项

这些选项适用于所有命令：

- `--help, -h` - 显示帮助信息
- `--verbose` - 详细输出
- `--config <path>` - 指定配置文件路径
- `--profile <name>` - 使用特定配置文件

## 环境变量

- `OPENCLAW_CONFIG_PATH` - 配置文件路径
- `OPENCLAW_PROFILE` - 配置文件名称
- `OPENCLAW_NO_COLOR` - 禁用彩色输出
- `CLAUDE_API_KEY` - Anthropic API 密钥
- `OPENAI_API_KEY` - OpenAI API 密钥

## 退出代码

- `0` - 成功
- `1` - 一般错误
- `2` - 无效参数
- `126` - 命令不可执行

## 更多帮助

```bash
openclaw --help
openclaw <command> --help
```

在线文档：https://docs.openclaw.ai
