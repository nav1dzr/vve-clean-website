import { useContext, type MutableRefObject } from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom';
import Modal from './Modal';

export default function CompletionReportNavigationGuard({ dirty, busy, allowNavigation }: { dirty: boolean; busy: boolean; allowNavigation: MutableRefObject<boolean> }) {
  const router = useContext(UNSAFE_DataRouterContext);
  return router ? <RouteGuard dirty={dirty} busy={busy} allowNavigation={allowNavigation} /> : null;
}
function RouteGuard({ dirty, busy, allowNavigation }: { dirty: boolean; busy: boolean; allowNavigation: MutableRefObject<boolean> }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !allowNavigation.current && (dirty || busy) && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  if (blocker.state !== 'blocked') return null;
  return <Modal titleId="leave-report-title" title="Leave this report?" onClose={() => blocker.reset()}>
    <p className="text-sm leading-6">{busy ? 'An action is still running. Keep this page open until it finishes.' : 'Your last saved draft is safe. Unsaved changes will be lost if you leave.'}</p>
    <div className="mt-4 flex flex-wrap gap-3"><button className="min-h-11 rounded-lg border border-silver-300 px-4" onClick={() => blocker.reset()}>Keep editing</button>{!busy && <button className="min-h-11 rounded-lg bg-navy-950 px-4 text-white" onClick={() => blocker.proceed()}>Leave without saving</button>}</div>
  </Modal>;
}
