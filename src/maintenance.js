import { refreshDynamicTopic } from './openai-refresh.js';
import { appendMessage, listTopics, saveTopic } from './memory.js';
import { rebuildMemory } from './topics.js';
import { sendText } from './telegram.js';

export async function runDailyMaintenance(storage, env, profile) {
  const topics = await listTopics(storage);
  let retrySoon = false;
  for (let topic of topics) {
    try {
      if (topic.sequence > Number(topic.summarizedSequence || 0)) {
        topic = await rebuildMemory(storage, env, topic, profile.chatId);
      }
      if (topic.refreshPolicy !== 'daily' || !topic.refreshQuery) continue;
      const hadBaseline = Boolean(topic.lastRefreshDigest);
      const refresh = await refreshDynamicTopic(env, topic);
      topic.lastRefreshAt = new Date().toISOString();
      topic.lastRefreshDigest = refresh.digest;
      if (refresh.changed && refresh.message) topic.dailyUpdate = refresh.message;
      await saveTopic(storage, topic);

      if (topic.notifyOnChange && hadBaseline && refresh.changed && refresh.message) {
        const sent = await sendText(env, profile.chatId, refresh.message, topic.telegramThreadId ?? null);
        await appendMessage(storage, topic, 'assistant', refresh.message, {
          kind: 'refresh', responseId: refresh.responseId, telegramMessageId: sent[0]?.message_id ?? null
        });
      }
    } catch (error) {
      console.error('maintenance error', topic.id, error);
      retrySoon = true;
    }
  }
  return { retrySoon };
}
