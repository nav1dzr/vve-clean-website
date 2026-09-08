import { useRef, useId } from 'react';
import { ShoppingBag, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { clearQuoteBasket, useQuoteBasket } from '../lib/quoteBasket';

export default function BasketButton() {
  const basket = useQuoteBasket();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" onClick={() => dialog.current?.showModal()} aria-label={basket ? 'Your basket — saved cleaning selection' : 'Your basket'} className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-navy-900 rounded-lg hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-royal-600">
      <ShoppingBag size={21} />
      {basket && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-royal-600" />}
    </button>
    <dialog ref={dialog} className="quote-basket-dialog" aria-labelledby={titleId} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
      <div className="bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4"><h2 id={titleId} className="font-display text-2xl font-bold text-navy-950">Your cleaning basket</h2><button type="button" onClick={() => dialog.current?.close()} aria-label="Close basket" className="p-3 rounded-lg hover:bg-slate-100"><X size={20} /></button></div>
        {basket ? <>
          <p className="mt-5 rounded-xl bg-sky-50 p-4 font-semibold text-navy-900">{basket.label}</p>
          <p className="my-5 text-sm leading-relaxed text-slate-600">Your choices are saved on this browser for 14 days. Continue to review your selection and current price. No appointment is reserved yet.</p>
          <Link to={basket.href} onClick={() => dialog.current?.close()} className="block rounded-xl bg-royal-600 px-5 py-3 text-center font-bold text-white">Continue my quote</Link>
          <button type="button" onClick={() => { clearQuoteBasket(); dialog.current?.close(); }} className="mt-3 min-h-[44px] w-full text-sm text-slate-600 underline underline-offset-4">Remove saved basket</button>
        </> : <><p className="my-5 text-slate-600">Choose a service and add your cleaning items. Your selections will stay here while you explore the website.</p><Link to="/#quote" onClick={() => dialog.current?.close()} className="block rounded-xl bg-royal-600 px-5 py-3 text-center font-bold text-white">Start my quote</Link></>}
      </div>
    </dialog>
  </>;
}
