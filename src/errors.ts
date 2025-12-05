/**
 * Base error class for Entrolytics SDK errors
 */
export class EntrolyticsError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly originalError?: Error;

  constructor(message: string, code: string, statusCode?: number, originalError?: Error) {
    super(message);
    this.name = 'EntrolyticsError';
    this.code = code;
    this.statusCode = statusCode;
    this.originalError = originalError;

    // Maintains proper stack trace for where error was thrown (V8 engines)
    const captureStackTrace = (
      Error as { captureStackTrace?: (target: object, constructor: Function) => void }
    ).captureStackTrace;
    if (captureStackTrace) {
      captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when required configuration is missing
 */
export class ConfigurationError extends EntrolyticsError {
  constructor(message: string, field?: string) {
    super(field ? `${message}: '${field}' is required` : message, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends EntrolyticsError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(message: string, field?: string, value?: unknown) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Error thrown when API request fails
 */
export class ApiError extends EntrolyticsError {
  public readonly response?: Response;
  public readonly body?: unknown;

  constructor(message: string, statusCode: number, response?: Response, body?: unknown) {
    super(message, 'API_ERROR', statusCode);
    this.name = 'ApiError';
    this.response = response;
    this.body = body;
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 500;
  }
}

/**
 * Error thrown when request times out
 */
export class TimeoutError extends EntrolyticsError {
  public readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when rate limited
 */
export class RateLimitError extends EntrolyticsError {
  public readonly retryAfter?: number;

  constructor(message = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Error thrown for network-related failures
 */
export class NetworkError extends EntrolyticsError {
  constructor(message: string, originalError?: Error) {
    super(message, 'NETWORK_ERROR', undefined, originalError);
    this.name = 'NetworkError';
  }
}

/**
 * Type guard to check if error is an EntrolyticsError
 */
export function isEntrolyticsError(error: unknown): error is EntrolyticsError {
  return error instanceof EntrolyticsError;
}

/**
 * Type guard to check if error is a specific error type
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}
