"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordPath = recordPath;
const array2object_1 = require("./array2object");
const lodash_1 = __importDefault(require("lodash"));
function recordPath(record, path) {
    const keys = path.split('.');
    let result = record;
    for (const key of keys) {
        if (key.includes('[_') || key.includes('[]')) {
            const arrayKey = key.split('[')[0];
            const index = key.includes(']') ? parseInt(key.split('[_')[1].split(']')[0]) : undefined;
            if (lodash_1.default.isArray(result)) {
                const arrayField = lodash_1.default.find(result, (item) => item.key === arrayKey);
                if (arrayField && lodash_1.default.isArray(arrayField.value)) {
                    result = index !== undefined
                        ? lodash_1.default.get(arrayField.value, `[${index}]`, null)
                        : arrayField.value;
                }
                else {
                    return undefined;
                }
            }
            else {
                return undefined;
            }
        }
        else {
            if (lodash_1.default.isArray(result)) {
                const field = lodash_1.default.find(result, (item) => item.key === key);
                if (field) {
                    if (lodash_1.default.includes(['ObjectArray', 'Object[]', 'Object'], field.type)) {
                        result = (0, array2object_1.arrayToObject)(field.value);
                    }
                    else if (lodash_1.default.includes(['StringArray', 'String[]', 'Number[]', 'NumberArray'], field.type)) {
                        result = lodash_1.default.map(field.value, (item) => item.value);
                    }
                    else {
                        result = field.value;
                    }
                }
                else {
                    return undefined;
                }
            }
            else if (lodash_1.default.isObject(result) && result !== null) {
                result = lodash_1.default.get(result, key, null);
            }
            else {
                return undefined;
            }
        }
        if (result === undefined || result === null) {
            return result;
        }
    }
    return result;
}
//# sourceMappingURL=recordPath.js.map