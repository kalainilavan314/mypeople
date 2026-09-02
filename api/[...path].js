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
//
// The app is imported LAZILY, inside the handler. A static import that throws
// while the module initialises — a missing dependency, a read-only filesystem,
// a bad connection string — kills the invocation before any of our code runs,
// and the platform reports only FUNCTION_INVOCATION_FAILED with no cause. Doing
// the import here means such a failure becomes a readable JSON response instead
// of an opaque 500, which is the difference between one debugging round and ten.

let appPromise = null;

export default async function handler(req, res) {
  let app;
  try {
    // Cached across invocations on a warm instance: imported once, reused after.
    if (!appPromise) appPromise = import('../server/src/index.js');
    app = (await appPromise).default;
  } catch (err) {
    // Let the next invocation retry rather than caching a transient failure.
    appPromise = null;
    console.error('API failed to initialise:', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    return res.end(
      JSON.stringify({
        error: 'api_init_failed',
        message: err?.message ?? String(err),
        code: err?.code,
        // Enough frames to identify the module at fault, not the whole trace.
        at: String(err?.stack ?? '').split('\n').slice(1, 4).map((l) => l.trim()),
      }),
    );
  }

  // Defensive: every route in the app is mounted under /api, so if the platform
  // ever strips that prefix before invoking us, put it back rather than 404.
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + (req.url === '/' ? '' : req.url);
  }
  return app(req, res);
}
