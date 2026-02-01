import fs from "node:fs/promises";
import path from "node:path";
import type { OnboardOptions } from "../commands/onboard-types.js";
import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { GatewayWizardSettings, WizardFlow } from "./onboarding.types.js";
import type { WizardPrompter } from "./prompts.js";
import { DEFAULT_BOOTSTRAP_FILENAME } from "../agents/workspace.js";
import { formatCliCommand } from "../cli/command-format.js";
import {
  buildGatewayInstallPlan,
  gatewayInstallErrorHint,
} from "../commands/daemon-install-helpers.js";
import {
  DEFAULT_GATEWAY_DAEMON_RUNTIME,
  GATEWAY_DAEMON_RUNTIME_OPTIONS,
} from "../commands/daemon-runtime.js";
import { formatHealthCheckFailure } from "../commands/health-format.js";
import { healthCommand } from "../commands/health.js";
import {
  detectBrowserOpenSupport,
  formatControlUiSshHint,
  openUrl,
  openUrlInBackground,
  probeGatewayReachable,
  waitForGatewayReachable,
  resolveControlUiLinks,
} from "../commands/onboard-helpers.js";
import { resolveGatewayService } from "../daemon/service.js";
import { isSystemdUserServiceAvailable } from "../daemon/systemd.js";
import { ensureControlUiAssetsBuilt } from "../infra/control-ui-assets.js";
import { runTui } from "../tui/tui.js";
import { resolveUserPath } from "../utils.js";

type FinalizeOnboardingOptions = {
  flow: WizardFlow;
  opts: OnboardOptions;
  baseConfig: OpenClawConfig;
  nextConfig: OpenClawConfig;
  workspaceDir: string;
  settings: GatewayWizardSettings;
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
};

export async function finalizeOnboardingWizard(options: FinalizeOnboardingOptions) {
  const { flow, opts, baseConfig, nextConfig, settings, prompter, runtime } = options;

  const withWizardProgress = async <T>(
    label: string,
    options: { doneMessage?: string },
    work: (progress: { update: (message: string) => void }) => Promise<T>,
  ): Promise<T> => {
    const progress = prompter.progress(label);
    try {
      return await work(progress);
    } finally {
      progress.stop(options.doneMessage);
    }
  };

  const systemdAvailable =
    process.platform === "linux" ? await isSystemdUserServiceAvailable() : true;
  if (process.platform === "linux" && !systemdAvailable) {
    await prompter.note(
      "Systemd user services are unavailable. Skipping lingering checks and service install.".replace(
        "Systemd user services are unavailable. Skipping lingering checks and service install.",
        "Systemd 用户服务不可用。跳过 lingering 检查和服务安装。",
      ),
      "Systemd",
    );
  }

  if (process.platform === "linux" && systemdAvailable) {
    const { ensureSystemdUserLingerInteractive } = await import("../commands/systemd-linger.js");
    await ensureSystemdUserLingerInteractive({
      runtime,
      prompter: {
        confirm: prompter.confirm,
        note: prompter.note,
      },
      reason:
        "Linux installs use a systemd user service by default. Without lingering, systemd stops the user session on logout/idle and kills the Gateway.".replace(
          "Linux installs use a systemd user service by default. Without lingering, systemd stops the user session on logout/idle and kills the Gateway.",
          "Linux 安装默认使用 systemd 用户服务。没有 lingering，systemd 会在注销/空闲时停止用户会话并杀死网关。",
        ),
      requireConfirm: false,
    });
  }

  const explicitInstallDaemon =
    typeof opts.installDaemon === "boolean" ? opts.installDaemon : undefined;
  let installDaemon: boolean;
  if (explicitInstallDaemon !== undefined) {
    installDaemon = explicitInstallDaemon;
  } else if (process.platform === "linux" && !systemdAvailable) {
    installDaemon = false;
  } else if (flow === "quickstart") {
    installDaemon = true;
  } else {
    installDaemon = await prompter.confirm({
      message: "Install Gateway service (recommended)".replace(
        "Install Gateway service (recommended)",
        "安装网关服务（推荐）",
      ),
      initialValue: true,
    });
  }

  if (process.platform === "linux" && !systemdAvailable && installDaemon) {
    await prompter.note(
      "Systemd user services are unavailable; skipping service install. Use your container supervisor or `docker compose up -d`.".replace(
        "Systemd user services are unavailable; skipping service install. Use your container supervisor or `docker compose up -d`.",
        "Systemd 用户服务不可用；跳过服务安装。请使用您的容器管理器或 `docker compose up -d`。",
      ),
      "Gateway service".replace("Gateway service", "网关服务"),
    );
    installDaemon = false;
  }

  if (installDaemon) {
    const daemonRuntime =
      flow === "quickstart"
        ? DEFAULT_GATEWAY_DAEMON_RUNTIME
        : await prompter.select({
            message: "Gateway service runtime".replace("Gateway service runtime", "网关服务运行时"),
            options: GATEWAY_DAEMON_RUNTIME_OPTIONS,
            initialValue: opts.daemonRuntime ?? DEFAULT_GATEWAY_DAEMON_RUNTIME,
          });
    if (flow === "quickstart") {
      await prompter.note(
        "QuickStart uses Node for the Gateway service (stable + supported).".replace(
          "QuickStart uses Node for the Gateway service (stable + supported).",
          "快速开始使用 Node 作为网关服务（稳定 + 支持）。",
        ),
        "Gateway service runtime".replace("Gateway service runtime", "网关服务运行时"),
      );
    }
    const service = resolveGatewayService();
    const loaded = await service.isLoaded({ env: process.env });
    if (loaded) {
      const action = await prompter.select({
        message: "Gateway service already installed".replace(
          "Gateway service already installed",
          "网关服务已安装",
        ),
        options: [
          { value: "restart", label: "Restart".replace("Restart", "重启") },
          { value: "reinstall", label: "Reinstall".replace("Reinstall", "重新安装") },
          { value: "skip", label: "Skip".replace("Skip", "跳过") },
        ],
      });
      if (action === "restart") {
        await withWizardProgress(
          "Gateway service".replace("Gateway service", "网关服务"),
          {
            doneMessage: "Gateway service restarted.".replace(
              "Gateway service restarted.",
              "网关服务已重启。",
            ),
          },
          async (progress) => {
            progress.update(
              "Restarting Gateway service…".replace(
                "Restarting Gateway service…",
                "正在重启网关服务…",
              ),
            );
            await service.restart({
              env: process.env,
              stdout: process.stdout,
            });
          },
        );
      } else if (action === "reinstall") {
        await withWizardProgress(
          "Gateway service".replace("Gateway service", "网关服务"),
          {
            doneMessage: "Gateway service uninstalled.".replace(
              "Gateway service uninstalled.",
              "网关服务已卸载。",
            ),
          },
          async (progress) => {
            progress.update(
              "Uninstalling Gateway service…".replace(
                "Uninstalling Gateway service…",
                "正在卸载网关服务…",
              ),
            );
            await service.uninstall({ env: process.env, stdout: process.stdout });
          },
        );
      }
    }

    if (!loaded || (loaded && !(await service.isLoaded({ env: process.env })))) {
      const progress = prompter.progress("Gateway service".replace("Gateway service", "网关服务"));
      let installError: string | null = null;
      try {
        progress.update(
          "Preparing Gateway service…".replace("Preparing Gateway service…", "正在准备网关服务…"),
        );
        const { programArguments, workingDirectory, environment } = await buildGatewayInstallPlan({
          env: process.env,
          port: settings.port,
          token: settings.gatewayToken,
          runtime: daemonRuntime,
          warn: (message, title) => prompter.note(message, title),
          config: nextConfig,
        });

        progress.update(
          "Installing Gateway service…".replace("Installing Gateway service…", "正在安装网关服务…"),
        );
        await service.install({
          env: process.env,
          stdout: process.stdout,
          programArguments,
          workingDirectory,
          environment,
        });
      } catch (err) {
        installError = err instanceof Error ? err.message : String(err);
      } finally {
        progress.stop(
          installError
            ? "Gateway service install failed.".replace(
                "Gateway service install failed.",
                "网关服务安装失败。",
              )
            : "Gateway service installed.".replace(
                "Gateway service installed.",
                "网关服务已安装。",
              ),
        );
      }
      if (installError) {
        await prompter.note(
          `Gateway service install failed: ${installError}`.replace(
            "Gateway service install failed:",
            "网关服务安装失败：",
          ),
          "Gateway".replace("Gateway", "网关"),
        );
        await prompter.note(gatewayInstallErrorHint(), "Gateway".replace("Gateway", "网关"));
      }
    }
  }

  if (!opts.skipHealth) {
    const probeLinks = resolveControlUiLinks({
      bind: nextConfig.gateway?.bind ?? "loopback",
      port: settings.port,
      customBindHost: nextConfig.gateway?.customBindHost,
      basePath: undefined,
    });
    // Daemon install/restart can briefly flap the WS; wait a bit so health check doesn't false-fail.
    await waitForGatewayReachable({
      url: probeLinks.wsUrl,
      token: settings.gatewayToken,
      deadlineMs: 15_000,
    });
    try {
      await healthCommand({ json: false, timeoutMs: 10_000 }, runtime);
    } catch (err) {
      runtime.error(formatHealthCheckFailure(err));
      await prompter.note(
        [
          "Docs:".replace("Docs:", "文档："),
          "https://docs.openclaw.ai/gateway/health",
          "https://docs.openclaw.ai/gateway/troubleshooting",
        ].join("\n"),
        "Health check help".replace("Health check help", "健康检查帮助"),
      );
    }
  }

  const controlUiEnabled =
    nextConfig.gateway?.controlUi?.enabled ?? baseConfig.gateway?.controlUi?.enabled ?? true;
  if (!opts.skipUi && controlUiEnabled) {
    const controlUiAssets = await ensureControlUiAssetsBuilt(runtime);
    if (!controlUiAssets.ok && controlUiAssets.message) {
      runtime.error(controlUiAssets.message);
    }
  }

  await prompter.note(
    [
      "Add nodes for extra features:".replace(
        "Add nodes for extra features:",
        "添加节点以获得额外功能：",
      ),
      "- macOS app (system + notifications)".replace(
        "- macOS app (system + notifications)",
        "- macOS 应用（系统 + 通知）",
      ),
      "- iOS app (camera/canvas)".replace("- iOS app (camera/canvas)", "- iOS 应用（相机/画布）"),
      "- Android app (camera/canvas)".replace(
        "- Android app (camera/canvas)",
        "- Android 应用（相机/画布）",
      ),
    ].join("\n"),
    "Optional apps".replace("Optional apps", "可选应用"),
  );

  const controlUiBasePath =
    nextConfig.gateway?.controlUi?.basePath ?? baseConfig.gateway?.controlUi?.basePath;
  const links = resolveControlUiLinks({
    bind: settings.bind,
    port: settings.port,
    customBindHost: settings.customBindHost,
    basePath: controlUiBasePath,
  });
  const tokenParam =
    settings.authMode === "token" && settings.gatewayToken
      ? `?token=${encodeURIComponent(settings.gatewayToken)}`
      : "";
  const authedUrl = `${links.httpUrl}${tokenParam}`;
  const gatewayProbe = await probeGatewayReachable({
    url: links.wsUrl,
    token: settings.authMode === "token" ? settings.gatewayToken : undefined,
    password: settings.authMode === "password" ? nextConfig.gateway?.auth?.password : "",
  });
  const gatewayStatusLine = gatewayProbe.ok
    ? "Gateway: reachable".replace("Gateway: reachable", "网关：可达")
    : `Gateway: not detected${gatewayProbe.detail ? ` (${gatewayProbe.detail})` : ""}`.replace(
        "Gateway: not detected",
        "网关：未检测到",
      );
  const bootstrapPath = path.join(
    resolveUserPath(options.workspaceDir),
    DEFAULT_BOOTSTRAP_FILENAME,
  );
  const hasBootstrap = await fs
    .access(bootstrapPath)
    .then(() => true)
    .catch(() => false);

  await prompter.note(
    [
      `Web UI: ${links.httpUrl}`,
      tokenParam
        ? `Web UI (with token): ${authedUrl}`.replace("Web UI (with token):", "Web UI（带令牌）：")
        : undefined,
      `Gateway WS: ${links.wsUrl}`.replace("Gateway WS:", "网关 WS："),
      gatewayStatusLine,
      "Docs: https://docs.openclaw.ai/web/control-ui".replace("Docs:", "文档："),
    ]
      .filter(Boolean)
      .join("\n"),
    "Control UI".replace("Control UI", "控制界面"),
  );

  let controlUiOpened = false;
  let controlUiOpenHint: string | undefined;
  let seededInBackground = false;
  let hatchChoice: "tui" | "web" | "later" | null = null;

  if (!opts.skipUi && gatewayProbe.ok) {
    if (hasBootstrap) {
      await prompter.note(
        [
          "This is the defining action that makes your agent you.".replace(
            "This is the defining action that makes your agent you.",
            "这是让您的代理成为您的决定性行动。",
          ),
          "Please take your time.".replace("Please take your time.", "请慢慢来。"),
          "The more you tell it, the better the experience will be.".replace(
            "The more you tell it, the better the experience will be.",
            "您告诉它的越多，体验就会越好。",
          ),
          'We will send: "Wake up, my friend!"'.replace(
            'We will send: "Wake up, my friend!"',
            '我们将发送："Wake up, my friend!"',
          ),
        ].join("\n"),
        "Start TUI (best option!)".replace("Start TUI (best option!)", "启动 TUI（最佳选择！）"),
      );
    }

    await prompter.note(
      [
        "Gateway token: shared auth for the Gateway + Control UI.".replace(
          "Gateway token: shared auth for the Gateway + Control UI.",
          "网关令牌：网关 + 控制界面的共享认证。",
        ),
        "Stored in: ~/.openclaw/openclaw.json (gateway.auth.token) or OPENCLAW_GATEWAY_TOKEN.".replace(
          "Stored in:",
          "存储在：",
        ),
        "Web UI stores a copy in this browser's localStorage (openclaw.control.settings.v1).".replace(
          "Web UI stores a copy in this browser's localStorage (openclaw.control.settings.v1).",
          "Web UI 在此浏览器的 localStorage 中存储一个副本（openclaw.control.settings.v1）。",
        ),
        `Get the tokenized link anytime: ${formatCliCommand("openclaw dashboard --no-open")}`.replace(
          "Get the tokenized link anytime:",
          "随时获取带令牌的链接：",
        ),
      ].join("\n"),
      "Token".replace("Token", "令牌"),
    );

    hatchChoice = await prompter.select({
      message: "How do you want to hatch your bot?".replace(
        "How do you want to hatch your bot?",
        "您想要如何孵化您的机器人？",
      ),
      options: [
        {
          value: "tui",
          label: "Hatch in TUI (recommended)".replace(
            "Hatch in TUI (recommended)",
            "在 TUI 中孵化（推荐）",
          ),
        },
        { value: "web", label: "Open the Web UI".replace("Open the Web UI", "打开 Web UI") },
        { value: "later", label: "Do this later".replace("Do this later", "稍后再做") },
      ],
      initialValue: "tui",
    });

    if (hatchChoice === "tui") {
      await runTui({
        url: links.wsUrl,
        token: settings.authMode === "token" ? settings.gatewayToken : undefined,
        password: settings.authMode === "password" ? nextConfig.gateway?.auth?.password : "",
        // Safety: onboarding TUI should not auto-deliver to lastProvider/lastTo.
        deliver: false,
        message: hasBootstrap ? "Wake up, my friend!" : undefined,
      });
      if (settings.authMode === "token" && settings.gatewayToken) {
        seededInBackground = await openUrlInBackground(authedUrl);
      }
      if (seededInBackground) {
        await prompter.note(
          `Web UI seeded in the background. Open later with: ${formatCliCommand(
            "openclaw dashboard --no-open",
          )}`.replace(
            "Web UI seeded in the background. Open later with:",
            "Web UI 已在后台准备就绪。稍后使用以下命令打开：",
          ),
          "Web UI".replace("Web UI", "Web UI"),
        );
      }
    } else if (hatchChoice === "web") {
      const browserSupport = await detectBrowserOpenSupport();
      if (browserSupport.ok) {
        controlUiOpened = await openUrl(authedUrl);
        if (!controlUiOpened) {
          controlUiOpenHint = formatControlUiSshHint({
            port: settings.port,
            basePath: controlUiBasePath,
            token: settings.gatewayToken,
          });
        }
      } else {
        controlUiOpenHint = formatControlUiSshHint({
          port: settings.port,
          basePath: controlUiBasePath,
          token: settings.gatewayToken,
        });
      }
      await prompter.note(
        [
          `Dashboard link (with token): ${authedUrl}`.replace(
            "Dashboard link (with token):",
            "仪表板链接（带令牌）：",
          ),
          controlUiOpened
            ? "Opened in your browser. Keep that tab to control OpenClaw.".replace(
                "Opened in your browser. Keep that tab to control OpenClaw.",
                "已在您的浏览器中打开。保留该选项卡以控制 OpenClaw。",
              )
            : "Copy/paste this URL in a browser on this machine to control OpenClaw.".replace(
                "Copy/paste this URL in a browser on this machine to control OpenClaw.",
                "复制/粘贴此 URL 到此机器上的浏览器中以控制 OpenClaw。",
              ),
          controlUiOpenHint,
        ]
          .filter(Boolean)
          .join("\n"),
        "Dashboard ready".replace("Dashboard ready", "仪表板就绪"),
      );
    } else {
      await prompter.note(
        `When you're ready: ${formatCliCommand("openclaw dashboard --no-open")}`.replace(
          "When you're ready:",
          "当您准备好后：",
        ),
        "Later".replace("Later", "稍后"),
      );
    }
  } else if (opts.skipUi) {
    await prompter.note(
      "Skipping Control UI/TUI prompts.".replace(
        "Skipping Control UI/TUI prompts.",
        "跳过控制界面/TUI 提示。",
      ),
      "Control UI".replace("Control UI", "控制界面"),
    );
  }

  await prompter.note(
    [
      "Back up your agent workspace.".replace(
        "Back up your agent workspace.",
        "备份您的代理工作区。",
      ),
      "Docs: https://docs.openclaw.ai/concepts/agent-workspace".replace("Docs:", "文档："),
    ].join("\n"),
    "Workspace backup".replace("Workspace backup", "工作区备份"),
  );

  await prompter.note(
    "Running agents on your computer is risky — harden your setup: https://docs.openclaw.ai/security".replace(
      "Running agents on your computer is risky — harden your setup:",
      "在您的计算机上运行代理是有风险的 — 加强您的安全设置：",
    ),
    "Security".replace("Security", "安全"),
  );

  const shouldOpenControlUi =
    !opts.skipUi &&
    settings.authMode === "token" &&
    Boolean(settings.gatewayToken) &&
    hatchChoice === null;
  if (shouldOpenControlUi) {
    const browserSupport = await detectBrowserOpenSupport();
    if (browserSupport.ok) {
      controlUiOpened = await openUrl(authedUrl);
      if (!controlUiOpened) {
        controlUiOpenHint = formatControlUiSshHint({
          port: settings.port,
          basePath: controlUiBasePath,
          token: settings.gatewayToken,
        });
      }
    } else {
      controlUiOpenHint = formatControlUiSshHint({
        port: settings.port,
        basePath: controlUiBasePath,
        token: settings.gatewayToken,
      });
    }

    await prompter.note(
      [
        `Dashboard link (with token): ${authedUrl}`.replace(
          "Dashboard link (with token):",
          "仪表板链接（带令牌）：",
        ),
        controlUiOpened
          ? "Opened in your browser. Keep that tab to control OpenClaw.".replace(
              "Opened in your browser. Keep that tab to control OpenClaw.",
              "已在您的浏览器中打开。保留该选项卡以控制 OpenClaw。",
            )
          : "Copy/paste this URL in a browser on this machine to control OpenClaw.".replace(
              "Copy/paste this URL in a browser on this machine to control OpenClaw.",
              "复制/粘贴此 URL 到此机器上的浏览器中以控制 OpenClaw。",
            ),
        controlUiOpenHint,
      ]
        .filter(Boolean)
        .join("\n"),
      "Dashboard ready".replace("Dashboard ready", "仪表板就绪"),
    );
  }

  const webSearchKey = (nextConfig.tools?.web?.search?.apiKey ?? "").trim();
  const webSearchEnv = (process.env.BRAVE_API_KEY ?? "").trim();
  const hasWebSearchKey = Boolean(webSearchKey || webSearchEnv);
  await prompter.note(
    hasWebSearchKey
      ? [
          "Web search is enabled, so your agent can look things up online when needed.".replace(
            "Web search is enabled, so your agent can look things up online when needed.",
            "网络搜索已启用，因此您的代理可以在需要时在线查找信息。",
          ),
          "",
          webSearchKey
            ? "API key: stored in config (tools.web.search.apiKey).".replace(
                "API key: stored in config (tools.web.search.apiKey).",
                "API 密钥：存储在配置中（tools.web.search.apiKey）。",
              )
            : "API key: provided via BRAVE_API_KEY env var (Gateway environment).".replace(
                "API key: provided via BRAVE_API_KEY env var (Gateway environment).",
                "API 密钥：通过 BRAVE_API_KEY 环境变量提供（网关环境）。",
              ),
          "Docs: https://docs.openclaw.ai/tools/web".replace("Docs:", "文档："),
        ].join("\n")
      : [
          "If you want your agent to be able to search the web, you'll need an API key.".replace(
            "If you want your agent to be able to search the web, you'll need an API key.",
            "如果您希望您的代理能够搜索网络，您需要一个 API 密钥。",
          ),
          "",
          "OpenClaw uses Brave Search for the `web_search` tool. Without a Brave Search API key, web search won't work.".replace(
            "OpenClaw uses Brave Search for the `web_search` tool. Without a Brave Search API key, web search won't work.",
            "OpenClaw 使用 Brave Search 作为 `web_search` 工具。没有 Brave Search API 密钥，网络搜索将无法工作。",
          ),
          "",
          "Set it up interactively:".replace("Set it up interactively:", "交互式设置："),
          `- Run: ${formatCliCommand("openclaw configure --section web")}`.replace(
            "- Run:",
            "- 运行：",
          ),
          "- Enable web_search and paste your Brave Search API key".replace(
            "- Enable web_search and paste your Brave Search API key",
            "- 启用 web_search 并粘贴您的 Brave Search API 密钥",
          ),
          "",
          "Alternative: set BRAVE_API_KEY in the Gateway environment (no config changes).".replace(
            "Alternative: set BRAVE_API_KEY in the Gateway environment (no config changes).",
            "替代方案：在网关环境中设置 BRAVE_API_KEY（无需更改配置）。",
          ),
          "Docs: https://docs.openclaw.ai/tools/web".replace("Docs:", "文档："),
        ].join("\n"),
    "Web search (optional)".replace("Web search (optional)", "网络搜索（可选）"),
  );

  await prompter.note(
    'What now: https://openclaw.ai/showcase ("What People Are Building").'.replace(
      'What now: https://openclaw.ai/showcase ("What People Are Building").',
      '接下来做什么：https://openclaw.ai/showcase ("人们正在构建什么")。',
    ),
    "What now".replace("What now", "接下来做什么"),
  );

  await prompter.outro(
    controlUiOpened
      ? "Onboarding complete. Dashboard opened with your token; keep that tab to control OpenClaw.".replace(
          "Onboarding complete. Dashboard opened with your token; keep that tab to control OpenClaw.",
          "入职完成。仪表板已使用您的令牌打开；保留该选项卡以控制 OpenClaw。",
        )
      : seededInBackground
        ? "Onboarding complete. Web UI seeded in the background; open it anytime with the tokenized link above.".replace(
            "Onboarding complete. Web UI seeded in the background; open it anytime with the tokenized link above.",
            "入职完成。Web UI 已在后台准备就绪；随时使用上面的带令牌链接打开它。",
          )
        : "Onboarding complete. Use the tokenized dashboard link above to control OpenClaw.".replace(
            "Onboarding complete. Use the tokenized dashboard link above to control OpenClaw.",
            "入职完成。使用上面的带令牌仪表板链接来控制 OpenClaw。",
          ),
  );
}
