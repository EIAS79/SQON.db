import { normalizeArray } from "./normalizeArray";
import { recordPath } from "./recordPath";
export function query_operators(record, filters) {
    for (const key in filters) {
        const filter = filters[key];
        const value = recordPath(record, key);
        for (const operator in filter) {
            const filterValue = filter[operator];
            console.log(value);
            switch (operator) {
                case '$eq':
                    if (value !== filterValue)
                        return false;
                    break;
                case '$neq':
                    if (value === filterValue)
                        return false;
                    break;
                case '$gt':
                    if (!(value > filterValue))
                        return false;
                    break;
                case '$gte':
                    if (!(value >= filterValue))
                        return false;
                    break;
                case '$lt':
                    if (!(value < filterValue))
                        return false;
                    break;
                case '$lte':
                    if (!(value <= filterValue))
                        return false;
                    break;
                case '$exists':
                    if (filterValue && value === undefined)
                        return false;
                    if (!filterValue && value !== undefined)
                        return false;
                    break;
                case '$not':
                    if (query_operators(record, { [key]: filterValue }))
                        return false;
                    break;
                case '$in':
                    {
                        const normalizedArray = normalizeArray(value);
                        if (!Array.isArray(filterValue) || !filterValue.some((val) => normalizedArray.includes(val))) {
                            return false;
                        }
                    }
                    break;
                case '$nin':
                    {
                        const normalizedArray = normalizeArray(value);
                        if (Array.isArray(filterValue) && filterValue.some((val) => normalizedArray.includes(val))) {
                            return false;
                        }
                    }
                    break;
                case '$contains':
                    {
                        const normalizedArray = normalizeArray(value);
                        if (!normalizedArray.includes(filterValue))
                            return false;
                    }
                    break;
                case '$regex':
                    if (!(typeof value === 'string' && new RegExp(filterValue).test(value)))
                        return false;
                    break;
                case '$and':
                    if (!filterValue.every((subFilter) => query_operators(record, subFilter))) {
                        return false;
                    }
                    break;
                case '$or':
                    if (!filterValue.some((subFilter) => query_operators(record, subFilter))) {
                        return false;
                    }
                    break;
                case '$between':
                    if (value < filterValue[0] || value > filterValue[1])
                        return false;
                    break;
                case '$date':
                    const dateValue = new Date(value);
                    const filterDate = new Date(filterValue);
                    if (!(dateValue >= filterDate))
                        return false;
                    break;
                case '$add':
                    if (!(value + filterValue === value))
                        return false;
                    break;
                case '$sub':
                    if (!(value - filterValue === value))
                        return false;
                    break;
                case '$mul':
                    if (!(value * filterValue === value))
                        return false;
                    break;
                case '$div':
                    if (filterValue === 0 || !(value / filterValue === value))
                        return false;
                    break;
                case '$mod':
                    if (!(value % filterValue === value))
                        return false;
                    break;
                case '$avg':
                    if (Array.isArray(value)) {
                        const sum = value.reduce((acc, curr) => acc + curr, 0);
                        const avg = sum / value.length;
                        if (avg !== filterValue)
                            return false;
                    }
                    else {
                        return false;
                    }
                    break;
                case '$avg': {
                    const normalized = normalizeArray(value);
                    if (normalized.length === 0)
                        return false;
                    const sum = normalized.reduce((acc, curr) => acc + curr, 0);
                    const avg = sum / normalized.length;
                    if (avg !== filterValue)
                        return false;
                    break;
                }
                case '$sum': {
                    const normalized = normalizeArray(value);
                    if (normalized.length === 0)
                        return false;
                    const sum = normalized.reduce((acc, curr) => acc + curr, 0);
                    if (sum !== filterValue)
                        return false;
                    break;
                }
                case '$startsWith': {
                    const normalized = normalizeArray(value);
                    if (normalized.length === 0)
                        return false;
                    if (normalized.some((item) => item.startsWith(filterValue)))
                        break;
                    return false;
                }
                case '$endsWith': {
                    const normalized = normalizeArray(value);
                    if (normalized.length === 0)
                        return false;
                    if (normalized.some((item) => item.endsWith(filterValue)))
                        break;
                    return false;
                }
                case '$replace': {
                    const normalized = normalizeArray(value);
                    if (normalized.length === 0)
                        return false;
                    if (normalized.every((item) => item.replace(filterValue[0], filterValue[1]) === item))
                        break;
                    return false;
                }
                case '$containsAny': {
                    const normalized = normalizeArray(value);
                    if (!filterValue.some((filterItem) => normalized.includes(filterItem)))
                        return false;
                    break;
                }
                case '$pow':
                    if (!(Math.pow(value, filterValue) === value))
                        return false;
                    break;
                case '$sqrt':
                    if (!(Math.sqrt(value) === value))
                        return false;
                    break;
                case '$round':
                    if (!(Math.round(value) === value))
                        return false;
                    break;
                case '$abs':
                    if (!(Math.abs(value) === value))
                        return false;
                    break;
                case '$floor':
                    if (!(Math.floor(value) === value))
                        return false;
                    break;
                case '$ceil':
                    if (!(Math.ceil(value) === value))
                        return false;
                    break;
                default:
                    console.warn(`Unknown operator: ${operator}`);
                    break;
            }
        }
    }
    return true;
}
//# sourceMappingURL=queryOperators.js.map