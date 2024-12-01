export declare enum LogLevel {
    ERROR = "ERROR",
    WARN = "WARN",
    INFO = "INFO",
    SUCCESS = "SUCCESS"
}
export interface LogErrorDetails {
    cause: string;
    fixMessage: string;
    stack?: string;
}
export interface LogWarningDetails {
    level: number;
    message: string;
}
export interface LogInfoDetails {
    message: string;
    suggestion?: string;
}
export interface LogSuccessDetails {
    message: string;
    valid: true;
}
//# sourceMappingURL=logger.d.ts.map