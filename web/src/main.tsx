import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { EventDetailPage } from './pages/EventDetailPage';
import { CreateEventPage, EditEventPage } from './pages/EventFormPage';
import { EventsPage } from './pages/EventsPage';
import { NotFoundPage, RouteErrorPage } from './pages/NotFound';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true },
  },
});

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <EventsPage /> },
      { path: 'events/new', element: <CreateEventPage /> },
      { path: 'events/:id', element: <EventDetailPage /> },
      { path: 'events/:id/edit', element: <EditEventPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
