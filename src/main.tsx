import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RELEASE_ID } from './delivery/release-identity.ts';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing #root element');
}
root.dataset.release = RELEASE_ID;

createRoot(root).render(
  <StrictMode>
    <h1>Trade Journal</h1>
  </StrictMode>,
);
