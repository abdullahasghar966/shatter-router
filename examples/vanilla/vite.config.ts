import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  // host: true listens on every interface, so the e2e suite can reach the same
  // server as a second origin (127.0.0.1 vs localhost) for cross-origin content.
  server: { port: 5173, strictPort: true, host: true },
  // cors: false so the cross-origin image in the lab page really has no CORS headers.
  preview: { port: 4173, strictPort: true, host: true, cors: false },
  build: {
    target: 'es2022',
    // Rapier (?physics=rapier) is one 4.3 MB lazy chunk: WebAssembly inlined as base64.
    chunkSizeWarningLimit: 5000,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        // The same app under a strict Content-Security-Policy (e2e fallback test).
        csp: fileURLToPath(new URL('./csp.html', import.meta.url)),
        // Images allowed, WebAssembly blocked: Rapier cannot start (e2e).
        'csp-wasm': fileURLToPath(new URL('./csp-wasm.html', import.meta.url)),
      },
    },
  },
});
