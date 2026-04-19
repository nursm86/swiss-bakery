import pino from "pino";
import { config } from "../config.js";

export const logger = pino(
  config.isProd
    ? { level: "info" }
    : {
        level: "debug",
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
        },
      },
);
