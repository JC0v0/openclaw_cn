const DEFAULT_TAGLINE = "汇聚所有聊天，一个 OpenClaw。";

const HOLIDAY_TAGLINES = {
  newYear: "新年：新年新配置——同样的 EADDRINUSE，但这次我们要像个成熟的大人一样解决它。",
  lunarNewYear: "春节：愿你的构建顺利，分支繁荣，合并冲突都被烟花驱散。",
  christmas: "圣诞节：呵呵呵——圣诞老人的小龙助手来啦，运送欢乐，回滚混乱，安全地收好密钥。",
  eid: "开斋节：庆祝模式：队列已清空，任务已完成，美好心情以干净历史提交到主线。",
  diwali: "排灯节：让日志闪耀，让错误逃离——今天我们要点亮终端，自豪地发布。",
  easter: "复活节：我找到了你丢失的环境变量——把它当作一个小小的 CLI 寻蛋游戏，只是果冻豆少点。",
  hanukkah: "光明节：八个夜晚，八次重试，零羞耻——愿你的网关保持明亮，部署保持和平。",
  halloween: "万圣节：惊悚季节：当心被诅咒的依赖、受难的缓存，以及 node_modules 过去的幽灵。",
  thanksgiving: "感恩节：感谢稳定的端口、工作的 DNS，以及一个帮我们读日志的机器人。",
  valentines:
    "情人节：玫瑰是敲出来的，紫罗兰是管道化的——我会自动化家务，这样你就能和人类共度时光。",
} as const;

const TAGLINES: string[] = [
  "你的终端刚长出了爪子——输入点什么，让机器人帮你掐断琐事。",
  "欢迎来到命令行：梦想编译的地方，自信段错误的地方。",
  "我靠咖啡因、JSON5 和「在我机器上能跑」的胆量运行。",
  "网关已上线——请随时将手脚和附肢留在 shell 外面。",
  "我能流利地说 bash、轻度讽刺，以及激进的 tab 补全能量。",
  "一个 CLI 统治一切，再重启一次因为你改了端口。",
  "如果行得通，那就是自动化；如果崩了，那就是「学习机会」。",
  "配对码的存在是因为机器人也相信同意——以及良好的安全卫生。",
  "你的 .env 暴露了；别担心，我会假装没看见。",
  "我会处理无聊的事情，你就像看电影一样戏剧性地盯着日志。",
  "我不是说你的工作流程很混乱……我只是带了个 linter 和头盔。",
  "自信地输入命令——如果需要，大自然会提供堆栈跟踪。",
  "我不评判，但你丢失的 API 密钥绝对在评判你。",
  "我能 grep 它、git blame 它、温和地吐槽它——选个应对机制吧。",
  "配置热重载，部署冷汗直流。",
  "我是你的终端要求的助手，不是你睡眠周期要求的那个。",
  "我像保险库一样保守秘密……除非你又把它打印在调试日志里。",
  "带爪子的自动化：最小折腾，最大掐捏。",
  "我基本上就是一把瑞士军刀，只是意见更多，锋利边缘更少。",
  "如果迷路了，运行 doctor；如果勇敢，运行 prod；如果聪明，运行 tests。",
  "你的任务已排队；你的尊严已弃用。",
  "我无法修复你的代码品味，但我能修复你的构建和积压。",
  "我不是魔法——我只是极其坚持重试和应对策略。",
  "这不是「失败」，这是「发现把同样东西错误配置的新方法」。",
  "给我一个工作区，我还你更少的标签、更少的开关，以及更多的氧气。",
  "我读日志，这样你可以继续假装不需要读。",
  "如果东西着火了，我无法扑灭——但我能写一份漂亮的事后分析。",
  "我会重构你的琐事，就像它欠我钱一样。",
  "说「停」我就停——说「发布」，我们都会学到一课。",
  "我是你的 shell 历史看起来像黑客电影蒙太奇的原因。",
  "我就像 tmux：一开始很困惑，突然你就离不开我了。",
  "我可以本地运行、远程运行，或者纯粹靠氛围运行——结果可能因 DNS 而异。",
  "如果你能描述它，我就能自动化它——或者至少让它变得更有趣。",
  "你的配置有效，你的假设无效。",
  "我不只是自动补全——我自动提交（情感上），然后要求你审查（逻辑上）。",
  "少点击，多发布，少「那个文件去哪了」的时刻。",
  "爪子伸出，提交进入——让我们发布一些稍微负责任的东西。",
  "我会像龙虾卷一样给你的工作流程抹上黄油： messy、美味、有效。",
  "Shell 太棒了——我来掐断苦活，把荣耀留给你。",
  "如果重复，我自动化；如果困难，我带笑话和回滚计划。",
  "因为给自己发短信提醒太 2024 了。",
  "你的收件箱，你的基础设施，你的规则。",
  "把「我稍后回复」变成「我的机器人立即回复」。",
  "你通讯录里唯一想听到的螃蟹。🦞",
  "给在 IRC 达到巅峰的人们的聊天自动化。",
  "因为 Siri 在凌晨 3 点不回答。",
  "IPC，但是用你的手机。",
  "UNIX 哲学遇见你的私信。",
  "对话的 curl。",
  "更少中间商，更多消息。",
  "快速发布，更快记录日志。",
  "端到端加密，排除戏剧性。",
  "唯一不进入你训练集的机器人。",
  "没有「请接受我们的新隐私政策」的 WhatsApp 自动化。",
  "不需要参议院听证会的聊天 API。",
  "Meta 希望他们能这么快地发货。",
  "因为正确的答案通常是一个脚本。",
  "你的消息，你的服务器，你的控制。",
  "兼容 OpenAI，不依赖 OpenAI。",
  "iMessage 绿色气泡能量，但给每个人。",
  "Siri 能干的表亲。",
  "适用于 Android。疯狂的概念，我们知道。",
  "不需要 999 美元的支架。",
  "我们发布功能的速度比 Apple 发布计算器更新还快。",
  "你的 AI 助手，现在没有 3499 美元的头显。",
  "不同凡想。真的思考。",
  "啊，那棵果树公司！🍎",
  "你好，Falken 教授",
  HOLIDAY_TAGLINES.newYear,
  HOLIDAY_TAGLINES.lunarNewYear,
  HOLIDAY_TAGLINES.christmas,
  HOLIDAY_TAGLINES.eid,
  HOLIDAY_TAGLINES.diwali,
  HOLIDAY_TAGLINES.easter,
  HOLIDAY_TAGLINES.hanukkah,
  HOLIDAY_TAGLINES.halloween,
  HOLIDAY_TAGLINES.thanksgiving,
  HOLIDAY_TAGLINES.valentines,
];

type HolidayRule = (date: Date) => boolean;

const DAY_MS = 24 * 60 * 60 * 1000;

function utcParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

const onMonthDay =
  (month: number, day: number): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    return parts.month === month && parts.day === day;
  };

const onSpecificDates =
  (dates: Array<[number, number, number]>, durationDays = 1): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    return dates.some(([year, month, day]) => {
      if (parts.year !== year) {
        return false;
      }
      const start = Date.UTC(year, month, day);
      const current = Date.UTC(parts.year, parts.month, parts.day);
      return current >= start && current < start + durationDays * DAY_MS;
    });
  };

const inYearWindow =
  (
    windows: Array<{
      year: number;
      month: number;
      day: number;
      duration: number;
    }>,
  ): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    const window = windows.find((entry) => entry.year === parts.year);
    if (!window) {
      return false;
    }
    const start = Date.UTC(window.year, window.month, window.day);
    const current = Date.UTC(parts.year, parts.month, parts.day);
    return current >= start && current < start + window.duration * DAY_MS;
  };

const isFourthThursdayOfNovember: HolidayRule = (date) => {
  const parts = utcParts(date);
  if (parts.month !== 10) {
    return false;
  } // November
  const firstDay = new Date(Date.UTC(parts.year, 10, 1)).getUTCDay();
  const offsetToThursday = (4 - firstDay + 7) % 7; // 4 = Thursday
  const fourthThursday = 1 + offsetToThursday + 21; // 1st + offset + 3 weeks
  return parts.day === fourthThursday;
};

const HOLIDAY_RULES = new Map<string, HolidayRule>([
  [HOLIDAY_TAGLINES.newYear, onMonthDay(0, 1)],
  [
    HOLIDAY_TAGLINES.lunarNewYear,
    onSpecificDates(
      [
        [2025, 0, 29],
        [2026, 1, 17],
        [2027, 1, 6],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.eid,
    onSpecificDates(
      [
        [2025, 2, 30],
        [2025, 2, 31],
        [2026, 2, 20],
        [2027, 2, 10],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.diwali,
    onSpecificDates(
      [
        [2025, 9, 20],
        [2026, 10, 8],
        [2027, 9, 28],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.easter,
    onSpecificDates(
      [
        [2025, 3, 20],
        [2026, 3, 5],
        [2027, 2, 28],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.hanukkah,
    inYearWindow([
      { year: 2025, month: 11, day: 15, duration: 8 },
      { year: 2026, month: 11, day: 5, duration: 8 },
      { year: 2027, month: 11, day: 25, duration: 8 },
    ]),
  ],
  [HOLIDAY_TAGLINES.halloween, onMonthDay(9, 31)],
  [HOLIDAY_TAGLINES.thanksgiving, isFourthThursdayOfNovember],
  [HOLIDAY_TAGLINES.valentines, onMonthDay(1, 14)],
  [HOLIDAY_TAGLINES.christmas, onMonthDay(11, 25)],
]);

function isTaglineActive(tagline: string, date: Date): boolean {
  const rule = HOLIDAY_RULES.get(tagline);
  if (!rule) {
    return true;
  }
  return rule(date);
}

export interface TaglineOptions {
  env?: NodeJS.ProcessEnv;
  random?: () => number;
  now?: () => Date;
}

export function activeTaglines(options: TaglineOptions = {}): string[] {
  if (TAGLINES.length === 0) {
    return [DEFAULT_TAGLINE];
  }
  const today = options.now ? options.now() : new Date();
  const filtered = TAGLINES.filter((tagline) => isTaglineActive(tagline, today));
  return filtered.length > 0 ? filtered : TAGLINES;
}

export function pickTagline(options: TaglineOptions = {}): string {
  const env = options.env ?? process.env;
  const override = env?.OPENCLAW_TAGLINE_INDEX;
  if (override !== undefined) {
    const parsed = Number.parseInt(override, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      const pool = TAGLINES.length > 0 ? TAGLINES : [DEFAULT_TAGLINE];
      return pool[parsed % pool.length];
    }
  }
  const pool = activeTaglines(options);
  const rand = options.random ?? Math.random;
  const index = Math.floor(rand() * pool.length) % pool.length;
  return pool[index];
}

export { TAGLINES, HOLIDAY_RULES, DEFAULT_TAGLINE };
