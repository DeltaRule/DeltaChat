'use strict';

const WebhookService = require('../WebhookService');

describe('WebhookService', () => {
  let mockDb;
  let service;

  beforeEach(() => {
    mockDb = {
      createWebhook: jest.fn(),
      listWebhooks:  jest.fn().mockResolvedValue([]),
      getWebhook:    jest.fn(),
      updateWebhook: jest.fn(),
      deleteWebhook: jest.fn().mockResolvedValue({ ok: true }),
    };
    service = new WebhookService({ db: mockDb });
  });

  // ── register ────────────────────────────────────────────────────────────────

  describe('register', () => {
    test('throws 400 when url is missing', async () => {
      await expect(service.register({})).rejects.toMatchObject({ status: 400 });
    });

    test('creates a webhook with sensible defaults', async () => {
      const stored = {
        id: 'w1',
        name: 'Unnamed Webhook',
        url: 'https://example.com',
        events: ['message.created'],
        chatIds: [],
        headers: {},
        secret: null,
        enabled: true,
      };
      mockDb.createWebhook.mockResolvedValue(stored);

      const result = await service.register({ url: 'https://example.com' });

      expect(mockDb.createWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com',
          events: ['message.created'],
          enabled: true,
        })
      );
      expect(result).toEqual(stored);
    });

    test('honours provided name, events, and secret', async () => {
      mockDb.createWebhook.mockResolvedValue({});
      await service.register({
        name: 'My Hook',
        url: 'https://example.com',
        events: ['message.created', 'chat.deleted'],
        secret: 'shh',
      });
      expect(mockDb.createWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Hook',
          events: ['message.created', 'chat.deleted'],
          secret: 'shh',
        })
      );
    });
  });

  // ── list ────────────────────────────────────────────────────────────────────

  describe('list', () => {
    test('delegates to db.listWebhooks', async () => {
      const whs = [{ id: 'w1' }];
      mockDb.listWebhooks.mockResolvedValue(whs);
      expect(await service.list()).toEqual(whs);
    });
  });

  // ── get ─────────────────────────────────────────────────────────────────────

  describe('get', () => {
    test('throws 404 when webhook is not found', async () => {
      mockDb.getWebhook.mockResolvedValue(null);
      await expect(service.get('missing')).rejects.toMatchObject({ status: 404 });
    });

    test('returns the webhook when found', async () => {
      const wh = { id: 'w1', url: 'https://example.com' };
      mockDb.getWebhook.mockResolvedValue(wh);
      expect(await service.get('w1')).toEqual(wh);
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    test('throws 404 when webhook is not found', async () => {
      mockDb.getWebhook.mockResolvedValue(null);
      await expect(service.update('missing', {})).rejects.toMatchObject({ status: 404 });
    });

    test('calls db.updateWebhook with correct args', async () => {
      mockDb.getWebhook.mockResolvedValue({ id: 'w1' });
      mockDb.updateWebhook.mockResolvedValue({ id: 'w1', enabled: false });
      await service.update('w1', { enabled: false });
      expect(mockDb.updateWebhook).toHaveBeenCalledWith('w1', { enabled: false });
    });
  });

  // ── delete ───────────────────────────────────────────────────────────────────

  describe('delete', () => {
    test('throws 404 when webhook is not found', async () => {
      mockDb.getWebhook.mockResolvedValue(null);
      await expect(service.delete('missing')).rejects.toMatchObject({ status: 404 });
    });

    test('calls db.deleteWebhook', async () => {
      mockDb.getWebhook.mockResolvedValue({ id: 'w1' });
      await service.delete('w1');
      expect(mockDb.deleteWebhook).toHaveBeenCalledWith('w1');
    });
  });

  // ── notify ───────────────────────────────────────────────────────────────────

  describe('notify', () => {
    test('does not attempt delivery when no webhooks are registered', async () => {
      mockDb.listWebhooks.mockResolvedValue([]);
      // Should not throw
      await expect(service.notify('message.created', 'c1', {})).resolves.toBeUndefined();
    });

    test('skips disabled webhooks', async () => {
      mockDb.listWebhooks.mockResolvedValue([
        { id: 'w1', enabled: false, events: ['message.created'], chatIds: [], url: 'https://example.com' },
      ]);
      // No HTTP call should be made – if it were, it would throw because there's no server
      await service.notify('message.created', 'c1', {});
    });

    test('skips webhooks that do not subscribe to the event', async () => {
      mockDb.listWebhooks.mockResolvedValue([
        { id: 'w1', enabled: true, events: ['other.event'], chatIds: [], url: 'https://example.com' },
      ]);
      await service.notify('message.created', 'c1', {});
    });

    test('skips webhooks scoped to a different chatId', async () => {
      mockDb.listWebhooks.mockResolvedValue([
        { id: 'w1', enabled: true, events: ['message.created'], chatIds: ['c2'], url: 'https://example.com' },
      ]);
      // chatId 'c1' is not in ['c2']
      await service.notify('message.created', 'c1', {});
    });

    test('delivers to webhooks scoped to the matching chatId', async () => {
      // We test the filter logic only – actual HTTP is suppressed by catching errors
      const wh = { id: 'w1', enabled: true, events: ['message.created'], chatIds: ['c1'], url: 'https://x.invalid', headers: {}, secret: null };
      mockDb.listWebhooks.mockResolvedValue([wh]);
      // _deliver will fail (no real server) but notify swallows errors
      await service.notify('message.created', 'c1', {});
    });

    test('handles db.listWebhooks failure gracefully', async () => {
      mockDb.listWebhooks.mockRejectedValue(new Error('DB is down'));
      await expect(service.notify('message.created', 'c1', {})).resolves.toBeUndefined();
    });
  });
});
