import type { ApiClient } from './api';
import { mockClient } from './mock/client';
import { httpContent } from './httpContent';

// Composite client: backend-backed methods (httpContent) override the mock ones,
// so events come from Postgres while the rest stays mock until wired.
export const api: ApiClient = { ...mockClient, ...httpContent };

export type { ApiClient };
