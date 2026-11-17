import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BulkMediaEditor from './BulkMediaEditor';
import type { MediaAsset } from '../types/media';
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock('../lib/authFetch', () => ({ authFetch: fetchMock }));
const asset = (id: string): MediaAsset => ({
  id, mediaType:'image',status:'ready',title:'Original ' + id,altText:'Original description',service:'carpet',category:'carpet',
  placement:'gallery-carpet',beforeAfter:'none',pairKey:'',locationLabel:'',websiteVisible:false,googleEnabled:false,
  socialEnabled:false,requestedSlotKey:null,activeSlotKey:null,usages:[],imageUrl:null,muxPlaybackId:null,processingError:'',
  createdAt:'2026-11-05T10:00:00Z',updatedAt:'2026-11-05T10:00:00Z',filename:id+'.jpg',size:100,contentType:'image/jpeg',
});
beforeEach(() => { fetchMock.mockReset(); });
describe('bulk media edits', () => {
  it('retains existing wording unless replacement is deliberately enabled', () => {
    render(<BulkMediaEditor assets={[asset('one')]} onClose={vi.fn()} onDirtyChange={vi.fn()} onBusyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', {name:'Fill with suggested wording'}));
    expect(screen.getByLabelText('Caption for one.jpg')).toHaveValue('Original one');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', {name:'Fill with suggested wording'}));
    expect(screen.getByLabelText('Caption for one.jpg')).toHaveValue('Carpet cleaning photo');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('retries only failed rows and reconciles a lost successful response', async () => {
    let second = false;
    const saved = { ...asset('two'),title:'Edited two' };
    fetchMock.mockImplementation(async (path: string, options: RequestInit) => {
      if (path.endsWith('one') && options.method === 'PATCH') return {asset:asset('one')};
      if (path.endsWith('two') && options.method === 'POST') return {asset:second ? saved : asset('two')};
      if (path.endsWith('two')) { if (!second) throw new Error('Lost response'); throw new Error('Lost acknowledgement'); }
    });
    render(<BulkMediaEditor assets={[asset('one'),asset('two')]} onClose={vi.fn()} onDirtyChange={vi.fn()} onBusyChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Caption for two.jpg'), {target:{value:'Edited two'}});
    fireEvent.click(screen.getByRole('button', {name:'Save unsaved items'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Lost response');
    expect(screen.getAllByText('Saved')).toHaveLength(1);
    second = true;
    fireEvent.click(screen.getByRole('button', {name:'Save unsaved items'}));
    await waitFor(() => expect(screen.getAllByText('Saved')).toHaveLength(2));
    expect(fetchMock.mock.calls.filter(([path, options]) => path.endsWith('one') && options.method === 'PATCH')).toHaveLength(1);
    expect(screen.getByRole('button', {name:'Save unsaved items'})).toBeDisabled();
  });
});
