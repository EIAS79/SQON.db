import { sqon_db } from '../Core/sqon';
import { SqonDbConfig, AdapterResults } from '../Types/utiles';
export declare class sqon_query extends sqon_db {
    private logger;
    constructor(config: SqonDbConfig);
    records(fileName: string): Promise<AdapterResults<any[]>>;
}
//# sourceMappingURL=sqon_query.d.ts.map