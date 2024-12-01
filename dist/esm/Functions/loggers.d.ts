import { LogErrorDetails, LogWarningDetails, LogInfoDetails, LogSuccessDetails } from "../Types/utiles";
declare class Logger {
    private getTimestamp;
    private formatMessage;
    error(message: string, details: LogErrorDetails): void;
    warn(details: LogWarningDetails): void;
    info(details: LogInfoDetails): void;
    success(details: LogSuccessDetails): void;
}
export default Logger;
//# sourceMappingURL=loggers.d.ts.map