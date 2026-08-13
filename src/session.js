import { DurableObject } from 'cloudflare:workers';
import { handleCommand } from './commands.js';
import { handleConversation } from './conversation.js';
import { runDailyMaintenance } from './maintenance.js';
import { pruneUpdateMarkers, updateKey } from './memory.js';
import { commandOf, safeInt } from './util.js';

export function nextDailyAlarm(hourUtc = 6, minuteUtc = 15, now = Date.now()) {
  const date = new Date(now);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hourUtc, minuteUtc, 0, 0);
  return today > now ? today : today + 24 * 60 * 60 * 1000;
}

export class ChatMeSession extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const update = await request.json();
    const message = update?.message;
    if (!Number.isInteger(update?.update_id) || message?.chat?.type !== 'private') return new Response(null, { status: 204 });

    const key = updateKey(update.update_id);
    const previous = await this.ctx.storage.get(key);
    const stillProcessing = previous?.status === 'processing' && Date.now() - Number(previous.startedAt || 0) < 120000;
    if (previous?.status === 'done' || stillProcessing) return new Response(null, { status: 204 });
    await this.ctx.storage.put(key, { status: 'processing', startedAt: Date.now() });

    try {
      await this.processMessage(message);
      await this.ctx.storage.put(key, { status: 'done', completedAt: Date.now() });
      await pruneUpdateMarkers(this.ctx.storage);
      await this.ensureAlarm();
      return new Response(null, { status: 204 });
    } catch (error) {
      await this.ctx.storage.delete(key);
      throw error;
    }
  }

  async processMessage(message) {
    await this.ctx.storage.put('profile', {
      chatId: String(message.chat.id),
      userId: message.from?.id == null ? null : String(message.from.id),
      username: message.from?.username ?? null,
      firstName: message.from?.first_name ?? null,
      languageCode: message.from?.language_code ?? null,
      updatedAt: new Date().toISOString()
    });
    if (typeof message.text !== 'string' || !message.text.trim()) return;
    const command = commandOf(message.text);
    if (command) await handleCommand(this.ctx.storage, this.env, message, command);
    else await handleConversation(this.ctx.storage, this.env, message);
  }

  async ensureAlarm() {
    if (await this.ctx.storage.getAlarm()) return;
    const hour = safeInt(this.env.DAILY_REFRESH_HOUR_UTC, 6, 0, 23);
    await this.ctx.storage.setAlarm(nextDailyAlarm(hour));
  }

  async alarm() {
    const profile = await this.ctx.storage.get('profile');
    if (!profile?.chatId) return;
    const { retrySoon } = await runDailyMaintenance(this.ctx.storage, this.env, profile);
    const hour = safeInt(this.env.DAILY_REFRESH_HOUR_UTC, 6, 0, 23);
    await this.ctx.storage.setAlarm(retrySoon ? Date.now() + 60 * 60 * 1000 : nextDailyAlarm(hour));
  }
}
