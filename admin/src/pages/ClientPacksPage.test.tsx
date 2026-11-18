import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ClientPacksPage, { fileKind } from './ClientPacksPage';
import type { ClientPack } from '../types/clientPack';
const { request }=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('../lib/authFetch',()=>({authFetch:request}));
vi.mock('../lib/supabase',()=>({supabase:{storage:{from:vi.fn()}}}));
const draft:ClientPack={id:'id',status:'draft',revision:1,title:'Test venue',customer_name:'Client',service_date:'2026-11-10',property_address:'Sample',summary:'Cleaning visit',invoice_reference:'INV-TEST',customer_id:null,booking_id:null,invoice_id:null,assets:[],expires_at:null};
afterEach(()=>{cleanup();vi.clearAllMocks();});
function show(p:ClientPack){request.mockResolvedValue({pack:p});render(<MemoryRouter initialEntries={['/client-packs?id=id']}><ClientPacksPage/></MemoryRouter>);}
describe('private pack manager',()=>{
 it('accepts only supported file types',()=>{expect(fileKind(new File(['x'],'x.pdf',{type:'application/pdf'}))).toBe('pdf');expect(fileKind(new File(['x'],'x.mp4',{type:'video/mp4'}))).toBe('video');expect(()=>fileKind(new File(['x'],'x.html',{type:'text/html'}))).toThrow(/Choose a PDF/);});
 it('requires explicit review confirmation before creating a link and has no send action',async()=>{show(draft);fireEvent.click(await screen.findByRole('button',{name:'Create customer link'}));const submit=screen.getByRole('button',{name:'Create link'});expect(submit).toBeDisabled();expect(screen.queryByRole('button',{name:/send email/i})).not.toBeInTheDocument();fireEvent.click(screen.getByRole('checkbox'));expect(submit).toBeEnabled();request.mockResolvedValue({pack:{...draft,status:'published',revision:2},viewPath:'/report-view#'+'a'.repeat(43)});fireEvent.click(submit);await waitFor(()=>expect(request).toHaveBeenCalledWith('/api/customers?resource=client-packs',expect.objectContaining({method:'POST',body:expect.stringContaining('"confirmed":true')})));expect(await screen.findByLabelText('Customer viewing link')).toHaveValue(window.location.origin+'/report-view#'+'a'.repeat(43));});
 it('published packs require revocation before replacement; metadata stays frozen',async()=>{show({...draft,status:'published'});await screen.findByRole('button',{name:'Revoke link'});expect(screen.queryByRole('button',{name:'Create replacement link'})).not.toBeInTheDocument();expect(screen.getByLabelText('Page title')).toBeDisabled();});
 it('shows a replacement action only after revocation',async()=>{show({...draft,status:'revoked'});expect(await screen.findByRole('button',{name:'Create replacement link'})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Revoke link'})).not.toBeInTheDocument();});
 it('opens a blank new pack from an existing record',async()=>{show(draft);await screen.findByRole('button',{name:'Create customer link'});fireEvent.click(screen.getByRole('button',{name:'New pack'}));expect(await screen.findByRole('heading',{name:'New private pack'})).toBeInTheDocument();expect(screen.getByLabelText('Page title')).toHaveValue('');expect(screen.getByRole('button',{name:'Save the draft before uploading'})).toBeDisabled();});
});
