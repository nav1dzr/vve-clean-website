import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import MediaManagerPage from '../../src/pages/MediaManagerPage';
import '../../src/index.css';

const router = createBrowserRouter([{ path: '*', element: <>
  <aside role="note" className="border-b border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950">
    <strong>Local review · sample data only.</strong> Changes here affect only this browser’s sample library.
    No live records, uploads or website publishing. Built-in website photographs are shown for positioning.
  </aside>
  <MediaManagerPage />
</> }]);
createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
