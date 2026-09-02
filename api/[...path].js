// Vercel serverless entry point for the whole API.
//
// A catch-all dynamic route ("[...path]") rather than api/index.js plus a
// rewrite: Vercel hands a dynamic route the ORIGINAL request path, which is
// exactly what Express needs to dispatch. Routing /api/health through a rewrite
// to /api can instead deliver the rewritten path, and every route 404s.
//
// An Express app is itself a (req, res) handler, so the whole API re-exports as
// one function. server/src/index.js skips app.listen() when process.env.VERCEL
// is set, so that same module still runs as an ordinary long-lived server
// locally and on any host with a real process.
import app from '../server/src/index.js';

export default function handler(req, res) {
  // Defensive: every route in the app is mounted under /api, so if the platform
  // ever strips that prefix before invoking us, put it back rather than 404.
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + (req.url === '/' ? '' : req.url);
  }
  return app(req, res);
}
