import { join, resolve, extname } from 'path';
export class sqon_db {
    DirPath;
    secure;
    restrictions;
    logs;
    constructor(config) {
        this.DirPath = config.DirPath;
        this.logs = config.logs;
        ;
        this.secure = config.secure;
        this.restrictions = config.restrictions;
    }
    getFile(fileName) {
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
//# sourceMappingURL=sqon.js.map