# @entrolytics/node

Node.js SDK for [Entrolytics](https://ng.entrolytics.click) - First-party growth analytics for the edge.

## Installation

```bash
# pnpm (recommended)
pnpm add @entrolytics/node

# npm
npm install @entrolytics/node

# yarn
yarn add @entrolytics/node

# bun
bun add @entrolytics/node
```

## Quick Start

```typescript
import { Entrolytics } from '@entrolytics/node';

// Create client instance
const client = new Entrolytics({
  websiteId: 'your-website-id',
  hostUrl: 'https://ng.entrolytics.click', // or your self-hosted URL
});

// Track a page view
await client.trackPageView({
  url: '/dashboard',
  title: 'Dashboard',
  referrer: 'https://google.com',
});

// Track a custom event
await client.trackEvent({
  url: '/products',
  name: 'add_to_cart',
  data: {
    productId: 'prod_123',
    price: 29.99,
    currency: 'USD',
  },
});
```

## Configuration

```typescript
const client = new Entrolytics({
  // Required
  websiteId: 'your-website-id',
  hostUrl: 'https://ng.entrolytics.click',

  // Optional
  sessionId: 'custom-session-id',
  userAgent: 'MyApp/1.0',
  timeout: 10000,
  endpoint: 'standard', // 'standard' | 'edge' | 'native'
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `websiteId` | `string` | - | Your Entrolytics website ID (required) |
| `hostUrl` | `string` | - | Entrolytics host URL (required) |
| `sessionId` | `string` | - | Custom session identifier |
| `userAgent` | `string` | Auto-generated | Custom user agent for requests |
| `timeout` | `number` | `10000` | Request timeout in milliseconds |
| `endpoint` | `string` | `'standard'` | API endpoint variant |

## API Reference

### `trackPageView(options)`

Track a page view event.

```typescript
await client.trackPageView({
  url: '/page-path',
  title: 'Page Title',
  referrer: 'https://...',
  hostname: 'example.com',
  language: 'en-US',
  screen: '1920x1080',
});
```

### `trackEvent(options)`

Track a custom event with optional data.

```typescript
await client.trackEvent({
  url: '/page-path',
  name: 'event_name',
  data: {
    key: 'value',
    count: 42,
  },
});
```

### `track(event, eventData?)`

Flexible tracking method.

```typescript
// Track with event name
await client.track('button_click');

// Track with event name and data
await client.track('purchase', { amount: 99.99 });

// Track with full options
await client.track({
  url: '/checkout',
  name: 'purchase_complete',
  data: { orderId: 'order_123' },
});
```

### `identify(properties)`

Identify a user/session with custom properties.

```typescript
await client.identify({
  sessionId: 'session_abc123',
  userId: 'user_456',
  plan: 'premium',
});
```

### Property Management

```typescript
client.setProperty('userId', 'user_123');
client.setProperties({ plan: 'enterprise', region: 'us-west' });
const props = client.getProperties();
client.clearProperty('region');
client.reset();
```

## Phase 2 Features

### Web Vitals Tracking

```typescript
import { onLCP, onINP, onCLS } from 'web-vitals';

// Track Core Web Vitals
onLCP((metric) => client.trackVital({
  metric: 'LCP',
  value: metric.value,
  rating: metric.rating,
  delta: metric.delta,
  id: metric.id,
  navigationType: metric.navigationType,
  attribution: metric.attribution,
}));
```

### Form Analytics

```typescript
// Track form interactions
await client.trackForm({
  eventType: 'start',
  formId: 'signup-form',
  formName: 'Newsletter Signup',
  urlPath: '/signup',
});

// Track field focus
await client.trackForm({
  eventType: 'field_focus',
  formId: 'signup-form',
  urlPath: '/signup',
  fieldName: 'email',
  fieldType: 'email',
  fieldIndex: 0,
});
```

### Deployment Tracking

```typescript
// Set deployment info (auto-detected from Vercel, Netlify, etc.)
client.setDeployment({
  deployId: 'dpl_abc123',
  gitSha: 'abc123def456',
  gitBranch: 'main',
});

// Get current deployment info
const deployment = client.getDeployment();
```

## TypeScript Types

```typescript
import {
  Entrolytics,
  EntrolyticsOptions,
  EntrolyticsPayload,
  EventData,
  TrackPageOptions,
  TrackEventOptions,
  IdentifyOptions,
  SendType,
  // Phase 2 types
  WebVitalMetric,
  WebVitalRating,
  NavigationType,
  TrackVitalOptions,
  FormEventType,
  TrackFormOptions,
  DeploymentInfo,
} from '@entrolytics/node';
```

## Self-Hosted Usage

```typescript
const client = new Entrolytics({
  websiteId: 'your-website-id',
  hostUrl: 'https://analytics.yourdomain.com',
});
```

## Edge Runtime

```typescript
const client = new Entrolytics({
  websiteId: 'your-website-id',
  hostUrl: 'https://ng.entrolytics.click',
  endpoint: 'edge',
});
```

## Requirements

- Node.js >= 24.x

## License

MIT
