import { isWebhookAuthorized } from './telegram.js';
export { ChatMeSession } from './session.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true, service: 'chatme' });
    }
    if (request.method !== 'POST' || url.pathname !== '/telegram/webhook') {
      return new Response('Not found', { status: 404 });
    }
    if (!isWebhookAuthorized(request, env)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const update = await request.json().catch(() => null);
    const chatId = update?.message?.chat?.id;
    if (chatId == null) return new Response(null, { status: 204 });

    const session = env.CHAT_SESSIONS.getByName(String(chatId));
    return session.fetch(new Request('https://chatme.internal/telegram-update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(update)
    }));
  }
};
