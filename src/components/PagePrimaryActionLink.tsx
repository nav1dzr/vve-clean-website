import type { MouseEventHandler, ReactNode } from 'react';
import { Link, resolvePath, useLocation } from 'react-router-dom';

export interface PagePrimaryAction {
  href: string;
  label: string;
  isWa?: boolean;
}

interface Props {
  action: PagePrimaryAction;
  className: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  children?: ReactNode;
}

// Preserve native hash scrolling and genuine contact anchors for the shared
// contact-click listener. Route links retain client-side navigation.
export default function PagePrimaryActionLink({ action, className, onClick, children }: Props) {
  const location = useLocation();
  const content = children ?? action.label;
  const target = /^(#|\/(?!\/))/.test(action.href)
    ? resolvePath(action.href, location.pathname)
    : null;
  const isSamePageFragment = Boolean(target?.hash)
    && target?.pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '')
    && (!target.search || target.search === location.search);
  // Canonical /service#quote links on that service are native fragments:
  // clicking again still scrolls, and existing campaign query data is kept.
  const href = isSamePageFragment && target ? target.hash : action.href;
  const isHttp = /^https?:/i.test(href);
  if (href.startsWith('#') || /^(https?:|tel:|mailto:)/i.test(href)) {
    return (
      <a
        href={href}
        className={className}
        onClick={onClick}
        target={isHttp ? '_blank' : undefined}
        rel={isHttp ? 'noopener noreferrer' : undefined}
      >
        {content}
      </a>
    );
  }
  return <Link to={action.href} className={className} onClick={onClick}>{content}</Link>;
}
