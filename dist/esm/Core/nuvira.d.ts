import { NuviraDbConfig, SecureOptions, RestrictionsOptions, AdapterResults } from '../Types/utiles';
import Logger from '../Functions/loggers';
import { Index, QueryOptions } from '../Types/query';
export declare class NuviraDb {
    mode: "local" | "external";
    DirPath: string;
    secure?: SecureOptions;
    restrictions?: RestrictionsOptions;
    logs?: {
        enable?: boolean;
        logFile?: string;
    };
    logger: Logger;
    indexes: Index | null;
    data: any[];
    private asyncLocalStorage;
    private indexBuildingEmitter;
    private indexBuildingPromise;
    private isIndexReady;
    private NuvCrud;
    private NuvQuery;
    constructor(config: NuviraDbConfig);
    use(fileName: string, callback: () => Promise<any>): Promise<any>;
    activeFiles(): Promise<string>;
    indexField(docId: number, field: any, inverted: Record<string, Record<any, number[]>>): void;
    chunkData<T>(data: T[], chunkSize: number): Generator<T[]>;
    private createIndex;
    private lazyLoadNuvRecords;
    buildIndex(): Promise<AdapterResults<null>>;
    search(queryOptions?: QueryOptions): Promise<AdapterResults<any[]>>;
    insert(record: any): Promise<boolean>;
    update(query: QueryOptions, newData: any, options?: {
        upsert?: boolean;
        doc?: number;
    }): Promise<AdapterResults<any>>;
}
//# sourceMappingURL=nuvira.d.ts.map