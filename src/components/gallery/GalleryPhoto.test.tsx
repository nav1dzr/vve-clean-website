import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import GalleryPhoto from './GalleryPhoto';

describe('gallery photo load recovery', () => {
  it('keeps a descriptive fallback and does not nest a retry button inside a gallery button', () => {
    render(<button type="button" aria-label="View photo"><GalleryPhoto src="/test-photo.jpg" alt="Carpet after cleaning" className="h-full w-full object-contain" /></button>);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('This photo could not be loaded.');
    expect(screen.getByText('Carpet after cleaning')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('retries the original photo only on request, and retries new sources automatically', () => {
    const { rerender } = render(<GalleryPhoto retryable src="/first.jpg" alt="First photo" />);
    fireEvent.error(screen.getByRole('img'));
    fireEvent.click(screen.getByRole('button', { name: 'Try loading photo again' }));
    expect(screen.getByRole('img')).toHaveAttribute('src', '/first.jpg');
    fireEvent.error(screen.getByRole('img'));
    rerender(<GalleryPhoto retryable src="/next.jpg" alt="Next photo" />);
    expect(screen.getByRole('img', { name: 'Next photo' })).toHaveAttribute('src', '/next.jpg');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
