import { SqonDbConfig, SecureOptions, RestrictionsOptions } from '../Types/utiles';
export declare class sqon_db {
    DirPath: string;
    secure?: SecureOptions;
    restrictions?: RestrictionsOptions;
    logs?: {
        enable: boolean;
        logFile: string;
    };
    constructor(config: SqonDbConfig);
    getFile(fileName: string): string;
}
//# sourceMappingURL=sqon.d.ts.map