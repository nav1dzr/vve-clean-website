import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSubmissionIdentity, submissionIdentity } from './submissionIdentity';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
beforeEach(() => { vi.stubGlobal('crypto', webcrypto); sessionStorage.clear(); clearSubmissionIdentity('test'); });
afterEach(() => vi.unstubAllGlobals());
describe('essential submission retry identity', () => {
  it('reuses one UUID for simultaneous retries, and changes it for edited content', async () => {
    const payload = { email: 'customer@example.com', message: 'Please quote.' };
    const [first, retry] = await Promise.all([submissionIdentity('test', payload), submissionIdentity('test', payload)]);
    expect(first).toMatch(UUID); expect(retry).toBe(first);
    expect(await submissionIdentity('test', { ...payload, message: 'Changed.' })).not.toBe(first);
    expect(sessionStorage.getItem('vve_retry_test')).not.toContain('customer@example.com');
    expect(sessionStorage.getItem('vve_retry_test')).not.toContain('Changed.');
  });
  it('rejects a corrupt stored UUID instead of making every later submission fail validation', async () => {
    const payload = { message: 'Please quote.' };
    await submissionIdentity('test', payload);
    const stored = JSON.parse(sessionStorage.getItem('vve_retry_test')!);
    clearSubmissionIdentity('test'); sessionStorage.setItem('vve_retry_test', JSON.stringify({ ...stored, id: 'invalid' }));
    expect(await submissionIdentity('test', payload)).toMatch(UUID);
  });
  it('still produces secure UUIDs in browsers with getRandomValues but no randomUUID', async () => {
    vi.stubGlobal('crypto', { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
    const id = await submissionIdentity('test', { message: 'Please quote.' });
    expect(id).toMatch(UUID); expect(await submissionIdentity('test', { message: 'Please quote.' })).toBe(id);
    expect(sessionStorage.getItem('vve_retry_test')).toBeNull();
  });
  it('retains an in-memory retry when session storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('disabled'); });
    const id = await submissionIdentity('test', { message: 'Please quote.' });
    expect(await submissionIdentity('test', { message: 'Please quote.' })).toBe(id);
    vi.restoreAllMocks();
  });
});
