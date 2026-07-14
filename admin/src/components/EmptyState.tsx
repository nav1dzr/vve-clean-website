import type { ReactNode } from 'react';

export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-silver-300 bg-white px-4 py-8 text-center">
      <p className="font-medium text-navy-900">{title}</p>
      {description && <p className="mt-1 text-sm text-navy-700">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
