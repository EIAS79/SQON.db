import { AdapterResults } from '../Types/core';
import { nuv_query } from './nuv_query';
import { Index, QueryOptions } from '../Types/query';
import Logger from '../Functions/loggers';
export declare class nuv_crud {
    private workerPool;
    logger: Logger;
    indexes: Index | null;
    queryClass: nuv_query;
    indexField: any;
    constructor(indexes: Index | null, indexField: any);
    /**
     * Adds a record or multiple records to the database.
     * @param file The file to update.
     * @param record The record(s) to add.
     * @returns A promise that resolves to true if the operation is successful.
     */
    addRecord(file: string, record: any): Promise<boolean>;
    update(file: string, query: QueryOptions, newData: any, options?: {
        upsert?: boolean;
        doc?: number;
    }): Promise<AdapterResults<any>>;
    /**
     * Executes an action with a file lock to ensure safe access.
     * @param filePath The file to lock.
     * @param action The action to execute while the file is locked.
     */
    private withLock;
    /**
     * Indexes a record by its document ID.
     * @param docId The document ID.
     * @param record The record to index.
     */
    private indexRecord;
    /**
     * Gets the next document ID for a new record.
     * @param index The index offset for batch operations.
     * @returns The next document ID.
     */
    private getNextDocId;
    /**
     * Formats a record into a string representation.
     * @param data The record to format.
     * @returns The formatted string.
     */
    private formatData;
    private applyOperations;
}
//# sourceMappingURL=nuv_crud.d.ts.map