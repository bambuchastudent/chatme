import OpenAI from 'openai';

const client = new OpenAI();

export async function simpleResponse(model, input) {
  const result = await client.responses.create({ model, input, store: false });
  return { id: result.id ?? null, text: result.output_text ?? '' };
}
