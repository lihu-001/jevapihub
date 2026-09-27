export type RuntimeErrorCode =
  | "INVALID_MANIFEST" | "INVALID_INPUT" | "MISSING_TYPESAFE_KEY"
  | "TYPESAFE_UNAUTHORIZED" | "TYPESAFE_VALIDATION_ERROR" | "TYPESAFE_RATE_LIMIT"
  | "TYPESAFE_OVERLOADED" | "TYPESAFE_TIMEOUT" | "TYPESAFE_UNKNOWN_ERROR"
  | "UPSTREAM_INVALID_RESPONSE" | "POSTPROCESS_ERROR";

const messages: Record<RuntimeErrorCode, string> = {
  INVALID_MANIFEST: "Interface Manifest 无效",
  INVALID_INPUT: "输入不符合 Interface 要求",
  MISSING_TYPESAFE_KEY: "请输入 TypeSafe API Key",
  TYPESAFE_UNAUTHORIZED: "TypeSafe API Key 无效或无权限",
  TYPESAFE_VALIDATION_ERROR: "TypeSafe 不接受本次请求",
  TYPESAFE_RATE_LIMIT: "TypeSafe 请求过于频繁",
  TYPESAFE_OVERLOADED: "TypeSafe 当前繁忙",
  TYPESAFE_TIMEOUT: "TypeSafe 请求超时",
  TYPESAFE_UNKNOWN_ERROR: "TypeSafe 请求失败",
  UPSTREAM_INVALID_RESPONSE: "TypeSafe 返回了无效结果",
  POSTPROCESS_ERROR: "结果处理失败",
};

export class RuntimeError extends Error {
  readonly retryable: boolean;
  constructor(public readonly code: RuntimeErrorCode, public readonly status: number, retryable = false) {
    super(messages[code]);
    this.retryable = retryable;
  }
  toJSON() { return { error: { code: this.code, message: this.message, retryable: this.retryable } }; }
}

export function statusError(status: number): RuntimeError {
  if (status === 401) return new RuntimeError("TYPESAFE_UNAUTHORIZED", 401);
  if (status === 422) return new RuntimeError("TYPESAFE_VALIDATION_ERROR", 502);
  if (status === 429) return new RuntimeError("TYPESAFE_RATE_LIMIT", 503, true);
  if (status === 529) return new RuntimeError("TYPESAFE_OVERLOADED", 503, true);
  return new RuntimeError("TYPESAFE_UNKNOWN_ERROR", 502, status >= 500);
}
