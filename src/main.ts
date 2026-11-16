import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app element.');

const app = mount(App, { target });

// Registered by hand so the production CSP needs no inline script and the
// registration follows the deployment base (root or /<repo>/ on Pages).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((error) => {
      console.error('Service worker registration failed', error);
    });
  });
}

export default app;
