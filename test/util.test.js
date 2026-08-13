import test from 'node:test';
import assert from 'node:assert/strict';
import { commandOf, normalizeTopicTitle, splitTelegramText } from '../src/util.js';

test('command parsing', () => {
  assert.deepEqual(commandOf('/new@ChatMeBot Проект'), { name: 'new', args: 'Проект' });
});

test('topic title is bounded', () => {
  assert.ok(normalizeTopicTitle('x'.repeat(200)).length <= 96);
});

test('long Telegram text is split', () => {
  assert.ok(splitTelegramText('слово '.repeat(2000)).every((chunk) => chunk.length <= 3900));
});
