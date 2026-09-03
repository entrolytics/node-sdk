import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { Entrolytics } from './Entrolytics';

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

  it('rejects collection without an API key', async () => {
    const client = new Entrolytics({
      hostUrl: 'https://api.example.test',
      websiteId: 'website-id',
    });

    await expect(client.trackPageView({ url: '/' })).rejects.toThrow('apiKey is required');
  });
});
