import { describe, expect, it } from 'vitest';
import { exportTraceHtml, exportTraceJson, redactTrace } from './export';
import { parseTrace } from './import';
import type { RedactionMode } from './export';
import type { Trace } from './types';

const zero = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
function fixture(): Trace {
  return {
    schemaVersion: 1, id: 'ghp_original', name: 'private-filename.json',
    source: '/home/alice/private', warnings: ['Contact alice@example.com'],
    usage: { ...zero }, demo: false,
    events: [
      { id: 'ghp_first', kind: 'user', name: 'alice@example.com', content: 'hello', status: 'ok', timestamp: 0 },
      { id: 'ghp_second', parentId: 'ghp_first', kind: 'tool', name: 'private tool',
        model: 'sk-ant-sensitive', content: 'content', input: 'input', output: 'output',
        status: 'error', timestamp: 10, durationMs: 0, usage: { ...zero } },
      { id: 'third', parentId: 'missing-external', kind: 'assistant', name: 'private assistant', content: 'answer', status: 'unknown' },
    ],
  };
}

describe.each<RedactionMode>(['patterns', 'structure'])('%s sharing', (mode) => {
  it('does not mutate or retain shared object references; remaps ids without scrub collisions', () => {
    const original = fixture();
    const before = structuredClone(original);
    const shared = redactTrace(original, mode);
    expect(original).toEqual(before);
    expect(shared.id).toBe('shared-run');
    expect(shared.name).toBe('Shared agent run');
    expect(shared.events.map((event) => event.id)).toEqual(['event-1', 'event-2', 'event-3']);
    expect(shared.events[1].parentId).toBe('event-1');
    expect(shared.events[2]).not.toHaveProperty('parentId');
    expect(redactTrace(original, mode)).toEqual(shared);
    shared.usage!.input = 123;
    shared.events[1].usage!.output = 456;
    expect(original).toEqual(before);
  });
  it('exports a plain, reimport-compatible version 1 Trace with zero metrics intact', () => {
    const json = JSON.parse(exportTraceJson(fixture(), mode)) as Trace;
    expect(json.schemaVersion).toBe(1);
    expect(json.usage).toEqual(zero);
    expect(json.events[1].usage).toEqual(zero);
    expect(json.events[0].timestamp).toBe(0);
    expect(json.events[1].durationMs).toBe(0);
    expect(json.events[2]).not.toHaveProperty('timestamp');
    expect(json.events[2]).not.toHaveProperty('durationMs');
  });
  it('makes standalone script-free escaped HTML without original hidden payload', () => {
    const run = fixture();
    const attack = '</script><img src="https://evil.example/x" onerror="alert(1)"><script>alert(2)</script>';
    run.events[1].name = attack;
    run.events[1].content = attack;
    run.events[1].input = attack;
    run.events[1].output = attack;
    run.events[1].model = attack;
    run.warnings.push(attack);
    const html = exportTraceHtml(run, mode);
    expect(html).toContain('TraceCrate');
    expect(html).toContain("default-src 'none'; style-src 'unsafe-inline'");
    expect(html).toContain('<details id="event-2">');
    expect(html).toContain('<summary>');
    expect(html).toContain('href="#event-1"');
    expect(html).not.toMatch(/<\/?script\b|<img\b|<iframe\b|<link\b|<object\b|<embed\b|<svg\b/i);
    expect(html).not.toMatch(/\s(?:src|href)=["']https?:|url\(|@import/i);
    expect(html).not.toContain(attack);
    expect(html).not.toContain('ghp_first');
    expect(html).not.toContain('private-filename.json');
    if (mode === 'patterns') expect(html).toContain('&lt;/script&gt;&lt;img');
    else expect(html).not.toContain('alert(1)');
  });
});

describe('pattern redaction', () => {
  it.each([
    'ghp_ABCdef123', 'github_pat_ABC_123', 'GHP_UPPER123', 'sk-openaiSecret123',
    'sk-ant-api03-AnthropicSecret', 'Bearer authSecret.ABC+/=',
    '-----BEGIN RSA PRIVATE KEY-----\nPRIVATE-BODY\n-----END RSA PRIVATE KEY-----',
    'Alice.Smith@example.com', '/home/alice/project/private.txt', '/Users/Alice/private.txt',
    '/root/private.txt', 'C:\\Users\\Alice\\private.txt', 'C:/Users/Alice/private.txt',
    'api_key=superSecret123', 'PASSWORD="superSecret123"', "client_secret='superSecret123'",
    'Authorization: Bearer superSecret123', 'OPENAI_API_KEY=superSecret123',
  ])('scrubs credential/path pattern %s in every string-valued field', (secret) => {
    const run = fixture();
    run.name = secret;
    run.id = secret;
    run.source = secret;
    run.warnings = [secret];
    Object.assign(run.events[0], { id: secret, name: secret, model: secret, content: secret, input: secret, output: secret });
    const serialized = exportTraceJson(run, 'patterns');
    expect(serialized).not.toContain(JSON.stringify(secret).slice(1, -1));
    expect(serialized).not.toContain('superSecret123');
    expect(serialized).not.toContain('PRIVATE-BODY');
  });
  it('recursively scrubs metadata, secret keys, JSON payloads and escaped nested JSON strings', () => {
    const run = fixture();
    const payload = { nested: { password: 'unrecognizable-value', apiKey: 'another-secret' }, raw: JSON.stringify({ client_secret: 'inner-secret', note: 'ghp_nested' }) };
    run.events[1].input = JSON.stringify(payload);
    run.events[1].output = JSON.stringify(JSON.stringify({ token: 'double-encoded-secret' }));
    Object.assign(run, { metadata: { credentials: { arbitrary: 'credential-object' }, extra: ['alice@example.com'], 'ghp_key': 'sk-other' } });
    Object.assign(run.events[1], { metadata: { refresh_token: 'event-secret' } });
    const json = exportTraceJson(run, 'patterns');
    for (const value of ['unrecognizable-value', 'another-secret', 'inner-secret', 'ghp_nested', 'double-encoded-secret', 'credential-object', 'alice@example.com', 'ghp_key', 'sk-other', 'event-secret']) {
      expect(json).not.toContain(value);
    }
    expect(JSON.parse(JSON.parse(json).events[1].input).nested.password).toBe('[REDACTED]');
  });
  it('scrubs escaped JSON fragments embedded in ordinary log text', () => {
    const run = fixture();
    run.events[0].content = 'payload: {\\"password\\":\\"embedded-secret\\",\\"api_key\\":\\"embedded-key\\"}';
    const json = exportTraceJson(run, 'patterns');
    expect(json).not.toContain('embedded-secret');
    expect(json).not.toContain('embedded-key');
  });
  it('preserves ordinary code/text and prominently warns that review is required', () => {
    const run = fixture();
    run.events[0].content = 'const answer = 42; // ordinary code';
    const shared = redactTrace(run, 'patterns');
    expect(shared.events[0].content).toBe(run.events[0].content);
    expect(shared.warnings[0]).toContain('BEST-EFFORT');
    expect(shared.warnings[0]).toContain('Code and text are preserved');
    expect(shared.warnings[0]).toContain('not a security guarantee');
  });

  it('fails closed on thousands of array levels hidden inside imported strings', () => {
    const run = fixture();
    const hidden = '['.repeat(5000) + '"unpatterned-confidential-value"' + ']'.repeat(5000);
    Object.assign(run.events[1], { content: hidden, input: hidden, output: hidden });
    const imported = parseTrace(JSON.stringify(run));
    const json = exportTraceJson(imported, 'patterns');
    const shared = parseTrace(json);
    expect(shared.events[1]).toMatchObject({ content: '[REDACTED]', input: '[REDACTED]', output: '[REDACTED]' });
    expect(json).not.toContain('unpatterned-confidential-value');
    expect(exportTraceHtml(imported, 'patterns')).not.toContain('unpatterned-confidential-value');
    expect(imported.events[1].content).toBe(hidden);
    expect(redactTrace(imported, 'structure').events[1].content).toBe('[Removed for sharing]');
  });

  it('shares a depth budget across containers and repeated serialized JSON layers', () => {
    let hidden = JSON.stringify({ note: 'unpatterned-confidential-value' });
    for (let i = 0; i < 8; i++) hidden = '['.repeat(40) + JSON.stringify(hidden) + ']'.repeat(40);
    const run = fixture();
    run.events[0].content = hidden;
    const imported = parseTrace(JSON.stringify(run));
    const json = exportTraceJson(imported, 'patterns');
    expect(json).toContain('[REDACTED]');
    expect(json).not.toContain('unpatterned-confidential-value');
    expect(parseTrace(json).events[0].id).toBe('event-1');
    expect(exportTraceHtml(imported, 'patterns')).not.toContain('unpatterned-confidential-value');
  });

  it('redacts deep serialized IDs and names within valid native string limits', () => {
    const hidden = '['.repeat(100) + '"unpatterned-confidential-value"' + ']'.repeat(100);
    const run = fixture();
    Object.assign(run.events[0], { id: hidden, name: hidden, model: hidden });
    run.events[1].parentId = hidden;
    const imported = parseTrace(JSON.stringify(run));
    const shared = parseTrace(exportTraceJson(imported, 'patterns'));
    expect(shared.events[0]).toMatchObject({ id: 'event-1', name: '[REDACTED]', model: '[REDACTED]' });
    expect(shared.events[1].parentId).toBe('event-1');
    expect(JSON.stringify(shared)).not.toContain('unpatterned-confidential-value');
  });

  it('bounds runtime objects, arrays and keys without changing the structure allowlist', () => {
    let nested: unknown = 'unpatterned-confidential-value';
    for (let i = 0; i < 5000; i++) nested = i % 2 ? { next: nested } : [nested];
    const run = fixture();
    const deepKey = '['.repeat(100) + '"unpatterned-key-value"' + ']'.repeat(100);
    Object.assign(run.events[0], { metadata: { nested, [deepKey]: 'ordinary' } });
    const json = exportTraceJson(run, 'patterns');
    expect(json).toContain('[REDACTED]');
    expect(json).not.toContain('unpatterned-confidential-value');
    expect(json).not.toContain('unpatterned-key-value');
    expect(exportTraceHtml(run, 'patterns')).not.toContain('unpatterned-confidential-value');
    expect(redactTrace(run, 'structure')).toEqual(redactTrace(fixture(), 'structure'));
  });

  it('does not treat warning indexes as depth or truncate ordinary long text', () => {
    const run = fixture();
    run.events[0].content = 'const answer = 42;\n'.repeat(10_000);
    run.warnings = Array.from({ length: 100 }, () => 'ordinary warning');
    const shared = redactTrace(run, 'patterns');
    expect(shared.events[0].content).toBe(run.events[0].content);
    expect(shared.warnings.slice(1)).toEqual(run.warnings);
  });
});

describe('structure allowlist', () => {
  it('is the safe default and removes arbitrary strings and unknown runtime properties', () => {
    const run = fixture();
    const marker = 'ARBITRARY-CONFIDENTIAL-TEXT';
    run.name = marker;
    run.source = marker;
    run.warnings = [marker];
    Object.assign(run, { filename: marker, metadata: { secret: marker }, extra: [marker] });
    Object.assign(run.usage!, { extra: marker });
    for (const event of run.events) {
      Object.assign(event, { name: marker, content: marker, model: marker, input: marker, output: marker, metadata: marker, extra: { nested: marker } });
      if (event.usage) Object.assign(event.usage, { extra: marker });
    }
    const shared = redactTrace(run);
    expect(JSON.stringify(shared)).not.toContain(marker);
    expect(exportTraceHtml(run)).not.toContain(marker);
    expect(exportTraceJson(run)).not.toContain(marker);
    expect(shared.warnings).toEqual(['Content removed. Metrics and event structure retained.']);
    expect(shared.source).toBe('TraceCrate export');
    expect(shared.demo).toBe(false);
    expect(shared.events[1]).toEqual({
      id: 'event-2', parentId: 'event-1', kind: 'tool', name: 'Tool 1',
      content: '[Removed for sharing]', status: 'error', timestamp: 10, durationMs: 0, usage: zero,
    });
    expect(Object.keys(shared).sort()).toEqual(['schemaVersion', 'id', 'name', 'source', 'events', 'warnings', 'usage', 'demo'].sort());
  });
  it('does not copy malformed runtime strings from numeric/enum/boolean fields', () => {
    const run = fixture();
    Object.assign(run, { demo: 'secret-demo' });
    Object.assign(run.events[0], { kind: 'secret-kind', status: 'secret-status', timestamp: 'secret-time', durationMs: 'secret-duration' });
    Object.assign(run.usage!, { input: 'secret-count' });
    const json = exportTraceJson(run, 'structure');
    expect(json).not.toContain('secret-');
    const shared = JSON.parse(json) as Trace;
    expect(shared.events[0].kind).toBe('system');
    expect(shared.events[0].status).toBe('unknown');
    expect(shared).not.toHaveProperty('demo');
  });
  it('leaves absent usage/duration unknown rather than fabricating zero totals', () => {
    const run = fixture();
    delete run.usage;
    run.events = [run.events[2]];
    const shared = redactTrace(run);
    expect(shared).not.toHaveProperty('usage');
    expect(shared.events[0]).not.toHaveProperty('durationMs');
    expect(exportTraceHtml(run)).toContain('Unknown');
  });
});