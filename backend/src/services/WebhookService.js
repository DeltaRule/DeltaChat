'use strict';

const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { getAdapter } = require('../db/DeltaDatabaseAdapter');

/**
 * WebhookService
 *
 * Manages webhook registrations and delivers chat events to external URLs.
 * Each webhook can be scoped to specific chats via `chatIds` (empty = all chats).
 *
 * Webhook payload structure sent on every assistant message:
 * {
 *   event: "message.created",
 *   webhookId: "...",
 *   chatId: "...",
 *   message: { id, role, content, createdAt },
 *   timestamp: "ISO8601"
 * }
 */
class WebhookService {
  constructor(opts = {}) {
    this._db = opts.db || getAdapter();
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async register(data = {}) {
    if (!data.url) throw Object.assign(new Error('url is required'), { status: 400 });
    return this._db.createWebhook({
      id: uuidv4(),
      name: data.name || 'Unnamed Webhook',
      url: data.url,
      events: data.events || ['message.created'],
      chatIds: data.chatIds || [], // empty = all chats
      headers: data.headers || {},
      secret: data.secret || null,
      enabled: data.enabled !== false,
    });
  }

  async list() {
    return this._db.listWebhooks();
  }

  async get(id) {
    const wh = await this._db.getWebhook(id);
    if (!wh) {
      const err = new Error(`Webhook not found: ${id}`);
      err.status = 404;
      throw err;
    }
    return wh;
  }

  async update(id, fields) {
    await this.get(id); // assert exists
    return this._db.updateWebhook(id, fields);
  }

  async delete(id) {
    await this.get(id); // assert exists
    return this._db.deleteWebhook(id);
  }

  // ── Delivery ───────────────────────────────────────────────────────────────

  /**
   * Notify all applicable webhooks about a chat event.
   * Errors are logged but never surfaced to the caller.
   *
   * @param {string} event    - Event name, e.g. "message.created"
   * @param {string} chatId   - The chat the event belongs to.
   * @param {object} payload  - Arbitrary event data.
   */
  async notify(event, chatId, payload = {}) {
    let webhooks;
    try {
      webhooks = await this._db.listWebhooks();
    } catch (err) {
      console.error('[WebhookService] Failed to load webhooks:', err.message);
      return;
    }

    const applicable = webhooks.filter(
      (wh) =>
        wh.enabled &&
        wh.events.includes(event) &&
        (wh.chatIds.length === 0 || wh.chatIds.includes(chatId))
    );

    await Promise.all(applicable.map((wh) => this._deliver(wh, event, chatId, payload)));
  }

  async _deliver(webhook, event, chatId, payload) {
    const body = {
      event,
      webhookId: webhook.id,
      chatId,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    const headers = {
      'Content-Type': 'application/json',
      ...webhook.headers,
    };

    if (webhook.secret) {
      // Simple HMAC-SHA256 signature header (X-Webhook-Signature)
      const crypto = require('crypto');
      const sig = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(body))
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${sig}`;
    }

    try {
      await axios.post(webhook.url, body, { headers, timeout: 10000 });
    } catch (err) {
      console.error(
        `[WebhookService] Delivery failed for webhook ${webhook.id} (${webhook.url}):`,
        err.message
      );
    }
  }
}

module.exports = WebhookService;
