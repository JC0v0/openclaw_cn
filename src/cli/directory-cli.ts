import type { Command } from "commander";
import { resolveChannelDefaultAccountId } from "../channels/plugins/helpers.js";
import { getChannelPlugin } from "../channels/plugins/index.js";
import { loadConfig } from "../config/config.js";
import { danger } from "../globals.js";
import { resolveMessageChannelSelection } from "../infra/outbound/channel-selection.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { renderTable } from "../terminal/table.js";
import { theme } from "../terminal/theme.js";

function parseLimit(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 0) {
      return null;
    }
    return Math.floor(value);
  }
  if (typeof value !== "string") {
    return null;
  }
  const raw = value.trim();
  if (!raw) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function buildRows(entries: Array<{ id: string; name?: string | undefined }>) {
  return entries.map((entry) => ({
    ID: entry.id,
    Name: entry.name?.trim() ?? "",
  }));
}

export function registerDirectoryCli(program: Command) {
  const directory = program
    .command("directory")
    .description("目录查找（自己、对等方、群组），适用于支持的渠道")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink(
          "/cli/directory",
          "docs.openclaw.ai/cli/directory",
        )}\n`,
    )
    .action(() => {
      directory.help({ error: true });
    });

  const withChannel = (cmd: Command) =>
    cmd
      .option("--channel <name>", "渠道（仅配置一个时自动选择）")
      .option("--account <id>", "账户 ID (accountId)")
      .option("--json", "以 JSON 格式输出", false);

  const resolve = async (opts: { channel?: string; account?: string }) => {
    const cfg = loadConfig();
    const selection = await resolveMessageChannelSelection({
      cfg,
      channel: opts.channel ?? null,
    });
    const channelId = selection.channel;
    const plugin = getChannelPlugin(channelId);
    if (!plugin) {
      throw new Error(`不支持的渠道：${String(channelId)}`);
    }
    const accountId = opts.account?.trim() || resolveChannelDefaultAccountId({ plugin, cfg });
    return { cfg, channelId, accountId, plugin };
  };

  withChannel(directory.command("self").description("显示当前账户用户")).action(async (opts) => {
    try {
      const { cfg, channelId, accountId, plugin } = await resolve({
        channel: opts.channel as string | undefined,
        account: opts.account as string | undefined,
      });
      const fn = plugin.directory?.self;
      if (!fn) {
        throw new Error(`渠道 ${channelId} 不支持目录自我查询`);
      }
      const result = await fn({ cfg, accountId, runtime: defaultRuntime });
      if (opts.json) {
        defaultRuntime.log(JSON.stringify(result, null, 2));
        return;
      }
      if (!result) {
        defaultRuntime.log(theme.muted("不可用。"));
        return;
      }
      const tableWidth = Math.max(60, (process.stdout.columns ?? 120) - 1);
      defaultRuntime.log(`${theme.heading("自己")}`);
      defaultRuntime.log(
        renderTable({
          width: tableWidth,
          columns: [
            { key: "ID", header: "ID", minWidth: 16, flex: true },
            { key: "Name", header: "名称", minWidth: 18, flex: true },
          ],
          rows: buildRows([result]),
        }).trimEnd(),
      );
    } catch (err) {
      defaultRuntime.error(danger(String(err)));
      defaultRuntime.exit(1);
    }
  });

  const peers = directory.command("peers").description("对等方目录（联系人/用户）");
  withChannel(peers.command("list").description("列出对等方"))
    .option("--query <text>", "可选搜索查询")
    .option("--limit <n>", "限制结果数量")
    .action(async (opts) => {
      try {
        const { cfg, channelId, accountId, plugin } = await resolve({
          channel: opts.channel as string | undefined,
          account: opts.account as string | undefined,
        });
        const fn = plugin.directory?.listPeers;
        if (!fn) {
          throw new Error(`渠道 ${channelId} 不支持目录对等方查询`);
        }
        const result = await fn({
          cfg,
          accountId,
          query: (opts.query as string | undefined) ?? null,
          limit: parseLimit(opts.limit),
          runtime: defaultRuntime,
        });
        if (opts.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
          return;
        }
        if (result.length === 0) {
          defaultRuntime.log(theme.muted("未找到对等方。"));
          return;
        }
        const tableWidth = Math.max(60, (process.stdout.columns ?? 120) - 1);
        defaultRuntime.log(`${theme.heading("对等方")} ${theme.muted(`(${result.length})`)}`);
        defaultRuntime.log(
          renderTable({
            width: tableWidth,
            columns: [
              { key: "ID", header: "ID", minWidth: 16, flex: true },
              { key: "Name", header: "名称", minWidth: 18, flex: true },
            ],
            rows: buildRows(result),
          }).trimEnd(),
        );
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  const groups = directory.command("groups").description("群组目录");
  withChannel(groups.command("list").description("列出群组"))
    .option("--query <text>", "可选搜索查询")
    .option("--limit <n>", "限制结果数量")
    .action(async (opts) => {
      try {
        const { cfg, channelId, accountId, plugin } = await resolve({
          channel: opts.channel as string | undefined,
          account: opts.account as string | undefined,
        });
        const fn = plugin.directory?.listGroups;
        if (!fn) {
          throw new Error(`渠道 ${channelId} 不支持目录群组查询`);
        }
        const result = await fn({
          cfg,
          accountId,
          query: (opts.query as string | undefined) ?? null,
          limit: parseLimit(opts.limit),
          runtime: defaultRuntime,
        });
        if (opts.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
          return;
        }
        if (result.length === 0) {
          defaultRuntime.log(theme.muted("未找到群组。"));
          return;
        }
        const tableWidth = Math.max(60, (process.stdout.columns ?? 120) - 1);
        defaultRuntime.log(`${theme.heading("群组")} ${theme.muted(`(${result.length})`)}`);
        defaultRuntime.log(
          renderTable({
            width: tableWidth,
            columns: [
              { key: "ID", header: "ID", minWidth: 16, flex: true },
              { key: "Name", header: "名称", minWidth: 18, flex: true },
            ],
            rows: buildRows(result),
          }).trimEnd(),
        );
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  withChannel(
    groups
      .command("members")
      .description("列出群组成员")
      .requiredOption("--group-id <id>", "群组 ID"),
  )
    .option("--limit <n>", "限制结果数量")
    .action(async (opts) => {
      try {
        const { cfg, channelId, accountId, plugin } = await resolve({
          channel: opts.channel as string | undefined,
          account: opts.account as string | undefined,
        });
        const fn = plugin.directory?.listGroupMembers;
        if (!fn) {
          throw new Error(`渠道 ${channelId} 不支持群组成员列表`);
        }
        const groupId = String(opts.groupId ?? "").trim();
        if (!groupId) {
          throw new Error("缺少 --group-id");
        }
        const result = await fn({
          cfg,
          accountId,
          groupId,
          limit: parseLimit(opts.limit),
          runtime: defaultRuntime,
        });
        if (opts.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
          return;
        }
        if (result.length === 0) {
          defaultRuntime.log(theme.muted("未找到群组成员。"));
          return;
        }
        const tableWidth = Math.max(60, (process.stdout.columns ?? 120) - 1);
        defaultRuntime.log(`${theme.heading("群组成员")} ${theme.muted(`(${result.length})`)}`);
        defaultRuntime.log(
          renderTable({
            width: tableWidth,
            columns: [
              { key: "ID", header: "ID", minWidth: 16, flex: true },
              { key: "Name", header: "名称", minWidth: 18, flex: true },
            ],
            rows: buildRows(result),
          }).trimEnd(),
        );
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });
}
