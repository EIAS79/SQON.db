 
export function normalizeArray(value: any): any[] {
    if (Array.isArray(value)) {
        return value.map((item: any) => item.value ?? item);
    } else if (typeof value === 'object' && value?.value && Array.isArray(value.value)) {
        return value.value.map((item: any) => item.value);
    } else if (typeof value === 'string') {
        return [value];
    }
    return [];
}