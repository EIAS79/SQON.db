"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const colors_1 = __importDefault(require("./colors"));
const utiles_1 = require("../Types/utiles");
class Logger {
    getTimestamp() {
        const now = new Date();
        return new Intl.DateTimeFormat("default", {
            dateStyle: "short",
            timeStyle: "medium",
        }).format(now);
    }
    formatMessage(level, emoji, details, color) {
        const timestamp = `${colors_1.default.fg.gray}${this.getTimestamp()}${colors_1.default.reset}`;
        const levelTag = `${color}${emoji} [${level}]${colors_1.default.reset}`;
        const detailString = JSON.stringify(details, null, 2);
        return `${timestamp} ${levelTag}: ${detailString}`;
    }
    error(message, details) {
        const errorDetails = { message, ...details };
        console.error(this.formatMessage(utiles_1.LogLevel.ERROR, "❌", errorDetails, colors_1.default.fg.red));
    }
    warn(details) {
        const warningLevel = details.level;
        const color = warningLevel === 1
            ? colors_1.default.fg.yellow
            : warningLevel === 2
                ? colors_1.default.fg.magenta
                : colors_1.default.fg.red;
        console.warn(this.formatMessage(utiles_1.LogLevel.WARN, "⚠️", details, color));
    }
    info(details) {
        console.info(this.formatMessage(utiles_1.LogLevel.INFO, "ℹ️", details, colors_1.default.fg.blue));
    }
    success(details) {
        console.log(this.formatMessage(utiles_1.LogLevel.SUCCESS, "✅", details, colors_1.default.fg.green));
    }
}
exports.default = Logger;
//# sourceMappingURL=loggers.js.map