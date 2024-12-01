import { sqon_db } from '../Core/sqon';
import { SqonDbConfig, AdapterResults } from '../Types/utiles';
import { SQON } from 'sqon-parser';
import Logger from '../Functions/loggers';

export class sqon_query extends sqon_db {
  private logger: Logger;
  
  constructor(config: SqonDbConfig) {
    super(config);
    this.logger = new Logger();
  }

  public async records(fileName: string): Promise<AdapterResults<any[]>> {
    try {
      const fullFilePath = this.getFile(fileName);
      const sqon = new SQON({ filePath: fullFilePath, section: 'records' });
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
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? `Error parsing the file: ${err.message}`
          : 'An unknown error occurred during file parsing';
      if (this.logs?.enable) {
        if (err instanceof Error) {
          this.logger.error('Error parsing the SQON file.', {
            cause: err.message,
            fixMessage: 'Check if the file path is correct and the file is readable.',
            stack: err.stack,
          });
        } else {
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