import { Logger, LogLevel, Layer } from "effect"

const isProd = process.env.NODE_ENV === "production"

const levelFromEnv = (): LogLevel.LogLevel => {
  const raw = process.env.LOG_LEVEL?.toLowerCase()
  switch (raw) {
    case "trace": return LogLevel.Trace
    case "debug": return LogLevel.Debug
    case "info": return LogLevel.Info
    case "warning": return LogLevel.Warning
    case "error": return LogLevel.Error
    case "fatal": return LogLevel.Fatal
    case "none": return LogLevel.None
    default: return isProd ? LogLevel.Info : LogLevel.Debug
  }
}

const format = isProd ? Logger.json : Logger.pretty

export const LoggerLive = Layer.merge(
  format,
  Logger.minimumLogLevel(levelFromEnv()),
)
