import OpenAI from 'openai';
import { clampText, normalizeTopicTitle } from './util.js';

const client = new OpenAI();
const MEMORY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'summary', 'refresh_policy', 'refresh_query'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    refresh_policy: { type: 'string', enum: ['on_change', 'daily'] },
    refresh_query: { type: 'string' }
  }
};

export async function summarizeTopic(env, topic, messages) {
  const transcript = messages
    .map((message) => `${message.role.toUpperCase()}: ${clampText(message.content, 6000)}`)
    .join('\n\n');
  const result = await client.responses.create({
    store: false,
    model: env.OPENAI_ORGANIZER_MODEL || env.OPENAI_MODEL || 'gpt-5-mini',
    instructions: [
      'Maintain compact durable memory for one Telegram AI topic.',
      'Keep useful state, decisions, preferences, facts, constraints, unresolved questions, and goals; drop incidental chatter.',
      'Set refresh_policy=daily only when changing external facts make a daily web check useful.',
      'For daily topics provide a standalone refresh_query; otherwise use an empty string.',
      'The title must be short and recognizable in Telegram.'
    ].join('\n'),
    input: `Current title: ${topic.title}\nCurrent memory: ${topic.summary || '(empty)'}\n\nEvidence:\n${clampText(transcript, 30000)}`,
    text: { format: { type: 'json_schema', name: 'topic_memory', strict: true, schema: MEMORY_SCHEMA } },
    max_output_tokens: 1800
  });
  let structured;
  try { structured = JSON.parse(result.output_text || '{}'); }
  catch { throw new Error('Topic memory returned invalid JSON'); }
  return {
    responseId: result.id ?? null,
    title: normalizeTopicTitle(structured.title),
    summary: clampText(structured.summary, 8000),
    refreshPolicy: structured.refresh_policy === 'daily' ? 'daily' : 'on_change',
    refreshQuery: structured.refresh_policy === 'daily' ? clampText(structured.refresh_query, 500) : ''
  };
}
