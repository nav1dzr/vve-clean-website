import { VAT_NOTE } from '../data/businessPolicy';

export default function PriceTaxNote({ className = '', inverse = false }: { className?: string; inverse?: boolean }) {
  return <p className={`text-sm leading-relaxed ${inverse ? 'text-slate-200' : 'text-slate-600'} ${className}`}>{VAT_NOTE}</p>;
}
