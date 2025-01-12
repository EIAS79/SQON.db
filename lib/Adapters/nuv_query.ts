import { QueryOptions, FilterCondition, Index } from '../Types/query';
import { AdapterResults } from '../Types/utiles';
import { recordPath } from '../Functions/recordPath';
import { query_operators } from '../Functions/queryOperators';
import nuv_vector, { VectorData } from './vectors';
import Logger from '../Functions/loggers';


export class nuv_query {
  private vector: nuv_vector<VectorData>;
  public logger: Logger;
  public indexes: Index | null = null;

  constructor(indexes: Index | null ) {
    this.vector = new nuv_vector<VectorData>(indexes);
    this.logger = new Logger();
    this.indexes = indexes;
  }

  public async query(queryOptions: QueryOptions = {}): Promise<AdapterResults<any[]>> {
    let results: any[] = [];

    const operations: { [key: string]: (options: any) => void } = {
        filter: (filterOptions: FilterCondition) => {
            results = results.filter(item => this.applyFilters([item.data], filterOptions)[0] !== undefined);
        },
        groupBy: (groupByOptions: string) => {
            results = this.groupBy(results.map(item => item.data), groupByOptions);
        },
        projection: (projectionOptions: string[]) => {
            results = results.map(item => ({
                docNumber: item.docNumber,
                data: this.applyProjection([item.data], projectionOptions)[0],
            }));
        },
        sorting: (sortingOptions: { fields: { field: string; order: 'asc' | 'desc' }[] }) => {
            results = this.applySorting(results.map(item => item.data), sortingOptions);
        },
        pagination: (paginationOptions: { skip?: number; limit?: number; page?: number; pageSize?: number }) => {
            results = this.applyPagination(results, paginationOptions);
        },
        textSearch: (textSearchOptions: { query: string; fields?: string[] }) => {
            const { query, fields } = textSearchOptions;
            results = results.map(item => ({
                docNumber: item.docNumber,
                data: this.applyTextSearch([item.data], query, fields)[0],
            }));
        },
        vectorSearch: async (vectorSearchOptions: { 
            queryVector?: number[]; 
            queryText?: string; 
            vectorKeyPath: string; 
            similarityThreshold?: number; 
            metadataKeyPaths?: Record<string, string>; 
            k?: number;
            sorting?: 'asc' | 'desc';
            method?: "cosine" | "euclidean" | "manhattan" | "minkowski" | "pearson" | "jaccard" | "hamming"; 
            projection?: any; 
            data?: any[]; 
            pagination?: {
                pageSize?: number;
                offset?: number;
            }; 
            reduceDimensionality?: {
                method?: "pca" | "tsne"
            }; 
            targetDimension?: number; 
            preprocessMethod?: 'normalize' | 'standardize' | 'robust';
        }) => {
            if (!vectorSearchOptions.queryVector && !vectorSearchOptions.queryText) {
                throw new Error("Either queryVector or queryText must be provided.");
            }

            const vectorResults = await this.vector.query({
                queryVector: vectorSearchOptions.queryVector!,
                queryText: vectorSearchOptions.queryText,
                vectorKeyPath: vectorSearchOptions.vectorKeyPath,
                similarityThreshold: vectorSearchOptions.similarityThreshold,
                metadataKeyPaths: vectorSearchOptions.metadataKeyPaths,
                k: vectorSearchOptions.k,
                sorting: vectorSearchOptions.sorting,
                method: vectorSearchOptions.method,
                projection: vectorSearchOptions.projection,
                data: results.map((r) => r.data),
                pagination: vectorSearchOptions.pagination, 
                reduceDimensionality: vectorSearchOptions.reduceDimensionality,  
                targetDimension: vectorSearchOptions.targetDimension, 
                preprocessMethod: vectorSearchOptions.preprocessMethod
            });

            results = vectorResults.map((r, idx) => ({
                docNumber: results[idx].docNumber,
                data: r.data,
            }));
        },
        customValidation: (validationFn: (data: any[]) => boolean | string) => {
            const validationResult = validationFn(results.map(item => item.data));
            if (validationResult !== true) {
                this.logger?.error('Custom validation failed.', {
                    cause: typeof validationResult === 'string' ? validationResult : 'Custom validation failed.',
                    fixMessage: 'Ensure custom validation function is correct.',
                });
                return {
                    acknowledge: false,
                    results: [],
                    errorMessage: typeof validationResult === 'string' ? validationResult : 'Custom validation failed.',
                };
            }
        },
        limit: (limit: number) => {
            results = results.slice(0, limit);
        },
    };

    const pipeline = queryOptions.pipeline || [];

    try {
        for (const chunk of this.chunkData(Object.entries(this.indexes!.primary), 5000)) {
            const chunkKeys = chunk.map(([key]) => String(key));
            const chunkResults = chunk.map(([_, value]) => value);

            const formattedResults = chunkKeys.map((key, index) => ({
                docNumber: key,
                data: chunkResults[index].map((field: any) => ({
                    key: field.key,
                    value: field.value,
                    type: field.type,
                })),
            }));

            results.push(...formattedResults);

            for (const step of pipeline) {
                if (typeof step === 'string' && operations[step]) {
                    const options = queryOptions[step as keyof QueryOptions];
                    if (options !== undefined) {
                        operations[step](options);
                    }
                } else if (typeof step === 'object') {
                    const customOperation = Object.keys(step)[0];
                    const options = step[customOperation];
                    if (operations[customOperation]) {
                        operations[customOperation](options);
                    }
                }
            }
        }

        results = results.filter(item => item.data !== undefined);

        const message = results.length > 0
            ? 'Found data matching your query.'
            : 'No data found matching your query.';

        return {
            acknowledge: true,
            results: results,
            message: message,
        };
    } catch (err: unknown) {
        this.logger?.error('Error executing query.', {
            cause: err instanceof Error ? err.message : 'Unknown error',
            fixMessage: 'Check the query options and ensure they are valid.',
            stack: err instanceof Error ? err.stack : undefined,
        });

        return {
            acknowledge: false,
            results: [],
            errorMessage: err instanceof Error ? err.stack || err.message : 'Unknown error',
        };
    }
}


  
  private applyFilters(records: Record<string, any>, filters: Record<string, any>): any[] {
    return Object.entries(records).filter(([docId, data]) => {
      return query_operators(data, filters);
    }).map(([docId]) => records[docId]);
  }
  


private groupBy(records: any[], groupByField: string): any[] {
  const grouped = new Map<string, any[]>();

  records.forEach(record => {
    const groupKey = this.deepGet(record, groupByField);
    if (groupKey !== undefined) {
      const key = String(groupKey);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(record);
    }
  });

  return Array.from(grouped.entries()).map(([key, group]) => ({
    groupKey: key,
    records: group,
  }));
}
  
private applySorting(records: any[], sort: { fields: { field: string, order: 'asc' | 'desc' }[] }): any[] {
  return records.sort((a, b) => {
      for (const { field, order } of sort.fields) {
          const valA = this.deepGet(a, field);
          const valB = this.deepGet(b, field);
          if (valA !== valB) {
              return order === 'asc' ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
          }
      }
      return 0;
  });
}

  
private applyPagination(records: any[], pagination: { page?: number, pageSize?: number, skip?: number, limit?: number }): any[] {
  if (!pagination) return records;

  let { skip = 0, limit = 10 } = pagination; 
  const { page, pageSize } = pagination;

  if (page !== undefined && pageSize !== undefined) {
      skip = (page - 1) * pageSize;
      limit = pageSize;
  }

  return records.slice(skip, skip + limit);
}

  
  private applyProjection(records: any[], projection: string[] = []): any[] {
    if (!projection.length) return records;
  
    return records.map(record => {
      const projectedRecord: any = {};
      projection.forEach(field => {
        projectedRecord[field] = this.deepGet(record, field);
      });
      return projectedRecord;
    });
  }

  private applyTextSearch(records: any[], searchQuery: string, fields?: string[], exactMatch: boolean = false, fuzzy: boolean = false): any[] {
    const lowercasedSearchQuery = searchQuery.toLowerCase();

    return records.filter(record => {
        if (fields) {
            return fields.some(field => {
                const fieldValue = this.deepGet(record, field);
                return fuzzy
                    ? this.matchesFuzzySearch(fieldValue, lowercasedSearchQuery)
                    : this.matchesSearch(fieldValue, lowercasedSearchQuery, exactMatch);
            });
        }

        return fuzzy
            ? this.fuzzySearchInRecord(record, lowercasedSearchQuery)
            : this.searchInRecord(record, lowercasedSearchQuery, exactMatch);
    });
}

private matchesFuzzySearch(value: any, searchQuery: string): boolean {
    if (value == null) return false;

    const stringValue = String(value).toLowerCase();
    const threshold = 0.7; 

    const similarity = this.calculateSimilarity(stringValue, searchQuery);
    return similarity >= threshold;
}

private calculateSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength; 
}

private levenshteinDistance(a: string, b: string): number {
    const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
        Array(b.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1]; 
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j],
                    dp[i][j - 1], 
                    dp[i - 1][j - 1]
                ) + 1;
            }
        }
    }

    return dp[a.length][b.length]; 
}

private fuzzySearchInRecord(record: any, searchQuery: string): boolean {
    if (Array.isArray(record)) {
        return record.some(item => this.fuzzySearchInRecord(item, searchQuery)); 
    }

    if (typeof record === 'object' && record !== null) {
        return Object.values(record).some(value => this.fuzzySearchInRecord(value, searchQuery));
    }

    return this.matchesFuzzySearch(record, searchQuery);
}
  
  private matchesSearch(value: any, searchQuery: string, exactMatch: boolean): boolean {
    if (value == null) return false;
  
    const stringValue = String(value).toLowerCase();
    return exactMatch ? stringValue === searchQuery : stringValue.includes(searchQuery);
  }
  
  private searchInRecord(record: any, searchQuery: string, exactMatch: boolean): boolean {
    if (Array.isArray(record)) {
      return record.some(item => this.searchInRecord(item, searchQuery, exactMatch));
    }
  
    if (typeof record === 'object' && record !== null) {
      return Object.values(record).some(value => this.searchInRecord(value, searchQuery, exactMatch)); 
    }
  
    return this.matchesSearch(record, searchQuery, exactMatch);
  }

  public *chunkData<T>(data: T[], chunkSize: number): Generator<T[]> {
    for (let i = 0; i < data.length; i += chunkSize) {
      yield data.slice(i, i + chunkSize);
    }
  }
  
  private deepGet(record: any[], path: string): any {
    const result = recordPath(record, path);
    return result;
  }
}