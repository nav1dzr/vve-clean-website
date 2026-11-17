import { useContext, useEffect } from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom';
import Modal from './Modal';

export default function MediaNavigationGuard({ dirty, busy }: { dirty: boolean; busy: boolean }) {
  const router = useContext(UNSAFE_DataRouterContext);
  useEffect(() => {
    if (!dirty && !busy) return;
    const protectReload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectReload);
    return () => window.removeEventListener('beforeunload', protectReload);
  }, [dirty, busy]);
  return router ? <RouteGuard dirty={dirty} busy={busy} /> : null;
}

function RouteGuard({ dirty, busy }: { dirty: boolean; busy: boolean }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    (dirty || busy) && currentLocation.pathname !== nextLocation.pathname);
  if (blocker.state !== 'blocked') return null;
  return <Modal titleId="leave-media-title" title="Leave the media manager?" onClose={() => blocker.reset()}>
    <p className="text-sm leading-6 text-navy-800">{busy
      ? 'A media action is still running. Wait for it to finish, or cancel the upload before leaving.'
      : 'Single-item caption drafts can be reviewed when you return if this browser has saved them. Unsaved bulk edits, position selections and selected files will need to be entered again.'}</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <button className="min-h-11 rounded-lg border border-silver-300 px-4 font-semibold" onClick={() => blocker.reset()}>Keep working</button>
      {!busy && <button className="min-h-11 rounded-lg bg-navy-950 px-4 font-semibold text-white" onClick={() => blocker.proceed()}>Leave media manager</button>}
    </div>
  </Modal>;
}
