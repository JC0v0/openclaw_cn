import type { Command } from "commander";
import { normalizeChannelId } from "../channels/plugins/index.js";
import { listPairingChannels, notifyPairingApproved } from "../channels/plugins/pairing.js";
import { loadConfig } from "../config/config.js";
import { resolvePairingIdLabel } from "../pairing/pairing-labels.js";
import {
  approveChannelPairingCode,
  listChannelPairingRequests,
  type PairingChannel,
} from "../pairing/pairing-store.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { renderTable } from "../terminal/table.js";
import { theme } from "../terminal/theme.js";
import { formatCliCommand } from "./command-format.js";

/** Parse channel, allowing extension channels not in core registry. */
function parseChannel(raw: unknown, channels: PairingChannel[]): PairingChannel {
  const value = (
    typeof raw === "string"
      ? raw
      : typeof raw === "number" || typeof raw === "boolean"
        ? String(raw)
        : ""
  )
    .trim()
    .toLowerCase();
  if (!value) {
    throw new Error("需要指定渠道");
  }

  const normalized = normalizeChannelId(value);
  if (normalized) {
    if (!channels.includes(normalized)) {
      throw new Error(`渠道 ${normalized} 不支持配对`);
    }
    return normalized;
  }

  // Allow extension channels: validate format but don't require registry
  if (/^[a-z][a-z0-9_-]{0,63}$/.test(value)) {
    return value as PairingChannel;
  }
  throw new Error(`无效的渠道：${value}`);
}

async function notifyApproved(channel: PairingChannel, id: string) {
  const cfg = loadConfig();
  await notifyPairingApproved({ channelId: channel, id, cfg });
}

export function registerPairingCli(program: Command) {
  const channels = listPairingChannels();
  const pairing = program
    .command("pairing")
    .description("安全私信配对（批准入站请求）")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("文档：")} ${formatDocsLink("/cli/pairing", "docs.openclaw.ai/cli/pairing")}\n`,
    );

  pairing
    .command("list")
    .description("列出待处理的配对请求")
    .option("--channel <channel>", `渠道 (${channels.join(", ")})`)
    .argument("[channel]", `渠道 (${channels.join(", ")})`)
    .option("--json", "以 JSON 格式输出", false)
    .action(async (channelArg, opts) => {
      const channelRaw = opts.channel ?? channelArg;
      if (!channelRaw) {
        throw new Error(
          `需要指定渠道。使用 --channel <channel> 或将其作为第一个参数传递（预期为以下之一：${channels.join(", ")})`,
        );
      }
      const channel = parseChannel(channelRaw, channels);
      const requests = await listChannelPairingRequests(channel);
      if (opts.json) {
        defaultRuntime.log(JSON.stringify({ channel, requests }, null, 2));
        return;
      }
      if (requests.length === 0) {
        defaultRuntime.log(theme.muted(`没有待处理的 ${channel} 配对请求。`));
        return;
      }
      const idLabel = resolvePairingIdLabel(channel);
      const tableWidth = Math.max(60, (process.stdout.columns ?? 120) - 1);
      defaultRuntime.log(`${theme.heading("配对请求")} ${theme.muted(`(${requests.length})`)}`);
      defaultRuntime.log(
        renderTable({
          width: tableWidth,
          columns: [
            { key: "Code", header: "代码", minWidth: 10 },
            { key: "ID", header: idLabel, minWidth: 12, flex: true },
            { key: "Meta", header: "元数据", minWidth: 8, flex: true },
            { key: "Requested", header: "请求时间", minWidth: 12 },
          ],
          rows: requests.map((r) => ({
            Code: r.code,
            ID: r.id,
            Meta: r.meta ? JSON.stringify(r.meta) : "",
            Requested: r.createdAt,
          })),
        }).trimEnd(),
      );
    });

  pairing
    .command("approve")
    .description("批准配对码并允许该发送者")
    .option("--channel <channel>", `渠道 (${channels.join(", ")})`)
    .argument("<codeOrChannel>", "配对码（或使用 2 个参数时的渠道）")
    .argument("[code]", "配对码（当渠道作为第 1 个参数传递时）")
    .option("--notify", "在同一渠道上通知请求者", false)
    .action(async (codeOrChannel, code, opts) => {
      const channelRaw = opts.channel ?? codeOrChannel;
      const resolvedCode = opts.channel ? codeOrChannel : code;
      if (!opts.channel && !code) {
        throw new Error(
          `Usage: ${formatCliCommand("openclaw pairing approve <channel> <code>")} (or: ${formatCliCommand("openclaw pairing approve --channel <channel> <code>")})`,
        );
      }
      if (opts.channel && code != null) {
        throw new Error(
          `Too many arguments. Use: ${formatCliCommand("openclaw pairing approve --channel <channel> <code>")}`,
        );
      }
      const channel = parseChannel(channelRaw, channels);
      const approved = await approveChannelPairingCode({
        channel,
        code: String(resolvedCode),
      });
      if (!approved) {
        throw new Error(`No pending pairing request found for code: ${String(resolvedCode)}`);
      }

      defaultRuntime.log(
        `${theme.success("Approved")} ${theme.muted(channel)} sender ${theme.command(approved.id)}.`,
      );

      if (!opts.notify) {
        return;
      }
      await notifyApproved(channel, approved.id).catch((err) => {
        defaultRuntime.log(theme.warn(`通知请求者失败：${String(err)}`));
      });
    });
}
