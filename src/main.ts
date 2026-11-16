import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import './app.css';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app element.');

const app = mount(App, { target });

// Registered manually (injectRegister: null) so the production CSP needs no
// inline script. Dev does not register a service worker.
if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

export default app;
