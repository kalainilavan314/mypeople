import 'server-only';

import { createApiClient } from '@my-people/api-client';

// Read on the server only: the API address is not sent to the browser, and the
// dashboard calls the API from its own server.
const API_URL = process.env.API_URL;

/** Null when API_URL is not set, so pages can say so instead of failing. */
export const api = API_URL ? createApiClient({ baseUrl: API_URL }) : null;
