import type { Command } from "commander";
import { sandboxExplainCommand } from "../commands/sandbox-explain.js";
import { sandboxListCommand, sandboxRecreateCommand } from "../commands/sandbox.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { formatHelpExamples } from "./help-format.js";

// --- Types ---

type CommandOptions = Record<string, unknown>;

// --- Helpers ---

const SANDBOX_EXAMPLES = {
  main: [
    ["openclaw sandbox list", "列出所有沙箱容器。"],
    ["openclaw sandbox list --browser", "仅列出浏览器容器。"],
    ["openclaw sandbox recreate --all", "重新创建所有容器。"],
    ["openclaw sandbox recreate --session main", "重新创建指定会话。"],
    ["openclaw sandbox recreate --agent mybot", "重新创建代理容器。"],
    ["openclaw sandbox explain", "解释有效的沙箱配置。"],
  ],
  list: [
    ["openclaw sandbox list", "列出所有沙箱容器。"],
    ["openclaw sandbox list --browser", "仅列出浏览器容器。"],
    ["openclaw sandbox list --json", "JSON 格式输出。"],
  ],
  recreate: [
    ["openclaw sandbox recreate --all", "重新创建所有容器。"],
    ["openclaw sandbox recreate --session main", "重新创建指定会话。"],
    ["openclaw sandbox recreate --agent mybot", "重新创建指定代理（包括子代理）。"],
    ["openclaw sandbox recreate --browser --all", "仅重新创建浏览器容器。"],
    ["openclaw sandbox recreate --all --force", "跳过确认提示。"],
  ],
  explain: [
    ["openclaw sandbox explain", "显示有效的沙箱配置。"],
    ["openclaw sandbox explain --session agent:main:main", "解释指定会话的配置。"],
    ["openclaw sandbox explain --agent work", "解释代理沙箱。"],
    ["openclaw sandbox explain --json", "JSON 格式输出。"],
  ],
} as const;

function createRunner(
  commandFn: (opts: CommandOptions, runtime: typeof defaultRuntime) => Promise<void>,
) {
  return async (opts: CommandOptions) => {
    try {
      await commandFn(opts, defaultRuntime);
    } catch (err) {
      defaultRuntime.error(String(err));
      defaultRuntime.exit(1);
    }
  };
}

// --- Registration ---

export function registerSandboxCli(program: Command) {
  const sandbox = program
    .command("sandbox")
    .description("管理沙箱容器（基于 Docker 的代理隔离）")
    .addHelpText(
      "after",
      () => `\n${theme.heading("示例：")}\n${formatHelpExamples(SANDBOX_EXAMPLES.main)}\n`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/sandbox", "docs.openclaw.ai/cli/sandbox")}\n`,
    )
    .action(() => {
      sandbox.help({ error: true });
    });

  // --- List Command ---

  sandbox
    .command("list")
    .description("列出沙箱容器及其状态")
    .option("--json", "以 JSON 格式输出结果", false)
    .option("--browser", "仅列出浏览器容器", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("示例：")}\n${formatHelpExamples(SANDBOX_EXAMPLES.list)}\n\n${theme.heading(
          "输出内容包括：",
        )}\n${theme.muted("- 容器名称和状态（运行中/已停止）")}\n${theme.muted(
          "- Docker 镜像以及是否与当前配置匹配",
        )}\n${theme.muted("- 存在时间（创建以来的时间）")}\n${theme.muted(
          "- 空闲时间（上次使用以来的时间）",
        )}\n${theme.muted("- 关联的会话/代理 ID")}`,
    )
    .action(
      createRunner((opts) =>
        sandboxListCommand(
          {
            browser: Boolean(opts.browser),
            json: Boolean(opts.json),
          },
          defaultRuntime,
        ),
      ),
    );

  // --- Recreate Command ---

  sandbox
    .command("recreate")
    .description("删除容器以使用更新后的配置强制重新创建")
    .option("--all", "重新创建所有沙箱容器", false)
    .option("--session <key>", "为指定会话重新创建容器")
    .option("--agent <id>", "为指定代理重新创建容器")
    .option("--browser", "仅重新创建浏览器容器", false)
    .option("--force", "跳过确认提示", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("示例：")}\n${formatHelpExamples(SANDBOX_EXAMPLES.recreate)}\n\n${theme.heading(
          "为什么使用此命令？",
        )}\n${theme.muted(
          "更新 Docker 镜像或沙箱配置后，现有容器会继续使用旧设置运行。",
        )}\n${theme.muted(
          "此命令会删除这些容器，以便在下次需要时使用当前配置自动重新创建。",
        )}\n\n${theme.heading("筛选选项：")}\n${theme.muted(
          "  --all          删除所有沙箱容器",
        )}\n${theme.muted("  --session      删除指定会话密钥的容器")}\n${theme.muted(
          "  --agent        删除代理的容器（包括 agent:id:* 变体）",
        )}\n\n${theme.heading("修饰符：")}\n${theme.muted(
          "  --browser      仅影响浏览器容器（不影响常规沙箱）",
        )}\n${theme.muted("  --force        跳过确认提示")}`,
    )
    .action(
      createRunner((opts) =>
        sandboxRecreateCommand(
          {
            all: Boolean(opts.all),
            session: opts.session as string | undefined,
            agent: opts.agent as string | undefined,
            browser: Boolean(opts.browser),
            force: Boolean(opts.force),
          },
          defaultRuntime,
        ),
      ),
    );

  // --- Explain Command ---

  sandbox
    .command("explain")
    .description("解释会话/代理的有效沙箱/工具策略")
    .option("--session <key>", "要检查的会话密钥（默认为 agent main）")
    .option("--agent <id>", "要检查的代理 ID（默认为派生代理）")
    .option("--json", "以 JSON 格式输出结果", false)
    .addHelpText(
      "after",
      () => `\n${theme.heading("示例：")}\n${formatHelpExamples(SANDBOX_EXAMPLES.explain)}\n`,
    )
    .action(
      createRunner((opts) =>
        sandboxExplainCommand(
          {
            session: opts.session as string | undefined,
            agent: opts.agent as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        ),
      ),
    );
}
