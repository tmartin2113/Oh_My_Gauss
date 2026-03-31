import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const rootLogger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: { service: "oh-my-gauss" },
});

export function createLogger(name: string) {
  return rootLogger.child({ module: name });
}

export type Logger = pino.Logger;
