import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * An invitation link (https://app.tmk.lk/join/INV-…, FR-REF-004) opens registration with its
 * token in the referral field. The token is opaque: it names no one. A signed-in member is taken
 * home instead, by the auth group's guard.
 */
export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <Redirect href={{ pathname: '/register', params: { referral: token ?? '' } }} />;
}
