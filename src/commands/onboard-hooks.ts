import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { formatCliCommand } from "../cli/command-format.js";
import { buildWorkspaceHookStatus } from "../hooks/hooks-status.js";

export async function setupInternalHooks(
  cfg: OpenClawConfig,
  runtime: RuntimeEnv,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  await prompter.note(
    [
      "Hooks let you automate actions when agent commands are issued.".replace(
        "Hooks let you automate actions when agent commands are issued.",
        "Hook 让您在发出代理命令时自动执行操作。",
      ),
      "Example: Save session context to memory when you issue /new.".replace(
        "Example: Save session context to memory when you issue /new.",
        "例如：在发出 /new 时将会话上下文保存到内存。",
      ),
      "",
      "Learn more: https://docs.openclaw.ai/hooks".replace("Learn more:", "了解更多："),
    ].join("\n"),
    "Hooks".replace("Hooks", "Hook"),
  );

  // Discover available hooks using the hook discovery system
  const workspaceDir = resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg));
  const report = buildWorkspaceHookStatus(workspaceDir, { config: cfg });

  // Show every eligible hook so users can opt in during onboarding.
  const eligibleHooks = report.hooks.filter((h) => h.eligible);

  if (eligibleHooks.length === 0) {
    await prompter.note(
      "No eligible hooks found. You can configure hooks later in your config.".replace(
        "No eligible hooks found. You can configure hooks later in your config.",
        "未找到符合条件的 Hook。您可以稍后在配置文件中配置 Hook。",
      ),
      "No Hooks Available".replace("No Hooks Available", "没有可用的 Hook"),
    );
    return cfg;
  }

  const toEnable = await prompter.multiselect({
    message: "Enable hooks?".replace("Enable hooks?", "启用 Hook？"),
    options: [
      { value: "__skip__", label: "Skip for now".replace("Skip for now", "跳过") },
      ...eligibleHooks.map((hook) => ({
        value: hook.name,
        label: `${hook.emoji ?? "🔗"} ${hook.name}`,
        hint: hook.description,
      })),
    ],
  });

  const selected = toEnable.filter((name) => name !== "__skip__");
  if (selected.length === 0) {
    return cfg;
  }

  // Enable selected hooks using the new entries config format
  const entries = { ...cfg.hooks?.internal?.entries };
  for (const name of selected) {
    entries[name] = { enabled: true };
  }

  const next: OpenClawConfig = {
    ...cfg,
    hooks: {
      ...cfg.hooks,
      internal: {
        enabled: true,
        entries,
      },
    },
  };

  await prompter.note(
    [
      `Enabled ${selected.length} hook${selected.length > 1 ? "s" : ""}: ${selected.join(", ")}`.replace(
        "Enabled",
        "已启用",
      ),
      "",
      "You can manage hooks later with:".replace(
        "You can manage hooks later with:",
        "您可以稍后使用以下命令管理 Hook：",
      ),
      `  ${formatCliCommand("openclaw hooks list")}`,
      `  ${formatCliCommand("openclaw hooks enable <name>")}`,
      `  ${formatCliCommand("openclaw hooks disable <name>")}`,
    ].join("\n"),
    "Hooks Configured".replace("Hooks Configured", "Hook 已配置"),
  );

  return next;
}
