export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
