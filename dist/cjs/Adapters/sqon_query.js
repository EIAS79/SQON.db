"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sqon_query = void 0;
const sqon_1 = require("../Core/sqon");
const sqon_parser_1 = require("sqon-parser");
const loggers_1 = __importDefault(require("../Functions/loggers"));
class sqon_query extends sqon_1.sqon_db {
    logger;
    constructor(config) {
        super(config);
        this.logger = new loggers_1.default();
    }
    async records(fileName) {
        try {
            const fullFilePath = this.getFile(fileName);
            const sqon = new sqon_parser_1.SQON({ filePath: fullFilePath, section: 'records' });
            const sqonParsing = await sqon.parse();
            if (sqonParsing.errors.length > 0) {
                const errorMessage = `Parsing errors: ${sqonParsing.errors.join(', ')}`;
                if (this.logs?.enable) {
                    this.logger.error('SQON Parsing Errors', {
                        cause: errorMessage,
                        fixMessage: 'Ensure the file is valid and follows the SQON schema.',
                    });
                }
                return {
                    acknowledge: false,
                    results: null,
                    errorMessage,
                };
            }
            if (this.logs?.enable) {
                this.logger.success({
                    message: `Successfully parsed records from the SQON file: ${fileName}.`,
                    valid: true,
                });
            }
            return {
                acknowledge: true,
                results: sqonParsing.records,
                message: 'Successfully retrieved records.',
            };
        }
        catch (err) {
            const errorMessage = err instanceof Error
                ? `Error parsing the file: ${err.message}`
                : 'An unknown error occurred during file parsing';
            if (this.logs?.enable) {
                if (err instanceof Error) {
                    this.logger.error('Error parsing the SQON file.', {
                        cause: err.message,
                        fixMessage: 'Check if the file path is correct and the file is readable.',
                        stack: err.stack,
                    });
                }
                else {
                    this.logger.error('Unknown error occurred.', {
                        cause: 'An unknown error occurred during file parsing.',
                        fixMessage: 'Ensure the file is accessible and properly formatted.',
                    });
                }
            }
            return {
                acknowledge: false,
                results: null,
                errorMessage,
            };
        }
    }
}
exports.sqon_query = sqon_query;
//# sourceMappingURL=sqon_query.js.map