import { SqonDbConfig, SecureOptions, RestrictionsOptions, AdapterResults } from '../Types/utiles';
import { join, resolve, extname  } from 'path';
import Logger from '../Functions/loggers'; // Importing the custom Logger class

export class sqon_db {
    public DirPath: string;
    public secure?: SecureOptions;
    public restrictions?: RestrictionsOptions;
    public logs?: { enable: boolean; logFile: string };

    constructor(config: SqonDbConfig) {
      this.DirPath = config.DirPath;
      this.logs = config.logs;;
      this.secure = config.secure;
      this.restrictions = config.restrictions;
      
    }
  
    public getFile(fileName: string): string {
        let fullPath = resolve(this.DirPath);
    
        if (!fileName.endsWith('.sqon')) {
          fileName = `${fileName}.sqon`;
        }
    
        if (extname(fileName) !== '.sqon') {
          throw new Error('Only .sqon files are allowed');
        }
    
        return join(fullPath, fileName);
    }
    
    
  
  }