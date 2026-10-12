import type { ApiClient } from '@/core/api/api';
import { httpContent } from '@/core/api/httpContent';
import { mockClient } from '@/core/api/prototype/client';

export const api: ApiClient = { ...mockClient, ...httpContent };

export type { ApiClient };
