"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.arrayToObject = arrayToObject;
const lodash_1 = __importDefault(require("lodash"));
function arrayToObject(arr) {
    return lodash_1.default.reduce(arr, (obj, item) => {
        if (item.key !== undefined) {
            obj[item.key] = item.value;
        }
        return obj;
    }, {});
}
//# sourceMappingURL=array2object.js.map