// The public API address, built into the app at build time (see .env.example).
// The client itself is shared with the member app (@my-people/mobile-ui).
export const API_URL = process.env.EXPO_PUBLIC_API_URL;

export { api } from '@my-people/mobile-ui';
