import type { Command } from "commander";
import { confirm, isCancel, select, spinner } from "@clack/prompts";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  formatUpdateAvailableHint,
  formatUpdateOneLiner,
  resolveUpdateAvailability,
} from "../commands/status.update.js";
import { readConfigFileSnapshot, writeConfigFile } from "../config/config.js";
import { resolveOpenClawPackageRoot } from "../infra/openclaw-root.js";
import { trimLogTail } from "../infra/restart-sentinel.js";
import { parseSemver } from "../infra/runtime-guard.js";
import {
  channelToNpmTag,
  DEFAULT_GIT_CHANNEL,
  DEFAULT_PACKAGE_CHANNEL,
  formatUpdateChannelLabel,
  normalizeUpdateChannel,
  resolveEffectiveUpdateChannel,
} from "../infra/update-channels.js";
import {
  checkUpdateStatus,
  compareSemverStrings,
  fetchNpmTagVersion,
  resolveNpmChannelTag,
} from "../infra/update-check.js";
import {
  detectGlobalInstallManagerByPresence,
  detectGlobalInstallManagerForRoot,
  globalInstallArgs,
  resolveGlobalPackageRoot,
  type GlobalInstallManager,
} from "../infra/update-global.js";
import {
  runGatewayUpdate,
  type UpdateRunResult,
  type UpdateStepInfo,
  type UpdateStepResult,
  type UpdateStepProgress,
} from "../infra/update-runner.js";
import { syncPluginsForUpdateChannel, updateNpmInstalledPlugins } from "../plugins/update.js";
import { runCommandWithTimeout } from "../process/exec.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { stylePromptHint, stylePromptMessage } from "../terminal/prompt-style.js";
import { renderTable } from "../terminal/table.js";
import { theme } from "../terminal/theme.js";
import { replaceCliName, resolveCliName } from "./cli-name.js";
import { formatCliCommand } from "./command-format.js";
import { formatHelpExamples } from "./help-format.js";

export type UpdateCommandOptions = {
  json?: boolean;
  restart?: boolean;
  channel?: string;
  tag?: string;
  timeout?: string;
  yes?: boolean;
};
export type UpdateStatusOptions = {
  json?: boolean;
  timeout?: string;
};
export type UpdateWizardOptions = {
  timeout?: string;
};

const STEP_LABELS: Record<string, string> = {
  "clean check": "工作目录干净",
  "upstream check": "上游分支存在",
  "git fetch": "获取最新更改",
  "git rebase": "变基到目标提交",
  "git rev-parse @{upstream}": "解析上游提交",
  "git rev-list": "枚举候选提交",
  "git clone": "克隆 git 检出",
  "preflight worktree": "准备预检工作树",
  "preflight cleanup": "清理预检工作树",
  "deps install": "安装依赖",
  build: "构建中",
  "ui:build": "构建 UI",
  "openclaw doctor": "运行检查程序",
  "git rev-parse HEAD (after)": "验证更新",
  "global update": "通过包管理器更新",
  "global install": "安装全局包",
};

const UPDATE_QUIPS = [
  "升级成功！解锁新技能。不客气。",
  "新代码，同样的龙虾。想我了吗？",
  "回归，更强。你注意到我离开了吗？",
  "更新完成。离开期间学了一些新技巧。",
  "已升级！现在多了 23% 的机智。",
  "我已经进化了。跟上吧。",
  "新版本，哪位？哦，还是我，只是更闪亮了。",
  "已打补丁，已打磨，准备就绪。开始吧。",
  "龙虾已蜕皮。更硬的壳，更锋利的爪子。",
  "更新完成！查看更新日志，或者相信我，这很好。",
  "从 npm 的沸水中重生。现在更强了。",
  "我离开了一段时间，回来时更聪明了。你也试试。",
  "更新完成。bug 怕了我，所以离开了。",
  "新版本已安装。旧版本向你问好。",
  "固件已刷新。脑皱纹：增加。",
  "我见过你不会相信的事情。总之，我已更新。",
  "重新上线。更新日志很长，但我们的友谊更长。",
  "已升级！Peter 修复了一些东西。如果出问题怪他。",
  "蜕皮完成。请别看我软壳阶段。",
  "版本升级！同样的混乱能量，更少的崩溃（大概）。",
];

const MAX_LOG_CHARS = 8000;
const DEFAULT_PACKAGE_NAME = "openclaw";
const CORE_PACKAGE_NAMES = new Set([DEFAULT_PACKAGE_NAME]);
const CLI_NAME = resolveCliName();
const OPENCLAW_REPO_URL = "https://github.com/openclaw/openclaw.git";
const DEFAULT_GIT_DIR = path.join(os.homedir(), ".openclaw");

function normalizeTag(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("openclaw@")) {
    return trimmed.slice("openclaw@".length);
  }
  if (trimmed.startsWith(`${DEFAULT_PACKAGE_NAME}@`)) {
    return trimmed.slice(`${DEFAULT_PACKAGE_NAME}@`.length);
  }
  return trimmed;
}

function pickUpdateQuip(): string {
  return UPDATE_QUIPS[Math.floor(Math.random() * UPDATE_QUIPS.length)] ?? "更新完成。";
}

function normalizeVersionTag(tag: string): string | null {
  const trimmed = tag.trim();
  if (!trimmed) {
    return null;
  }
  const cleaned = trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;
  return parseSemver(cleaned) ? cleaned : null;
}

async function readPackageVersion(root: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(root, "package.json"), "utf-8");
    const parsed = JSON.parse(raw) as { version?: string };
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}

async function resolveTargetVersion(tag: string, timeoutMs?: number): Promise<string | null> {
  const direct = normalizeVersionTag(tag);
  if (direct) {
    return direct;
  }
  const res = await fetchNpmTagVersion({ tag, timeoutMs });
  return res.version ?? null;
}

async function isGitCheckout(root: string): Promise<boolean> {
  try {
    await fs.stat(path.join(root, ".git"));
    return true;
  } catch {
    return false;
  }
}

async function readPackageName(root: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(root, "package.json"), "utf-8");
    const parsed = JSON.parse(raw) as { name?: string };
    const name = parsed?.name?.trim();
    return name ? name : null;
  } catch {
    return null;
  }
}

async function isCorePackage(root: string): Promise<boolean> {
  const name = await readPackageName(root);
  return Boolean(name && CORE_PACKAGE_NAMES.has(name));
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function isEmptyDir(targetPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(targetPath);
    return entries.length === 0;
  } catch {
    return false;
  }
}

function resolveGitInstallDir(): string {
  const override = process.env.OPENCLAW_GIT_DIR?.trim();
  if (override) {
    return path.resolve(override);
  }
  return resolveDefaultGitDir();
}

function resolveDefaultGitDir(): string {
  return DEFAULT_GIT_DIR;
}

function resolveNodeRunner(): string {
  const base = path.basename(process.execPath).toLowerCase();
  if (base === "node" || base === "node.exe") {
    return process.execPath;
  }
  return "node";
}

async function runUpdateStep(params: {
  name: string;
  argv: string[];
  cwd?: string;
  timeoutMs: number;
  progress?: UpdateStepProgress;
}): Promise<UpdateStepResult> {
  const command = params.argv.join(" ");
  params.progress?.onStepStart?.({
    name: params.name,
    command,
    index: 0,
    total: 0,
  });
  const started = Date.now();
  const res = await runCommandWithTimeout(params.argv, {
    cwd: params.cwd,
    timeoutMs: params.timeoutMs,
  });
  const durationMs = Date.now() - started;
  const stderrTail = trimLogTail(res.stderr, MAX_LOG_CHARS);
  params.progress?.onStepComplete?.({
    name: params.name,
    command,
    index: 0,
    total: 0,
    durationMs,
    exitCode: res.code,
    stderrTail,
  });
  return {
    name: params.name,
    command,
    cwd: params.cwd ?? process.cwd(),
    durationMs,
    exitCode: res.code,
    stdoutTail: trimLogTail(res.stdout, MAX_LOG_CHARS),
    stderrTail,
  };
}

async function ensureGitCheckout(params: {
  dir: string;
  timeoutMs: number;
  progress?: UpdateStepProgress;
}): Promise<UpdateStepResult | null> {
  const dirExists = await pathExists(params.dir);
  if (!dirExists) {
    return await runUpdateStep({
      name: "git clone",
      argv: ["git", "clone", OPENCLAW_REPO_URL, params.dir],
      timeoutMs: params.timeoutMs,
      progress: params.progress,
    });
  }

  if (!(await isGitCheckout(params.dir))) {
    const empty = await isEmptyDir(params.dir);
    if (!empty) {
      throw new Error(
        `OPENCLAW_GIT_DIR 指向非 git 目录：${params.dir}。将 OPENCLAW_GIT_DIR 设置为空文件夹或 openclaw 检出目录。`,
      );
    }
    return await runUpdateStep({
      name: "git clone",
      argv: ["git", "clone", OPENCLAW_REPO_URL, params.dir],
      cwd: params.dir,
      timeoutMs: params.timeoutMs,
      progress: params.progress,
    });
  }

  if (!(await isCorePackage(params.dir))) {
    throw new Error(`OPENCLAW_GIT_DIR 看起来不像核心检出目录：${params.dir}。`);
  }

  return null;
}

async function resolveGlobalManager(params: {
  root: string;
  installKind: "git" | "package" | "unknown";
  timeoutMs: number;
}): Promise<GlobalInstallManager> {
  const runCommand = async (argv: string[], options: { timeoutMs: number }) => {
    const res = await runCommandWithTimeout(argv, options);
    return { stdout: res.stdout, stderr: res.stderr, code: res.code };
  };
  if (params.installKind === "package") {
    const detected = await detectGlobalInstallManagerForRoot(
      runCommand,
      params.root,
      params.timeoutMs,
    );
    if (detected) {
      return detected;
    }
  }
  const byPresence = await detectGlobalInstallManagerByPresence(runCommand, params.timeoutMs);
  return byPresence ?? "npm";
}

function formatGitStatusLine(params: {
  branch: string | null;
  tag: string | null;
  sha: string | null;
}): string {
  const shortSha = params.sha ? params.sha.slice(0, 8) : null;
  const branch = params.branch && params.branch !== "HEAD" ? params.branch : null;
  const tag = params.tag;
  const parts = [
    branch ?? (tag ? "分离头" : "git"),
    tag ? `标签 ${tag}` : null,
    shortSha ? `@ ${shortSha}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export async function updateStatusCommand(opts: UpdateStatusOptions): Promise<void> {
  const timeoutMs = opts.timeout ? Number.parseInt(opts.timeout, 10) * 1000 : undefined;
  if (timeoutMs !== undefined && (Number.isNaN(timeoutMs) || timeoutMs <= 0)) {
    defaultRuntime.error("--timeout 必须是正整数（秒）");
    defaultRuntime.exit(1);
    return;
  }

  const root =
    (await resolveOpenClawPackageRoot({
      moduleUrl: import.meta.url,
      argv1: process.argv[1],
      cwd: process.cwd(),
    })) ?? process.cwd();
  const configSnapshot = await readConfigFileSnapshot();
  const configChannel = configSnapshot.valid
    ? normalizeUpdateChannel(configSnapshot.config.update?.channel)
    : null;

  const update = await checkUpdateStatus({
    root,
    timeoutMs: timeoutMs ?? 3500,
    fetchGit: true,
    includeRegistry: true,
  });
  const channelInfo = resolveEffectiveUpdateChannel({
    configChannel,
    installKind: update.installKind,
    git: update.git ? { tag: update.git.tag, branch: update.git.branch } : undefined,
  });
  const channelLabel = formatUpdateChannelLabel({
    channel: channelInfo.channel,
    source: channelInfo.source,
    gitTag: update.git?.tag ?? null,
    gitBranch: update.git?.branch ?? null,
  });
  const gitLabel =
    update.installKind === "git"
      ? formatGitStatusLine({
          branch: update.git?.branch ?? null,
          tag: update.git?.tag ?? null,
          sha: update.git?.sha ?? null,
        })
      : null;
  const updateAvailability = resolveUpdateAvailability(update);
  const updateLine = formatUpdateOneLiner(update).replace(/^Update:\s*/i, "");

  if (opts.json) {
    defaultRuntime.log(
      JSON.stringify(
        {
          update,
          channel: {
            value: channelInfo.channel,
            source: channelInfo.source,
            label: channelLabel,
            config: configChannel,
          },
          availability: updateAvailability,
        },
        null,
        2,
      ),
    );
    return;
  }

  const tableWidth = Math.max(60, (process.stdout.columns ?? 120) - 1);
  const installLabel =
    update.installKind === "git"
      ? `git (${update.root ?? "unknown"})`
      : update.installKind === "package"
        ? update.packageManager
        : "unknown";
  const rows = [
    { Item: "安装", Value: installLabel },
    { Item: "渠道", Value: channelLabel },
    ...(gitLabel ? [{ Item: "Git", Value: gitLabel }] : []),
    {
      Item: "更新",
      Value: updateAvailability.available ? theme.warn(`可用 · ${updateLine}`) : updateLine,
    },
  ];

  defaultRuntime.log(theme.heading("OpenClaw 更新状态"));
  defaultRuntime.log("");
  defaultRuntime.log(
    renderTable({
      width: tableWidth,
      columns: [
        { key: "Item", header: "项目", minWidth: 10 },
        { key: "Value", header: "值", flex: true, minWidth: 24 },
      ],
      rows,
    }).trimEnd(),
  );
  defaultRuntime.log("");
  const updateHint = formatUpdateAvailableHint(update);
  if (updateHint) {
    defaultRuntime.log(theme.warn(updateHint));
  }
}

function getStepLabel(step: UpdateStepInfo): string {
  return STEP_LABELS[step.name] ?? step.name;
}

type ProgressController = {
  progress: UpdateStepProgress;
  stop: () => void;
};

function createUpdateProgress(enabled: boolean): ProgressController {
  if (!enabled) {
    return {
      progress: {},
      stop: () => {},
    };
  }

  let currentSpinner: ReturnType<typeof spinner> | null = null;

  const progress: UpdateStepProgress = {
    onStepStart: (step) => {
      currentSpinner = spinner();
      currentSpinner.start(theme.accent(getStepLabel(step)));
    },
    onStepComplete: (step) => {
      if (!currentSpinner) {
        return;
      }

      const label = getStepLabel(step);
      const duration = theme.muted(`(${formatDuration(step.durationMs)})`);
      const icon = step.exitCode === 0 ? theme.success("\u2713") : theme.error("\u2717");

      currentSpinner.stop(`${icon} ${label} ${duration}`);
      currentSpinner = null;

      if (step.exitCode !== 0 && step.stderrTail) {
        const lines = step.stderrTail.split("\n").slice(-10);
        for (const line of lines) {
          if (line.trim()) {
            defaultRuntime.log(`    ${theme.error(line)}`);
          }
        }
      }
    },
  };

  return {
    progress,
    stop: () => {
      if (currentSpinner) {
        currentSpinner.stop();
        currentSpinner = null;
      }
    },
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

function formatStepStatus(exitCode: number | null): string {
  if (exitCode === 0) {
    return theme.success("\u2713");
  }
  if (exitCode === null) {
    return theme.warn("?");
  }
  return theme.error("\u2717");
}

const selectStyled = <T>(params: Parameters<typeof select<T>>[0]) =>
  select({
    ...params,
    message: stylePromptMessage(params.message),
    options: params.options.map((opt) =>
      opt.hint === undefined ? opt : { ...opt, hint: stylePromptHint(opt.hint) },
    ),
  });

type PrintResultOptions = UpdateCommandOptions & {
  hideSteps?: boolean;
};

function printResult(result: UpdateRunResult, opts: PrintResultOptions) {
  if (opts.json) {
    defaultRuntime.log(JSON.stringify(result, null, 2));
    return;
  }

  const statusColor =
    result.status === "ok" ? theme.success : result.status === "skipped" ? theme.warn : theme.error;

  defaultRuntime.log("");
  defaultRuntime.log(`${theme.heading("更新结果：")} ${statusColor(result.status.toUpperCase())}`);
  if (result.root) {
    defaultRuntime.log(`  Root: ${theme.muted(result.root)}`);
  }
  if (result.reason) {
    defaultRuntime.log(`  Reason: ${theme.muted(result.reason)}`);
  }

  if (result.before?.version || result.before?.sha) {
    const before = result.before.version ?? result.before.sha?.slice(0, 8) ?? "";
    defaultRuntime.log(`  Before: ${theme.muted(before)}`);
  }
  if (result.after?.version || result.after?.sha) {
    const after = result.after.version ?? result.after.sha?.slice(0, 8) ?? "";
    defaultRuntime.log(`  After: ${theme.muted(after)}`);
  }

  if (!opts.hideSteps && result.steps.length > 0) {
    defaultRuntime.log("");
    defaultRuntime.log(theme.heading("步骤："));
    for (const step of result.steps) {
      const status = formatStepStatus(step.exitCode);
      const duration = theme.muted(`(${formatDuration(step.durationMs)})`);
      defaultRuntime.log(`  ${status} ${step.name} ${duration}`);

      if (step.exitCode !== 0 && step.stderrTail) {
        const lines = step.stderrTail.split("\n").slice(0, 5);
        for (const line of lines) {
          if (line.trim()) {
            defaultRuntime.log(`      ${theme.error(line)}`);
          }
        }
      }
    }
  }

  defaultRuntime.log("");
  defaultRuntime.log(`总耗时：${theme.muted(formatDuration(result.durationMs))}`);
}

export async function updateCommand(opts: UpdateCommandOptions): Promise<void> {
  process.noDeprecation = true;
  process.env.NODE_NO_WARNINGS = "1";
  const timeoutMs = opts.timeout ? Number.parseInt(opts.timeout, 10) * 1000 : undefined;
  const shouldRestart = opts.restart !== false;

  if (timeoutMs !== undefined && (Number.isNaN(timeoutMs) || timeoutMs <= 0)) {
    defaultRuntime.error("--timeout 必须是正整数（秒）");
    defaultRuntime.exit(1);
    return;
  }

  const root =
    (await resolveOpenClawPackageRoot({
      moduleUrl: import.meta.url,
      argv1: process.argv[1],
      cwd: process.cwd(),
    })) ?? process.cwd();

  const updateStatus = await checkUpdateStatus({
    root,
    timeoutMs: timeoutMs ?? 3500,
    fetchGit: false,
    includeRegistry: false,
  });

  const configSnapshot = await readConfigFileSnapshot();
  let activeConfig = configSnapshot.valid ? configSnapshot.config : null;
  const storedChannel = configSnapshot.valid
    ? normalizeUpdateChannel(configSnapshot.config.update?.channel)
    : null;

  const requestedChannel = normalizeUpdateChannel(opts.channel);
  if (opts.channel && !requestedChannel) {
    defaultRuntime.error(`--channel 必须是 "stable"、"beta" 或 "dev"（得到 "${opts.channel}"）`);
    defaultRuntime.exit(1);
    return;
  }
  if (opts.channel && !configSnapshot.valid) {
    const issues = configSnapshot.issues.map((issue) => `- ${issue.path}: ${issue.message}`);
    defaultRuntime.error(["配置无效；无法设置更新渠道。", ...issues].join("\n"));
    defaultRuntime.exit(1);
    return;
  }

  const installKind = updateStatus.installKind;
  const switchToGit = requestedChannel === "dev" && installKind !== "git";
  const switchToPackage =
    requestedChannel !== null && requestedChannel !== "dev" && installKind === "git";
  const updateInstallKind = switchToGit ? "git" : switchToPackage ? "package" : installKind;
  const defaultChannel =
    updateInstallKind === "git" ? DEFAULT_GIT_CHANNEL : DEFAULT_PACKAGE_CHANNEL;
  const channel = requestedChannel ?? storedChannel ?? defaultChannel;
  const explicitTag = normalizeTag(opts.tag);
  let tag = explicitTag ?? channelToNpmTag(channel);
  if (updateInstallKind !== "git") {
    const currentVersion = switchToPackage ? null : await readPackageVersion(root);
    let fallbackToLatest = false;
    const targetVersion = explicitTag
      ? await resolveTargetVersion(tag, timeoutMs)
      : await resolveNpmChannelTag({ channel, timeoutMs }).then((resolved) => {
          tag = resolved.tag;
          fallbackToLatest = channel === "beta" && resolved.tag === "latest";
          return resolved.version;
        });
    const cmp =
      currentVersion && targetVersion ? compareSemverStrings(currentVersion, targetVersion) : null;
    const needsConfirm =
      !fallbackToLatest &&
      currentVersion != null &&
      (targetVersion == null || (cmp != null && cmp > 0));

    if (needsConfirm && !opts.yes) {
      if (!process.stdin.isTTY || opts.json) {
        defaultRuntime.error(
          ["降级需要确认。", "降级可能会破坏配置。在 TTY 中重新运行以确认。"].join("\n"),
        );
        defaultRuntime.exit(1);
        return;
      }

      const targetLabel = targetVersion ?? `${tag}（未知）`;
      const message = `从 ${currentVersion} 降级到 ${targetLabel} 可能会破坏配置。继续吗？`;
      const ok = await confirm({
        message: stylePromptMessage(message),
        initialValue: false,
      });
      if (isCancel(ok) || !ok) {
        if (!opts.json) {
          defaultRuntime.log(theme.muted("更新已取消。"));
        }
        defaultRuntime.exit(0);
        return;
      }
    }
  } else if (opts.tag && !opts.json) {
    defaultRuntime.log(theme.muted("注意：--tag 仅适用于 npm 安装；git 更新会忽略它。"));
  }

  if (requestedChannel && configSnapshot.valid) {
    const next = {
      ...configSnapshot.config,
      update: {
        ...configSnapshot.config.update,
        channel: requestedChannel,
      },
    };
    await writeConfigFile(next);
    activeConfig = next;
    if (!opts.json) {
      defaultRuntime.log(theme.muted(`更新渠道已设置为 ${requestedChannel}。`));
    }
  }

  const showProgress = !opts.json && process.stdout.isTTY;

  if (!opts.json) {
    defaultRuntime.log(theme.heading("正在更新 OpenClaw..."));
    defaultRuntime.log("");
  }

  const { progress, stop } = createUpdateProgress(showProgress);

  const startedAt = Date.now();
  let result: UpdateRunResult;

  if (switchToPackage) {
    const manager = await resolveGlobalManager({
      root,
      installKind,
      timeoutMs: timeoutMs ?? 20 * 60_000,
    });
    const runCommand = async (argv: string[], options: { timeoutMs: number }) => {
      const res = await runCommandWithTimeout(argv, options);
      return { stdout: res.stdout, stderr: res.stderr, code: res.code };
    };
    const pkgRoot = await resolveGlobalPackageRoot(manager, runCommand, timeoutMs ?? 20 * 60_000);
    const packageName =
      (pkgRoot ? await readPackageName(pkgRoot) : await readPackageName(root)) ??
      DEFAULT_PACKAGE_NAME;
    const beforeVersion = pkgRoot ? await readPackageVersion(pkgRoot) : null;
    const updateStep = await runUpdateStep({
      name: "global update",
      argv: globalInstallArgs(manager, `${packageName}@${tag}`),
      timeoutMs: timeoutMs ?? 20 * 60_000,
      progress,
    });
    const steps = [updateStep];
    let afterVersion = beforeVersion;
    if (pkgRoot) {
      afterVersion = await readPackageVersion(pkgRoot);
      const entryPath = path.join(pkgRoot, "dist", "entry.js");
      if (await pathExists(entryPath)) {
        const doctorStep = await runUpdateStep({
          name: `${CLI_NAME} doctor`,
          argv: [resolveNodeRunner(), entryPath, "doctor", "--non-interactive"],
          timeoutMs: timeoutMs ?? 20 * 60_000,
          progress,
        });
        steps.push(doctorStep);
      }
    }
    const failedStep = steps.find((step) => step.exitCode !== 0);
    result = {
      status: failedStep ? "error" : "ok",
      mode: manager,
      root: pkgRoot ?? root,
      reason: failedStep ? failedStep.name : undefined,
      before: { version: beforeVersion },
      after: { version: afterVersion },
      steps,
      durationMs: Date.now() - startedAt,
    };
  } else {
    const updateRoot = switchToGit ? resolveGitInstallDir() : root;
    const cloneStep = switchToGit
      ? await ensureGitCheckout({
          dir: updateRoot,
          timeoutMs: timeoutMs ?? 20 * 60_000,
          progress,
        })
      : null;
    if (cloneStep && cloneStep.exitCode !== 0) {
      result = {
        status: "error",
        mode: "git",
        root: updateRoot,
        reason: cloneStep.name,
        steps: [cloneStep],
        durationMs: Date.now() - startedAt,
      };
      stop();
      printResult(result, { ...opts, hideSteps: showProgress });
      defaultRuntime.exit(1);
      return;
    }
    const updateResult = await runGatewayUpdate({
      cwd: updateRoot,
      argv1: switchToGit ? undefined : process.argv[1],
      timeoutMs,
      progress,
      channel,
      tag,
    });
    const steps = [...(cloneStep ? [cloneStep] : []), ...updateResult.steps];
    if (switchToGit && updateResult.status === "ok") {
      const manager = await resolveGlobalManager({
        root,
        installKind,
        timeoutMs: timeoutMs ?? 20 * 60_000,
      });
      const installStep = await runUpdateStep({
        name: "global install",
        argv: globalInstallArgs(manager, updateRoot),
        cwd: updateRoot,
        timeoutMs: timeoutMs ?? 20 * 60_000,
        progress,
      });
      steps.push(installStep);
      const failedStep = [installStep].find((step) => step.exitCode !== 0);
      result = {
        ...updateResult,
        status: updateResult.status === "ok" && !failedStep ? "ok" : "error",
        steps,
        durationMs: Date.now() - startedAt,
      };
    } else {
      result = {
        ...updateResult,
        steps,
        durationMs: Date.now() - startedAt,
      };
    }
  }

  stop();

  printResult(result, { ...opts, hideSteps: showProgress });

  if (result.status === "error") {
    defaultRuntime.exit(1);
    return;
  }

  if (result.status === "skipped") {
    if (result.reason === "dirty") {
      defaultRuntime.log(theme.warn("已跳过：工作目录有未提交的更改。请先提交或暂存它们。"));
    }
    if (result.reason === "not-git-install") {
      defaultRuntime.log(
        theme.warn(
          `已跳过：此 OpenClaw 安装不是 git 检出，且无法检测包管理器。通过包管理器更新，然后运行 \`${replaceCliName(formatCliCommand("openclaw doctor"), CLI_NAME)}\` 和 \`${replaceCliName(formatCliCommand("openclaw gateway restart"), CLI_NAME)}\`。`,
        ),
      );
      defaultRuntime.log(
        theme.muted(
          `示例：\`${replaceCliName("npm i -g openclaw@latest", CLI_NAME)}\` 或 \`${replaceCliName("pnpm add -g openclaw@latest", CLI_NAME)}\``,
        ),
      );
    }
    defaultRuntime.exit(0);
    return;
  }

  if (activeConfig) {
    const pluginLogger = opts.json
      ? {}
      : {
          info: (msg: string) => defaultRuntime.log(msg),
          warn: (msg: string) => defaultRuntime.log(theme.warn(msg)),
          error: (msg: string) => defaultRuntime.log(theme.error(msg)),
        };

    if (!opts.json) {
      defaultRuntime.log("");
      defaultRuntime.log(theme.heading("正在更新插件..."));
    }

    const syncResult = await syncPluginsForUpdateChannel({
      config: activeConfig,
      channel,
      workspaceDir: root,
      logger: pluginLogger,
    });
    let pluginConfig = syncResult.config;

    const npmResult = await updateNpmInstalledPlugins({
      config: pluginConfig,
      skipIds: new Set(syncResult.summary.switchedToNpm),
      logger: pluginLogger,
    });
    pluginConfig = npmResult.config;

    if (syncResult.changed || npmResult.changed) {
      await writeConfigFile(pluginConfig);
    }

    if (!opts.json) {
      const summarizeList = (list: string[]) => {
        if (list.length <= 6) {
          return list.join("、");
        }
        return `${list.slice(0, 6).join("、")} +${list.length - 6} 更多`;
      };

      if (syncResult.summary.switchedToBundled.length > 0) {
        defaultRuntime.log(
          theme.muted(`已切换到内置插件：${summarizeList(syncResult.summary.switchedToBundled)}。`),
        );
      }
      if (syncResult.summary.switchedToNpm.length > 0) {
        defaultRuntime.log(
          theme.muted(`已恢复 npm 插件：${summarizeList(syncResult.summary.switchedToNpm)}。`),
        );
      }
      for (const warning of syncResult.summary.warnings) {
        defaultRuntime.log(theme.warn(warning));
      }
      for (const error of syncResult.summary.errors) {
        defaultRuntime.log(theme.error(error));
      }

      const updated = npmResult.outcomes.filter((entry) => entry.status === "updated").length;
      const unchanged = npmResult.outcomes.filter((entry) => entry.status === "unchanged").length;
      const failed = npmResult.outcomes.filter((entry) => entry.status === "error").length;
      const skipped = npmResult.outcomes.filter((entry) => entry.status === "skipped").length;

      if (npmResult.outcomes.length === 0) {
        defaultRuntime.log(theme.muted("无需更新插件。"));
      } else {
        const parts = [`${updated} 已更新`, `${unchanged} 未更改`];
        if (failed > 0) {
          parts.push(`${failed} 失败`);
        }
        if (skipped > 0) {
          parts.push(`${skipped} 跳过`);
        }
        defaultRuntime.log(theme.muted(`npm 插件：${parts.join("、")}。`));
      }

      for (const outcome of npmResult.outcomes) {
        if (outcome.status !== "error") {
          continue;
        }
        defaultRuntime.log(theme.error(outcome.message));
      }
    }
  } else if (!opts.json) {
    defaultRuntime.log(theme.warn("跳过插件更新：配置无效。"));
  }

  // Restart service if requested
  if (shouldRestart) {
    if (!opts.json) {
      defaultRuntime.log("");
      defaultRuntime.log(theme.heading("正在重启服务..."));
    }
    try {
      const { runDaemonRestart } = await import("./daemon-cli.js");
      const restarted = await runDaemonRestart();
      if (!opts.json && restarted) {
        defaultRuntime.log(theme.success("服务重启成功。"));
        defaultRuntime.log("");
        process.env.OPENCLAW_UPDATE_IN_PROGRESS = "1";
        try {
          const { doctorCommand } = await import("../commands/doctor.js");
          const interactiveDoctor = Boolean(process.stdin.isTTY) && !opts.json && opts.yes !== true;
          await doctorCommand(defaultRuntime, {
            nonInteractive: !interactiveDoctor,
          });
        } catch (err) {
          defaultRuntime.log(theme.warn(`检查失败：${String(err)}`));
        } finally {
          delete process.env.OPENCLAW_UPDATE_IN_PROGRESS;
        }
      }
    } catch (err) {
      if (!opts.json) {
        defaultRuntime.log(theme.warn(`服务重启失败：${String(err)}`));
        defaultRuntime.log(
          theme.muted(
            `您可能需要手动重启服务：${replaceCliName(formatCliCommand("openclaw gateway restart"), CLI_NAME)}`,
          ),
        );
      }
    }
  } else if (!opts.json) {
    defaultRuntime.log("");
    if (result.mode === "npm" || result.mode === "pnpm") {
      defaultRuntime.log(
        theme.muted(
          `提示：运行 \`${replaceCliName(formatCliCommand("openclaw doctor"), CLI_NAME)}\`，然后运行 \`${replaceCliName(formatCliCommand("openclaw gateway restart"), CLI_NAME)}\` 以将更新应用到运行中的网关。`,
        ),
      );
    } else {
      defaultRuntime.log(
        theme.muted(
          `提示：运行 \`${replaceCliName(formatCliCommand("openclaw gateway restart"), CLI_NAME)}\` 以将更新应用到运行中的网关。`,
        ),
      );
    }
  }

  if (!opts.json) {
    defaultRuntime.log(theme.muted(pickUpdateQuip()));
  }
}

export async function updateWizardCommand(opts: UpdateWizardOptions = {}): Promise<void> {
  if (!process.stdin.isTTY) {
    defaultRuntime.error(
      "更新向导需要 TTY。请改用 `openclaw update --channel <stable|beta|dev>`。",
    );
    defaultRuntime.exit(1);
    return;
  }

  const timeoutMs = opts.timeout ? Number.parseInt(opts.timeout, 10) * 1000 : undefined;
  if (timeoutMs !== undefined && (Number.isNaN(timeoutMs) || timeoutMs <= 0)) {
    defaultRuntime.error("--timeout 必须是正整数（秒）");
    defaultRuntime.exit(1);
    return;
  }

  const root =
    (await resolveOpenClawPackageRoot({
      moduleUrl: import.meta.url,
      argv1: process.argv[1],
      cwd: process.cwd(),
    })) ?? process.cwd();

  const [updateStatus, configSnapshot] = await Promise.all([
    checkUpdateStatus({
      root,
      timeoutMs: timeoutMs ?? 3500,
      fetchGit: false,
      includeRegistry: false,
    }),
    readConfigFileSnapshot(),
  ]);

  const configChannel = configSnapshot.valid
    ? normalizeUpdateChannel(configSnapshot.config.update?.channel)
    : null;
  const channelInfo = resolveEffectiveUpdateChannel({
    configChannel,
    installKind: updateStatus.installKind,
    git: updateStatus.git
      ? { tag: updateStatus.git.tag, branch: updateStatus.git.branch }
      : undefined,
  });
  const channelLabel = formatUpdateChannelLabel({
    channel: channelInfo.channel,
    source: channelInfo.source,
    gitTag: updateStatus.git?.tag ?? null,
    gitBranch: updateStatus.git?.branch ?? null,
  });

  const pickedChannel = await selectStyled({
    message: "更新渠道",
    options: [
      {
        value: "keep",
        label: `保持当前（${channelInfo.channel}）`,
        hint: channelLabel,
      },
      {
        value: "stable",
        label: "稳定版",
        hint: "标签发布（npm latest）",
      },
      {
        value: "beta",
        label: "测试版",
        hint: "预发布版本（npm beta）",
      },
      {
        value: "dev",
        label: "开发版",
        hint: "Git main",
      },
    ],
    initialValue: "keep",
  });

  if (isCancel(pickedChannel)) {
    defaultRuntime.log(theme.muted("更新已取消。"));
    defaultRuntime.exit(0);
    return;
  }

  const requestedChannel = pickedChannel === "keep" ? null : pickedChannel;

  if (requestedChannel === "dev" && updateStatus.installKind !== "git") {
    const gitDir = resolveGitInstallDir();
    const hasGit = await isGitCheckout(gitDir);
    if (!hasGit) {
      const dirExists = await pathExists(gitDir);
      if (dirExists) {
        const empty = await isEmptyDir(gitDir);
        if (!empty) {
          defaultRuntime.error(
            `OPENCLAW_GIT_DIR 指向非 git 目录：${gitDir}。将 OPENCLAW_GIT_DIR 设置为空文件夹或 openclaw 检出目录。`,
          );
          defaultRuntime.exit(1);
          return;
        }
      }
      const ok = await confirm({
        message: stylePromptMessage(`在 ${gitDir} 创建 git 检出？（通过 OPENCLAW_GIT_DIR 覆盖）`),
        initialValue: true,
      });
      if (isCancel(ok) || !ok) {
        defaultRuntime.log(theme.muted("更新已取消。"));
        defaultRuntime.exit(0);
        return;
      }
    }
  }

  const restart = await confirm({
    message: stylePromptMessage("更新后重启网关服务？"),
    initialValue: true,
  });
  if (isCancel(restart)) {
    defaultRuntime.log(theme.muted("更新已取消。"));
    defaultRuntime.exit(0);
    return;
  }

  try {
    await updateCommand({
      channel: requestedChannel ?? undefined,
      restart: Boolean(restart),
      timeout: opts.timeout,
    });
  } catch (err) {
    defaultRuntime.error(String(err));
    defaultRuntime.exit(1);
  }
}

export function registerUpdateCli(program: Command) {
  const update = program
    .command("update")
    .description("将 OpenClaw 更新到最新版本")
    .option("--json", "以 JSON 格式输出结果", false)
    .option("--no-restart", "成功更新后跳过重启网关服务")
    .option("--channel <stable|beta|dev>", "持久化更新渠道（git + npm）")
    .option("--tag <dist-tag|version>", "覆盖此次更新的 npm 分发标签或版本")
    .option("--timeout <seconds>", "每个更新步骤的超时时间（秒，默认：1200）")
    .option("--yes", "跳过确认提示（非交互模式）", false)
    .addHelpText("after", () => {
      const examples = [
        ["openclaw update", "更新源码检出版本（git）"],
        ["openclaw update --channel beta", "切换到 beta 渠道（git + npm）"],
        ["openclaw update --channel dev", "切换到 dev 渠道（git + npm）"],
        ["openclaw update --tag beta", "一次性更新到指定分发标签或版本"],
        ["openclaw update --no-restart", "更新但不重启服务"],
        ["openclaw update --json", "以 JSON 格式输出结果"],
        ["openclaw update --yes", "非交互模式（接受降级提示）"],
        ["openclaw update wizard", "交互式更新向导"],
        ["openclaw --update", "等同于 openclaw update"],
      ] as const;
      const fmtExamples = examples
        .map(([cmd, desc]) => `  ${theme.command(cmd)} ${theme.muted(`# ${desc}`)}`)
        .join("\n");
      return `
${theme.heading("执行内容：")}
  - Git 检出版本：获取最新代码、变基、安装依赖、构建并运行检查
  - npm 安装版本：通过检测到的包管理器更新

${theme.heading("切换渠道：")}
  - 使用 --channel stable|beta|dev 将更新渠道持久化到配置
  - 运行 openclaw update status 查看当前渠道和来源
  - 使用 --tag <dist-tag|version> 进行一次性 npm 更新而不持久化

${theme.heading("非交互模式：")}
  - 使用 --yes 接受降级提示
  - 根据需要与 --channel/--tag/--restart/--json/--timeout 组合使用

${theme.heading("示例：")}
${fmtExamples}

${theme.heading("注意事项：")}
  - 使用 --channel stable|beta|dev 切换渠道
  - 全局安装版本：尽可能通过检测到的包管理器自动更新（参见 docs/install/updating.md）
  - 降级需要确认（可能会破坏配置）
  - 如果工作目录有未提交的更改，则跳过更新

${theme.muted("文档：")} ${formatDocsLink("/cli/update", "docs.openclaw.ai/cli/update")}`;
    })
    .action(async (opts) => {
      try {
        await updateCommand({
          json: Boolean(opts.json),
          restart: Boolean(opts.restart),
          channel: opts.channel as string | undefined,
          tag: opts.tag as string | undefined,
          timeout: opts.timeout as string | undefined,
          yes: Boolean(opts.yes),
        });
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  update
    .command("wizard")
    .description("交互式更新向导")
    .option("--timeout <seconds>", "每个更新步骤的超时时间（秒，默认：1200）")
    .addHelpText(
      "after",
      `\n${theme.muted("文档：")} ${formatDocsLink("/cli/update", "docs.openclaw.ai/cli/update")}\n`,
    )
    .action(async (opts) => {
      try {
        await updateWizardCommand({
          timeout: opts.timeout as string | undefined,
        });
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  update
    .command("status")
    .description("显示更新渠道和版本状态")
    .option("--json", "以 JSON 格式输出结果", false)
    .option("--timeout <seconds>", "更新检查的超时时间（秒，默认：3）")
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("示例：")}\n${formatHelpExamples([
          ["openclaw update status", "显示渠道和版本状态。"],
          ["openclaw update status --json", "JSON 格式输出。"],
          ["openclaw update status --timeout 10", "自定义超时时间。"],
        ])}\n\n${theme.heading("注意事项：")}\n${theme.muted(
          "- 显示当前更新渠道（stable/beta/dev）和来源",
        )}\n${theme.muted("- 包含源码检出的 git 标签/分支/SHA")}\n\n${theme.muted(
          "文档：",
        )} ${formatDocsLink("/cli/update", "docs.openclaw.ai/cli/update")}`,
    )
    .action(async (opts) => {
      try {
        await updateStatusCommand({
          json: Boolean(opts.json),
          timeout: opts.timeout as string | undefined,
        });
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });
}
