import { join, resolve, extname } from 'path';

export function getFile(dirPath: string, fileName: string): string {
  let fullPath = resolve(dirPath);
  if (!fileName.endsWith('.nuv')) {
    fileName = `${fileName}.nuv`;
  }
  if (extname(fileName) !== '.nuv') {
    throw new Error('Only .nuv files are allowed');
  }
  return join(fullPath, fileName);
}

export async function ensureFileExists(filePath: string, defaultContent: string): Promise<void> {
  const path = require('path');
  const fs = require('fs');

  if (!fs.existsSync(filePath)) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, defaultContent, 'utf-8');
  }
}

export function getDefaultNuv(): string {
  return `*STRICT=FALSE
@schema
  Id -> Number | String
  vector -> Number[]
  Text -> String
  Metadata -> Object {
    tags -> String[]
    category -> String
    description -> String
    creationDate -> Date
  }
@end

@validations
  Id -> isUnique=true; required=true
  vector -> minLength=1; required=true
  Text -> required=true
  Metadata.tags -> required=true; isUnique=true
  Metadata.tags -> required=true; isDate=true
@end

@records
#0 -> Id(1);
      vector[...];
      Text("Sample Text");
      Metadata{
          tags[...];
          category("Example Category");
          description("Sample Description");
          creationDate(1993-05-20T00:00:00Z);
      };
@end`;
}

export function simulateAsyncDelay(delay = 10): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delay));
}


export function getActiveFile(store: any) {
    if (!store || !store.activeFile) {
      throw new Error('No active file set. Use the "use" method to set a file context.');
    }
    return store.activeFile;
}