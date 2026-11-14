import type { Page } from './pages';

/**
 * The "lab" page: every kind of hard-to-capture content from master prompt
 * section 9, used by the e2e suite. Cross-origin content comes from
 * 127.0.0.1 while the app runs on localhost (a different origin).
 */
const CROSS_ORIGIN = `http://127.0.0.1:${location.port || '80'}`;

/** A 2x1 SVG poster, red then blue, as a data URL. */
const POSTER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="160" height="180" fill="#ff0000"/><rect x="160" width="160" height="180" fill="#0000ff"/></svg>',
)}`;

export const lab: Page = {
  title: 'Lab',
  render: () => `
    <section class="hero compact">
      <p class="eyebrow">Lab</p>
      <h1>Hard to capture.</h1>
    </section>
    <section class="lab" aria-label="Capture cases">
      <figure>
        <iframe id="lab-iframe" title="Cross-origin frame" src="${CROSS_ORIGIN}/frame.html"
          style="background:#2b6cb0"></iframe>
        <figcaption>Cross-origin iframe</figcaption>
      </figure>
      <figure>
        <video id="lab-video" muted playsinline></video>
        <figcaption>Video (canvas stream)</figcaption>
      </figure>
      <figure>
        <video id="lab-poster" poster="${POSTER}" muted></video>
        <figcaption>Video, poster only</figcaption>
      </figure>
      <figure>
        <canvas id="lab-canvas" width="320" height="180"></canvas>
        <figcaption>2D canvas</figcaption>
      </figure>
      <figure class="lab-cors">
        <img id="lab-cors" src="${CROSS_ORIGIN}/pattern.svg" alt="Cross-origin image" width="320" height="180" />
        <figcaption>Cross-origin image, no CORS</figcaption>
      </figure>
      <figure>
        <div id="lab-ignore" data-shatter-ignore class="lab-ignore">Secret: not captured</div>
        <figcaption>data-shatter-ignore</figcaption>
      </figure>
    </section>
    <p class="footnote"><a href="/">Back home</a></p>`,
  mount: (root) => {
    const canvas = root.querySelector<HTMLCanvasElement>('#lab-canvas');
    const context = canvas?.getContext('2d');
    if (canvas && context) {
      context.fillStyle = '#1fb6a6';
      context.fillRect(0, 0, 320, 180);
      context.fillStyle = '#ffffff';
      context.fillRect(100, 50, 120, 80);
    }
    // A video fed by a canvas stream: readable frames without any media file.
    const video = root.querySelector<HTMLVideoElement>('#lab-video');
    const source = document.createElement('canvas');
    source.width = 320;
    source.height = 180;
    const sourceContext = source.getContext('2d');
    if (video && sourceContext && typeof source.captureStream === 'function') {
      sourceContext.fillStyle = '#ff8800';
      sourceContext.fillRect(0, 0, 320, 180);
      const stream = source.captureStream(10);
      video.srcObject = stream;
      void video.play().catch(() => undefined);
      // Keep producing frames so the stream stays live.
      const timer = window.setInterval(() => {
        if (!video.isConnected) {
          window.clearInterval(timer);
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        sourceContext.fillRect(0, 0, 320, 180);
      }, 100);
    }
  },
};
