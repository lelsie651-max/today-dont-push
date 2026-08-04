/**
 * 通用领域结果类型与错误结构。
 *
 * 领域层不抛异常表达预期的输入错误：所有工厂函数统一返回 DomainResult，
 * 失败时携带结构化 errors（code + path + message）。
 */

/** 单条结构化领域错误。path 指向出错字段（如 `tasks[1].title`）。 */
export interface DomainError {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

/** 领域结果：成功携带 value，失败携带结构化 errors。 */
export type DomainResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly DomainError[] };

/** 构造成功结果。 */
export function ok<T>(value: T): DomainResult<T> {
  return { ok: true, value };
}

/** 构造失败结果。 */
export function fail<T>(errors: readonly DomainError[]): DomainResult<T> {
  return { ok: false, errors };
}

/** 构造单条错误。 */
export function error(code: string, path: string, message: string): DomainError {
  return { code, path, message };
}

/** 文本去除首尾空格。 */
export function trimText(value: string): string {
  return value.trim();
}

/**
 * 校验文本字段：去空格后非空、不超过最大长度。
 * 返回清洗后的文本；非法时向 errors 追加一条错误。
 */
export function validateRequiredText(
  errors: DomainError[],
  value: string,
  path: string,
  label: string,
  maxLength: number,
): string {
  const trimmed = trimText(value);
  if (trimmed.length === 0) {
    errors.push(error('INVALID_TEXT', path, `${label}不能为空`));
  } else if (trimmed.length > maxLength) {
    errors.push(error('TEXT_TOO_LONG', path, `${label}长度不能超过 ${maxLength} 个字符`));
  }
  return trimmed;
}

/**
 * 校验整数是否落在 [min, max] 区间内；非法时向 errors 追加一条错误。
 */
export function validateIntegerInRange(
  errors: DomainError[],
  value: number,
  path: string,
  label: string,
  min: number,
  max: number,
): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    errors.push(error('INVALID_NUMBER', path, `${label}必须为 ${min} 至 ${max} 的整数`));
  }
}
