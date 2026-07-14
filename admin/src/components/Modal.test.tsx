import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

function renderModal(onClose = vi.fn()) {
  render(
    <Modal titleId="test-modal-title" title="Test modal" onClose={onClose}>
      <input placeholder="First field" />
      <button type="button">Middle button</button>
      <button type="button">Last button</button>
    </Modal>,
  );
  return onClose;
}

describe('Modal — focus trap', () => {
  it('renders as an accessible dialog', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Test modal' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves initial focus into the panel (the first input, not the close button)', () => {
    renderModal();
    expect(screen.getByPlaceholderText('First field')).toHaveFocus();
  });

  it('closes on Escape', () => {
    const onClose = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('wraps Tab from the last focusable element back to the first', async () => {
    const user = userEvent.setup();
    renderModal();
    screen.getByText('Last button').focus();
    await user.tab();
    // The close (✕) button is first in DOM order, ahead of the input.
    expect(screen.getByLabelText('Close')).toHaveFocus();
  });

  it('wraps Shift+Tab from the first focusable element back to the last', async () => {
    const user = userEvent.setup();
    renderModal();
    screen.getByLabelText('Close').focus();
    await user.tab({ shift: true });
    expect(screen.getByText('Last button')).toHaveFocus();
  });

  it('closes when the backdrop is clicked, not when the panel is clicked', () => {
    const onClose = renderModal();
    fireEvent.click(screen.getByText('Middle button'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
