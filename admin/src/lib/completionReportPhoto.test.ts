import { describe, expect, it } from 'vitest';
import { prepareCompletionPhoto } from './completionReportPhoto';
describe('Completion report photo validation', () => {
  it('rejects unsupported file types before decoding', async () => {
    await expect(prepareCompletionPhoto(new File(['svg'], 'photo.svg', { type: 'image/svg+xml' }))).rejects.toThrow('JPEG or PNG');
  });
  it('rejects large originals rather than silently replacing their evidence', async () => {
    await expect(prepareCompletionPhoto(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'photo.jpg', { type: 'image/jpeg' }))).rejects.toThrow('original is preserved unchanged');
  });
});
