import { NuviraDbConfig, SecureOptions, RestrictionsOptions, AdapterResults } from '../Types/utiles';
import { AsyncLocalStorage } from 'async_hooks';
import Logger from '../Functions/loggers';
import { Index, QueryOptions, Relations } from '../Types/query';
import { Nuvira } from 'nuvira-parser';
import { nuv_query } from '../Adapters/nuv_query';
import { nuv_crud } from '../Adapters/nuv_crud';
import { ensureFileExists, getDefaultNuv, getFile, simulateAsyncDelay } from '../Functions/coreFunctions';
import { EventEmitter } from 'events';

export class NuviraDb {
  public mode: "local" | "external";
  public DirPath: string;
  public secure?: SecureOptions;
  public restrictions?: RestrictionsOptions;
  public logs?: { enable?: boolean; logFile?: string };
  public logger: Logger;
  public indexes: Index | null = null;
  public data: any[] = [];
  private asyncLocalStorage = new AsyncLocalStorage<{ activeFile: string }>();

  private indexBuildingEmitter = new EventEmitter();
  private indexBuildingPromise: Promise<AdapterResults<null>> | null = null;
  private isIndexReady = false; 
  private NuvCrud: nuv_crud;
  private NuvQuery: nuv_query;

  constructor(config: NuviraDbConfig) {
    this.mode = config.mode;
    this.DirPath = config.DirPath;
    this.logs = config.logs;
    this.secure = config.secure;
    this.restrictions = config.restrictions;
    this.logger = new Logger();
    this.indexes = { primary: {}, inverted: {} };

    this.NuvCrud = new nuv_crud(this.indexes, this.indexField.bind(this));
    this.NuvQuery = new nuv_query(this.indexes);
  }
  

  public async use(fileName: string, callback: () => Promise<any>): Promise<any> {
    if (this.mode === "local") {
      const fullPath = getFile(this.DirPath, fileName);
  
      return await this.asyncLocalStorage.run({ activeFile: fullPath }, async () => {
        if (!this.isIndexReady) {
          // Wait for the index to be ready
          await new Promise<void>((resolve, reject) => {
            const onReady = () => {
              this.indexBuildingEmitter.off('error', onError); // Cleanup
              resolve();
            };
            const onError = (err: any) => {
              this.indexBuildingEmitter.off('ready', onReady); // Cleanup
              reject(err);
            };
  
            this.indexBuildingEmitter.once('ready', onReady);
            this.indexBuildingEmitter.once('error', onError);
  
            // Trigger index building if not already in progress
            if (!this.indexBuildingPromise) {
              this.buildIndex().catch(onError);
            }
          });
        }
  
        // Proceed with the callback once the index is ready
        return callback();
      });
    } else if (this.mode === "external") {
      // Handle external mode logic
    }
  }
  
  public async activeFiles(): Promise<string> {
    const store = this.asyncLocalStorage.getStore();
    if (!store || !store.activeFile) {
      throw new Error('No active file set. Use the "use" method to set a file context.');
    }
    return store.activeFile;
  }

  public indexField(
    docId: number,
    field: any,
    inverted: Record<string, Record<any, number[]>>
  ) {
    if (['Number', 'String', 'Boolean', 'Null', 'undefined', 'Binary'].includes(field.type)) {
      if (!inverted[field.key]) inverted[field.key] = {};
      if (!inverted[field.key][field.value]) inverted[field.key][field.value] = [];
      inverted[field.key][field.value].push(docId);
    } else if (['ObjectArray', 'Object[]', 'Array', 'Any[]', '[]'].includes(field.type)) {
      if (Array.isArray(field.value)) {
        field.value.forEach((subField: any, index: any) => {
          this.indexField(
            docId,
            { key: `${field.key}[_${index}]`, value: subField.value, type: subField.type },
            inverted
          );
        });
      } else if (['StringArray', 'NumberArray', 'String[]', 'Number[]'].includes(field.type)) {
        field.value.forEach((subField: any, index: number) => {
          this.indexField(
            docId,
            { key: `${field.key}[_${index}]`, value: subField.value, type: subField.type },
            inverted
          );
        });
      } else if (field.type === 'Object') {
        Object.keys(field.value).forEach(subKey => {
          this.indexField(
            docId,
            { key: `${field.key}.${subKey}`, value: field.value[subKey], type: field.value[subKey]?.type || 'Unknown' },
            inverted
          );
        });
      }
    }
  }

  public *chunkData<T>(data: T[], chunkSize: number): Generator<T[]> {
    for (let i = 0; i < data.length; i += chunkSize) {
      yield data.slice(i, i + chunkSize);
    }
  }

  private async createIndex(
    records: any[],
    batchSize: number,
    schema: any,
    validations: any,
    fileRules: any,
    relations: unknown
  ): Promise<Index> {
    const primary: Record<string, any> = {};
    const inverted: Record<string, Record<any, number[]>> = {};
    const relationMappings: Relations = {};
  
    for await (const batch of this.lazyLoadNuvRecords(records, batchSize)) {
      batch.forEach(record => {
        const docId = record['#doc'];
        const data = record['data'];
        primary[docId] = data;
  
        data.forEach((field: any) => this.indexField(docId, field, inverted));
      });
    }
  
    if (typeof relations === 'object' && relations !== null) {
      for (const [relationKey, relationDetails] of Object.entries(relations)) {
        const detail = relationDetails;
        relationMappings[relationKey] = {
          from: detail.from,
          to: detail.to,
          metadata: detail.metadata,
        };
      }
    }
  
    if (!this.indexes) {
      this.indexes = { primary, inverted };
    } else {
      this.indexes.primary = primary;
      this.indexes.inverted = inverted;
    }
  
    this.indexes.schema = schema;
    this.indexes.validations = validations;
    this.indexes.fileRules = fileRules;
    this.indexes.relations = relationMappings;
  
    return {
      primary,
      inverted,
      schema,
      validations,
      fileRules,
      relations: relationMappings,
    };
  }
      

  private async *lazyLoadNuvRecords(records: any[], batchSize: number = 100): AsyncGenerator<any[]> {
    let offset = 0;

    while (offset < records.length) {
      const batch = records.slice(offset, offset + batchSize);
      yield batch;

      offset += batchSize;

      await simulateAsyncDelay(100);
    }
  }

  public async buildIndex(): Promise<AdapterResults<null>> {
    if (this.indexBuildingPromise) {
      return this.indexBuildingPromise;
    }
  
    this.indexBuildingPromise = (async () => {
      try {
        const fullFilePath = await this.activeFiles();
        await ensureFileExists(fullFilePath, getDefaultNuv());
  
        const nuv = new Nuvira({ filePath: fullFilePath });
        const nuvParsing = await nuv.parse();
  
        if (nuvParsing.errors.length > 0) {
          const parsedErrors = nuvParsing.errors
            .map(err => `Line ${err.line}: ${err.message || 'Unknown error'}`)
            .join(', ');
  
          if (this.logs?.enable) {
            this.logger.error('Nuvira Parsing Errors', {
              cause: parsedErrors,
              fixMessage: 'Ensure the file is valid and follows the Nuvira schema.',
            });
          } else {
            throw new Error(parsedErrors);
          }
        }
  
        const { records, schema, validations, fileRules, relations } = nuvParsing;
        const indexes = await this.createIndex(records, 100, schema, validations, fileRules, relations);
        
  
        this.indexes = { ...indexes };
        this.isIndexReady = true;
        this.indexBuildingEmitter.emit('ready');
  
        if (this.logs?.enable) {
          this.logger.success({
            message: `Indexes successfully built for the Nuvira file at path: ${fullFilePath}.`,
            valid: true,
          });
        }
  
        return {
          acknowledge: true,
          results: null,
          message: `Indexes successfully built for the Nuvira file at path: ${fullFilePath}.`,
        };
      } catch (err: unknown) {
        this.indexBuildingEmitter.emit('error', err); 
        this.isIndexReady = false; 
  
        let errorCause: string;
  
        if (err instanceof Error) {
          errorCause = `Error: ${err.message}`;
          if (err.stack) {
            errorCause += `\nStack: ${err.stack}`;
          }
        } else if (typeof err === 'object' && err !== null) {
          errorCause = Object.entries(err)
            .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`)
            .join(', ');
        } else {
          errorCause = String(err);
        }
  
        if (this.logs?.enable) {
          this.logger.error('Error building the Nuvira index.', {
            cause: errorCause,
            fixMessage: 'Check if the file path is correct and the file is readable.',
          });
        } else {
          throw new Error(errorCause);
        }
  
        return {
          acknowledge: false,
          results: null,
          errorMessage: errorCause,
        };
      } finally {
        this.indexBuildingPromise = null;
      }
    })();
  
    return this.indexBuildingPromise;
  }
      
  public async search(queryOptions?: QueryOptions): Promise<AdapterResults<any[]>> {
    return await this.NuvQuery.query(queryOptions)
  }
  
  public async insert(record: any): Promise<boolean> {
    const filePath = await this.activeFiles();
    const addData =  await this.NuvCrud.addRecord(filePath, record);
    return addData
  }

  public async update(query: QueryOptions, newData: any, options?: {
    upsert?: boolean;
    doc?: number;
}): Promise<AdapterResults<any>>
  {

    const filePath = await this.activeFiles();

    return this.NuvCrud.update(filePath, query, newData, options)
  }
}
