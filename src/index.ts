// Default export
export {
  default,
  Entrolytics,
  type EntrolyticsOptions,
  type EntrolyticsPayload,
  type EventData,
  type IdentifyOptions,
  type SendType,
  type TrackEventOptions,
  type TrackPageOptions,
  // Phase 2 exports
  type WebVitalMetric,
  type WebVitalRating,
  type NavigationType,
  type TrackVitalOptions,
  type TrackVitalsBatchOptions,
  type FormEventType,
  type TrackFormOptions,
  type TrackFormBatchOptions,
  type DeploymentInfo,
} from './Entrolytics.js';
// Error classes
export {
  ApiError,
  ConfigurationError,
  EntrolyticsError,
  isApiError,
  isConfigurationError,
  isEntrolyticsError,
  isNetworkError,
  isRateLimitError,
  isTimeoutError,
  isValidationError,
  NetworkError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from './errors.js';
