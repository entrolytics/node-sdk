import { afterEach, describe, expect, it, vi } from 'vitest';

import { Entrolytics } from './Entrolytics';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function requestBody([, request]: Parameters<typeof fetch>): unknown {
  if (typeof request?.body !== 'string') throw new Error('Expected a JSON request body');
  return JSON.parse(request.body);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Entrolytics', () => {
  it('sends the canonical collection contract with API-key authentication', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchFn);
    const client = new Entrolytics({
      apiKey: 'secret',
      hostUrl: 'https://api.example.test/',
      sessionId: 'session-id',
      websiteId: 'website-id',
    });

    await client.trackEvent({ name: 'signup', url: '/pricing' });

    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, request] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.example.test/collect');
    expect(request?.headers).toMatchObject({ 'x-api-key': 'secret' });
    if (typeof request?.body !== 'string') throw new Error('Expected a JSON request body');
    const payload: unknown = JSON.parse(request.body);
    expect(payload).toMatchObject({
      eventName: 'signup',
      eventType: 'custom_event',
      sessionId: 'session-id',
      url: 'https://api.example.test/pricing',
      websiteId: 'website-id',
    });
    expect(payload).toHaveProperty('eventId');
    expect(payload).toHaveProperty('timestamp');
    expect(payload).toHaveProperty('visitorId');
  });

  it('sends eventId, timestamp, and an absolute url with vitals', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchFn);
    const client = new Entrolytics({
      apiKey: 'secret',
      hostUrl: 'https://api.example.test',
      websiteId: 'website-id',
    });

    await client.trackVital({ metric: 'LCP', value: 1200, rating: 'good', path: '/pricing' });
    await client.trackVital({
      metric: 'CLS',
      value: 0.1,
      rating: 'good',
      url: 'https://site.example.test/docs',
    });

    const [first, second] = fetchFn.mock.calls.map(requestBody);
    expect(first).toMatchObject({
      eventId: expect.stringMatching(UUID_PATTERN),
      metricName: 'LCP',
      path: '/pricing',
      timestamp: expect.stringMatching(ISO_TIMESTAMP_PATTERN),
      url: 'https://api.example.test/pricing',
    });
    expect(second).toMatchObject({
      eventId: expect.stringMatching(UUID_PATTERN),
      url: 'https://site.example.test/docs',
    });
  });

  it('sends eventId and timestamp with each batched vital', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchFn);
    const client = new Entrolytics({
      apiKey: 'secret',
      hostUrl: 'https://api.example.test',
      websiteId: 'website-id',
    });

    await client.trackVitalsBatch({ vitals: [{ metric: 'LCP', value: 1200, rating: 'good' }] });

    expect(requestBody(fetchFn.mock.calls[0])).toMatchObject({
      vitals: [
        {
          eventId: expect.stringMatching(UUID_PATTERN),
          timestamp: expect.stringMatching(ISO_TIMESTAMP_PATTERN),
          url: 'https://api.example.test/__entrolytics_server__',
        },
      ],
    });
  });

  it('sends eventId and timestamp with form events', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchFn);
    const client = new Entrolytics({
      apiKey: 'secret',
      hostUrl: 'https://api.example.test',
      websiteId: 'website-id',
    });

    await client.trackForm({ eventType: 'start', formId: 'signup', urlPath: '/signup' });
    await client.trackFormBatch({
      events: [{ eventType: 'submit', formId: 'signup', urlPath: '/signup', success: true }],
    });

    const [single, batch] = fetchFn.mock.calls.map(requestBody);
    expect(single).toMatchObject({
      eventId: expect.stringMatching(UUID_PATTERN),
      eventType: 'start',
      formId: 'signup',
      timestamp: expect.stringMatching(ISO_TIMESTAMP_PATTERN),
    });
    expect(batch).toMatchObject({
      events: [
        {
          eventId: expect.stringMatching(UUID_PATTERN),
          eventType: 'submit',
          timestamp: expect.stringMatching(ISO_TIMESTAMP_PATTERN),
        },
      ],
    });
  });

  it('marks a configured visitor id persistent and leaves the generated one unscoped', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchFn);
    const options = {
      apiKey: 'secret',
      hostUrl: 'https://api.example.test',
      websiteId: 'website-id',
    };
    const configured = new Entrolytics({ ...options, visitorId: 'customer-42' });
    const generated = new Entrolytics(options);

    await configured.trackPageView({ url: '/' });
    await configured.trackEvent({ name: 'signup', url: '/signup' });
    await configured.identify({ plan: 'pro' });
    await generated.trackEvent({ name: 'signup', url: '/signup' });
    generated.init({ visitorId: 'customer-43' });
    await generated.trackEvent({ name: 'signup', url: '/signup' });
    await configured.trackVital({ metric: 'LCP', value: 1200, rating: 'good' });

    const bodies = fetchFn.mock.calls.map(requestBody);
    expect(bodies.slice(0, 5)).toMatchObject([
      { visitorId: 'customer-42', visitorIdScope: 'persistent' },
      { visitorId: 'customer-42', visitorIdScope: 'persistent' },
      { visitorId: 'customer-42', visitorIdScope: 'persistent' },
      {},
      { visitorId: 'customer-43', visitorIdScope: 'persistent' },
    ]);
    expect(bodies[3]).not.toHaveProperty('visitorIdScope');
    // The vitals endpoint does not accept the field.
    expect(bodies[5]).not.toHaveProperty('visitorIdScope');
  });

  it('rejects collection without an API key', async () => {
    const client = new Entrolytics({
      hostUrl: 'https://api.example.test',
      websiteId: 'website-id',
    });

    await expect(client.trackPageView({ url: '/' })).rejects.toThrow('apiKey is required');
  });
});
