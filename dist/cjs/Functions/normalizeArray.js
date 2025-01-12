"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeArray = normalizeArray;
function normalizeArray(value) {
    if (Array.isArray(value)) {
        return value.map((item) => item.value ?? item);
    }
    else if (typeof value === 'object' && value?.value && Array.isArray(value.value)) {
        return value.value.map((item) => item.value);
    }
    else if (typeof value === 'string') {
        return [value];
    }
    return [];
}
//# sourceMappingURL=normalizeArray.js.map