// Tiny zero-dependency colored terminal logger.
// Honors NO_COLOR and disables color when stdout is not a TTY.
const useColor = !process.env.NO_COLOR && process.stdout.isTTY;

const wrap = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const c = {
  reset: wrap(0),
  bold: wrap(1),
  dim: wrap(2),
  italic: wrap(3),
  red: wrap(31),
  green: wrap(32),
  yellow: wrap(33),
  blue: wrap(34),
  magenta: wrap(35),
  cyan: wrap(36),
  gray: wrap(90),
  white: wrap(97),
  brightGreen: wrap(92),
  brightYellow: wrap(93),
  brightBlue: wrap(94),
  brightMagenta: wrap(95),
  brightCyan: wrap(96),
};

const SYM = {
  arrow: "➜",
  step: "◆",
  info: "ℹ",
  ok: "✓",
  fail: "✗",
  warn: "⚠",
  star: "★",
  dot: "•",
  key: "🔑",
  mail: "✉",
  box: "▸",
};

export const sym = SYM;

// A single step line: "◆ <b>title</b> <dim>detail</dim>"
export function step(title, detail) {
  const head = `${c.cyan(SYM.step)} ${c.bold(title)}`;
  console.log(detail ? `${head} ${c.gray(detail)}` : head);
}

// Indented detail under a step.
export function info(label, value) {
  if (value === undefined) {
    console.log(`  ${c.gray(SYM.dot)} ${c.gray(label)}`);
    return;
  }
  console.log(`  ${c.gray(SYM.dot)} ${c.gray(label)} ${c.white ? c.white(value) : value}`);
}

// Green success line.
export function success(msg) {
  console.log(`${c.green(SYM.ok)} ${c.green(msg)}`);
}

// Red error line.
export function error(msg) {
  console.error(`${c.red(SYM.fail)} ${c.red(msg)}`);
}

// Yellow warning line.
export function warn(msg) {
  console.log(`${c.yellow(SYM.warn)} ${c.yellow(msg)}`);
}

// Full-width banner with a title and optional subtitle.
export function banner(title, subtitle) {
  const line = "─".repeat(56);
  console.log(c.brightCyan(line));
  console.log(`${c.brightCyan(c.bold(title))}`);
  if (subtitle) console.log(c.gray(subtitle));
  console.log(c.brightCyan(line));
}

// Section header for one account in a batch.
export function section(index, total, title) {
  const tag = total ? `[${index}/${total}]` : "";
  console.log(`\n${c.magenta(SYM.box)} ${c.bold(c.magenta(tag))} ${c.bold(title)}`);
}

// Key/value highlighted row, e.g. for credentials.
export function field(label, value, color = c.brightYellow) {
  console.log(`  ${c.gray(label.padEnd(10))} ${color(value)}`);
}

export default { c, sym, step, info, success, error, warn, banner, section, field };