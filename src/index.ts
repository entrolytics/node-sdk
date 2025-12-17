// Default export
export {
  type DeploymentInfo,
  default,
  Entrolytics,
  type EntrolyticsOptions,
  type EntrolyticsPayload,
  type EventData,
  type FormEventType,
  type IdentifyOptions,
  type NavigationType,
  type SendType,
  type TrackEventOptions,
  type TrackFormBatchOptions,
  type TrackFormOptions,
  type TrackPageOptions,
  type TrackVitalOptions,
  type TrackVitalsBatchOptions,
  // Phase 2 exports
  type WebVitalMetric,
  type WebVitalRating,
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
