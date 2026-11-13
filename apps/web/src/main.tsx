import '@fontsource/fira-sans/400.css';
import '@fontsource/fira-sans/500.css';
import '@fontsource/fira-sans/600.css';
import '@fontsource/fira-code/500.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import '../app/globals.css';

const root = document.getElementById('root');

if (!root) throw new Error('LedgerFlow root element is missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
