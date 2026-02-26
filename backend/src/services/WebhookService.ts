'use strict';

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { getAdapter, DeltaDatabaseAdapter, Entity } from '../db/DeltaDatabaseAdapter';

interface AppError extends Error {
  status?: number;
}

interface WebhookEntity extends Entity {
  url: string;
  enabled: boolean;
  events: string[];
  chatIds: string[];
  headers: Record<string, string>;
  secret: string | null;
}

interface WebhookServiceOpts {
  db?: DeltaDatabaseAdapter;
}

class WebhookService {
  private _db: DeltaDatabaseAdapter;

  constructor(opts: WebhookServiceOpts = {}) {
    this._db = opts.db ?? getAdapter();
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async register(data: Record<string, unknown> = {}): Promise<Entity> {
    if (!data['url']) {
      const err: AppError = new Error('url is required');
      err.status = 400;
      throw err;
    }
    return this._db.createWebhook({
      id: uuidv4(),
      name: (data['name'] as string | undefined) ?? 'Unnamed Webhook',
      url: data['url'] as string,
      events: (data['events'] as string[] | undefined) ?? ['message.created'],
      chatIds: (data['chatIds'] as string[] | undefined) ?? [],
      headers: (data['headers'] as Record<string, string> | undefined) ?? {},
      secret: (data['secret'] as string | null | undefined) ?? null,
      enabled: data['enabled'] !== false,
    });
  }

  async list(): Promise<Entity[]> {
    return this._db.listWebhooks();
  }

  async get(id: string): Promise<Entity> {
    const wh = await this._db.getWebhook(id);
    if (!wh) {
      const err: AppError = new Error(`Webhook not found: ${id}`);
      err.status = 404;
      throw err;
    }
    return wh;
  }

  async update(id: string, fields: Record<string, unknown>): Promise<Entity | null> {
    await this.get(id);
    return this._db.updateWebhook(id, fields);
  }

  async delete(id: string): Promise<unknown> {
    await this.get(id);
    return this._db.deleteWebhook(id);
  }

  // ── Delivery ───────────────────────────────────────────────────────────────

  async notify(event: string, chatId: string, payload: Record<string, unknown> = {}): Promise<void> {
    let webhooks: Entity[];
    try {
      webhooks = await this._db.listWebhooks();
    } catch (err) {
      console.error('[WebhookService] Failed to load webhooks:', (err as Error).message);
      return;
    }

    const applicable = webhooks.filter((wh) => {
      const w = wh as unknown as WebhookEntity;
      return (
        w.enabled &&
        w.events.includes(event) &&
        (w.chatIds.length === 0 || w.chatIds.includes(chatId))
      );
    });

    await Promise.all(applicable.map((wh) => this._deliver(wh as unknown as WebhookEntity, event, chatId, payload)));
  }

  private async _deliver(webhook: WebhookEntity, event: string, chatId: string, payload: Record<string, unknown>): Promise<void> {
    const body: Record<string, unknown> = {
      event,
      webhookId: webhook.id,
      chatId,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...webhook.headers,
    };

    if (webhook.secret) {
      const crypto = await import('crypto');
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
        (err as Error).message
      );
    }
  }
}

export default WebhookService;
