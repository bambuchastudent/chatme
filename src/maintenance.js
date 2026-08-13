import { refreshDynamicTopic } from './openai-refresh.js';
import { listTopics, saveTopic } from './memory.js';
import { rebuildMemory } from './topics.js';

export async function runDailyMaintenance(storage, env, profile) {
  const topics = await listTopics(storage);
  let retrySoon = false;
  for (let topic of topics) {
    try {
      if (topic.sequence > Number(topic.summarizedSequence || 0)) {
        topic = await rebuildMemory(storage, env, topic, profile.chatId);
      }
      if (topic.refreshPolicy !== 'daily' || !topic.refreshQuery) continue;
      const refresh = await refreshDynamicTopic(env, topic);
      topic.lastRefreshAt = new Date().toISOString();
      topic.lastRefreshDigest = refresh.digest;
      if (refresh.changed && refresh.message) {
        topic.summary = `${topic.summary}\n\nПоследнее внешнее обновление: ${refresh.message}`.trim();
      }
      await saveTopic(storage, topic);
    } catch (error) {
      console.error('maintenance error', topic.id, error);
      retrySoon = true;
    }
  }
  return { retrySoon };
}
