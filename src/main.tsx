import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { createBrowserAppRuntime } from './runtime/browser-runtime';

const runtime = createBrowserAppRuntime();

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App runtime={runtime} />
    </React.StrictMode>,
  );
}
