import { answerTopic } from './openai.js';
import { appendMessage, recentMessages } from './memory.js';
import { rebuildMemory, selectTopic } from './topics.js';
import { sendText, sendTyping } from './telegram.js';
import { safeInt } from './util.js';

export async function handleConversation(storage, env, message) {
  let topic = await selectTopic(storage, env, message);
  const recentLimit = safeInt(env.RECENT_MESSAGE_LIMIT, 24, 4, 60);
  const previous = await recentMessages(storage, topic.id, recentLimit);

  await appendMessage(storage, topic, 'user', message.text, {
    telegramMessageId: message.message_id
  });

  await sendTyping(env, message.chat.id, topic.telegramThreadId ?? message.message_thread_id ?? null);
  const answer = await answerTopic(env, topic, previous, message.text);
  if (!answer.text) throw new Error('OpenAI returned an empty reply');

  const sent = await sendText(env, message.chat.id, answer.text, topic.telegramThreadId ?? message.message_thread_id ?? null);
  await appendMessage(storage, topic, 'assistant', answer.text, {
    responseId: answer.id,
    telegramMessageId: sent[0]?.message_id ?? null
  });

  const threshold = safeInt(env.SUMMARY_MESSAGE_THRESHOLD, 6, 2, 30);
  const unsummarized = topic.sequence - Number(topic.summarizedSequence || 0);
  if (!topic.summary ? unsummarized >= 2 : unsummarized >= threshold) {
    topic = await rebuildMemory(storage, env, topic, message.chat.id);
  }
  return topic;
}
