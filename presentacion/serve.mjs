// Servidor estático mínimo para previsualizar la presentación reveal.js.
// Uso: node presentacion/serve.mjs [puerto]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.argv[2] || 4173);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = normalize(url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
  // Evita path traversal fuera de presentacion/
  if (rel.startsWith('..')) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const buf = await readFile(join(root, rel));
    res.writeHead(200, { 'Content-Type': types[extname(rel)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404');
  }
}).listen(port, () => {
  console.log(`reveal.js en http://localhost:${port}`);
});
