import type { Command } from "commander";
import type { ProgramContext } from "./context.js";
import { formatDocsLink } from "../../terminal/links.js";
import { isRich, theme } from "../../terminal/theme.js";
import { formatCliBannerLine, hasEmittedCliBanner } from "../banner.js";
import { replaceCliName, resolveCliName } from "../cli-name.js";

const CLI_NAME = resolveCliName();

const EXAMPLES = [
  ["openclaw channels login --verbose", "关联个人 WhatsApp Web 并显示 QR + 连接日志。"],
  [
    'openclaw message send --target +15555550123 --message "Hi" --json',
    "通过您的 Web 会话发送并打印 JSON 结果。",
  ],
  ["openclaw gateway --port 18789", "在本地运行 WebSocket 网关。"],
  ["openclaw --dev gateway", "在 ws://127.0.0.1:19001 上运行开发网关（隔离状态/配置）。"],
  ["openclaw gateway --force", "终止绑定到默认网关端口的任何内容，然后启动它。"],
  ["openclaw gateway ...", "通过 WebSocket 进行网关控制。"],
  [
    'openclaw agent --to +15555550123 --message "Run summary" --deliver',
    "使用网关直接与代理对话；可选择发送 WhatsApp 回复。",
  ],
  [
    'openclaw message send --channel telegram --target @mychat --message "Hi"',
    "通过您的 Telegram 机器人发送。",
  ],
] as const;

export function configureProgramHelp(program: Command, ctx: ProgramContext) {
  program
    .name(CLI_NAME)
    .description("")
    .version(ctx.programVersion)
    .option(
      "--dev",
      "开发配置文件：将状态隔离在 ~/.openclaw-dev 下，默认网关端口 19001，并转移派生端口（浏览器/canvas）",
    )
    .option(
      "--profile <name>",
      "使用命名配置文件（将 OPENCLAW_STATE_DIR/OPENCLAW_CONFIG_PATH 隔离在 ~/.openclaw-<name> 下）",
    );

  program.option("--no-color", "禁用 ANSI 颜色", false);

  program.configureHelp({
    optionTerm: (option) => theme.option(option.flags),
    subcommandTerm: (cmd) => theme.command(cmd.name()),
  });

  program.configureOutput({
    writeOut: (str) => {
      const colored = str
        .replace(/^Usage:/gm, theme.heading("用法："))
        .replace(/^Options:/gm, theme.heading("选项："))
        .replace(/^Commands:/gm, theme.heading("命令："))
        .replace(/output the version number/g, "输出版本号")
        .replace(/display help for command/g, "显示命令帮助");
      process.stdout.write(colored);
    },
    writeErr: (str) => process.stderr.write(str),
    outputError: (str, write) => write(theme.error(str)),
  });

  if (
    process.argv.includes("-V") ||
    process.argv.includes("--version") ||
    process.argv.includes("-v")
  ) {
    console.log(ctx.programVersion);
    process.exit(0);
  }

  program.addHelpText("beforeAll", () => {
    if (hasEmittedCliBanner()) {
      return "";
    }
    const rich = isRich();
    const line = formatCliBannerLine(ctx.programVersion, { richTty: rich });
    return `\n${line}\n`;
  });

  const fmtExamples = EXAMPLES.map(
    ([cmd, desc]) => `  ${theme.command(replaceCliName(cmd, CLI_NAME))}\n    ${theme.muted(desc)}`,
  ).join("\n");

  program.addHelpText("afterAll", ({ command }) => {
    if (command !== program) {
      return "";
    }
    const docs = formatDocsLink("/cli", "docs.openclaw.ai/cli");
    return `\n${theme.heading("示例：")}\n${fmtExamples}\n\n${theme.muted("文档：")} ${docs}\n`;
  });
}
