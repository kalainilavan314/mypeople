// Vercel serverless entry point for the whole API.
//
// One function, reached through a rewrite of /api/* in vercel.json, rather than
// a [...path] catch-all file. The catch-all only ever matched a single segment
// on this project: /api/health reached it while /api/auth/login and
// /api/donations/mine returned NOT_FOUND, which is most of the API. A rewrite to
// a plain filename routes every depth and is what Vercel's own Express example
// uses. Rewrites preserve the original request URL, which is what Express needs
// in order to dispatch.
//
// An Express app is itself a (req, res) handler, so the whole API re-exports as
// one function. server/src/index.js skips app.listen() when process.env.VERCEL
// is set, so that same module still runs as an ordinary long-lived server
// locally and on any host with a real process.
//
// The app is imported LAZILY, inside the handler. A static import that throws
// while the module initialises kills the invocation before any of our code
// runs, and the platform reports only FUNCTION_INVOCATION_FAILED with no cause.
// Importing here turns such a failure into a readable JSON response.

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
        at: String(err?.stack ?? '').split('\n').slice(1, 4).map((l) => l.trim()),
      }),
    );
  }

  // Every route in the app is mounted under /api. A rewrite normally hands the
  // original path through untouched, but if the platform ever delivers the
  // rewritten target instead, put the prefix back rather than 404 everything.
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + (req.url === '/' ? '' : req.url);
  }
  return app(req, res);
}
