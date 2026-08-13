import OpenAI from 'openai';
import { clampText } from './util.js';

const client = new OpenAI();
const REFRESH_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['changed', 'digest', 'message'],
  properties: {
    changed: { type: 'boolean' },
    digest: { type: 'string' },
    message: { type: 'string' }
  }
};

export async function refreshDynamicTopic(env, topic) {
  const result = await client.responses.create({
    store: false,
    model: env.OPENAI_MODEL || 'gpt-5',
    instructions: [
      'Check one time-sensitive saved topic for material external changes.',
      'Use web search and compare with the previous digest and durable memory.',
      'changed=true only if a development could alter the user understanding, decision, plan, timing, cost, availability, or next action.',
      'Routine repetition, unchanged facts, tiny fluctuations, and rewording are not changes.',
      'digest is a compact canonical snapshot for tomorrow comparison.',
      'message is a concise Telegram update in the topic language; it must be empty when changed=false.'
    ].join('\n'),
    tools: [{ type: 'web_search', search_context_size: 'medium' }],
    input: `Topic: ${topic.title}\nMemory: ${topic.summary}\nRefresh goal: ${topic.refreshQuery}\nPrevious digest: ${topic.lastRefreshDigest || '(no baseline)'}`,
    text: { format: { type: 'json_schema', name: 'daily_refresh', strict: true, schema: REFRESH_SCHEMA } },
    max_output_tokens: 1800
  });
  let structured;
  try { structured = JSON.parse(result.output_text || '{}'); }
  catch { throw new Error('Daily refresh returned invalid JSON'); }
  return {
    responseId: result.id ?? null,
    changed: Boolean(structured.changed),
    digest: clampText(structured.digest, 6000),
    message: structured.changed ? clampText(structured.message, 12000) : ''
  };
}
