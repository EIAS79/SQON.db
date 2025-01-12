import * as fs from 'fs';
import * as lockfile from 'proper-lockfile';
import { AdapterResults } from '../Types/core';
import { nuv_query } from './nuv_query';
import { Index, QueryOptions } from '../Types/query';
import Logger from '../Functions/loggers';
import { Nuvira } from 'nuvira-parser';
class WorkerPool {
  private tasks: Array<() => Promise<void>> = [];
  private activeWorkers = 0;
  private maxWorkers: number;


  constructor(maxWorkers: number) {
    this.maxWorkers = maxWorkers;

  }

  async addTask(task: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.tasks.push(async () => {
        try {
          await task();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      this.processTasks();
    });
  }

  private async processTasks() {
    if (this.activeWorkers >= this.maxWorkers || this.tasks.length === 0) return;

    this.activeWorkers++;
    const task = this.tasks.shift()!;
    try {
      await task();
    } finally {
      this.activeWorkers--;
      this.processTasks();
    }
  }
}

export class nuv_crud {
  private workerPool = new WorkerPool(10);
  public logger: Logger;
  public indexes: Index | null = null;
  public queryClass: nuv_query;
  public indexField: any
  constructor( indexes: Index | null , indexField: any) {
    this.logger = new Logger();
    this.indexes = indexes;
    this.queryClass = new nuv_query(this.indexes)
    this.indexField = indexField
  }

/**
 * Adds a record or multiple records to the database.
 * @param file The file to update.
 * @param record The record(s) to add.
 * @returns A promise that resolves to true if the operation is successful.
 */
public async addRecord(file: string, record: any): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    this.workerPool.addTask(async () => {
      try {

        if (!this.indexes || !this.indexes.primary || !this.indexes.schema) {
          throw new Error('Indexes are not built or schema is missing. Please call buildIndex() first.');
        }

        const db = new Nuvira({ filePath: file });

        const schema = this.indexes.schema;
        const recordsToAdd = Array.isArray(record) ? record : [record];

        for (const rec of recordsToAdd) {
          const validationResult = await db.validateData({
            schema: schema,
            validateData: this.indexes.validations,
            data: rec,
            strict: this.indexes.fileRules?.Strict || false,
          });

          if (!validationResult.valid) {
            const errorMessages = validationResult.errors
              ?.map((error: any) => error.message || 'Unknown error')
              .join(', ');
            throw new Error(`Validation failed for record: ${errorMessages}`);
          }
        }

        await this.withLock(file, async () => {
          const tempFilePath = `${file}.tmp`;
          const readStream = fs.createReadStream(file, { encoding: 'utf-8' });
          const writeStream = fs.createWriteStream(tempFilePath, { encoding: 'utf-8' });

          let insideRecordsSection = false;
          let inserted = false;

          const formattedRecords = recordsToAdd
            .map((rec) => {
              const docId = this.getNextDocId();
              this.indexes!.primary[docId] = rec;
              this.indexRecord(docId, rec);
              return `#${docId} -> ${this.formatData(rec)}`;
            })
            .join('\n');

          for await (const chunk of readStream) {
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.trim() === '@records') {
                insideRecordsSection = true;
                writeStream.write(`${line}\n`);
                continue;
              }

              if (insideRecordsSection && line.trim() === '@end') {
                if (!inserted) {
                  writeStream.write(`${formattedRecords}\n`);
                  inserted = true;
                }
                insideRecordsSection = false;
              }

              writeStream.write(`${line}\n`);
            }
          }

          if (!inserted) {
            throw new Error('Could not find the @records section or @end tag in the file.');
          }

          readStream.close();
          writeStream.end();

          await fs.promises.rename(tempFilePath, file);
        });

        resolve(true);
      } catch (err) {
        reject(err);
      }
    });
  });
}

  
public async update(
  file: string,
  query: QueryOptions,
  newData: any,
  options: { upsert?: boolean; doc?: number } = {}
): Promise<AdapterResults<any>> {
  const { upsert = false, doc = Infinity } = options;

  return new Promise<AdapterResults<any>>((resolve, reject) => {
    this.workerPool.addTask(async () => {
      try {
        if (!this.indexes || !this.indexes.primary) {
          throw new Error('Indexes are not built. Please call buildIndex() first.');
        }

        const queryResults = await this.queryClass.query(query);

        if (queryResults.results.length === 0) {
          if (upsert) {
            await this.addRecord(file, newData);
            resolve({
              acknowledge: true,
              results: [],
              message: 'No matching document found. New record added.',
            });
            return;
          } else {
            resolve({
              acknowledge: false,
              results: [],
              message: 'No matching document found.',
            });
            return;
          }
        }

        await this.withLock(file, async () => {
          const tempFilePath = `${file}.tmp`;
          const readStream = fs.createReadStream(file, { encoding: 'utf-8' });
          const writeStream = fs.createWriteStream(tempFilePath, { encoding: 'utf-8' });

          let currentRecord = '';
          let updatingRecord = false;
          let updated = false;
          let foundEndTag = false;

          for await (const chunk of readStream) {
            const lines = chunk.split('\n');
            for (const line of lines) {
              const trimmedLine = line.trim();

              const recordMatch = /^#(\d+)\s*->\s*(.*)/.exec(trimmedLine);
              
              if (recordMatch) {
                if (updatingRecord) {
                  writeStream.write(currentRecord + '\n'); 
                }
                currentRecord = trimmedLine;

                const docId = parseInt(recordMatch[1], 10);
                if (queryResults.results.some((result: any) => result.docNumber === docId.toString())) {
                  updatingRecord = true;
                  continue; 
                }
              }

              if (updatingRecord) {
                if (trimmedLine === '@end') {
                  // Apply operations and write the updated record
                  let updatedRecord = currentRecord;
              
                  if (newData) {
                    updatedRecord = this.applyOperations(updatedRecord, newData);
                  }
              
                  writeStream.write(updatedRecord + '\n');
                  updatingRecord = false; // Reset flag
                  updated = true;
                  foundEndTag = true; // We found @end for this record
                } else {
                  currentRecord += '\n' + trimmedLine; // Accumulate multi-line record
                }
              } else {
                writeStream.write(line + '\n');
              }
            }
          }

          if (updatingRecord) {
            let updatedRecord = currentRecord;
            Object.keys(newData).forEach(key => {
              const regex = new RegExp(`${key}\\([^)]+\\)`, 'g');
              const newValue = this.formatData({ [key]: newData[key] }).trim().slice(key.length + 1, -2);
              updatedRecord = updatedRecord.replace(regex, `${key}(${newValue})`);
            });
            writeStream.write(updatedRecord + '\n');
            updated = true;
          }
          
          writeStream.write('@end\n');
          
          readStream.close();
          writeStream.end();

          if (updated) {
            await fs.promises.rename(tempFilePath, file);
            resolve({
              acknowledge: true,
              results: [],
              message: 'Document updated successfully.',
            });
          } else {
            resolve({
              acknowledge: false,
              results: [],
              message: 'No matching document found to update.',
            });
          }
        });
      } catch (err) {
        reject({
          acknowledge: false,
          results: [],
          errorMessage: err instanceof Error ? err.stack || err.message : 'Unknown error',
        });
      }
    });
  });
}


  /**
   * Executes an action with a file lock to ensure safe access.
   * @param filePath The file to lock.
   * @param action The action to execute while the file is locked.
   */
  private async withLock(filePath: string, action: () => Promise<void>): Promise<void> {
    const release = await lockfile.lock(filePath, { retries: 5 });
    try {
      await action();
    } finally {
      await release();
    }
  }

  /**
   * Indexes a record by its document ID.
   * @param docId The document ID.
   * @param record The record to index.
   */
  private indexRecord(docId: number, record: any) {
    Object.keys(record).forEach((key) => {
      const value = record[key];
      let fieldType: string;

      if (typeof value === 'string') {
        fieldType = 'String';
      } else if (typeof value === 'number') {
        fieldType = 'Number';
      } else if (typeof value === 'boolean') {
        fieldType = 'Boolean';
      } else if (value === null) {
        fieldType = 'Null';
      } else if (Buffer.isBuffer(value)) {
        fieldType = 'Buffer';
      } else if (value instanceof Uint8Array) {
        fieldType = 'Uint8Array';
      } else if (value instanceof Date) {
        fieldType = 'Date';
      } else if (Array.isArray(value)) {
        if (value.every(item => typeof item === 'object')) {
          fieldType = 'ObjectArray';
        } else if (value.every(item => typeof item === 'string')) {
          fieldType = 'StringArray';
        } else if (value.every(item => typeof item === 'number')) {
          fieldType = 'NumberArray';
        } else {
          fieldType = 'AnyArray';
        }
      } else if (typeof value === 'object') {
        fieldType = 'Object';
      } else {
        fieldType = 'Unknown';
      }

      const field = { key, value, type: fieldType };
      this.indexField(docId, field, this.indexes!.inverted);
    });
  }

  /**
   * Gets the next document ID for a new record.
   * @param index The index offset for batch operations.
   * @returns The next document ID.
   */
  private getNextDocId(): number {
    const primaryKeys = Object.keys(this.indexes?.primary || {});

    const docIds = primaryKeys
        .map((key) => parseInt(key))
        .filter((id) => !isNaN(id));

    const maxDocId = docIds.length ? Math.max(...docIds) : -1;

    return maxDocId + 1;
}


  /**
   * Formats a record into a string representation.
   * @param data The record to format.
   * @returns The formatted string.
   */
  private formatData(data: any): string {
    let formattedData = '';
    
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        formattedData += `${key}[`;
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            formattedData += ` _${index}{ ${this.formatData(item)} }; `;
          } else if (typeof item === 'string') {
            formattedData += ` _${index}("${item}"); `; // Enclose strings in quotes
          } else {
            formattedData += ` _${index}(${item}); `;
          }
        });
        formattedData += ']; ';
      } else if (typeof value === 'string') {
        formattedData += `${key}("${value}"); `;
      } else if (typeof value === 'number') {
        formattedData += `${key}(${value}); `;
      } else if (typeof value === 'boolean') {
        formattedData += `${key}(${value ? 'TRUE' : 'FALSE'}); `;
      } else if (value instanceof Date) {
        formattedData += `${key}(${value.toISOString()}); `;
      } else if (value === null) {
        formattedData += `${key}(NULL); `;
      } else if (typeof value === 'object') {
        formattedData += `${key}{ ${this.formatData(value)} }; `;
      }
    }
  
    return formattedData;
  }
    
  private applyOperations(record: string, operations: any): string {
    let updatedRecord = record;
  
    Object.keys(operations).forEach(operation => {
      switch (operation) {
        case '$set':
          Object.keys(operations.$set).forEach(key => {
            const regex = new RegExp(`${key}\\([^)]+\\)`, 'g'); // Match the field format
            const newValue = this.formatData({ [key]: operations.$set[key] }).trim().slice(key.length + 1, -2);
  
            if (updatedRecord.match(regex)) {
              updatedRecord = updatedRecord.replace(regex, `${key}(${newValue})`);
            } else {
              updatedRecord += ` ${key}(${newValue})`;
            }
          });
          break;
  
        // Future operations like $unset, $inc, etc., can be added here
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
    });
  
    return updatedRecord;
  }
  
}
