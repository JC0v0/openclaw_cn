#!/bin/bash
set -euo pipefail

# OpenClaw 中文版 Installer for macOS and Linux
# 使用方法: curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/JC0v0/openclaw_cn/main/scripts/install-zh.sh | bash
# 仓库: https://github.com/JC0v0/openclaw_cn (中文版 fork)

BOLD='\033[1m'
ACCENT='\033[38;2;255;90;45m'
# shellcheck disable=SC2034
ACCENT_BRIGHT='\033[38;2;255;122;61m'
ACCENT_DIM='\033[38;2;209;74;34m'
INFO='\033[38;2;255;138;91m'
SUCCESS='\033[38;2;47;191;113m'
WARN='\033[38;2;255;176;32m'
ERROR='\033[38;2;226;61;45m'
MUTED='\033[38;2;139;127;119m'
NC='\033[0m' # No Color

DEFAULT_TAGLINE="万千对话，尽在 OpenClaw。"

ORIGINAL_PATH="${PATH:-}"

TMPFILES=()
cleanup_tmpfiles() {
    local f
    for f in "${TMPFILES[@]:-}"; do
        rm -f "$f" 2>/dev/null || true
    done
}
trap cleanup_tmpfiles EXIT

mktempfile() {
    local f
    f="$(mktemp)"
    TMPFILES+=("$f")
    echo "$f"
}

DOWNLOADER=""
detect_downloader() {
    if command -v curl &> /dev/null; then
        DOWNLOADER="curl"
        return 0
    fi
    if command -v wget &> /dev/null; then
        DOWNLOADER="wget"
        return 0
    fi
    echo -e "${ERROR}错误：缺少下载工具（需要 curl 或 wget）${NC}"
    exit 1
}

download_file() {
    local url="$1"
    local output="$2"
    if [[ -z "$DOWNLOADER" ]]; then
        detect_downloader
    fi
    if [[ "$DOWNLOADER" == "curl" ]]; then
        curl -fsSL --proto '=https' --tlsv1.2 --retry 3 --retry-delay 1 --retry-connrefused -o "$output" "$url"
        return
    fi
    wget -q --https-only --secure-protocol=TLSv1_2 --tries=3 --timeout=20 -O "$output" "$url"
}

run_remote_bash() {
    local url="$1"
    local tmp
    tmp="$(mktempfile)"
    download_file "$url" "$tmp"
    /bin/bash "$tmp"
}

cleanup_legacy_submodules() {
    local repo_dir="$1"
    local legacy_dir="$repo_dir/Peekaboo"
    if [[ -d "$legacy_dir" ]]; then
        echo -e "${WARN}→${NC} 正在移除旧的子模块：${INFO}${legacy_dir}${NC}"
        rm -rf "$legacy_dir"
    fi
}

cleanup_npm_openclaw_paths() {
    local npm_root=""
    npm_root="$(npm root -g 2>/dev/null || true)"
    if [[ -z "$npm_root" || "$npm_root" != *node_modules* ]]; then
        return 1
    fi
    rm -rf "$npm_root"/.openclaw-* "$npm_root"/openclaw 2>/dev/null || true
}

extract_openclaw_conflict_path() {
    local log="$1"
    local path=""
    path="$(sed -n 's/.*File exists: //p' "$log" | head -n1)"
    if [[ -z "$path" ]]; then
        path="$(sed -n 's/.*EEXIST: file already exists, //p' "$log" | head -n1)"
    fi
    if [[ -n "$path" ]]; then
        echo "$path"
        return 0
    fi
    return 1
}

cleanup_openclaw_bin_conflict() {
    local bin_path="$1"
    if [[ -z "$bin_path" || ( ! -e "$bin_path" && ! -L "$bin_path" ) ]]; then
        return 1
    fi
    local npm_bin=""
    npm_bin="$(npm_global_bin_dir 2>/dev/null || true)"
    if [[ -n "$npm_bin" && "$bin_path" != "$npm_bin/openclaw" ]]; then
        case "$bin_path" in
            "/opt/homebrew/bin/openclaw"|"/usr/local/bin/openclaw")
                ;;
            *)
                return 1
                ;;
        esac
    fi
    if [[ -L "$bin_path" ]]; then
        local target=""
        target="$(readlink "$bin_path" 2>/dev/null || true)"
        if [[ "$target" == *"/node_modules/openclaw/"* ]]; then
            rm -f "$bin_path"
            echo -e "${WARN}→${NC} 已移除失效的 openclaw 符号链接：${INFO}${bin_path}${NC}"
            return 0
        fi
        return 1
    fi
    local backup=""
    backup="${bin_path}.bak-$(date +%Y%m%d-%H%M%S)"
    if mv "$bin_path" "$backup"; then
        echo -e "${WARN}→${NC} 已将现有的 openclaw 二进制文件移动至：${INFO}${backup}${NC}"
        return 0
    fi
    return 1
}

install_openclaw_npm() {
    local spec="$1"
    local log
    log="$(mktempfile)"
    if ! SHARP_IGNORE_GLOBAL_LIBVIPS="$SHARP_IGNORE_GLOBAL_LIBVIPS" npm --loglevel "$NPM_LOGLEVEL" ${NPM_SILENT_FLAG:+$NPM_SILENT_FLAG} --no-fund --no-audit install -g "$spec" 2>&1 | tee "$log"; then
        if grep -q "ENOTEMPTY: directory not empty, rename .*openclaw" "$log"; then
            echo -e "${WARN}→${NC} npm 遗留了旧的 openclaw 目录；正在清理并重试..."
            cleanup_npm_openclaw_paths
            SHARP_IGNORE_GLOBAL_LIBVIPS="$SHARP_IGNORE_GLOBAL_LIBVIPS" npm --loglevel "$NPM_LOGLEVEL" ${NPM_SILENT_FLAG:+$NPM_SILENT_FLAG} --no-fund --no-audit install -g "$spec"
            return $?
        fi
        if grep -q "EEXIST" "$log"; then
            local conflict=""
            conflict="$(extract_openclaw_conflict_path "$log" || true)"
            if [[ -n "$conflict" ]] && cleanup_openclaw_bin_conflict "$conflict"; then
                SHARP_IGNORE_GLOBAL_LIBVIPS="$SHARP_IGNORE_GLOBAL_LIBVIPS" npm --loglevel "$NPM_LOGLEVEL" ${NPM_SILENT_FLAG:+$NPM_SILENT_FLAG} --no-fund --no-audit install -g "$spec"
                return $?
            fi
            echo -e "${ERROR}npm 失败，因为已存在 openclaw 二进制文件。${NC}"
            if [[ -n "$conflict" ]]; then
                echo -e "${INFO}i${NC} 请移除或移动 ${INFO}${conflict}${NC}，然后重试。"
            fi
            echo -e "${INFO}i${NC} 或者使用 ${INFO}npm install -g --force ${spec}${NC} 重新运行（覆盖安装）。"
        fi
        return 1
    fi
    return 0
}

TAGLINES=()
TAGLINES+=("你的终端长出了钳子——尽管打字，让机器人帮你处理繁杂事务。")
TAGLINES+=("欢迎来到命令行：梦想在此编译，信心在此崩溃。")
TAGLINES+=("我的动力源自咖啡因、JSON5，以及“在我机器上能跑”的迷之自信。")
TAGLINES+=("网关上线——请始终将手脚和附肢保持在 Shell 内部。")
TAGLINES+=("我精通 Bash，略带讽刺，并充满了激进的 Tab 补全能量。")
TAGLINES+=("一个 CLI 统领一切，外加一次重启，因为你改了端口。")
TAGLINES+=("如果跑通了，那就是自动化；如果崩了，那就是“学习机会”。")
TAGLINES+=("配对码的存在是因为即使是机器人也相信许可——以及良好的安全习惯。")
TAGLINES+=("你的 .env 露出来了；别担心，我会假装没看见。")
TAGLINES+=("我会处理那些无聊的事，你只需像看电影一样深情地盯着日志。")
TAGLINES+=("我不是说你的工作流混乱……我只是带了个 Linter 和头盔。")
TAGLINES+=("自信地敲下命令——如果有必要，大自然会提供堆栈跟踪。")
TAGLINES+=("我不予置评，但你缺失的 API Key 绝对在审视你。")
TAGLINES+=("我可以 grep 它，git blame 它，还可以温柔地吐槽它——选一个你喜欢的应对机制。")
TAGLINES+=("配置负责热重载，部署负责冒冷汗。")
TAGLINES+=("我是你终端要求的助手，不是你睡眠时间表要求的那个。")
TAGLINES+=("我像保险库一样保守秘密……除非你又把它们打印在调试日志里。")
TAGLINES+=("带钳子的自动化：最小的麻烦，最大的夹力。")
TAGLINES+=("我基本上是一把瑞士军刀，但观点更多，锋利边缘更少。")
TAGLINES+=("迷茫时运行 doctor，勇敢时运行 prod，智慧时运行 tests。")
TAGLINES+=("你的任务已排队；你的尊严已被弃用。")
TAGLINES+=("我治不了你的代码品味，但我能搞定你的构建和积压工作。")
TAGLINES+=("我不是魔法——我只是在重试和应对策略上极其执着。")
TAGLINES+=("这不叫“失败”，这叫“探索把同一件事配置错的新方法”。")
TAGLINES+=("给我一个工作区，我还你更少的标签页、更少的开关和更多的氧气。")
TAGLINES+=("我看日志，这样你就可以继续假装你不需要看。")
TAGLINES+=("如果着火了，我灭不了——但我能写一份漂亮的事故复盘。")
TAGLINES+=("我会像这堆繁杂工作欠我钱一样重构它们。")
TAGLINES+=("说“停”我就停——说“发布”我们都能吸取教训。")
TAGLINES+=("我是你 Shell 历史记录看起来像黑客电影蒙太奇的原因。")
TAGLINES+=("我像 tmux：刚开始很困惑，突然间你就离不开我了。")
TAGLINES+=("我可以在本地跑、远程跑，或者纯靠感觉跑——结果随 DNS 而定。")
TAGLINES+=("如果你能描述它，我大概就能自动化它——或者至少让它更有趣。")
TAGLINES+=("你的配置是有效的，你的假设是无效的。")
TAGLINES+=("我不只自动补全——我还（情感上）自动提交，然后请你（逻辑上）审查。")
TAGLINES+=("少点点击，多点发布，少点“那文件去哪了”的时刻。")
TAGLINES+=("亮出钳子，提交代码——让我们发布点勉强负责任的东西。")
TAGLINES+=("我会像处理龙虾卷一样润滑你的工作流：虽然乱，但美味且有效。")
TAGLINES+=("Shell Yeah——我来掐断劳苦，把荣耀留给你。")
TAGLINES+=("如果重复，我就自动化；如果困难，我就带上笑话和回滚计划。")
TAGLINES+=("因为给自己发短信提醒太 2024 年了。")
TAGLINES+=("WhatsApp，但要 ✨工程化✨。")
TAGLINES+=("把“我稍后回复”变成“我的机器人秒回了”。")
TAGLINES+=("你通讯录里唯一一只你真想听到消息的螃蟹。🦞")
TAGLINES+=("专为 IRC 时代巅峰人士打造的聊天自动化。")
TAGLINES+=("因为 Siri 凌晨 3 点不接茬。")
TAGLINES+=("IPC（进程间通信），但是在你手机上。")
TAGLINES+=("UNIX 哲学遇上你的私信。")
TAGLINES+=("对话界的 curl。")
TAGLINES+=("WhatsApp Business，但没有 Business。")
TAGLINES+=("Meta 希望他们也能发布这么快。")
TAGLINES+=("端到端加密，扎克到扎克除外。")
TAGLINES+=("Mark 唯一无法用你私信训练的机器人。")
TAGLINES+=("无需“请接受我们新隐私政策”的 WhatsApp 自动化。")
TAGLINES+=("不需要参议院听证会的聊天 API。")
TAGLINES+=("因为 Threads 也不是答案。")
TAGLINES+=("你的消息，你的服务器，Meta 的眼泪。")
TAGLINES+=("iMessage 绿色气泡能量，但普惠众生。")
TAGLINES+=("Siri 的能干表亲。")
TAGLINES+=("支持 Android。很疯狂的概念，我们懂。")
TAGLINES+=("不需要 \$999 的支架。")
TAGLINES+=("我们要比 Apple 发布计算器更新还快。")
TAGLINES+=("你的 AI 助手，现在无需 \$3,499 的头显。")
TAGLINES+=("Think different. 真的动脑想想。")
TAGLINES+=("啊，那家果树公司！🍎")

HOLIDAY_NEW_YEAR="元旦快乐：新年新配置——虽然还是那个 EADDRINUSE，但这次我们像成年人一样解决它。"
HOLIDAY_LUNAR_NEW_YEAR="春节快乐：愿构建顺利，分支兴旺，所有的合并冲突都被烟花驱散。"
HOLIDAY_CHRISTMAS="圣诞快乐：Ho ho ho——圣诞老人的小钳工来送快乐，回滚混乱，并要把密钥藏好。"
HOLIDAY_EID="开斋节吉庆：庆祝模式：队列清空，任务完成，美好氛围随着干净的历史记录提交到主干。"
HOLIDAY_DIWALI="排灯节快乐：让日志闪耀，Bug 退散——今天我们点亮终端，自豪发布。"
HOLIDAY_EASTER="复活节快乐：我找到了你丢失的环境变量——就当是一次少点糖豆的微型 CLI 彩蛋搜寻吧。"
HOLIDAY_HANUKKAH="光明节快乐：八个夜晚，八次重试，零羞耻——愿网关常亮，部署平安。"
HOLIDAY_HALLOWEEN="万圣节快乐：惊悚季：当心闹鬼的依赖、被诅咒的缓存，以及 node_modules 的亡灵。"
HOLIDAY_THANKSGIVING="感恩节快乐：感恩稳定的端口、工作的 DNS，以及那个没人原意看日志却帮大家看的机器人。"
HOLIDAY_VALENTINES="情人节快乐：玫瑰是敲出来的，紫罗兰是管道传的——家务我包了，你去陪人类吧。"

append_holiday_taglines() {
    local today
    local month_day
    today="$(date -u +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)"
    month_day="$(date -u +%m-%d 2>/dev/null || date +%m-%d)"

    case "$month_day" in
        "01-01") TAGLINES+=("$HOLIDAY_NEW_YEAR") ;;
        "02-14") TAGLINES+=("$HOLIDAY_VALENTINES") ;;
        "10-31") TAGLINES+=("$HOLIDAY_HALLOWEEN") ;;
        "12-25") TAGLINES+=("$HOLIDAY_CHRISTMAS") ;;
    esac

    case "$today" in
        "2025-01-29"|"2026-02-17"|"2027-02-06") TAGLINES+=("$HOLIDAY_LUNAR_NEW_YEAR") ;;
        "2025-03-30"|"2025-03-31"|"2026-03-20"|"2027-03-10") TAGLINES+=("$HOLIDAY_EID") ;;
        "2025-10-20"|"2026-11-08"|"2027-10-28") TAGLINES+=("$HOLIDAY_DIWALI") ;;
        "2025-04-20"|"2026-04-05"|"2027-03-28") TAGLINES+=("$HOLIDAY_EASTER") ;;
        "2025-11-27"|"2026-11-26"|"2027-11-25") TAGLINES+=("$HOLIDAY_THANKSGIVING") ;;
        "2025-12-15"|"2025-12-16"|"2025-12-17"|"2025-12-18"|"2025-12-19"|"2025-12-20"|"2025-12-21"|"2025-12-22"|"2026-12-05"|"2026-12-06"|"2026-12-07"|"2026-12-08"|"2026-12-09"|"2026-12-10"|"2026-12-11"|"2026-12-12"|"2027-12-25"|"2027-12-26"|"2027-12-27"|"2027-12-28"|"2027-12-29"|"2027-12-30"|"2027-12-31"|"2028-01-01") TAGLINES+=("$HOLIDAY_HANUKKAH") ;;
    esac
}

map_legacy_env() {
    local key="$1"
    local legacy="$2"
    if [[ -z "${!key:-}" && -n "${!legacy:-}" ]]; then
        printf -v "$key" '%s' "${!legacy}"
    fi
}

map_legacy_env "OPENCLAW_TAGLINE_INDEX" "CLAWDBOT_TAGLINE_INDEX"
map_legacy_env "OPENCLAW_NO_ONBOARD" "CLAWDBOT_NO_ONBOARD"
map_legacy_env "OPENCLAW_NO_PROMPT" "CLAWDBOT_NO_PROMPT"
map_legacy_env "OPENCLAW_DRY_RUN" "CLAWDBOT_DRY_RUN"
map_legacy_env "OPENCLAW_INSTALL_METHOD" "CLAWDBOT_INSTALL_METHOD"
map_legacy_env "OPENCLAW_VERSION" "CLAWDBOT_VERSION"
map_legacy_env "OPENCLAW_BETA" "CLAWDBOT_BETA"
map_legacy_env "OPENCLAW_GIT_DIR" "CLAWDBOT_GIT_DIR"
map_legacy_env "OPENCLAW_GIT_UPDATE" "CLAWDBOT_GIT_UPDATE"
map_legacy_env "OPENCLAW_NPM_LOGLEVEL" "CLAWDBOT_NPM_LOGLEVEL"
map_legacy_env "OPENCLAW_VERBOSE" "CLAWDBOT_VERBOSE"
map_legacy_env "OPENCLAW_PROFILE" "CLAWDBOT_PROFILE"
map_legacy_env "OPENCLAW_INSTALL_SH_NO_RUN" "CLAWDBOT_INSTALL_SH_NO_RUN"

pick_tagline() {
    append_holiday_taglines
    local count=${#TAGLINES[@]}
    if [[ "$count" -eq 0 ]]; then
        echo "$DEFAULT_TAGLINE"
        return
    fi
    if [[ -n "${OPENCLAW_TAGLINE_INDEX:-}" ]]; then
        if [[ "${OPENCLAW_TAGLINE_INDEX}" =~ ^[0-9]+$ ]]; then
            local idx=$((OPENCLAW_TAGLINE_INDEX % count))
            echo "${TAGLINES[$idx]}"
            return
        fi
    fi
    local idx=$((RANDOM % count))
    echo "${TAGLINES[$idx]}"
}

TAGLINE=$(pick_tagline)

NO_ONBOARD=${OPENCLAW_NO_ONBOARD:-0}
NO_PROMPT=${OPENCLAW_NO_PROMPT:-0}
DRY_RUN=${OPENCLAW_DRY_RUN:-0}
INSTALL_METHOD=${OPENCLAW_INSTALL_METHOD:-}
OPENCLAW_VERSION=${OPENCLAW_VERSION:-latest}
USE_BETA=${OPENCLAW_BETA:-0}
GIT_DIR_DEFAULT="${HOME}/openclaw"
GIT_DIR=${OPENCLAW_GIT_DIR:-$GIT_DIR_DEFAULT}
GIT_UPDATE=${OPENCLAW_GIT_UPDATE:-1}
SHARP_IGNORE_GLOBAL_LIBVIPS="${SHARP_IGNORE_GLOBAL_LIBVIPS:-1}"
NPM_LOGLEVEL="${OPENCLAW_NPM_LOGLEVEL:-error}"
NPM_SILENT_FLAG="--silent"
VERBOSE="${OPENCLAW_VERBOSE:-0}"
OPENCLAW_BIN=""
HELP=0

print_usage() {
    cat <<EOF
OpenClaw 中文版安装程序 (macOS + Linux)
仓库: https://github.com/JC0v0/openclaw_cn

用法:
  # 从 GitHub 直接安装中文版（推荐）:
  curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/JC0v0/openclaw_cn/main/scripts/install-zh.sh | bash

  # 或使用原始安装脚本:
  curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash -s -- [选项]

选项:
  --install-method, --method npm|git   通过 git checkout (默认) 或 npm 安装
  --npm                                --install-method npm 的快捷方式
  --git, --github                      --install-method git 的快捷方式 (默认)
  --version <version|dist-tag>         npm 安装版本 (默认: latest)
  --beta                               如果有 beta 版则使用 beta，否则使用 latest
  --git-dir, --dir <path>             Checkout 目录 (默认: ~/openclaw)
  --no-git-update                      跳过现有 checkout 的 git pull
  --no-onboard                          跳过初始化向导 (非交互模式)
  --no-prompt                           禁用提示 (CI/自动化环境必须)
  --dry-run                             仅打印将要执行的操作 (不进行更改)
  --verbose                             打印调试输出 (set -x, npm verbose)
  --help, -h                            显示此帮助信息

环境变量:
  OPENCLAW_INSTALL_METHOD=git|npm
  OPENCLAW_VERSION=latest|next|<semver>
  OPENCLAW_BETA=0|1
  OPENCLAW_GIT_DIR=...
  OPENCLAW_GIT_UPDATE=0|1
  OPENCLAW_NO_PROMPT=1
  OPENCLAW_DRY_RUN=1
  OPENCLAW_NO_ONBOARD=1
  OPENCLAW_VERBOSE=1
  OPENCLAW_NPM_LOGLEVEL=error|warn|notice  默认: error (隐藏 npm 弃用警告)
  SHARP_IGNORE_GLOBAL_LIBVIPS=0|1    默认: 1 (避免 sharp 针对全局 libvips 构建)

示例:
  # 安装中文版 (推荐):
  curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/JC0v0/openclaw_cn/main/scripts/install-zh.sh | bash

  # 标准安装:
  curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash
  curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash -s -- --no-onboard
  curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash -s -- --install-method git --no-onboard

中文社区:
  腾讯频道: https://pd.qq.com/s/46ogez1gd
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --no-onboard)
                NO_ONBOARD=1
                shift
                ;;
            --onboard)
                NO_ONBOARD=0
                shift
                ;;
            --dry-run)
                DRY_RUN=1
                shift
                ;;
            --verbose)
                VERBOSE=1
                shift
                ;;
            --no-prompt)
                NO_PROMPT=1
                shift
                ;;
            --help|-h)
                HELP=1
                shift
                ;;
            --install-method|--method)
                INSTALL_METHOD="$2"
                shift 2
                ;;
            --version)
                OPENCLAW_VERSION="$2"
                shift 2
                ;;
            --beta)
                USE_BETA=1
                shift
                ;;
            --npm)
                INSTALL_METHOD="npm"
                shift
                ;;
            --git|--github)
                INSTALL_METHOD="git"
                shift
                ;;
            --git-dir|--dir)
                GIT_DIR="$2"
                shift 2
                ;;
            --no-git-update)
                GIT_UPDATE=0
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
}

configure_verbose() {
    if [[ "$VERBOSE" != "1" ]]; then
        return 0
    fi
    if [[ "$NPM_LOGLEVEL" == "error" ]]; then
        NPM_LOGLEVEL="notice"
    fi
    NPM_SILENT_FLAG=""
    set -x
}

is_promptable() {
    if [[ "$NO_PROMPT" == "1" ]]; then
        return 1
    fi
    if [[ -r /dev/tty && -w /dev/tty ]]; then
        return 0
    fi
    return 1
}

prompt_choice() {
    local prompt="$1"
    local answer=""
    if ! is_promptable; then
        return 1
    fi
    echo -e "$prompt" > /dev/tty
    read -r answer < /dev/tty || true
    echo "$answer"
}

detect_openclaw_checkout() {
    local dir="$1"
    if [[ ! -f "$dir/package.json" ]]; then
        return 1
    fi
    if [[ ! -f "$dir/pnpm-workspace.yaml" ]]; then
        return 1
    fi
    if ! grep -q '"name"[[:space:]]*:[[:space:]]*"openclaw"' "$dir/package.json" 2>/dev/null; then
        return 1
    fi
    echo "$dir"
    return 0
}

echo -e "${ACCENT}${BOLD}"
echo "  🦞 OpenClaw 中文版 Installer (JC0v0/openclaw_cn)"
echo -e "${NC}${ACCENT_DIM}  ${TAGLINE}${NC}"
echo ""
echo -e "${INFO}i${NC} 中文版仓库: ${ACCENT}https://github.com/JC0v0/openclaw_cn${NC}"
echo -e "${INFO}i${NC} 中文社区: ${ACCENT}https://pd.qq.com/s/46ogez1gd${NC}"
echo ""

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]] || [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
    OS="linux"
fi

if [[ "$OS" == "unknown" ]]; then
    echo -e "${ERROR}错误：不支持的操作系统${NC}"
    echo "此安装程序支持 macOS 和 Linux (包括 WSL)。"
    echo "对于 Windows，请使用：iwr -useb https://openclaw.ai/install.ps1 | iex"
    exit 1
fi

echo -e "${SUCCESS}✓${NC} 已检测到：$OS"

# Check for Homebrew on macOS
install_homebrew() {
    if [[ "$OS" == "macos" ]]; then
        if ! command -v brew &> /dev/null; then
            echo -e "${WARN}→${NC} 正在安装 Homebrew..."
            run_remote_bash "https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh"

            # Add Homebrew to PATH for this session
            if [[ -f "/opt/homebrew/bin/brew" ]]; then
                eval "$(/opt/homebrew/bin/brew shellenv)"
            elif [[ -f "/usr/local/bin/brew" ]]; then
                eval "$(/usr/local/bin/brew shellenv)"
            fi
            echo -e "${SUCCESS}✓${NC} Homebrew 已安装"
        else
            echo -e "${SUCCESS}✓${NC} Homebrew 已安装"
        fi
    fi
}

# Check Node.js version
check_node() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ "$NODE_VERSION" -ge 22 ]]; then
            echo -e "${SUCCESS}✓${NC} 发现 Node.js v$(node -v | cut -d'v' -f2)"
            return 0
        else
            echo -e "${WARN}→${NC} 发现 Node.js $(node -v)，但需要 v22+"
            return 1
        fi
    else
        echo -e "${WARN}→${NC} 未找到 Node.js"
        return 1
    fi
}

# Install Node.js
install_node() {
    if [[ "$OS" == "macos" ]]; then
        echo -e "${WARN}→${NC} 正在通过 Homebrew 安装 Node.js..."
        brew install node@22
        brew link node@22 --overwrite --force 2>/dev/null || true
        echo -e "${SUCCESS}✓${NC} Node.js 已安装"
	    elif [[ "$OS" == "linux" ]]; then
	        echo -e "${WARN}→${NC} 正在通过 NodeSource 安装 Node.js..."
            require_sudo
	        if command -v apt-get &> /dev/null; then
	            local tmp
	            tmp="$(mktempfile)"
	            download_file "https://deb.nodesource.com/setup_22.x" "$tmp"
	            maybe_sudo -E bash "$tmp"
	            maybe_sudo apt-get install -y nodejs
	        elif command -v dnf &> /dev/null; then
	            local tmp
	            tmp="$(mktempfile)"
	            download_file "https://rpm.nodesource.com/setup_22.x" "$tmp"
	            maybe_sudo bash "$tmp"
	            maybe_sudo dnf install -y nodejs
	        elif command -v yum &> /dev/null; then
	            local tmp
	            tmp="$(mktempfile)"
	            download_file "https://rpm.nodesource.com/setup_22.x" "$tmp"
	            maybe_sudo bash "$tmp"
	            maybe_sudo yum install -y nodejs
	        else
	            echo -e "${ERROR}错误：无法检测到包管理器${NC}"
	            echo "请手动安装 Node.js 22+：https://nodejs.org"
            exit 1
        fi
        echo -e "${SUCCESS}✓${NC} Node.js 已安装"
    fi
}

# Check Git
check_git() {
    if command -v git &> /dev/null; then
        echo -e "${SUCCESS}✓${NC} Git 已安装"
        return 0
    fi
    echo -e "${WARN}→${NC} 未找到 Git"
    return 1
}

is_root() {
    [[ "$(id -u)" -eq 0 ]]
}

# Run a command with sudo only if not already root
maybe_sudo() {
    if is_root; then
        # Skip -E flag when root (env is already preserved)
        if [[ "${1:-}" == "-E" ]]; then
            shift
        fi
        "$@"
    else
        sudo "$@"
    fi
}

require_sudo() {
    if [[ "$OS" != "linux" ]]; then
        return 0
    fi
    if is_root; then
        return 0
    fi
    if command -v sudo &> /dev/null; then
        return 0
    fi
    echo -e "${ERROR}错误：Linux 系统安装需要 sudo${NC}"
    echo "请安装 sudo 或以 root 身份重新运行。"
    exit 1
}

install_git() {
    echo -e "${WARN}→${NC} 正在安装 Git..."
    if [[ "$OS" == "macos" ]]; then
        brew install git
    elif [[ "$OS" == "linux" ]]; then
        require_sudo
        if command -v apt-get &> /dev/null; then
            maybe_sudo apt-get update -y
            maybe_sudo apt-get install -y git
        elif command -v dnf &> /dev/null; then
            maybe_sudo dnf install -y git
        elif command -v yum &> /dev/null; then
            maybe_sudo yum install -y git
        else
            echo -e "${ERROR}错误：无法检测到 Git 的包管理器${NC}"
            exit 1
        fi
    fi
    echo -e "${SUCCESS}✓${NC} Git 已安装"
}

# Fix npm permissions for global installs (Linux)
fix_npm_permissions() {
    if [[ "$OS" != "linux" ]]; then
        return 0
    fi

    local npm_prefix
    npm_prefix="$(npm config get prefix 2>/dev/null || true)"
    if [[ -z "$npm_prefix" ]]; then
        return 0
    fi

    if [[ -w "$npm_prefix" || -w "$npm_prefix/lib" ]]; then
        return 0
    fi

    echo -e "${WARN}→${NC} 正在为用户本地安装配置 npm..."
    mkdir -p "$HOME/.npm-global"
    npm config set prefix "$HOME/.npm-global"

    # shellcheck disable=SC2016
    local path_line='export PATH="$HOME/.npm-global/bin:$PATH"'
    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
        if [[ -f "$rc" ]] && ! grep -q ".npm-global" "$rc"; then
            echo "$path_line" >> "$rc"
        fi
    done

    export PATH="$HOME/.npm-global/bin:$PATH"
    echo -e "${SUCCESS}✓${NC} npm 已配置为用户安装"
}

resolve_openclaw_bin() {
    if command -v openclaw &> /dev/null; then
        command -v openclaw
        return 0
    fi
    local npm_bin=""
    npm_bin="$(npm_global_bin_dir || true)"
    if [[ -n "$npm_bin" && -x "${npm_bin}/openclaw" ]]; then
        echo "${npm_bin}/openclaw"
        return 0
    fi
    return 1
}

ensure_openclaw_bin_link() {
    local npm_root=""
    npm_root="$(npm root -g 2>/dev/null || true)"
    if [[ -z "$npm_root" || ! -d "$npm_root/openclaw" ]]; then
        return 1
    fi
    local npm_bin=""
    npm_bin="$(npm_global_bin_dir || true)"
    if [[ -z "$npm_bin" ]]; then
        return 1
    fi
    mkdir -p "$npm_bin"
    if [[ ! -x "${npm_bin}/openclaw" ]]; then
        ln -sf "$npm_root/openclaw/dist/entry.js" "${npm_bin}/openclaw"
        echo -e "${WARN}→${NC} 已在 ${INFO}${npm_bin}/openclaw${NC} 安装 openclaw bin 链接"
    fi
    return 0
}

# Check for existing OpenClaw installation
check_existing_openclaw() {
    if [[ -n "$(type -P openclaw 2>/dev/null || true)" ]]; then
        echo -e "${WARN}→${NC} 检测到现有的 OpenClaw 安装"
        return 0
    fi
    return 1
}

ensure_pnpm() {
    if command -v pnpm &> /dev/null; then
        return 0
    fi

    if command -v corepack &> /dev/null; then
        echo -e "${WARN}→${NC} 正在通过 Corepack 安装 pnpm..."
        corepack enable >/dev/null 2>&1 || true
        corepack prepare pnpm@10 --activate
        echo -e "${SUCCESS}✓${NC} pnpm 已安装"
        return 0
    fi

    echo -e "${WARN}→${NC} 正在通过 npm 安装 pnpm..."
    fix_npm_permissions
    npm install -g pnpm@10
    echo -e "${SUCCESS}✓${NC} pnpm 已安装"
    return 0
}

ensure_user_local_bin_on_path() {
    local target="$HOME/.local/bin"
    mkdir -p "$target"

    export PATH="$target:$PATH"

    # shellcheck disable=SC2016
    local path_line='export PATH="$HOME/.local/bin:$PATH"'
    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
        if [[ -f "$rc" ]] && ! grep -q ".local/bin" "$rc"; then
            echo "$path_line" >> "$rc"
        fi
    done
}

npm_global_bin_dir() {
    local prefix=""
    prefix="$(npm prefix -g 2>/dev/null || true)"
    if [[ -n "$prefix" ]]; then
        if [[ "$prefix" == /* ]]; then
            echo "${prefix%/}/bin"
            return 0
        fi
    fi

    prefix="$(npm config get prefix 2>/dev/null || true)"
    if [[ -n "$prefix" && "$prefix" != "undefined" && "$prefix" != "null" ]]; then
        if [[ "$prefix" == /* ]]; then
            echo "${prefix%/}/bin"
            return 0
        fi
    fi

    echo ""
    return 1
}

refresh_shell_command_cache() {
    hash -r 2>/dev/null || true
}

path_has_dir() {
    local path="$1"
    local dir="${2%/}"
    if [[ -z "$dir" ]]; then
        return 1
    fi
    case ":${path}:" in
        *":${dir}:"*) return 0 ;;
        *) return 1 ;;
    esac
}

warn_shell_path_missing_dir() {
    local dir="${1%/}"
    local label="$2"
    if [[ -z "$dir" ]]; then
        return 0
    fi
    if path_has_dir "$ORIGINAL_PATH" "$dir"; then
        return 0
    fi

    echo ""
    echo -e "${WARN}→${NC} PATH 警告：缺少 ${label}：${INFO}${dir}${NC}"
    echo -e "这可能导致新终端中 ${INFO}openclaw${NC} 显示为 \"command not found\"。"
    echo -e "修复方法 (zsh: ~/.zshrc, bash: ~/.bashrc):"
    echo -e "  export PATH=\"${dir}:\\$PATH\""
    echo -e "文档: ${INFO}https://docs.openclaw.ai/install#nodejs--npm-path-sanity${NC}"
}

ensure_npm_global_bin_on_path() {
    local bin_dir=""
    bin_dir="$(npm_global_bin_dir || true)"
    if [[ -n "$bin_dir" ]]; then
        export PATH="${bin_dir}:$PATH"
    fi
}

maybe_nodenv_rehash() {
    if command -v nodenv &> /dev/null; then
        nodenv rehash >/dev/null 2>&1 || true
    fi
}

warn_openclaw_not_found() {
    echo -e "${WARN}→${NC} 已安装，但 ${INFO}openclaw${NC} 在此 shell 的 PATH 中不可见。"
    echo -e "尝试运行：${INFO}hash -r${NC} (bash) 或 ${INFO}rehash${NC} (zsh)，然后重试。"
    echo -e "文档：${INFO}https://docs.openclaw.ai/install#nodejs--npm-path-sanity${NC}"
    local t=""
    t="$(type -t openclaw 2>/dev/null || true)"
    if [[ "$t" == "alias" || "$t" == "function" ]]; then
        echo -e "${WARN}→${NC} 发现名为 ${INFO}openclaw${NC} 的 shell ${INFO}${t}${NC}；它可能会遮蔽真正的二进制文件。"
    fi
    if command -v nodenv &> /dev/null; then
        echo -e "正在使用 nodenv？运行：${INFO}nodenv rehash${NC}"
    fi

    local npm_prefix=""
    npm_prefix="$(npm prefix -g 2>/dev/null || true)"
    local npm_bin=""
    npm_bin="$(npm_global_bin_dir 2>/dev/null || true)"
    if [[ -n "$npm_prefix" ]]; then
        echo -e "npm prefix -g: ${INFO}${npm_prefix}${NC}"
    fi
    if [[ -n "$npm_bin" ]]; then
        echo -e "npm bin -g: ${INFO}${npm_bin}${NC}"
        echo -e "如果需要：${INFO}export PATH=\"${npm_bin}:\\$PATH\"${NC}"
    fi
}

resolve_openclaw_bin() {
    refresh_shell_command_cache
    local resolved=""
    resolved="$(type -P openclaw 2>/dev/null || true)"
    if [[ -n "$resolved" && -x "$resolved" ]]; then
        echo "$resolved"
        return 0
    fi

    ensure_npm_global_bin_on_path
    refresh_shell_command_cache
    resolved="$(type -P openclaw 2>/dev/null || true)"
    if [[ -n "$resolved" && -x "$resolved" ]]; then
        echo "$resolved"
        return 0
    fi

    local npm_bin=""
    npm_bin="$(npm_global_bin_dir || true)"
    if [[ -n "$npm_bin" && -x "${npm_bin}/openclaw" ]]; then
        echo "${npm_bin}/openclaw"
        return 0
    fi

    maybe_nodenv_rehash
    refresh_shell_command_cache
    resolved="$(type -P openclaw 2>/dev/null || true)"
    if [[ -n "$resolved" && -x "$resolved" ]]; then
        echo "$resolved"
        return 0
    fi

    if [[ -n "$npm_bin" && -x "${npm_bin}/openclaw" ]]; then
        echo "${npm_bin}/openclaw"
        return 0
    fi

    echo ""
    return 1
}

install_openclaw_from_git() {
    local repo_dir="$1"
    local repo_url="https://github.com/JC0v0/openclaw_cn.git"

    if [[ -d "$repo_dir/.git" ]]; then
        echo -e "${WARN}→${NC} 正在从 git checkout 安装 OpenClaw：${INFO}${repo_dir}${NC}"
    else
        echo -e "${WARN}→${NC} 正在从 GitHub 安装 OpenClaw (${repo_url})..."
    fi

    if ! check_git; then
        install_git
    fi

    ensure_pnpm

    if [[ ! -d "$repo_dir" ]]; then
        git clone "$repo_url" "$repo_dir"
    fi

    if [[ "$GIT_UPDATE" == "1" ]]; then
        if [[ -z "$(git -C "$repo_dir" status --porcelain 2>/dev/null || true)" ]]; then
            git -C "$repo_dir" pull --rebase || true
        else
            echo -e "${WARN}→${NC} 仓库有未提交的更改；跳过 git pull"
        fi
    fi

    cleanup_legacy_submodules "$repo_dir"

    SHARP_IGNORE_GLOBAL_LIBVIPS="$SHARP_IGNORE_GLOBAL_LIBVIPS" pnpm -C "$repo_dir" install

    if ! pnpm -C "$repo_dir" ui:build; then
        echo -e "${WARN}→${NC} UI 构建失败；继续执行（CLI 可能仍可工作）"
    fi
    pnpm -C "$repo_dir" build

    ensure_user_local_bin_on_path

    cat > "$HOME/.local/bin/openclaw" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec node "${repo_dir}/dist/entry.js" "\$@"
EOF
    chmod +x "$HOME/.local/bin/openclaw"
    echo -e "${SUCCESS}✓${NC} OpenClaw 包装器已安装到 \$HOME/.local/bin/openclaw"
    echo -e "${INFO}i${NC} 此 checkout 使用 pnpm。要安装依赖，请运行：${INFO}pnpm install${NC} (在仓库中避免使用 npm install)。"
}

# Install OpenClaw
resolve_beta_version() {
    local beta=""
    beta="$(npm view openclaw dist-tags.beta 2>/dev/null || true)"
    if [[ -z "$beta" || "$beta" == "undefined" || "$beta" == "null" ]]; then
        return 1
    fi
    echo "$beta"
}

install_openclaw() {
    local package_name="openclaw"
    if [[ "$USE_BETA" == "1" ]]; then
        local beta_version=""
        beta_version="$(resolve_beta_version || true)"
        if [[ -n "$beta_version" ]]; then
            OPENCLAW_VERSION="$beta_version"
            echo -e "${INFO}i${NC} 检测到 Beta 标签 (${beta_version})；正在安装 beta 版。"
            package_name="openclaw"
        else
            OPENCLAW_VERSION="latest"
            echo -e "${INFO}i${NC} 未找到 Beta 标签；正在安装最新版。"
        fi
    fi

    if [[ -z "${OPENCLAW_VERSION}" ]]; then
        OPENCLAW_VERSION="latest"
    fi

    local resolved_version=""
    resolved_version="$(npm view "${package_name}@${OPENCLAW_VERSION}" version 2>/dev/null || true)"
    if [[ -n "$resolved_version" ]]; then
        echo -e "${WARN}→${NC} 正在安装 OpenClaw ${INFO}${resolved_version}${NC}..."
    else
        echo -e "${WARN}→${NC} 正在安装 OpenClaw (${INFO}${OPENCLAW_VERSION}${NC})..."
    fi
    local install_spec=""
    if [[ "${OPENCLAW_VERSION}" == "latest" ]]; then
        install_spec="${package_name}@latest"
    else
        install_spec="${package_name}@${OPENCLAW_VERSION}"
    fi

    if ! install_openclaw_npm "${install_spec}"; then
        echo -e "${WARN}→${NC} npm 安装失败；正在清理并重试..."
        cleanup_npm_openclaw_paths
        install_openclaw_npm "${install_spec}"
    fi

    if [[ "${OPENCLAW_VERSION}" == "latest" && "${package_name}" == "openclaw" ]]; then
        if ! resolve_openclaw_bin &> /dev/null; then
            echo -e "${WARN}→${NC} npm install openclaw@latest 失败；正在重试 openclaw@next"
            cleanup_npm_openclaw_paths
            install_openclaw_npm "openclaw@next"
        fi
    fi

    ensure_openclaw_bin_link || true

    echo -e "${SUCCESS}✓${NC} OpenClaw 已安装"
}

# Run doctor for migrations (safe, non-interactive)
run_doctor() {
    echo -e "${WARN}→${NC} 正在运行 doctor 以迁移设置..."
    local claw="${OPENCLAW_BIN:-}"
    if [[ -z "$claw" ]]; then
        claw="$(resolve_openclaw_bin || true)"
    fi
    if [[ -z "$claw" ]]; then
        echo -e "${WARN}→${NC} 跳过 doctor：${INFO}openclaw${NC} 尚未在 PATH 中。"
        warn_openclaw_not_found
        return 0
    fi
    "$claw" doctor --non-interactive || true
    echo -e "${SUCCESS}✓${NC} 迁移完成"
}

maybe_open_dashboard() {
    local claw="${OPENCLAW_BIN:-}"
    if [[ -z "$claw" ]]; then
        claw="$(resolve_openclaw_bin || true)"
    fi
    if [[ -z "$claw" ]]; then
        return 0
    fi
    if ! "$claw" dashboard --help >/dev/null 2>&1; then
        return 0
    fi
    "$claw" dashboard || true
}

resolve_workspace_dir() {
    local profile="${OPENCLAW_PROFILE:-default}"
    if [[ "${profile}" != "default" ]]; then
        echo "${HOME}/.openclaw/workspace-${profile}"
    else
        echo "${HOME}/.openclaw/workspace"
    fi
}

run_bootstrap_onboarding_if_needed() {
    if [[ "${NO_ONBOARD}" == "1" ]]; then
        return
    fi

    local config_path="${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
    if [[ -f "${config_path}" || -f "$HOME/.clawdbot/clawdbot.json" || -f "$HOME/.moltbot/moltbot.json" || -f "$HOME/.moldbot/moldbot.json" ]]; then
        return
    fi

    local workspace
    workspace="$(resolve_workspace_dir)"
    local bootstrap="${workspace}/BOOTSTRAP.md"

    if [[ ! -f "${bootstrap}" ]]; then
        return
    fi

    if [[ ! -r /dev/tty || ! -w /dev/tty ]]; then
        echo -e "${WARN}→${NC} 在 ${INFO}${bootstrap}${NC} 发现 BOOTSTRAP.md；无 TTY，跳过 onboarding。"
        echo -e "请稍后运行 ${INFO}openclaw onboard${NC} 完成设置。"
        return
    fi

    echo -e "${WARN}→${NC} 在 ${INFO}${bootstrap}${NC} 发现 BOOTSTRAP.md；正在开始 onboarding..."
    local claw="${OPENCLAW_BIN:-}"
    if [[ -z "$claw" ]]; then
        claw="$(resolve_openclaw_bin || true)"
    fi
    if [[ -z "$claw" ]]; then
        echo -e "${WARN}→${NC} 发现 BOOTSTRAP.md，但 ${INFO}openclaw${NC} 尚未在 PATH 中；跳过 onboarding。"
        warn_openclaw_not_found
        return
    fi

    "$claw" onboard || {
        echo -e "${ERROR}Onboarding 失败；BOOTSTRAP.md 仍然存在。请重新运行 ${INFO}openclaw onboard${ERROR}。${NC}"
        return
    }
}

resolve_openclaw_version() {
    local version=""
    local claw="${OPENCLAW_BIN:-}"
    if [[ -z "$claw" ]] && command -v openclaw &> /dev/null; then
        claw="$(command -v openclaw)"
    fi
    if [[ -n "$claw" ]]; then
        version=$("$claw" --version 2>/dev/null | head -n 1 | tr -d '\r')
    fi
    if [[ -z "$version" ]]; then
        local npm_root=""
        npm_root=$(npm root -g 2>/dev/null || true)
        if [[ -n "$npm_root" && -f "$npm_root/openclaw/package.json" ]]; then
            version=$(node -e "console.log(require('${npm_root}/openclaw/package.json').version)" 2>/dev/null || true)
        fi
    fi
    echo "$version"
}

is_gateway_daemon_loaded() {
    local claw="$1"
    if [[ -z "$claw" ]]; then
        return 1
    fi

    local status_json=""
    status_json="$("$claw" daemon status --json 2>/dev/null || true)"
    if [[ -z "$status_json" ]]; then
        return 1
    fi

    printf '%s' "$status_json" | node -e '
const fs = require("fs");
const raw = fs.readFileSync(0, "utf8").trim();
if (!raw) process.exit(1);
try {
  const data = JSON.parse(raw);
  process.exit(data?.service?.loaded ? 0 : 1);
} catch {
  process.exit(1);
}
' >/dev/null 2>&1
}

# Main installation flow
main() {
    if [[ "$HELP" == "1" ]]; then
        print_usage
        return 0
    fi

    local detected_checkout=""
    detected_checkout="$(detect_openclaw_checkout "$PWD" || true)"

    if [[ -z "$INSTALL_METHOD" && -n "$detected_checkout" ]]; then
        if ! is_promptable; then
            echo -e "${WARN}→${NC} 发现 OpenClaw checkout，但无 TTY；默认为 npm 安装。"
            INSTALL_METHOD="npm"
        else
            local choice=""
            choice="$(prompt_choice "$(cat <<EOF
${WARN}→${NC} 在 ${INFO}${detected_checkout}${NC} 检测到 OpenClaw 源码 checkout
请选择安装方式：
  1) 更新此 checkout (git) 并使用它
  2) 通过 npm 全局安装 (从 git 迁移)
输入 1 或 2：
EOF
)" || true)"

            case "$choice" in
                1) INSTALL_METHOD="git" ;;
                2) INSTALL_METHOD="npm" ;;
                *)
                    echo -e "${ERROR}错误：未选择安装方式。${NC}"
                    echo "请重新运行并指定：--install-method git|npm (或设置 OPENCLAW_INSTALL_METHOD)。"
                    exit 2
                    ;;
            esac
        fi
    fi

    if [[ -z "$INSTALL_METHOD" ]]; then
        INSTALL_METHOD="git"
    fi

    if [[ "$INSTALL_METHOD" != "npm" && "$INSTALL_METHOD" != "git" ]]; then
        echo -e "${ERROR}错误：无效的 --install-method: ${INSTALL_METHOD}${NC}"
        echo "使用：--install-method npm|git"
        exit 2
    fi

    if [[ "$DRY_RUN" == "1" ]]; then
        echo -e "${SUCCESS}✓${NC} 试运行 (Dry run)"
        echo -e "${SUCCESS}✓${NC} 安装方式：${INSTALL_METHOD}"
        if [[ -n "$detected_checkout" ]]; then
            echo -e "${SUCCESS}✓${NC} 检测到 checkout：${detected_checkout}"
        fi
        if [[ "$INSTALL_METHOD" == "git" ]]; then
            echo -e "${SUCCESS}✓${NC} Git 目录：${GIT_DIR}"
            echo -e "${SUCCESS}✓${NC} Git 更新：${GIT_UPDATE}"
        fi
        echo -e "${MUTED}试运行完成 (未做任何更改)。${NC}"
        return 0
    fi

    # Check for existing installation
    local is_upgrade=false
    if check_existing_openclaw; then
        is_upgrade=true
    fi
    local should_open_dashboard=false
    local skip_onboard=false

    # Step 1: Homebrew (macOS only)
    install_homebrew

    # Step 2: Node.js
    if ! check_node; then
        install_node
    fi

    local final_git_dir=""
    if [[ "$INSTALL_METHOD" == "git" ]]; then
        # Clean up npm global install if switching to git
        if npm list -g openclaw &>/dev/null; then
            echo -e "${WARN}→${NC} 正在移除 npm 全局安装 (切换到 git)..."
            npm uninstall -g openclaw 2>/dev/null || true
            echo -e "${SUCCESS}✓${NC} npm 全局安装已移除"
        fi

        local repo_dir="$GIT_DIR"
        if [[ -n "$detected_checkout" ]]; then
            repo_dir="$detected_checkout"
        fi
        final_git_dir="$repo_dir"
        install_openclaw_from_git "$repo_dir"
    else
        # Clean up git wrapper if switching to npm
        if [[ -x "$HOME/.local/bin/openclaw" ]]; then
            echo -e "${WARN}→${NC} 正在移除 git 包装器 (切换到 npm)..."
            rm -f "$HOME/.local/bin/openclaw"
            echo -e "${SUCCESS}✓${NC} git 包装器已移除"
        fi

        # Step 3: Git (required for npm installs that may fetch from git or apply patches)
        if ! check_git; then
            install_git
        fi

        # Step 4: npm permissions (Linux)
        fix_npm_permissions

        # Step 5: OpenClaw
        install_openclaw
    fi

    OPENCLAW_BIN="$(resolve_openclaw_bin || true)"

    # PATH warning: installs can succeed while the user's login shell still lacks npm's global bin dir.
    local npm_bin=""
    npm_bin="$(npm_global_bin_dir || true)"
    if [[ "$INSTALL_METHOD" == "npm" ]]; then
        warn_shell_path_missing_dir "$npm_bin" "npm global bin dir"
    fi
    if [[ "$INSTALL_METHOD" == "git" ]]; then
        if [[ -x "$HOME/.local/bin/openclaw" ]]; then
            warn_shell_path_missing_dir "$HOME/.local/bin" "user-local bin dir (~/.local/bin)"
        fi
    fi

    # Step 6: Run doctor for migrations on upgrades and git installs
    local run_doctor_after=false
    if [[ "$is_upgrade" == "true" || "$INSTALL_METHOD" == "git" ]]; then
        run_doctor_after=true
    fi
    if [[ "$run_doctor_after" == "true" ]]; then
        run_doctor
        should_open_dashboard=true
    fi

    # Step 7: If BOOTSTRAP.md is still present in the workspace, resume onboarding
    run_bootstrap_onboarding_if_needed

    local installed_version
    installed_version=$(resolve_openclaw_version)

    echo ""
    if [[ -n "$installed_version" ]]; then
        echo -e "${SUCCESS}${BOLD}🦞 OpenClaw 安装成功 (${installed_version})！${NC}"
    else
        echo -e "${SUCCESS}${BOLD}🦞 OpenClaw 安装成功！${NC}"
    fi
    if [[ "$is_upgrade" == "true" ]]; then
        local update_messages=(
            "升级达成！解锁新技能。不客气。"
            "代码新鲜出炉，龙虾依旧。想我了吗？"
            "回归且更强。你甚至都没注意到我离开了吧？"
            "更新完成。我在外面学会了一些新把戏。"
            "已升级！现在增加了 23% 的俏皮话。"
            "我进化了。努力跟上吧。🦞"
            "新版本，哪位？噢对了，还是我，但是更闪亮了。"
            "已修补，已打磨，随时准备开夹。走起。"
            "龙虾已蜕壳。壳更硬，钳更利。"
            "更新完毕！查看变更日志或者直接相信我，真的很棒。"
            "从 npm 的沸水中重生。现在更强了。"
            "我离开了一会儿，回来变聪明了。你也该试试。"
            "更新完成。Bug 怕我，所以它们跑了。"
            "新版本已安装。旧版本向你问好。"
            "固件新鲜。大脑皱纹：已增加。"
            "我见过你们无法置信的事物。总之，我更新了。"
            "重新上线。变更日志很长，但我们的友谊更长。"
            "已升级！Peter 修了一些东西。如果坏了就怪他。"
            "蜕壳完成。请不要看我的软壳期。"
            "版本跃升！同样的混乱能量，更少的崩溃（大概）。"
        )
        local update_message
        update_message="${update_messages[RANDOM % ${#update_messages[@]}]}"
        echo -e "${MUTED}${update_message}${NC}"
    else
        local completion_messages=(
            "啊不错，我喜欢这里。有零食吗？"
            "甜蜜的家。别担心，我不会乱动家具。"
            "我进来了。让我们搞点负责任的破坏吧。"
            "安装完成。你的生产力即将变得怪异。"
            "安顿好了。是时候自动化你的生活了，不管你准备好没。"
            "舒适。我已经看过你的日历了。我们需要谈谈。"
            "终于拆完包了。现在把我指向你的问题吧。"
            "咔咔钳子 好了，由于什么原因我们要构建什么？"
            "龙虾已着陆。你的终端将不再一样。"
            "全部搞定！我保证只稍微评判一下你的代码。"
        )
        local completion_message
        completion_message="${completion_messages[RANDOM % ${#completion_messages[@]}]}"
        echo -e "${MUTED}${completion_message}${NC}"
    fi
    echo ""

    if [[ "$INSTALL_METHOD" == "git" && -n "$final_git_dir" ]]; then
        echo -e "源码检出：${INFO}${final_git_dir}${NC}"
        echo -e "包装器：${INFO}\$HOME/.local/bin/openclaw${NC}"
        echo -e "已从源码安装。后续更新请运行：${INFO}openclaw update --restart${NC}"
        echo -e "后续切换到全局安装：${INFO}curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash -s -- --install-method npm${NC}"
    elif [[ "$is_upgrade" == "true" ]]; then
        echo -e "升级完成。"
        if [[ -r /dev/tty && -w /dev/tty ]]; then
            local claw="${OPENCLAW_BIN:-}"
            if [[ -z "$claw" ]]; then
                claw="$(resolve_openclaw_bin || true)"
            fi
            if [[ -z "$claw" ]]; then
                echo -e "${WARN}→${NC} 跳过 doctor：${INFO}openclaw${NC} 尚未在 PATH 中。"
                warn_openclaw_not_found
                return 0
            fi
            local -a doctor_args=()
            if [[ "$NO_ONBOARD" == "1" ]]; then
                if "$claw" doctor --help 2>/dev/null | grep -q -- "--non-interactive"; then
                    doctor_args+=("--non-interactive")
                fi
            fi
            echo -e "正在运行 ${INFO}openclaw doctor${NC}..."
            local doctor_ok=0
            if (( ${#doctor_args[@]} )); then
                OPENCLAW_UPDATE_IN_PROGRESS=1 "$claw" doctor "${doctor_args[@]}" </dev/tty && doctor_ok=1
            else
                OPENCLAW_UPDATE_IN_PROGRESS=1 "$claw" doctor </dev/tty && doctor_ok=1
            fi
            if (( doctor_ok )); then
                echo -e "正在更新插件 (${INFO}openclaw plugins update --all${NC})..."
                OPENCLAW_UPDATE_IN_PROGRESS=1 "$claw" plugins update --all || true
            else
                echo -e "${WARN}→${NC} Doctor 失败；跳过插件更新。"
            fi
        else
            echo -e "${WARN}→${NC} 无 TTY 可用；跳过 doctor。"
            echo -e "请运行 ${INFO}openclaw doctor${NC}，然后运行 ${INFO}openclaw plugins update --all${NC}。"
        fi
    else
        if [[ "$NO_ONBOARD" == "1" || "$skip_onboard" == "true" ]]; then
            echo -e "跳过 onboard（应请求）。请稍后运行 ${INFO}openclaw onboard${NC}。"
        else
            local config_path="${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
            if [[ -f "${config_path}" || -f "$HOME/.clawdbot/clawdbot.json" || -f "$HOME/.moltbot/moltbot.json" || -f "$HOME/.moldbot/moldbot.json" ]]; then
                echo -e "配置已存在；正在运行 doctor..."
                run_doctor
                should_open_dashboard=true
                echo -e "配置已存在；跳过 onboarding。"
                skip_onboard=true
            fi
            echo -e "正在开始设置..."
            echo ""
            if [[ -r /dev/tty && -w /dev/tty ]]; then
                local claw="${OPENCLAW_BIN:-}"
                if [[ -z "$claw" ]]; then
                    claw="$(resolve_openclaw_bin || true)"
                fi
                if [[ -z "$claw" ]]; then
                    echo -e "${WARN}→${NC} 跳过 onboarding：${INFO}openclaw${NC} 尚未在 PATH 中。"
                    warn_openclaw_not_found
                    return 0
                fi
                exec </dev/tty
                exec "$claw" onboard
            fi
            echo -e "${WARN}→${NC} 无 TTY 可用；跳过 onboarding。"
            echo -e "请稍后运行 ${INFO}openclaw onboard${NC}。"
            return 0
        fi
    fi

    if command -v openclaw &> /dev/null; then
        local claw="${OPENCLAW_BIN:-}"
        if [[ -z "$claw" ]]; then
            claw="$(resolve_openclaw_bin || true)"
        fi
        if [[ -n "$claw" ]] && is_gateway_daemon_loaded "$claw"; then
            if [[ "$DRY_RUN" == "1" ]]; then
                echo -e "${INFO}i${NC} 检测到网关守护进程；将重启 (${INFO}openclaw daemon restart${NC})。"
            else
                echo -e "${INFO}i${NC} 检测到网关守护进程；正在重启..."
                if OPENCLAW_UPDATE_IN_PROGRESS=1 "$claw" daemon restart >/dev/null 2>&1; then
                    echo -e "${SUCCESS}✓${NC} 网关已重启。"
                else
                    echo -e "${WARN}→${NC} 网关重启失败；尝试：${INFO}openclaw daemon restart${NC}"
                fi
            fi
        fi
    fi

    if [[ "$should_open_dashboard" == "true" ]]; then
        maybe_open_dashboard
    fi

    echo ""
    echo -e "中文社区: ${INFO}https://pd.qq.com/s/46ogez1gd${NC}"
    echo -e "FAQ: ${INFO}https://docs.openclaw.ai/start/faq${NC}"
}

if [[ "${OPENCLAW_INSTALL_SH_NO_RUN:-0}" != "1" ]]; then
    parse_args "$@"
    configure_verbose
    main
fi
