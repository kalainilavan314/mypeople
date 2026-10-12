import { ServerMember } from '@/core/api/auth/models';
export const TOKEN_KEY = 'npm.token';
export function cachedMember(): ServerMember | null {
  try {
    const v = localStorage.getItem('npm.member');
    return v ? (JSON.parse(v) as ServerMember) : null;
  } catch {
    return null;
  }
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('npm.member');
}
export function getToken(): string | null {
  return null;
}
export function saveMember(member: ServerMember) {
  localStorage.setItem('npm.name', member.fullName);
  localStorage.setItem('npm.member', JSON.stringify(member));
}
export function saveSession(_token: string, member: ServerMember) {
  saveMember(member);
}
