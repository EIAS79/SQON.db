import colors from "./colors";
import { LogLevel, LogErrorDetails, LogWarningDetails, LogInfoDetails, LogSuccessDetails} from "../Types/utiles";

class Logger {
  private getTimestamp(): string {
    const now = new Date();
    return new Intl.DateTimeFormat("default", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(now);
  }

  private formatMessage(level: LogLevel, emoji: string, details: unknown, color: string): string {
    const timestamp = `${colors.fg.gray}${this.getTimestamp()}${colors.reset}`;
    const levelTag = `${color}${emoji} [${level}]${colors.reset}`;
    const detailString = JSON.stringify(details, null, 2);
    return `${timestamp} ${levelTag}: ${detailString}`;
  }

  public error(message: string, details: LogErrorDetails): void {
    const errorDetails = { message, ...details };
    console.error(
      this.formatMessage(LogLevel.ERROR, "❌", errorDetails, colors.fg.red)
    );
  }

  public warn(details: LogWarningDetails): void {
    const warningLevel = details.level;
    const color =
      warningLevel === 1
        ? colors.fg.yellow
        : warningLevel === 2
        ? colors.fg.magenta
        : colors.fg.red;
    console.warn(
      this.formatMessage(LogLevel.WARN, "⚠️", details, color)
    );
  }

  public info(details: LogInfoDetails): void {
    console.info(
      this.formatMessage(LogLevel.INFO, "ℹ️", details, colors.fg.blue)
    );
  }

  public success(details: LogSuccessDetails): void {
    console.log(
      this.formatMessage(LogLevel.SUCCESS, "✅", details, colors.fg.green)
    );
  }
}

export default Logger;
