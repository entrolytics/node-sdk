import { API_ROUTES } from '@entrolytics/shared';
import type { FormEventType, NavigationType, VitalRating, VitalType } from '@entrolytics/shared';
import {
  ApiError,
  ConfigurationError,
  NetworkError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from './errors.js';

export type { FormEventType, NavigationType };

export interface EntrolyticsOptions {
  hostUrl?: string;
  websiteId?: string;
  apiKey?: string;
  sessionId?: string;
  visitorId?: string;
  userAgent?: string;
  timeout?: number;
  /** Deployment ID (auto-detected from VERCEL_DEPLOYMENT_ID, DEPLOY_ID env vars) */
  deployId?: string;
  /** Git SHA (auto-detected from VERCEL_GIT_COMMIT_SHA, COMMIT_REF env vars) */
  gitSha?: string;
  /** Git branch (auto-detected from VERCEL_GIT_COMMIT_REF, BRANCH env vars) */
  gitBranch?: string;
}

export interface EntrolyticsPayload {
  website: string;
  session?: string;
  hostname?: string;
  language?: string;
  referrer?: string;
  screen?: string;
  title?: string;
  url?: string;
  name?: string;
  data?: EventData;
}

export interface EventData {
  [key: string]: string | number | boolean | Date | null;
}

export interface TrackPageOptions {
  url: string;
  title?: string;
  referrer?: string;
  hostname?: string;
  language?: string;
  screen?: string;
}

export interface TrackEventOptions extends TrackPageOptions {
  name: string;
  data?: EventData;
}

export interface IdentifyOptions {
  sessionId?: string;
  [key: string]: string | number | boolean | Date | null | undefined;
}

// ============================================================================
// PHASE 2: Web Vitals, Forms, Deployments
// ============================================================================

/** Web Vitals metric types */
export type WebVitalMetric = VitalType;

/** Web Vitals rating */
export type WebVitalRating = VitalRating;

/** Web Vitals tracking options */
export interface TrackVitalOptions {
  /** Metric name (LCP, INP, CLS, TTFB, FCP) */
  metric: WebVitalMetric;
  /** Metric value in milliseconds (or unitless for CLS) */
  value: number;
  /** Performance rating */
  rating: WebVitalRating;
  /** Delta from previous measurement */
  delta?: number;
  /** Unique metric ID for deduplication */
  id?: string;
  /** Navigation type */
  navigationType?: NavigationType;
  /** Attribution data from web-vitals library */
  attribution?: Record<string, unknown>;
  /** Page URL */
  url?: string;
  /** Page path */
  path?: string;
  /** Session ID (UUID) */
  sessionId?: string;
  /** Visitor ID (UUID) */
  visitorId?: string;
  /** Optional browser name */
  browser?: string;
  /** Optional device type */
  deviceType?: string;
}

/** Batch of web vitals */
export interface TrackVitalsBatchOptions {
  vitals: Omit<TrackVitalOptions, 'url' | 'path' | 'sessionId' | 'visitorId'>[];
  url?: string;
  path?: string;
  sessionId?: string;
  visitorId?: string;
}

/** Form tracking options */
export interface TrackFormOptions {
  /** Form event type */
  eventType: FormEventType;
  /** Form identifier (ID attribute or generated) */
  formId: string;
  /** Human-readable form name */
  formName?: string;
  /** Page path where form exists */
  urlPath: string;
  /** Field name (for field events) */
  fieldName?: string;
  /** Field type (text, email, select, etc.) */
  fieldType?: string;
  /** Field position in form (0-indexed) */
  fieldIndex?: number;
  /** Time spent on field (ms) */
  timeOnField?: number;
  /** Time since form start (ms) */
  timeSinceStart?: number;
  /** Error message (for field_error events) */
  errorMessage?: string;
  /** Whether submission was successful (for submit events) */
  success?: boolean;
  /** Session ID (UUID) */
  sessionId?: string;
  /** Visitor ID (UUID) */
  visitorId?: string;
}

/** Batch of form events */
export interface TrackFormBatchOptions {
  events: Omit<TrackFormOptions, 'sessionId' | 'visitorId'>[];
  sessionId?: string;
  visitorId?: string;
}

/** Deployment information */
export interface DeploymentInfo {
  /** Deployment ID from platform */
  deployId: string;
  /** Git commit SHA */
  gitSha?: string;
  /** Git branch */
  gitBranch?: string;
  /** Deployment URL */
  deployUrl?: string;
}

export type SendType = 'event' | 'identify';

// Declare process for environments where it exists
declare const process: { env: Record<string, string | undefined>; version: string } | undefined;

/**
 * Detect deployment info from environment variables
 * Supports Vercel, Netlify, and generic CI/CD environments
 */
function detectDeploymentInfo(): Partial<DeploymentInfo> {
  const env = typeof process !== 'undefined' && process?.env ? process.env : {};

  return {
    deployId: env.VERCEL_DEPLOYMENT_ID || env.DEPLOY_ID || env.CF_PAGES_COMMIT_SHA || undefined,
    gitSha:
      env.VERCEL_GIT_COMMIT_SHA ||
      env.COMMIT_REF ||
      env.CF_PAGES_COMMIT_SHA ||
      env.GITHUB_SHA ||
      undefined,
    gitBranch:
      env.VERCEL_GIT_COMMIT_REF ||
      env.BRANCH ||
      env.CF_PAGES_BRANCH ||
      env.GITHUB_REF_NAME ||
      undefined,
    deployUrl: env.VERCEL_URL
      ? `https://${env.VERCEL_URL}`
      : env.DEPLOY_URL || env.CF_PAGES_URL || undefined,
  };
}

/** Get version safely */
function getVersion(): string {
  return typeof process !== 'undefined' && process?.version ? process.version : 'unknown';
}

function generateUuid(): string {
  return globalThis.crypto.randomUUID();
}

const isEventDataValue = (value: unknown): value is EventData[string] =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean' ||
  value instanceof Date;

function toEventData(properties: Record<string, unknown>): EventData {
  const eventData: EventData = {};
  for (const [key, value] of Object.entries(properties)) {
    if (isEventDataValue(value)) {
      eventData[key] = value;
    }
  }
  return eventData;
}

export class Entrolytics {
  options: EntrolyticsOptions;
  properties: Record<string, unknown>;
  private deploymentInfo: Partial<DeploymentInfo>;
  private generatedVisitorDay?: string;
  private generatedVisitorId?: string;

  constructor(options: EntrolyticsOptions = {}) {
    // Auto-detect deployment info from environment
    const detectedDeployment = detectDeploymentInfo();

    this.options = {
      timeout: 10000,
      sessionId: options.sessionId || generateUuid(),
      visitorId: options.visitorId,
      deployId: detectedDeployment.deployId,
      gitSha: detectedDeployment.gitSha,
      gitBranch: detectedDeployment.gitBranch,
      ...options,
    };
    this.properties = {};
    this.deploymentInfo = detectedDeployment;
  }

  /**
   * Initialize or update client options
   */
  init(options: EntrolyticsOptions): void {
    this.options = { ...this.options, ...options };
  }

  private resolveSessionId(override?: string): string {
    const value = override || this.options.sessionId;
    if (value) return value;

    const generated = generateUuid();
    this.options.sessionId = generated;
    return generated;
  }

  private resolveVisitorId(override?: string): string {
    const value = override || this.options.visitorId;
    if (value) return value;

    const currentDay = new Date().toISOString().slice(0, 10);
    if (!this.generatedVisitorId || this.generatedVisitorDay !== currentDay) {
      this.generatedVisitorDay = currentDay;
      this.generatedVisitorId = generateUuid();
    }
    return this.generatedVisitorId;
  }

  private requireApiKey(): string {
    const apiKey = this.options.apiKey?.trim();
    if (!apiKey) {
      throw new ConfigurationError(
        'apiKey is required for collection endpoints. Call init() with apiKey first.',
        'apiKey',
      );
    }

    return apiKey;
  }

  /**
   * Get the API endpoint path based on configuration
   */
  private getEndpointPath(): string {
    return '/collect';
  }

  /**
   * Send data to Entrolytics
   */
  async send(payload: EntrolyticsPayload, type: SendType = 'event'): Promise<Response> {
    const { hostUrl, userAgent, timeout = 10000 } = this.options;

    if (!hostUrl) {
      throw new ConfigurationError(
        'hostUrl is required. Call init() with hostUrl first.',
        'hostUrl',
      );
    }

    const apiKey = this.requireApiKey();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const endpointPath = this.getEndpointPath();
      const websiteId = payload.website || this.options.websiteId;
      if (!websiteId) {
        throw new ConfigurationError(
          'websiteId is required. Call init() with websiteId first.',
          'websiteId',
        );
      }

      const rawUrl = payload.url || '/';
      let normalizedUrl = rawUrl;
      if (!/^https?:\/\//i.test(rawUrl)) {
        const cleanHost = hostUrl.replace(/\/$/, '');
        const normalizedPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
        normalizedUrl = `${cleanHost}${normalizedPath}`;
      }

      const normalizedReferrer =
        payload.referrer && /^https?:\/\//i.test(payload.referrer) ? payload.referrer : undefined;

      const sessionId = this.resolveSessionId(payload.session);
      const visitorId = this.resolveVisitorId();

      const properties: Record<string, unknown> = {
        ...payload.data,
      };

      if (payload.hostname) properties.hostname = payload.hostname;
      if (payload.language) properties.language = payload.language;
      if (payload.screen) properties.screen = payload.screen;
      if (payload.title) properties.title = payload.title;

      if (type === 'identify') {
        properties.identify = true;
      }

      const eventName = type === 'identify' ? 'identify' : payload.name;
      const collectPayload = {
        websiteId,
        eventId: generateUuid(),
        timestamp: new Date().toISOString(),
        sessionId,
        visitorId,
        url: normalizedUrl,
        eventType: eventName ? 'custom_event' : 'pageview',
        ...(eventName && { eventName }),
        ...(normalizedReferrer && { referrer: normalizedReferrer }),
        ...(Object.keys(properties).length > 0 && { properties }),
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': userAgent || `Mozilla/5.0 EntrolyticsNG/${getVersion()}`,
        'x-api-key': apiKey,
      };

      const baseUrl = hostUrl.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}${endpointPath}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(collectPayload),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Check for rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new RateLimitError(
            'Rate limit exceeded',
            retryAfter ? parseInt(retryAfter, 10) : undefined,
          );
        }

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = await response.text();
        }

        throw new ApiError(
          `HTTP error! status: ${response.status}`,
          response.status,
          response,
          body,
        );
      }

      return response;
    } catch (error) {
      // Re-throw our custom errors
      if (
        error instanceof ConfigurationError ||
        error instanceof ApiError ||
        error instanceof RateLimitError
      ) {
        throw error;
      }

      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(timeout);
      }

      // Handle network errors
      if (error instanceof TypeError) {
        throw new NetworkError(`Network request failed: ${error.message}`, error);
      }

      // Re-throw unknown errors
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Track a page view
   */
  async trackPageView(options: TrackPageOptions): Promise<Response> {
    const { websiteId } = this.options;

    if (!websiteId) {
      throw new ConfigurationError(
        'websiteId is required. Call init() with websiteId first.',
        'websiteId',
      );
    }

    if (!options.url) {
      throw new ValidationError('url is required for page view tracking', 'url');
    }

    return this.send({
      website: websiteId,
      ...options,
    });
  }

  /**
   * Track a custom event
   */
  async trackEvent(options: TrackEventOptions): Promise<Response> {
    const { websiteId } = this.options;

    if (!websiteId) {
      throw new ConfigurationError(
        'websiteId is required. Call init() with websiteId first.',
        'websiteId',
      );
    }

    if (!options.name) {
      throw new ValidationError('name is required for event tracking', 'name');
    }

    return this.send({
      website: websiteId,
      ...options,
    });
  }

  /**
   * Identify a user/session with custom properties
   */
  async identify(properties: IdentifyOptions = {}): Promise<Response> {
    const { websiteId, sessionId } = this.options;

    if (!websiteId) {
      throw new ConfigurationError(
        'websiteId is required. Call init() with websiteId first.',
        'websiteId',
      );
    }

    // Merge with existing properties
    this.properties = { ...this.properties, ...properties };

    return this.send(
      {
        website: websiteId,
        session: properties.sessionId || sessionId,
        data: toEventData(this.properties),
      },
      'identify',
    );
  }

  /**
   * Set a custom property that will be included in subsequent events
   */
  setProperty(key: string, value: string | number | boolean | Date | null): void {
    this.properties[key] = value;
  }

  /**
   * Set multiple custom properties
   */
  setProperties(properties: Record<string, string | number | boolean | Date | null>): void {
    this.properties = { ...this.properties, ...properties };
  }

  /**
   * Get current properties
   */
  getProperties(): Record<string, unknown> {
    return { ...this.properties };
  }

  /**
   * Reset all stored properties
   */
  reset(): void {
    this.properties = {};
  }

  /**
   * Clear specific property
   */
  clearProperty(key: string): void {
    delete this.properties[key];
  }

  // ===========================================================================
  // PHASE 2: Web Vitals, Forms, Deployments
  // ===========================================================================

  /**
   * Track a Web Vital metric (LCP, INP, CLS, TTFB, FCP)
   *
   * @example
   * // With web-vitals library
   * import { onLCP, onINP, onCLS } from 'web-vitals';
   * onLCP((metric) => entrolytics.trackVital({
   *   metric: 'LCP',
   *   value: metric.value,
   *   rating: metric.rating,
   *   delta: metric.delta,
   *   id: metric.id,
   *   navigationType: metric.navigationType,
   *   attribution: metric.attribution
   * }));
   */
  async trackVital(options: TrackVitalOptions): Promise<Response> {
    const { websiteId, hostUrl } = this.options;

    if (!websiteId) {
      throw new ConfigurationError(
        'websiteId is required. Call init() with websiteId first.',
        'websiteId',
      );
    }

    if (!hostUrl) {
      throw new ConfigurationError(
        'hostUrl is required. Call init() with hostUrl first.',
        'hostUrl',
      );
    }

    const apiKey = this.requireApiKey();

    const {
      metric,
      value,
      rating,
      delta,
      id,
      navigationType,
      attribution,
      url,
      path,
      browser,
      deviceType,
      sessionId,
      visitorId,
    } = options;

    const payload = {
      websiteId,
      sessionId: this.resolveSessionId(sessionId),
      visitorId: this.resolveVisitorId(visitorId),
      metricName: metric,
      metricValue: value,
      rating,
      delta,
      id,
      navigationType,
      attribution,
      url: url || '/__entrolytics_server__',
      path: path || '/__entrolytics_server__',
      ...(browser && { browser }),
      ...(deviceType && { deviceType }),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout || 10000);

    try {
      const response = await fetch(`${hostUrl}${API_ROUTES.collectVitals}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ApiError(`HTTP error! status: ${response.status}`, response.status, response);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Track multiple Web Vital metrics at once
   */
  async trackVitalsBatch(options: TrackVitalsBatchOptions): Promise<Response> {
    const { websiteId, hostUrl } = this.options;

    if (!websiteId) {
      throw new ConfigurationError(
        'websiteId is required. Call init() with websiteId first.',
        'websiteId',
      );
    }

    if (!hostUrl) {
      throw new ConfigurationError(
        'hostUrl is required. Call init() with hostUrl first.',
        'hostUrl',
      );
    }

    const apiKey = this.requireApiKey();
    const sessionId = this.resolveSessionId(options.sessionId);
    const visitorId = this.resolveVisitorId(options.visitorId);

    const payload = {
      websiteId,
      sessionId,
      visitorId,
      vitals: options.vitals.map(v => ({
        url: options.url || '/__entrolytics_server__',
        path: options.path || '/__entrolytics_server__',
        metricName: v.metric,
        metricValue: v.value,
        ...(v.browser && { browser: v.browser }),
        ...(v.deviceType && { deviceType: v.deviceType }),
      })),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout || 10000);

    try {
      const response = await fetch(`${hostUrl}${API_ROUTES.collectVitalsBatch}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ApiError(`HTTP error! status: ${response.status}`, response.status, response);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Track a form event (start, field interactions, submit, abandon)
   *
   * @example
   * // Track form start
   * entrolytics.trackForm({
   *   eventType: 'start',
   *   formId: 'signup-form',
   *   formName: 'Newsletter Signup',
   *   urlPath: '/signup'
   * });
   *
   * // Track field focus
   * entrolytics.trackForm({
   *   eventType: 'field_focus',
   *   formId: 'signup-form',
   *   urlPath: '/signup',
   *   fieldName: 'email',
   *   fieldType: 'email',
   *   fieldIndex: 0
   * });
   */
  async trackForm(options: TrackFormOptions): Promise<Response> {
    const { websiteId, hostUrl } = this.options;

    if (!websiteId) {
      throw new ConfigurationError(
        'websiteId is required. Call init() with websiteId first.',
        'websiteId',
      );
    }

    if (!hostUrl) {
      throw new ConfigurationError(
        'hostUrl is required. Call init() with hostUrl first.',
        'hostUrl',
      );
    }

    const apiKey = this.requireApiKey();
    const sessionId = this.resolveSessionId(options.sessionId);
    const visitorId = this.resolveVisitorId(options.visitorId);

    const { sessionId: _sessionId, visitorId: _visitorId, ...event } = options;

    const payload = {
      websiteId,
      sessionId,
      visitorId,
      ...event,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout || 10000);

    try {
      const response = await fetch(`${hostUrl}${API_ROUTES.collectForms}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ApiError(`HTTP error! status: ${response.status}`, response.status, response);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Track multiple form events at once (for batched tracking)
   */
  async trackFormBatch(options: TrackFormBatchOptions): Promise<Response> {
    const { websiteId, hostUrl } = this.options;

    if (!websiteId) {
      throw new ConfigurationError(
        'websiteId is required. Call init() with websiteId first.',
        'websiteId',
      );
    }

    if (!hostUrl) {
      throw new ConfigurationError(
        'hostUrl is required. Call init() with hostUrl first.',
        'hostUrl',
      );
    }

    const apiKey = this.requireApiKey();
    const sessionId = this.resolveSessionId(options.sessionId);
    const visitorId = this.resolveVisitorId(options.visitorId);

    const payload = {
      websiteId,
      sessionId,
      visitorId,
      events: options.events,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout || 10000);

    try {
      const response = await fetch(`${hostUrl}${API_ROUTES.collectFormsBatch}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ApiError(`HTTP error! status: ${response.status}`, response.status, response);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Set deployment information (auto-detected from environment, but can be overridden)
   *
   * @example
   * entrolytics.setDeployment({
   *   deployId: 'dpl_abc123',
   *   gitSha: 'abc123def456',
   *   gitBranch: 'main'
   * });
   */
  setDeployment(deployment: Partial<DeploymentInfo>): void {
    this.deploymentInfo = { ...this.deploymentInfo, ...deployment };
    this.options.deployId = deployment.deployId || this.options.deployId;
    this.options.gitSha = deployment.gitSha || this.options.gitSha;
    this.options.gitBranch = deployment.gitBranch || this.options.gitBranch;
  }

  /**
   * Get current deployment information
   */
  getDeployment(): Partial<DeploymentInfo> {
    return { ...this.deploymentInfo };
  }
}

// Default instance for convenience
const entrolytics = new Entrolytics();

export default entrolytics;
