import { refreshDynamicTopic } from './openai-refresh.js';
import { listTopics, saveTopic, topicForThread } from './memory.js';
import { createTopic, rebuildMemory } from './topics.js';
import { sendText } from './telegram.js';
import { normalizeTopicTitle } from './util.js';

async function currentTopic(storage, message) {
  const threaded = await topicForThread(storage, message.message_thread_id);
  if (threaded) return threaded;
  const topics = await listTopics(storage);
  return topics[0] ?? null;
}

export async function handleCommand(storage, env, message, command) {
  const chatId = message.chat.id;
  const fallbackThread = message.message_thread_id ?? null;

  if (command.name === 'start') {
    await sendText(env, chatId, [
      'ChatMe готов.',
      '',
      'Я храню нашу переписку по темам, помню контекст и могу продолжать его позже.',
      'Меняющиеся внешние темы я проверяю раз в день и пишу только если действительно что-то поменялось.',
      '',
      'Команды: /topics · /memory · /new <тема> · /refresh'
    ].join('\n'), fallbackThread);
    return;
  }

  if (command.name === 'topics') {
    const topics = await listTopics(storage);
    const text = topics.length
      ? ['Темы:', ...topics.slice(0, 30).map((topic, index) => `${index + 1}. ${topic.title}${topic.refreshPolicy === 'daily' ? ' · ↻ daily' : ''}`)].join('\n')
      : 'Тем пока нет. Просто напиши мне что-нибудь.';
    await sendText(env, chatId, text, fallbackThread);
    return;
  }

  if (command.name === 'new') {
    const topic = await createTopic(storage, env, chatId, normalizeTopicTitle(command.args || 'Новая тема'));
    await sendText(env, chatId, `Создал тему «${topic.title}».`, topic.telegramThreadId ?? fallbackThread);
    return;
  }

  const topic = await currentTopic(storage, message);
  if (!topic) {
    await sendText(env, chatId, 'Сначала нужна хотя бы одна тема.', fallbackThread);
    return;
  }

  if (command.name === 'memory') {
    const fresh = await rebuildMemory(storage, env, topic, chatId);
    await sendText(env, chatId, `${fresh.title}\n\n${fresh.summary || 'Пока мало материала для устойчивой памяти.'}`, fresh.telegramThreadId ?? fallbackThread);
    return;
  }

  if (command.name === 'refresh') {
    const fresh = await rebuildMemory(storage, env, topic, chatId);
    if (fresh.refreshPolicy === 'daily' && fresh.refreshQuery) {
      const refresh = await refreshDynamicTopic(env, fresh);
      fresh.lastRefreshAt = new Date().toISOString();
      fresh.lastRefreshDigest = refresh.digest;
      await saveTopic(storage, fresh);
      await sendText(env, chatId, refresh.changed ? refresh.message : 'Память обновлена. Существенных внешних изменений не нашёл.', fresh.telegramThreadId ?? fallbackThread);
    } else {
      await sendText(env, chatId, 'Память темы обновлена.', fresh.telegramThreadId ?? fallbackThread);
    }
    return;
  }

  await sendText(env, chatId, 'Не знаю такую команду. Есть /topics, /memory, /new и /refresh.', fallbackThread);
}
