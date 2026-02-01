import type { Command } from "commander";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { runTui } from "../tui/tui.js";
import { parseTimeoutMs } from "./parse-timeout.js";

export function registerTuiCli(program: Command) {
  program
    .command("tui")
    .description("打开连接到网关的终端界面")
    .option("--url <url>", "网关 WebSocket URL（默认使用 gateway.remote.url 配置）")
    .option("--token <token>", "网关令牌（如果需要）")
    .option("--password <password>", "网关密码（如果需要）")
    .option("--session <key>", '会话密钥（默认："main"，全局作用域时为 "global"）')
    .option("--deliver", "传递助手回复", false)
    .option("--thinking <level>", "思考级别覆盖")
    .option("--message <text>", "连接后发送初始消息")
    .option("--timeout-ms <ms>", "代理超时时间（毫秒，默认使用 agents.defaults.timeoutSeconds）")
    .option("--history-limit <n>", "要加载的历史记录条数", "200")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/tui", "docs.openclaw.ai/cli/tui")}\n`,
    )
    .action(async (opts) => {
      try {
        const timeoutMs = parseTimeoutMs(opts.timeoutMs);
        if (opts.timeoutMs !== undefined && timeoutMs === undefined) {
          defaultRuntime.error(`警告：无效的 --timeout-ms "${String(opts.timeoutMs)}"；已忽略`);
        }
        const historyLimit = Number.parseInt(String(opts.historyLimit ?? "200"), 10);
        await runTui({
          url: opts.url as string | undefined,
          token: opts.token as string | undefined,
          password: opts.password as string | undefined,
          session: opts.session as string | undefined,
          deliver: Boolean(opts.deliver),
          thinking: opts.thinking as string | undefined,
          message: opts.message as string | undefined,
          timeoutMs,
          historyLimit: Number.isNaN(historyLimit) ? undefined : historyLimit,
        });
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });
}
