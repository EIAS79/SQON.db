import { arrayToObject } from "./array2object";
import _ from 'lodash';
export function recordPath(record, path) {
    const keys = path.split('.');
    let result = record;
    for (const key of keys) {
        if (key.includes('[_') || key.includes('[]')) {
            const arrayKey = key.split('[')[0];
            const index = key.includes(']') ? parseInt(key.split('[_')[1].split(']')[0]) : undefined;
            if (_.isArray(result)) {
                const arrayField = _.find(result, (item) => item.key === arrayKey);
                if (arrayField && _.isArray(arrayField.value)) {
                    result = index !== undefined
                        ? _.get(arrayField.value, `[${index}]`, null)
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
            if (_.isArray(result)) {
                const field = _.find(result, (item) => item.key === key);
                if (field) {
                    if (_.includes(['ObjectArray', 'Object[]', 'Object'], field.type)) {
                        result = arrayToObject(field.value);
                    }
                    else if (_.includes(['StringArray', 'String[]', 'Number[]', 'NumberArray'], field.type)) {
                        result = _.map(field.value, (item) => item.value);
                    }
                    else {
                        result = field.value;
                    }
                }
                else {
                    return undefined;
                }
            }
            else if (_.isObject(result) && result !== null) {
                result = _.get(result, key, null);
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