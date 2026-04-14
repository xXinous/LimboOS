import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (
  contextId: string,
  options?: any
) {
  if (contextId === '2d') {
    return originalGetContext.call(this, '2d', {
      ...options,
      willReadFrequently: true,
    }) as any;
  }
  return originalGetContext.call(this, contextId, options) as any;
} as typeof HTMLCanvasElement.prototype.getContext;
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
