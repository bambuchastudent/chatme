import { organizeIncoming } from './openai.js';
import { summarizeTopic } from './openai-memory.js';
import { createTelegramTopic, editTelegramTopic } from './telegram.js';
import { listTopics, recentMessages, saveTopic, threadKey, topicKey, topicForThread } from './memory.js';
import { normalizeTopicTitle } from './util.js';

export async function createTopic(storage, env, chatId, title, refreshPolicy = 'on_change', refreshQuery = '') {
  const now = new Date().toISOString();
  const topic = {
    id: crypto.randomUUID(), title: normalizeTopicTitle(title), telegramThreadId: null,
    summary: '', refreshPolicy, refreshQuery, sequence: 0, summarizedSequence: 0,
    createdAt: now, updatedAt: now, lastMessageAt: null, lastSummarizedAt: null,
    lastRefreshAt: null, lastRefreshDigest: ''
  };

  try {
    const forum = await createTelegramTopic(env, chatId, topic.title);
    if (Number.isInteger(forum?.message_thread_id)) topic.telegramThreadId = forum.message_thread_id;
  } catch (error) {
    if (error?.status !== 400) throw error;
  }

  const values = { [topicKey(topic.id)]: topic };
  if (topic.telegramThreadId != null) values[threadKey(topic.telegramThreadId)] = topic.id;
  await storage.put(values);
  return topic;
}

export async function selectTopic(storage, env, message) {
  const current = await topicForThread(storage, message.message_thread_id);
  if (current) return current;
  const topics = await listTopics(storage);
  const route = await organizeIncoming(env, message.text, topics);
  if (route.action === 'existing') {
    const existing = await storage.get(topicKey(route.topicId));
    if (existing) return existing;
  }
  return createTopic(storage, env, message.chat.id, route.title, route.refreshPolicy, route.refreshQuery);
}

export async function rebuildMemory(storage, env, topic, chatId) {
  const evidence = await recentMessages(storage, topic.id, 80);
  if (!evidence.length) return topic;
  const memory = await summarizeTopic(env, topic, evidence);
  const oldTitle = topic.title;
  topic.title = memory.title;
  topic.summary = memory.summary;
  topic.refreshPolicy = memory.refreshPolicy;
  topic.refreshQuery = memory.refreshQuery;
  topic.summarizedSequence = topic.sequence;
  topic.lastSummarizedAt = new Date().toISOString();
  await saveTopic(storage, topic);
  if (topic.telegramThreadId != null && oldTitle !== topic.title) {
    try { await editTelegramTopic(env, chatId, topic.telegramThreadId, topic.title); } catch { }
  }
  return topic;
}
