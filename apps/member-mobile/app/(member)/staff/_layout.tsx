import type { Assignment, MfaStatus } from '@my-people/api-client';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { headerOptions, useApiQuery, useLanguage } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { MfaGate } from '@/features/staff/auth/MfaGate';
import { NoRole } from '@/features/staff/auth/NoRole';
import { api } from '@/lib/api';
import { StaffProvider } from '@/providers/StaffProvider';

type Gate = { mfa: MfaStatus; assignments: Assignment[] };

/**
 * The Staff section of the app. Every staff screen sits behind this gate: the
 * authenticator code in this session (NFR-SEC-04), then at least one staff role
 * that counts now (an overdue yearly review or a membership that is not Active
 * ends it, BR-097). The API checks both again on every request.
 */
export default function StaffLayout() {
  const gate = useApiQuery<Gate>(async () => {
    const mfa = await api().getMfaStatus();
    // Roles are read only once the second factor is given; before that the API refuses staff calls.
    return { mfa, assignments: mfa.sessionVerified ? await api().getMyAccess() : [] };
  });

  return (
    <QueryView query={gate}>
      {(data) => {
        if (!data.mfa.sessionVerified) return <MfaGate status={data.mfa} onVerified={gate.reload} />;
        if (data.assignments.length === 0) return <NoRole />;
        return (
          <StaffProvider assignments={data.assignments} mfa={data.mfa} reload={gate.reload}>
            <StaffStack />
          </StaffProvider>
        );
      }}
    </QueryView>
  );
}

function StaffStack() {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <Stack screenOptions={headerOptions(language)}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="checkin/[id]" options={{ title: t('s.checkIn.scanPass') }} />
      <Stack.Screen name="roster/[id]" options={{ title: t('s.checkIn.roster') }} />
      <Stack.Screen name="card-check" options={{ title: t('s.checkIn.cardCheck') }} />
      <Stack.Screen name="lookup" options={{ title: t('s.lookup.title') }} />
      <Stack.Screen name="sessions" options={{ title: t('s.sessions.title') }} />
      <Stack.Screen name="assignments" options={{ title: t('s.assignments.title') }} />
    </Stack>
  );
}
