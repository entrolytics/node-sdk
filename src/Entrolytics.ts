import {
  ApiError,
  ConfigurationError,
  NetworkError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from './errors.js';

export interface EntrolyticsOptions {
  hostUrl?: string;
  websiteId?: string;
  sessionId?: string;
  userAgent?: string;
  timeout?: number;
  endpoint?: 'standard' | 'edge' | 'native';
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
export type WebVitalMetric = 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP';

/** Web Vitals rating */
export type WebVitalRating = 'good' | 'needs-improvement' | 'poor';

/** Navigation type for web vitals */
export type NavigationType = 'navigate' | 'reload' | 'back-forward' | 'back-forward-cache' | 'prerender' | 'restore';

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
}

/** Batch of web vitals */
export interface TrackVitalsBatchOptions {
  vitals: Omit<TrackVitalOptions, 'url' | 'path'>[];
  url?: string;
  path?: string;
}

/** Form event types */
export type FormEventType = 'start' | 'field_focus' | 'field_blur' | 'field_error' | 'submit' | 'abandon';

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
}

/** Batch of form events */
export interface TrackFormBatchOptions {
  events: TrackFormOptions[];
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
    gitSha: env.VERCEL_GIT_COMMIT_SHA || env.COMMIT_REF || env.CF_PAGES_COMMIT_SHA || env.GITHUB_SHA || undefined,
    gitBranch: env.VERCEL_GIT_COMMIT_REF || env.BRANCH || env.CF_PAGES_BRANCH || env.GITHUB_REF_NAME || undefined,
    deployUrl: env.VERCEL_URL ? `https://${env.VERCEL_URL}` : env.DEPLOY_URL || env.CF_PAGES_URL || undefined,
  };
}

/** Get version safely */
function getVersion(): string {
  return typeof process !== 'undefined' && process?.version ? process.version : 'unknown';
}

export class Entrolytics {
  options: EntrolyticsOptions;
  properties: Record<string, unknown>;
  private deploymentInfo: Partial<DeploymentInfo>;

  constructor(options: EntrolyticsOptions = {}) {
    // Auto-detect deployment info from environment
    const detectedDeployment = detectDeploymentInfo();

    this.options = {
      timeout: 10000,
      endpoint: 'standard',
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

  /**
   * Get the API endpoint path based on configuration
   */
  private getEndpointPath(): string {
    switch (this.options.endpoint) {
      case 'edge':
        return '/api/send-edge';
      case 'native':
        return '/api/send-native';
      case 'standard':
      default:
        return '/api/send';
    }
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const endpointPath = this.getEndpointPath();
      const response = await fetch(`${hostUrl}${endpointPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': userAgent || `Mozilla/5.0 EntrolyticsNG/${getVersion()}`,
        },
        body: JSON.stringify({ type, payload }),
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
   * Track a page view or event (flexible method for backwards compatibility)
   */
  async track(
    event: string | TrackPageOptions | TrackEventOptions,
    eventData?: EventData,
  ): Promise<Response> {
    const { websiteId } = this.options;

    if (!websiteId) {
      throw new ConfigurationError(
        'websiteId is required. Call init() with websiteId first.',
        'websiteId',
      );
    }

    if (typeof event === 'string') {
      // Simple event tracking with just a name
      return this.send({
        website: websiteId,
        name: event,
        data: eventData,
      });
    }

    // Object-based tracking
    return this.send({
      website: websiteId,
      ...event,
      data: eventData || (event as TrackEventOptions).data,
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
        data: { ...this.properties } as EventData,
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

    const { metric, value, rating, delta, id, navigationType, attribution, url, path } = options;

    const payload = {
      website: websiteId,
      metric,
      value,
      rating,
      delta,
      id,
      navigationType,
      attribution,
      url,
      path,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout || 10000);

    try {
      const response = await fetch(`${hostUrl}/api/collect/vitals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

    const payload = {
      website: websiteId,
      vitals: options.vitals.map((v) => ({
        ...v,
        url: options.url,
        path: options.path,
      })),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout || 10000);

    try {
      const response = await fetch(`${hostUrl}/api/collect/vitals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

    const payload = {
      website: websiteId,
      ...options,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout || 10000);

    try {
      const response = await fetch(`${hostUrl}/api/collect/forms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

    const payload = {
      website: websiteId,
      events: options.events,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout || 10000);

    try {
      const response = await fetch(`${hostUrl}/api/collect/forms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
