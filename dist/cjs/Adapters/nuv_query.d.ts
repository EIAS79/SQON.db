import { QueryOptions, Index } from '../Types/query';
import { AdapterResults } from '../Types/utiles';
import Logger from '../Functions/loggers';
export declare class nuv_query {
    private vector;
    logger: Logger;
    indexes: Index | null;
    constructor(indexes: Index | null);
    query(queryOptions?: QueryOptions): Promise<AdapterResults<any[]>>;
    private applyFilters;
    private groupBy;
    private applySorting;
    private applyPagination;
    private applyProjection;
    private applyTextSearch;
    private matchesFuzzySearch;
    private calculateSimilarity;
    private levenshteinDistance;
    private fuzzySearchInRecord;
    private matchesSearch;
    private searchInRecord;
    chunkData<T>(data: T[], chunkSize: number): Generator<T[]>;
    private deepGet;
}
//# sourceMappingURL=nuv_query.d.ts.map