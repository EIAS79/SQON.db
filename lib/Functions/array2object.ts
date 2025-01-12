import _ from 'lodash';

export function arrayToObject(arr: any[]): Record<string, any> {
    return _.reduce(arr, (obj: Record<string, any>, item: any) => {
        if (item.key !== undefined) {
            obj[item.key] = item.value;
        }
        return obj;
    }, {});
}