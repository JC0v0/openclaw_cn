import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import { installSkill } from "../agents/skills-install.js";
import { buildWorkspaceSkillStatus } from "../agents/skills-status.js";
import { formatCliCommand } from "../cli/command-format.js";
import { detectBinary, resolveNodeManagerOptions } from "./onboard-helpers.js";

function summarizeInstallFailure(message: string): string | undefined {
  const cleaned = message.replace(/^Install failed(?:\s*\([^)]*\))?\s*:?\s*/i, "").trim();
  if (!cleaned) {
    return undefined;
  }
  const maxLen = 140;
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 1)}…` : cleaned;
}

function formatSkillHint(skill: {
  description?: string;
  install: Array<{ label: string }>;
}): string {
  const desc = skill.description?.trim();
  const installLabel = skill.install[0]?.label?.trim();
  const combined = desc && installLabel ? `${desc} — ${installLabel}` : desc || installLabel;
  if (!combined) {
    return "install";
  }
  const maxLen = 90;
  return combined.length > maxLen ? `${combined.slice(0, maxLen - 1)}…` : combined;
}

function upsertSkillEntry(
  cfg: OpenClawConfig,
  skillKey: string,
  patch: { apiKey?: string },
): OpenClawConfig {
  const entries = { ...cfg.skills?.entries };
  const existing = (entries[skillKey] as { apiKey?: string } | undefined) ?? {};
  entries[skillKey] = { ...existing, ...patch };
  return {
    ...cfg,
    skills: {
      ...cfg.skills,
      entries,
    },
  };
}

export async function setupSkills(
  cfg: OpenClawConfig,
  workspaceDir: string,
  runtime: RuntimeEnv,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  const report = buildWorkspaceSkillStatus(workspaceDir, { config: cfg });
  const eligible = report.skills.filter((s) => s.eligible);
  const missing = report.skills.filter((s) => !s.eligible && !s.disabled && !s.blockedByAllowlist);
  const blocked = report.skills.filter((s) => s.blockedByAllowlist);

  const needsBrewPrompt =
    process.platform !== "win32" &&
    report.skills.some((skill) => skill.install.some((option) => option.kind === "brew")) &&
    !(await detectBinary("brew"));

  await prompter.note(
    [
      `Eligible: ${eligible.length}`.replace("Eligible:", "符合条件："),
      `Missing requirements: ${missing.length}`.replace("Missing requirements:", "缺少依赖："),
      `Blocked by allowlist: ${blocked.length}`.replace(
        "Blocked by allowlist:",
        "被允许列表阻止：",
      ),
    ].join("\n"),
    "Skills status".replace("Skills status", "技能状态"),
  );

  const shouldConfigure = await prompter.confirm({
    message: "Configure skills now? (recommended)".replace(
      "Configure skills now? (recommended)",
      "现在配置技能？（推荐）",
    ),
    initialValue: true,
  });
  if (!shouldConfigure) {
    return cfg;
  }

  if (needsBrewPrompt) {
    await prompter.note(
      [
        "Many skill dependencies are shipped via Homebrew.".replace(
          "Many skill dependencies are shipped via Homebrew.",
          "许多技能依赖项通过 Homebrew 提供。",
        ),
        "Without brew, you'll need to build from source or download releases manually.".replace(
          "Without brew, you'll need to build from source or download releases manually.",
          "没有 brew，您需要从源代码构建或手动下载发布版本。",
        ),
      ].join("\n"),
      "Homebrew recommended".replace("Homebrew recommended", "推荐安装 Homebrew"),
    );
    const showBrewInstall = await prompter.confirm({
      message: "Show Homebrew install command?".replace(
        "Show Homebrew install command?",
        "显示 Homebrew 安装命令？",
      ),
      initialValue: true,
    });
    if (showBrewInstall) {
      await prompter.note(
        [
          "Run:".replace("Run:", "运行："),
          '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
        ].join("\n"),
        "Homebrew install".replace("Homebrew install", "Homebrew 安装"),
      );
    }
  }

  const nodeManager = (await prompter.select({
    message: "Preferred node manager for skill installs".replace(
      "Preferred node manager for skill installs",
      "技能安装的首选 Node 包管理器",
    ),
    options: resolveNodeManagerOptions(),
  })) as "npm" | "pnpm" | "bun";

  let next: OpenClawConfig = {
    ...cfg,
    skills: {
      ...cfg.skills,
      install: {
        ...cfg.skills?.install,
        nodeManager,
      },
    },
  };

  const installable = missing.filter(
    (skill) => skill.install.length > 0 && skill.missing.bins.length > 0,
  );
  if (installable.length > 0) {
    const toInstall = await prompter.multiselect({
      message: "Install missing skill dependencies".replace(
        "Install missing skill dependencies",
        "安装缺少的技能依赖",
      ),
      options: [
        {
          value: "__skip__",
          label: "Skip for now".replace("Skip for now", "跳过"),
          hint: "Continue without installing dependencies".replace(
            "Continue without installing dependencies",
            "继续而不安装依赖",
          ),
        },
        ...installable.map((skill) => ({
          value: skill.name,
          label: `${skill.emoji ?? "🧩"} ${skill.name}`,
          hint: formatSkillHint(skill),
        })),
      ],
    });

    const selected = toInstall.filter((name) => name !== "__skip__");
    for (const name of selected) {
      const target = installable.find((s) => s.name === name);
      if (!target || target.install.length === 0) {
        continue;
      }
      const installId = target.install[0]?.id;
      if (!installId) {
        continue;
      }
      const spin = prompter.progress(`Installing ${name}…`.replace("Installing", "正在安装"));
      const result = await installSkill({
        workspaceDir,
        skillName: target.name,
        installId,
        config: next,
      });
      if (result.ok) {
        spin.stop(`Installed ${name}`.replace("Installed", "已安装"));
      } else {
        const code = result.code == null ? "" : ` (exit ${result.code})`;
        const detail = summarizeInstallFailure(result.message);
        spin.stop(
          `Install failed: ${name}${code}${detail ? ` — ${detail}` : ""}`.replace(
            "Install failed:",
            "安装失败：",
          ),
        );
        if (result.stderr) {
          runtime.log(result.stderr.trim());
        } else if (result.stdout) {
          runtime.log(result.stdout.trim());
        }
        runtime.log(
          `Tip: run \`${formatCliCommand("openclaw doctor")}\` to review skills + requirements.`.replace(
            "Tip: run",
            "提示：运行",
          ),
        );
        runtime.log("Docs: https://docs.openclaw.ai/skills".replace("Docs:", "文档："));
      }
    }
  }

  for (const skill of missing) {
    if (!skill.primaryEnv || skill.missing.env.length === 0) {
      continue;
    }
    const wantsKey = await prompter.confirm({
      message: `Set ${skill.primaryEnv} for ${skill.name}?`
        .replace("Set", "设置")
        .replace("for", "用于"),
      initialValue: false,
    });
    if (!wantsKey) {
      continue;
    }
    const apiKey = String(
      await prompter.text({
        message: `Enter ${skill.primaryEnv}`.replace("Enter", "输入"),
        validate: (value) => (value?.trim() ? undefined : "Required".replace("Required", "必填")),
      }),
    );
    next = upsertSkillEntry(next, skill.skillKey, { apiKey: apiKey.trim() });
  }

  return next;
}
