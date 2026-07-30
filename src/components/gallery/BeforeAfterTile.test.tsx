import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BeforeAfterTile from './BeforeAfterTile';
import type { GalleryBeforeAfterItem } from '../../data/galleryMedia';

const ENTRY: GalleryBeforeAfterItem = {
  type: 'before-after',
  id: 'test-pair',
  label: 'Test pair',
  before: '/before.jpg',
  after: '/after.jpg',
  beforeAlt: 'Before alt text',
  afterAlt: 'After alt text',
};

describe('BeforeAfterTile', () => {
  it('renders the "coming soon" placeholder when no entry is supplied', () => {
    render(<BeforeAfterTile placeholderLabel="Some job" />);

    expect(screen.getByText('Recent results coming soon')).toBeInTheDocument();
    expect(screen.getByLabelText('Some job — recent results coming soon')).toBeInTheDocument();
  });

  it('renders real Before/After photos, unambiguously labelled, with accurate alt text', () => {
    render(<BeforeAfterTile entry={ENTRY} placeholderLabel="Test pair" />);

    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
    expect(screen.getByText('Test pair')).toBeInTheDocument();

    const beforeImg = screen.getByAltText('Before alt text');
    const afterImg = screen.getByAltText('After alt text');
    expect(beforeImg).toHaveAttribute('src', '/before.jpg');
    expect(afterImg).toHaveAttribute('src', '/after.jpg');
  });

  it('uses object-contain (not object-cover) so mixed-orientation photos are never misleadingly cropped', () => {
    render(<BeforeAfterTile entry={ENTRY} placeholderLabel="Test pair" />);

    const beforeImg = screen.getByAltText('Before alt text');
    const afterImg = screen.getByAltText('After alt text');
    expect(beforeImg.className).toContain('object-contain');
    expect(afterImg.className).toContain('object-contain');
    expect(beforeImg.className).not.toContain('object-cover');
    expect(afterImg.className).not.toContain('object-cover');
  });
});
