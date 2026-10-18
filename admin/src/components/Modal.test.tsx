import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
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

  it('keeps initial Shift+Tab inside a dialog containing links and buttons only', async () => {
    const user = userEvent.setup();
    render(<>
      <button>Outside page action</button>
      <Modal titleId="navigation-title" title="Navigation" onClose={vi.fn()}>
        <a href="/customers">Customers</a>
        <a href="/search">Search</a>
      </Modal>
    </>);
    expect(screen.getByRole('dialog')).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('link', { name: 'Search' })).toHaveFocus();
    expect(screen.getByText('Outside page action')).not.toHaveFocus();
  });

  it('closes when the backdrop is clicked, not when the panel is clicked', () => {
    const onClose = renderModal();
    fireEvent.click(screen.getByText('Middle button'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});


describe('Modal — returning to the task', () => {
  it('returns focus to the actual opener rather than a different page action', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return <>
        <button>New item</button>
        <button onClick={() => setOpen(true)}>Edit existing item</button>
        {open && <Modal titleId="edit-title" title="Edit item" onClose={() => setOpen(false)}><input aria-label="Item name" /></Modal>}
      </>;
    }
    render(<Harness />);
    await user.click(screen.getByText('Edit existing item'));
    expect(screen.getByLabelText('Item name')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Edit existing item')).toHaveFocus();
  });

  it('skips disabled and hidden inputs when choosing initial focus', () => {
    render(<Modal titleId="disabled-title" title="Unavailable inputs" onClose={vi.fn()}>
      <input aria-label="Unavailable" disabled />
      <input type="hidden" value="internal" readOnly />
      <input aria-label="Editable" />
    </Modal>);
    expect(screen.getByLabelText('Editable')).toHaveFocus();
  });
});
