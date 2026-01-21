import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/index.css'
import App from './ui/App.tsx'
import { ErrorBoundary } from './ErrorBoundary'

console.log('Starting application...');

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element not found');

  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
} catch (e) {
  console.error('Fatal initialization error:', e);
}
