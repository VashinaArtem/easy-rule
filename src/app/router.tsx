import { createBrowserRouter, Outlet, ScrollRestoration } from 'react-router';
import { Lobby } from './Lobby';
import { HallPage } from './HallPage';
import { ExhibitPage } from './ExhibitPage';
import { NotFound } from './NotFound';

function Root() {
  return (
    <>
      <a className="skip-link" href="#content">
        Перейти к содержанию
      </a>
      <Outlet />
      <ScrollRestoration />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <Lobby /> },
      { path: '/hall/:hallId', element: <HallPage /> },
      { path: '/work/:workId', element: <ExhibitPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
