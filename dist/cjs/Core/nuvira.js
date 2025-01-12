"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NuviraDb = void 0;
const async_hooks_1 = require("async_hooks");
const loggers_1 = __importDefault(require("../Functions/loggers"));
const nuvira_parser_1 = require("nuvira-parser");
const nuv_query_1 = require("../Adapters/nuv_query");
const nuv_crud_1 = require("../Adapters/nuv_crud");
const coreFunctions_1 = require("../Functions/coreFunctions");
const events_1 = require("events");
class NuviraDb {
    mode;
    DirPath;
    secure;
    restrictions;
    logs;
    logger;
    indexes = null;
    data = [];
    asyncLocalStorage = new async_hooks_1.AsyncLocalStorage();
    indexBuildingEmitter = new events_1.EventEmitter();
    indexBuildingPromise = null;
    isIndexReady = false;
    NuvCrud;
    NuvQuery;
    constructor(config) {
        this.mode = config.mode;
        this.DirPath = config.DirPath;
        this.logs = config.logs;
        this.secure = config.secure;
        this.restrictions = config.restrictions;
        this.logger = new loggers_1.default();
        this.indexes = { primary: {}, inverted: {} };
        this.NuvCrud = new nuv_crud_1.nuv_crud(this.indexes, this.indexField.bind(this));
        this.NuvQuery = new nuv_query_1.nuv_query(this.indexes);
    }
    async use(fileName, callback) {
        if (this.mode === "local") {
            const fullPath = (0, coreFunctions_1.getFile)(this.DirPath, fileName);
            return await this.asyncLocalStorage.run({ activeFile: fullPath }, async () => {
                if (!this.isIndexReady) {
                    // Wait for the index to be ready
                    await new Promise((resolve, reject) => {
                        const onReady = () => {
                            this.indexBuildingEmitter.off('error', onError); // Cleanup
                            resolve();
                        };
                        const onError = (err) => {
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
        }
        else if (this.mode === "external") {
            // Handle external mode logic
        }
    }
    async activeFiles() {
        const store = this.asyncLocalStorage.getStore();
        if (!store || !store.activeFile) {
            throw new Error('No active file set. Use the "use" method to set a file context.');
        }
        return store.activeFile;
    }
    indexField(docId, field, inverted) {
        if (['Number', 'String', 'Boolean', 'Null', 'undefined', 'Binary'].includes(field.type)) {
            if (!inverted[field.key])
                inverted[field.key] = {};
            if (!inverted[field.key][field.value])
                inverted[field.key][field.value] = [];
            inverted[field.key][field.value].push(docId);
        }
        else if (['ObjectArray', 'Object[]', 'Array', 'Any[]', '[]'].includes(field.type)) {
            if (Array.isArray(field.value)) {
                field.value.forEach((subField, index) => {
                    this.indexField(docId, { key: `${field.key}[_${index}]`, value: subField.value, type: subField.type }, inverted);
                });
            }
            else if (['StringArray', 'NumberArray', 'String[]', 'Number[]'].includes(field.type)) {
                field.value.forEach((subField, index) => {
                    this.indexField(docId, { key: `${field.key}[_${index}]`, value: subField.value, type: subField.type }, inverted);
                });
            }
            else if (field.type === 'Object') {
                Object.keys(field.value).forEach(subKey => {
                    this.indexField(docId, { key: `${field.key}.${subKey}`, value: field.value[subKey], type: field.value[subKey]?.type || 'Unknown' }, inverted);
                });
            }
        }
    }
    *chunkData(data, chunkSize) {
        for (let i = 0; i < data.length; i += chunkSize) {
            yield data.slice(i, i + chunkSize);
        }
    }
    async createIndex(records, batchSize, schema, validations, fileRules, relations) {
        const primary = {};
        const inverted = {};
        const relationMappings = {};
        for await (const batch of this.lazyLoadNuvRecords(records, batchSize)) {
            batch.forEach(record => {
                const docId = record['#doc'];
                const data = record['data'];
                primary[docId] = data;
                data.forEach((field) => this.indexField(docId, field, inverted));
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
        }
        else {
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
    async *lazyLoadNuvRecords(records, batchSize = 100) {
        let offset = 0;
        while (offset < records.length) {
            const batch = records.slice(offset, offset + batchSize);
            yield batch;
            offset += batchSize;
            await (0, coreFunctions_1.simulateAsyncDelay)(100);
        }
    }
    async buildIndex() {
        if (this.indexBuildingPromise) {
            return this.indexBuildingPromise;
        }
        this.indexBuildingPromise = (async () => {
            try {
                const fullFilePath = await this.activeFiles();
                await (0, coreFunctions_1.ensureFileExists)(fullFilePath, (0, coreFunctions_1.getDefaultNuv)());
                const nuv = new nuvira_parser_1.Nuvira({ filePath: fullFilePath });
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
                    }
                    else {
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
            }
            catch (err) {
                this.indexBuildingEmitter.emit('error', err);
                this.isIndexReady = false;
                let errorCause;
                if (err instanceof Error) {
                    errorCause = `Error: ${err.message}`;
                    if (err.stack) {
                        errorCause += `\nStack: ${err.stack}`;
                    }
                }
                else if (typeof err === 'object' && err !== null) {
                    errorCause = Object.entries(err)
                        .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`)
                        .join(', ');
                }
                else {
                    errorCause = String(err);
                }
                if (this.logs?.enable) {
                    this.logger.error('Error building the Nuvira index.', {
                        cause: errorCause,
                        fixMessage: 'Check if the file path is correct and the file is readable.',
                    });
                }
                else {
                    throw new Error(errorCause);
                }
                return {
                    acknowledge: false,
                    results: null,
                    errorMessage: errorCause,
                };
            }
            finally {
                this.indexBuildingPromise = null;
            }
        })();
        return this.indexBuildingPromise;
    }
    async search(queryOptions) {
        return await this.NuvQuery.query(queryOptions);
    }
    async insert(record) {
        const filePath = await this.activeFiles();
        const addData = await this.NuvCrud.addRecord(filePath, record);
        return addData;
    }
    async update(query, newData, options) {
        const filePath = await this.activeFiles();
        return this.NuvCrud.update(filePath, query, newData, options);
    }
}
exports.NuviraDb = NuviraDb;
//# sourceMappingURL=nuvira.js.map