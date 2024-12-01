"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sqon_db = void 0;
const path_1 = require("path");
class sqon_db {
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
        let fullPath = (0, path_1.resolve)(this.DirPath);
        if (!fileName.endsWith('.sqon')) {
            fileName = `${fileName}.sqon`;
        }
        if ((0, path_1.extname)(fileName) !== '.sqon') {
            throw new Error('Only .sqon files are allowed');
        }
        return (0, path_1.join)(fullPath, fileName);
    }
}
exports.sqon_db = sqon_db;
//# sourceMappingURL=sqon.js.map