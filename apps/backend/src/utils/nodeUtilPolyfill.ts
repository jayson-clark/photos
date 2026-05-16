import util from 'util';

const u = util as any;

if (!u.isNullOrUndefined) u.isNullOrUndefined = (x: unknown) => x === null || x === undefined;
if (!u.isNull) u.isNull = (x: unknown) => x === null;
if (!u.isUndefined) u.isUndefined = (x: unknown) => x === undefined;
if (!u.isString) u.isString = (x: unknown) => typeof x === 'string';
if (!u.isNumber) u.isNumber = (x: unknown) => typeof x === 'number';
if (!u.isBoolean) u.isBoolean = (x: unknown) => typeof x === 'boolean';
if (!u.isArray) u.isArray = Array.isArray;
if (!u.isObject) u.isObject = (x: unknown) => x !== null && typeof x === 'object';
if (!u.isFunction) u.isFunction = (x: unknown) => typeof x === 'function';
if (!u.isBuffer) u.isBuffer = (x: unknown) => Buffer.isBuffer(x);
if (!u.isDate) u.isDate = (x: unknown) => x instanceof Date;
if (!u.isError) u.isError = (x: unknown) => x instanceof Error;
if (!u.isRegExp) u.isRegExp = (x: unknown) => x instanceof RegExp;
if (!u.isPrimitive) u.isPrimitive = (x: unknown) =>
  x === null || (typeof x !== 'object' && typeof x !== 'function');
