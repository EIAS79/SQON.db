import { recordPath } from '../Functions/recordPath';
import { query_operators } from '../Functions/queryOperators';
import nuv_vector from './vectors';
import Logger from '../Functions/loggers';
export class nuv_query {
    vector;
    logger;
    indexes = null;
    constructor(indexes) {
        this.vector = new nuv_vector(indexes);
        this.logger = new Logger();
        this.indexes = indexes;
    }
    async query(queryOptions = {}) {
        let results = [];
        const operations = {
            filter: (filterOptions) => {
                results = results.filter(item => this.applyFilters([item.data], filterOptions)[0] !== undefined);
            },
            groupBy: (groupByOptions) => {
                results = this.groupBy(results.map(item => item.data), groupByOptions);
            },
            projection: (projectionOptions) => {
                results = results.map(item => ({
                    docNumber: item.docNumber,
                    data: this.applyProjection([item.data], projectionOptions)[0],
                }));
            },
            sorting: (sortingOptions) => {
                results = this.applySorting(results.map(item => item.data), sortingOptions);
            },
            pagination: (paginationOptions) => {
                results = this.applyPagination(results, paginationOptions);
            },
            textSearch: (textSearchOptions) => {
                const { query, fields } = textSearchOptions;
                results = results.map(item => ({
                    docNumber: item.docNumber,
                    data: this.applyTextSearch([item.data], query, fields)[0],
                }));
            },
            vectorSearch: async (vectorSearchOptions) => {
                if (!vectorSearchOptions.queryVector && !vectorSearchOptions.queryText) {
                    throw new Error("Either queryVector or queryText must be provided.");
                }
                const vectorResults = await this.vector.query({
                    queryVector: vectorSearchOptions.queryVector,
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
            customValidation: (validationFn) => {
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
            limit: (limit) => {
                results = results.slice(0, limit);
            },
        };
        const pipeline = queryOptions.pipeline || [];
        try {
            for (const chunk of this.chunkData(Object.entries(this.indexes.primary), 5000)) {
                const chunkKeys = chunk.map(([key]) => String(key));
                const chunkResults = chunk.map(([_, value]) => value);
                const formattedResults = chunkKeys.map((key, index) => ({
                    docNumber: key,
                    data: chunkResults[index].map((field) => ({
                        key: field.key,
                        value: field.value,
                        type: field.type,
                    })),
                }));
                results.push(...formattedResults);
                for (const step of pipeline) {
                    if (typeof step === 'string' && operations[step]) {
                        const options = queryOptions[step];
                        if (options !== undefined) {
                            operations[step](options);
                        }
                    }
                    else if (typeof step === 'object') {
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
        }
        catch (err) {
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
    applyFilters(records, filters) {
        return Object.entries(records).filter(([docId, data]) => {
            return query_operators(data, filters);
        }).map(([docId]) => records[docId]);
    }
    groupBy(records, groupByField) {
        const grouped = new Map();
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
    applySorting(records, sort) {
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
    applyPagination(records, pagination) {
        if (!pagination)
            return records;
        let { skip = 0, limit = 10 } = pagination;
        const { page, pageSize } = pagination;
        if (page !== undefined && pageSize !== undefined) {
            skip = (page - 1) * pageSize;
            limit = pageSize;
        }
        return records.slice(skip, skip + limit);
    }
    applyProjection(records, projection = []) {
        if (!projection.length)
            return records;
        return records.map(record => {
            const projectedRecord = {};
            projection.forEach(field => {
                projectedRecord[field] = this.deepGet(record, field);
            });
            return projectedRecord;
        });
    }
    applyTextSearch(records, searchQuery, fields, exactMatch = false, fuzzy = false) {
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
    matchesFuzzySearch(value, searchQuery) {
        if (value == null)
            return false;
        const stringValue = String(value).toLowerCase();
        const threshold = 0.7;
        const similarity = this.calculateSimilarity(stringValue, searchQuery);
        return similarity >= threshold;
    }
    calculateSimilarity(str1, str2) {
        const distance = this.levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);
        return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
    }
    levenshteinDistance(a, b) {
        const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
        for (let i = 0; i <= a.length; i++)
            dp[i][0] = i;
        for (let j = 0; j <= b.length; j++)
            dp[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                if (a[i - 1] === b[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                }
                else {
                    dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
                }
            }
        }
        return dp[a.length][b.length];
    }
    fuzzySearchInRecord(record, searchQuery) {
        if (Array.isArray(record)) {
            return record.some(item => this.fuzzySearchInRecord(item, searchQuery));
        }
        if (typeof record === 'object' && record !== null) {
            return Object.values(record).some(value => this.fuzzySearchInRecord(value, searchQuery));
        }
        return this.matchesFuzzySearch(record, searchQuery);
    }
    matchesSearch(value, searchQuery, exactMatch) {
        if (value == null)
            return false;
        const stringValue = String(value).toLowerCase();
        return exactMatch ? stringValue === searchQuery : stringValue.includes(searchQuery);
    }
    searchInRecord(record, searchQuery, exactMatch) {
        if (Array.isArray(record)) {
            return record.some(item => this.searchInRecord(item, searchQuery, exactMatch));
        }
        if (typeof record === 'object' && record !== null) {
            return Object.values(record).some(value => this.searchInRecord(value, searchQuery, exactMatch));
        }
        return this.matchesSearch(record, searchQuery, exactMatch);
    }
    *chunkData(data, chunkSize) {
        for (let i = 0; i < data.length; i += chunkSize) {
            yield data.slice(i, i + chunkSize);
        }
    }
    deepGet(record, path) {
        const result = recordPath(record, path);
        return result;
    }
}
//# sourceMappingURL=nuv_query.js.map