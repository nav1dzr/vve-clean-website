import { VAT_NOTE, VAT_SHORT_NOTE } from '../data/businessPolicy';

export default function PriceTaxNote({ className = '', inverse = false, compact = false }: { className?: string; inverse?: boolean; compact?: boolean }) {
  return <p className={`text-sm leading-relaxed ${inverse ? 'text-slate-200' : 'text-slate-600'} ${className}`}>{compact ? VAT_SHORT_NOTE : VAT_NOTE}</p>;
}
