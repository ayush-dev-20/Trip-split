import { env } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  debug: '\x1b[36m',   // cyan
  info: '\x1b[32m',    // green
  warn: '\x1b[33m',    // yellow
  error: '\x1b[31m',   // red
  method: '\x1b[35m',  // magenta
  path: '\x1b[34m',    // blue
  status2: '\x1b[32m', // green
  status4: '\x1b[33m', // yellow
  status5: '\x1b[31m', // red
};

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

function statusColor(code: number): string {
  if (code >= 500) return COLORS.status5;
  if (code >= 400) return COLORS.status4;
  return COLORS.status2;
}

function format(level: LogLevel, context: string, message: string, meta?: object): string {
  const c = COLORS[level];
  const ts = `${COLORS.dim}${timestamp()}${COLORS.reset}`;
  const lv = `${c}${COLORS.bold}${level.toUpperCase().padEnd(5)}${COLORS.reset}`;
  const ctx = `${COLORS.dim}[${context}]${COLORS.reset}`;
  const msg = `${message}`;
  const extra = meta && Object.keys(meta).length
    ? `\n       ${COLORS.dim}${JSON.stringify(meta, null, 2).replace(/\n/g, '\n       ')}${COLORS.reset}`
    : '';
  return `${ts} ${lv} ${ctx} ${msg}${extra}`;
}

const isDev = env.NODE_ENV !== 'production';

export const logger = {
  debug(context: string, message: string, meta?: object) {
    if (isDev) console.debug(format('debug', context, message, meta));
  },
  info(context: string, message: string, meta?: object) {
    console.info(format('info', context, message, meta));
  },
  warn(context: string, message: string, meta?: object) {
    console.warn(format('warn', context, message, meta));
  },
  error(context: string, message: string, meta?: object) {
    console.error(format('error', context, message, meta));
  },

  /** Log an incoming request */
  request(method: string, path: string, body?: object) {
    if (!isDev) return;
    const m = `${COLORS.method}${COLORS.bold}${method}${COLORS.reset}`;
    const p = `${COLORS.path}${path}${COLORS.reset}`;
    const hasBody = body && Object.keys(body).length > 0;
    // Redact sensitive fields
    const safe = hasBody ? redact(body!) : undefined;
    console.info(format('info', 'Request', `${m} ${p}`, safe));
  },

  /** Log an outgoing response */
  response(method: string, path: string, statusCode: number, ms: number) {
    if (!isDev) return;
    const m = `${COLORS.method}${COLORS.bold}${method}${COLORS.reset}`;
    const p = `${COLORS.path}${path}${COLORS.reset}`;
    const sc = `${statusColor(statusCode)}${COLORS.bold}${statusCode}${COLORS.reset}`;
    const t = `${COLORS.dim}${ms}ms${COLORS.reset}`;
    console.info(format('info', 'Response', `${m} ${p} → ${sc} ${t}`));
  },
};

const SENSITIVE = new Set(['password', 'passwordHash', 'token', 'secret', 'apiKey', 'accessToken', 'refreshToken', 'authorization']);

function redact(obj: object, depth = 0): object {
  if (depth > 4) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE.has(k)) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redact(v as object, depth + 1);
    } else {
      out[k] = v;
    }
  }
  return out;
}
