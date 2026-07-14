import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SearchBox({ className = '' }: { className?: string }) {
  const [value, setValue] = useState('');
  const navigate = useNavigate();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className={className} role="search">
      <label htmlFor="dashboard-search" className="sr-only">
        Search customer, phone, postcode, or reference
      </label>
      <input
        id="dashboard-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search name, phone, postcode, reference…"
        className="min-h-11 w-full rounded-xl border border-silver-300 bg-white px-3.5 py-2.5 text-navy-950 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      />
    </form>
  );
}
