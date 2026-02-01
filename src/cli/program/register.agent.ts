import type { Command } from "commander";
import { DEFAULT_CHAT_CHANNEL } from "../../channels/registry.js";
import { agentCliCommand } from "../../commands/agent-via-gateway.js";
import {
  agentsAddCommand,
  agentsDeleteCommand,
  agentsListCommand,
  agentsSetIdentityCommand,
} from "../../commands/agents.js";
import { setVerbose } from "../../globals.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { hasExplicitOptions } from "../command-options.js";
import { createDefaultDeps } from "../deps.js";
import { formatHelpExamples } from "../help-format.js";
import { collectOption } from "./helpers.js";

export function registerAgentCommands(program: Command, args: { agentChannelOptions: string }) {
  program
    .command("agent")
    .description("通过网关运行代理（使用 --local 运行嵌入式代理）")
    .requiredOption("-m, --message <text>", "代理的消息内容")
    .option("-t, --to <number>", "用于派生会话密钥的 E.164 接收者号码")
    .option("--session-id <id>", "使用显式会话 ID")
    .option("--agent <id>", "代理 ID（覆盖路由绑定）")
    .option("--thinking <level>", "思考级别：off | minimal | low | medium | high")
    .option("--verbose <on|off>", "为会话持久化代理详细级别")
    .option(
      "--channel <channel>",
      `传递频道：${args.agentChannelOptions}（默认：${DEFAULT_CHAT_CHANNEL}）`,
    )
    .option("--reply-to <target>", "传递目标覆盖（与会话路由分离）")
    .option("--reply-channel <channel>", "传递频道覆盖（与路由分离）")
    .option("--reply-account <id>", "传递账户 ID 覆盖")
    .option("--local", "在本地运行嵌入式代理（需要 shell 中的模型提供商 API 密钥）", false)
    .option("--deliver", "将代理的回复发送回所选频道", false)
    .option("--json", "将结果输出为 JSON", false)
    .option("--timeout <seconds>", "覆盖代理命令超时（秒，默认 600 或配置值）")
    .addHelpText(
      "after",
      () =>
        `
${theme.heading("示例：")}
${formatHelpExamples([
  ['openclaw agent --to +15555550123 --message "status update"', "开始新会话。"],
  ['openclaw agent --agent ops --message "Summarize logs"', "使用特定代理。"],
  [
    'openclaw agent --session-id 1234 --message "Summarize inbox" --thinking medium',
    "以指定思考级别定位会话。",
  ],
  [
    'openclaw agent --to +15555550123 --message "Trace logs" --verbose on --json',
    "启用详细日志和 JSON 输出。",
  ],
  ['openclaw agent --to +15555550123 --message "Summon reply" --deliver', "传递回复。"],
  [
    'openclaw agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"',
    "将回复发送到不同的频道/目标。",
  ],
])}

${theme.muted("文档：")} ${formatDocsLink("/cli/agent", "docs.openclaw.ai/cli/agent")}`,
    )
    .action(async (opts) => {
      const verboseLevel = typeof opts.verbose === "string" ? opts.verbose.toLowerCase() : "";
      setVerbose(verboseLevel === "on");
      // Build default deps (keeps parity with other commands; future-proofing).
      const deps = createDefaultDeps();
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentCliCommand(opts, defaultRuntime, deps);
      });
    });

  const agents = program
    .command("agents")
    .description("管理隔离的代理（工作区 + 认证 + 路由）")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/agents", "docs.openclaw.ai/cli/agents")}\n`,
    );

  agents
    .command("list")
    .description("列出已配置的代理")
    .option("--json", "输出 JSON 而非文本", false)
    .option("--bindings", "包含路由绑定", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsListCommand(
          { json: Boolean(opts.json), bindings: Boolean(opts.bindings) },
          defaultRuntime,
        );
      });
    });

  agents
    .command("add [name]")
    .description("添加新的隔离代理")
    .option("--workspace <dir>", "新代理的工作区目录")
    .option("--model <id>", "此代理的模型 ID")
    .option("--agent-dir <dir>", "此代理的代理状态目录")
    .option("--bind <channel[:accountId]>", "路由频道绑定（可重复）", collectOption, [])
    .option("--non-interactive", "禁用提示；需要 --workspace", false)
    .option("--json", "输出 JSON 摘要", false)
    .action(async (name, opts, command) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const hasFlags = hasExplicitOptions(command, [
          "workspace",
          "model",
          "agentDir",
          "bind",
          "nonInteractive",
        ]);
        await agentsAddCommand(
          {
            name: typeof name === "string" ? name : undefined,
            workspace: opts.workspace as string | undefined,
            model: opts.model as string | undefined,
            agentDir: opts.agentDir as string | undefined,
            bind: Array.isArray(opts.bind) ? (opts.bind as string[]) : undefined,
            nonInteractive: Boolean(opts.nonInteractive),
            json: Boolean(opts.json),
          },
          defaultRuntime,
          { hasFlags },
        );
      });
    });

  agents
    .command("set-identity")
    .description("更新代理身份（名称/主题/表情符号/头像）")
    .option("--agent <id>", "要更新的代理 ID")
    .option("--workspace <dir>", "用于定位代理 + IDENTITY.md 的工作区目录")
    .option("--identity-file <path>", "要读取的显式 IDENTITY.md 路径")
    .option("--from-identity", "从 IDENTITY.md 读取值", false)
    .option("--name <name>", "身份名称")
    .option("--theme <theme>", "身份主题")
    .option("--emoji <emoji>", "身份表情符号")
    .option("--avatar <value>", "身份头像（工作区路径、http(s) URL 或 data URI）")
    .option("--json", "输出 JSON 摘要", false)
    .addHelpText(
      "after",
      () =>
        `
${theme.heading("示例：")}
${formatHelpExamples([
  [
    'openclaw agents set-identity --agent main --name "OpenClaw" --emoji "🦞"',
    "设置名称 + 表情符号。",
  ],
  ["openclaw agents set-identity --agent main --avatar avatars/openclaw.png", "设置头像路径。"],
  [
    "openclaw agents set-identity --workspace ~/.openclaw/workspace --from-identity",
    "从 IDENTITY.md 加载。",
  ],
  [
    "openclaw agents set-identity --identity-file ~/.openclaw/workspace/IDENTITY.md --agent main",
    "使用特定的 IDENTITY.md。",
  ],
])}
`,
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsSetIdentityCommand(
          {
            agent: opts.agent as string | undefined,
            workspace: opts.workspace as string | undefined,
            identityFile: opts.identityFile as string | undefined,
            fromIdentity: Boolean(opts.fromIdentity),
            name: opts.name as string | undefined,
            theme: opts.theme as string | undefined,
            emoji: opts.emoji as string | undefined,
            avatar: opts.avatar as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  agents
    .command("delete <id>")
    .description("删除代理并清理工作区/状态")
    .option("--force", "跳过确认", false)
    .option("--json", "输出 JSON 摘要", false)
    .action(async (id, opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await agentsDeleteCommand(
          {
            id: String(id),
            force: Boolean(opts.force),
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  agents.action(async () => {
    await runCommandWithRuntime(defaultRuntime, async () => {
      await agentsListCommand({}, defaultRuntime);
    });
  });
}
