import _ from 'lodash';
export function arrayToObject(arr) {
    return _.reduce(arr, (obj, item) => {
        if (item.key !== undefined) {
            obj[item.key] = item.value;
        }
        return obj;
    }, {});
}
//# sourceMappingURL=array2object.js.map