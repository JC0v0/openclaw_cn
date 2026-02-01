import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import { resolveGatewayPort } from "../config/config.js";
import { findTailscaleBinary } from "../infra/tailscale.js";
import { note } from "../terminal/note.js";
import { buildGatewayAuthConfig } from "./configure.gateway-auth.js";
import { confirm, select, text } from "./configure.shared.js";
import { guardCancel, normalizeGatewayTokenInput, randomToken } from "./onboard-helpers.js";

type GatewayAuthChoice = "token" | "password";

export async function promptGatewayConfig(
  cfg: OpenClawConfig,
  runtime: RuntimeEnv,
): Promise<{
  config: OpenClawConfig;
  port: number;
  token?: string;
}> {
  const portRaw = guardCancel(
    await text({
      message: "网关端口",
      initialValue: String(resolveGatewayPort(cfg)),
      validate: (value) => (Number.isFinite(Number(value)) ? undefined : "无效的端口号"),
    }),
    runtime,
  );
  const port = Number.parseInt(String(portRaw), 10);

  let bind = guardCancel(
    await select({
      message: "网关绑定模式",
      options: [
        {
          value: "loopback",
          label: "本地回环（仅本地）",
          hint: "绑定到 127.0.0.1 - 安全，仅本地访问",
        },
        {
          value: "tailnet",
          label: "Tailnet（Tailscale IP）",
          hint: "仅绑定到您的 Tailscale IP（100.x.x.x）",
        },
        {
          value: "auto",
          label: "自动（本地回环 → 局域网）",
          hint: "优先本地回环；若不可用则回退到所有接口",
        },
        {
          value: "lan",
          label: "局域网（所有接口）",
          hint: "绑定到 0.0.0.0 - 可从网络上的任何位置访问",
        },
        {
          value: "custom",
          label: "自定义 IP",
          hint: "指定特定的 IP 地址，若不可用则回退到 0.0.0.0",
        },
      ],
    }),
    runtime,
  );

  let customBindHost: string | undefined;
  if (bind === "custom") {
    const input = guardCancel(
      await text({
        message: "自定义 IP 地址",
        placeholder: "192.168.1.100",
        validate: (value) => {
          if (!value) {
            return "自定义绑定模式需要 IP 地址";
          }
          const trimmed = value.trim();
          const parts = trimmed.split(".");
          if (parts.length !== 4) {
            return "无效的 IPv4 地址（例如：192.168.1.100）";
          }
          if (
            parts.every((part) => {
              const n = parseInt(part, 10);
              return !Number.isNaN(n) && n >= 0 && n <= 255 && part === String(n);
            })
          ) {
            return undefined;
          }
          return "无效的 IPv4 地址（每个八位组必须是 0-255）";
        },
      }),
      runtime,
    );
    customBindHost = typeof input === "string" ? input : undefined;
  }

  let authMode = guardCancel(
    await select({
      message: "网关认证方式",
      options: [
        { value: "token", label: "令牌", hint: "推荐默认选项" },
        { value: "password", label: "密码" },
      ],
      initialValue: "token",
    }),
    runtime,
  ) as GatewayAuthChoice;

  const tailscaleMode = guardCancel(
    await select({
      message: "Tailscale 暴露方式",
      options: [
        { value: "off", label: "关闭", hint: "不使用 Tailscale 暴露" },
        {
          value: "serve",
          label: "Serve（服务）",
          hint: "为您的 tailnet 提供私有 HTTPS（Tailscale 上的设备）",
        },
        {
          value: "funnel",
          label: "Funnel（隧道）",
          hint: "通过 Tailscale Funnel 提供公共 HTTPS（互联网）",
        },
      ],
    }),
    runtime,
  );

  // Detect Tailscale binary before proceeding with serve/funnel setup.
  if (tailscaleMode !== "off") {
    const tailscaleBin = await findTailscaleBinary();
    if (!tailscaleBin) {
      note(
        [
          "在 PATH 或 /Applications 中未找到 Tailscale 二进制文件。",
          "请确保从以下位置安装了 Tailscale：",
          "  https://tailscale.com/download/mac",
          "",
          "您可以继续设置，但 serve/funnel 在运行时会失败。",
        ].join("\n"),
        "Tailscale 警告",
      );
    }
  }

  let tailscaleResetOnExit = false;
  if (tailscaleMode !== "off") {
    note(
      ["Docs:", "https://docs.openclaw.ai/gateway/tailscale", "https://docs.openclaw.ai/web"].join(
        "\n",
      ),
      "Tailscale",
    );
    tailscaleResetOnExit = Boolean(
      guardCancel(
        await confirm({
          message: "退出时重置 Tailscale serve/funnel？",
          initialValue: false,
        }),
        runtime,
      ),
    );
  }

  if (tailscaleMode !== "off" && bind !== "loopback") {
    note("Tailscale 需要绑定到本地回环。正在将绑定模式调整为本地回环。", "注意");
    bind = "loopback";
  }

  if (tailscaleMode === "funnel" && authMode !== "password") {
    note("Tailscale Funnel 需要密码认证。", "注意");
    authMode = "password";
  }

  let gatewayToken: string | undefined;
  let gatewayPassword: string | undefined;
  let next = cfg;

  if (authMode === "token") {
    const tokenInput = guardCancel(
      await text({
        message: "网关令牌（留空以自动生成）",
        initialValue: randomToken(),
      }),
      runtime,
    );
    gatewayToken = normalizeGatewayTokenInput(tokenInput) || randomToken();
  }

  if (authMode === "password") {
    const password = guardCancel(
      await text({
        message: "网关密码",
        validate: (value) => (value?.trim() ? undefined : "必填项"),
      }),
      runtime,
    );
    gatewayPassword = String(password).trim();
  }

  const authConfig = buildGatewayAuthConfig({
    existing: next.gateway?.auth,
    mode: authMode,
    token: gatewayToken,
    password: gatewayPassword,
  });

  next = {
    ...next,
    gateway: {
      ...next.gateway,
      mode: "local",
      port,
      bind,
      auth: authConfig,
      ...(customBindHost && { customBindHost }),
      tailscale: {
        ...next.gateway?.tailscale,
        mode: tailscaleMode,
        resetOnExit: tailscaleResetOnExit,
      },
    },
  };

  return { config: next, port, token: gatewayToken };
}
