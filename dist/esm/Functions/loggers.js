import colors from "./colors";
import { LogLevel } from "../Types/utiles";
class Logger {
    getTimestamp() {
        const now = new Date();
        return new Intl.DateTimeFormat("default", {
            dateStyle: "short",
            timeStyle: "medium",
        }).format(now);
    }
    formatMessage(level, emoji, details, color) {
        const timestamp = `${colors.fg.gray}${this.getTimestamp()}${colors.reset}`;
        const levelTag = `${color}${emoji} [${level}]${colors.reset}`;
        const detailString = JSON.stringify(details, null, 2);
        return `${timestamp} ${levelTag}: ${detailString}`;
    }
    error(message, details) {
        const errorDetails = { message, ...details };
        console.error(this.formatMessage(LogLevel.ERROR, "❌", errorDetails, colors.fg.red));
    }
    warn(details) {
        const warningLevel = details.level;
        const color = warningLevel === 1
            ? colors.fg.yellow
            : warningLevel === 2
                ? colors.fg.magenta
                : colors.fg.red;
        console.warn(this.formatMessage(LogLevel.WARN, "⚠️", details, color));
    }
    info(details) {
        console.info(this.formatMessage(LogLevel.INFO, "ℹ️", details, colors.fg.blue));
    }
    success(details) {
        console.log(this.formatMessage(LogLevel.SUCCESS, "✅", details, colors.fg.green));
    }
}
export default Logger;
//# sourceMappingURL=loggers.js.map