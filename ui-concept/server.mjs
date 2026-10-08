import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const host = '127.0.0.1';
const port = Number(process.env.PORT ?? 3100);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535.');
  process.exit(1);
}

const routes = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/history.js', ['history.js', 'text/javascript; charset=utf-8']],
  ['/history.css', ['history.css', 'text/css; charset=utf-8']],
  ['/composer.js', ['composer.js', 'text/javascript; charset=utf-8']],
  ['/composer.css', ['composer.css', 'text/css; charset=utf-8']],
  ['/scroll.js', ['scroll.js', 'text/javascript; charset=utf-8']],
]);

const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  const reply = (status, message) => {
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : message);
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    reply(405, 'Method not allowed.');
    return;
  }

  let pathname;
  try {
    pathname = new URL(request.url, `http://${host}:${port}`).pathname;
  } catch {
    reply(400, 'Invalid request URL.');
    return;
  }

  const route = routes.get(pathname);
  if (!route) {
    reply(404, 'Not found.');
    return;
  }

  try {
    const [filename, contentType] = route;
    const content = await readFile(new URL(filename, import.meta.url));
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    reply(500, 'The preview asset could not be loaded.');
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Choose another PORT or close the existing preview.`);
  } else {
    console.error(`Unable to start the preview: ${error.message}`);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`UI concept: http://${host}:${port}`);
  console.log('Standalone preview with sample data. Press Ctrl+C to stop.');
});
