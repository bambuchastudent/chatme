import { splitTelegramText } from './util.js';

export async function telegramApi(env, method, payload = {}) {
  if (!env.TELEGRAM_API_BASE) throw new Error('TELEGRAM_API_BASE is not configured');
  const base = String(env.TELEGRAM_API_BASE).replace(/\/$/, '');
  const response = await fetch(`${base}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    const error = new Error(`Telegram ${method} failed: ${body?.description || response.status}`);
    error.status = response.status;
    throw error;
  }
  return body.result;
}

export const getBotProfile = (env) => telegramApi(env, 'getMe');
export const createTelegramTopic = (env, chatId, name) => telegramApi(env, 'createForumTopic', { chat_id: chatId, name });
export const editTelegramTopic = (env, chatId, threadId, name) => telegramApi(env, 'editForumTopic', { chat_id: chatId, message_thread_id: threadId, name });

export async function sendTyping(env, chatId, threadId = null) {
  const payload = { chat_id: chatId, action: 'typing' };
  if (threadId != null) payload.message_thread_id = threadId;
  try { await telegramApi(env, 'sendChatAction', payload); } catch { }
}

export async function sendText(env, chatId, text, threadId = null) {
  const sent = [];
  for (const chunk of splitTelegramText(text)) {
    const payload = { chat_id: chatId, text: chunk, link_preview_options: { is_disabled: true } };
    if (threadId != null) payload.message_thread_id = threadId;
    sent.push(await telegramApi(env, 'sendMessage', payload));
  }
  return sent;
}

export function isWebhookAuthorized(request, env) {
  const expected = String(env.TELEGRAM_WEBHOOK_SECRET ?? '');
  if (!expected) return false;
  return (request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '') === expected;
}
