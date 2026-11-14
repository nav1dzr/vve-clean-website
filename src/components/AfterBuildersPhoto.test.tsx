import { afterEach, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { buildersJobPhotos } from '../data/afterBuildersPhotos';
import AfterBuildersPhoto, { AfterBuildersResults } from './AfterBuildersPhoto';

afterEach(() => {
  delete buildersJobPhotos.hero;
  delete buildersJobPhotos.before;
  delete buildersJobPhotos.after;
});

it('shows an approved hero independently and removes the figure if loading fails', () => {
  buildersJobPhotos.hero = { src: '/test/finished.jpg', alt: 'Cleaned room' };
  const { container } = render(<><AfterBuildersPhoto /><AfterBuildersResults /></>);
  expect(screen.queryByRole('heading')).toBeNull();
  fireEvent.error(screen.getByAltText('Cleaned room'));
  expect(container).toBeEmptyDOMElement();
});

it('only shows a complete before/after pair and removes the section if either image fails', () => {
  buildersJobPhotos.before = { src: '/test/before.jpg', alt: 'Dust on the sill' };
  const { container, rerender } = render(<AfterBuildersResults />);
  expect(container).toBeEmptyDOMElement();
  buildersJobPhotos.after = { src: '/test/after.jpg', alt: 'Cleaned sill' };
  rerender(<AfterBuildersResults />);
  expect(screen.getAllByRole('img')).toHaveLength(2);
  expect(screen.getByRole('region', { name: /before and after/i })).toBeVisible();
  fireEvent.error(screen.getByAltText('Cleaned sill'));
  expect(container).toBeEmptyDOMElement();
});
