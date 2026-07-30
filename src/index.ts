import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENDPOINT = '/__console-panel.js';
const SCRIPT_TAG = `<script src="${ENDPOINT}"></script>`;

export default function consolePanel(): Plugin {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const scriptPath = path.join(currentDir, '..', 'src', 'panel-script.js');

  return {
    name: 'vite-plugin-console-panel',
    apply: 'serve',

    configureServer(server) {
      // Serve the panel script itself
      server.middlewares.use(ENDPOINT, (req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.end(fs.readFileSync(scriptPath, 'utf-8'));
      });

      // Inject the script tag into every HTML response, including
      // server-rendered (SSR) pages where transformIndexHtml never fires.
      server.middlewares.use((req, res, next) => {
        const originalWrite = res.write.bind(res);
        const originalEnd = res.end.bind(res);
        const chunks: Buffer[] = [];
        let intercepting = true;

        res.write = ((chunk: any, ...args: any[]) => {
          const contentType = res.getHeader('content-type');
          if (intercepting && typeof contentType === 'string' && contentType.includes('text/html')) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            return true;
          }
          intercepting = false;
          return originalWrite(chunk, ...args);
        }) as typeof res.write;

        res.end = ((chunk?: any, ...args: any[]) => {
          const contentType = res.getHeader('content-type');
          if (intercepting && typeof contentType === 'string' && contentType.includes('text/html')) {
            if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            let html = Buffer.concat(chunks).toString('utf-8');
            if (!html.includes(ENDPOINT) && html.includes('</body>')) {
              html = html.replace('</body>', `  ${SCRIPT_TAG}\n</body>`);
            }
            return originalEnd(html, ...args);
          }
          return originalEnd(chunk, ...args);
        }) as typeof res.end;

        next();
      });
    },

    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { src: ENDPOINT },
          injectTo: 'body',
        },
      ];
    },
  };
}
