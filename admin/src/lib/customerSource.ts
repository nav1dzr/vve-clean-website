const CHECKATRADE_NOTE = 'Customer source: Checkatrade.';

export function customerSourceChoice(source: string, notes?: string | null): string {
  return source === 'other' && (notes || '').split(/\r?\n/).some((line) => line.trim() === CHECKATRADE_NOTE)
    ? 'checkatrade' : source;
}

export function customerSourceInput(choice: string, notes: string): { source: string; notes: string | null } {
  // Use the existing supported source value; retain the named source as an
  // explicit note until a future schema migration adds a dedicated value.
  const lines = notes.split(/\r?\n/).filter((line) => line.trim() !== CHECKATRADE_NOTE);
  const preserved = lines.join('\n').trim();
  return {
    source: choice === 'checkatrade' ? 'other' : choice,
    notes: [choice === 'checkatrade' ? CHECKATRADE_NOTE : '', preserved].filter(Boolean).join('\n') || null,
  };
}
