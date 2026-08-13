const TOPIC = 'topic:';
const THREAD = 'thread:';
const MESSAGE = 'message:';
const UPDATE = 'update:';

export const updateKey = (id) => `${UPDATE}${id}`;
export const topicKey = (id) => `${TOPIC}${id}`;
export const threadKey = (id) => `${THREAD}${id}`;
const messagePrefix = (id) => `${MESSAGE}${id}:`;
const messageKey = (id, sequence) => `${messagePrefix(id)}${String(sequence).padStart(12, '0')}`;

export async function listTopics(storage) {
  const entries = await storage.list({ prefix: TOPIC });
  return [...entries.values()].sort((a, b) => String(b.lastMessageAt || b.createdAt).localeCompare(String(a.lastMessageAt || a.createdAt)));
}

export async function topicForThread(storage, threadId) {
  if (threadId == null) return null;
  const id = await storage.get(threadKey(threadId));
  return id ? storage.get(topicKey(id)) : null;
}

export async function saveTopic(storage, topic) {
  topic.updatedAt = new Date().toISOString();
  await storage.put(topicKey(topic.id), topic);
  return topic;
}

export async function appendMessage(storage, topic, role, content, extra = {}) {
  const now = new Date().toISOString();
  topic.sequence = Number(topic.sequence || 0) + 1;
  topic.lastMessageAt = now;
  topic.updatedAt = now;
  const record = { role, content, kind: extra.kind || 'chat', responseId: extra.responseId || null, createdAt: now };
  await storage.put({ [messageKey(topic.id, topic.sequence)]: record, [topicKey(topic.id)]: topic });
  return record;
}

export async function recentMessages(storage, topicId, limit = 24) {
  const entries = await storage.list({ prefix: messagePrefix(topicId), reverse: true, limit });
  return [...entries.values()].reverse();
}

export async function pruneUpdateMarkers(storage, keep = 500) {
  const entries = await storage.list({ prefix: UPDATE, reverse: true });
  if (entries.size <= keep) return;
  const old = [...entries.keys()].slice(keep);
  if (old.length) await storage.delete(old);
}
