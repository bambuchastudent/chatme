export function nowIso() {
  return new Date().toISOString();
}

export function clampText(value, max = 8000) {
  const text = String(value ?? '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function splitTelegramText(text, limit = 3900) {
  const source = String(text ?? '').trim();
  if (!source) return [];
  if (source.length <= limit) return [source];

  const chunks = [];
  let rest = source;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n\n', limit);
    if (cut < Math.floor(limit * 0.55)) cut = rest.lastIndexOf('\n', limit);
    if (cut < Math.floor(limit * 0.55)) cut = rest.lastIndexOf(' ', limit);
    if (cut < Math.floor(limit * 0.55)) cut = limit;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.filter(Boolean);
}

export function commandOf(text) {
  const match = String(text ?? '').trim().match(/^\/([a-zA-Z_]+)(?:@[\w_]+)?(?:\s+([\s\S]*))?$/);
  if (!match) return null;
  return { name: match[1].toLowerCase(), args: (match[2] ?? '').trim() };
}

export function safeInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeTopicTitle(value) {
  const cleaned = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return clampText(cleaned || 'Новая тема', 96);
}
