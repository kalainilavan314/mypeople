import type { OfficialSigningStatus } from '@my-people/api-client';

/**
 * Whether signing can happen at all (a key is configured, INT-24) and whether the viewer is a
 * registered publisher (FR-AUT-001). Either missing means "Sign and publish" is refused, so the page
 * says why before anyone tries.
 */
export function SigningStatus({ status, canSign }: { status: OfficialSigningStatus; canSign: boolean }) {
  return (
    <section aria-labelledby="signing-status-heading" className="flex flex-col gap-2 rounded-2xl border border-line bg-card shadow-card p-4 text-sm">
      <h2 id="signing-status-heading" className="flex flex-col font-bold text-text">
        <span lang="ta">கையொப்ப நிலை</span>
        <span lang="en" className="text-xs font-semibold text-muted">
          Signing status
        </span>
      </h2>
      {status.available ? (
        <p className="text-text">
          Signing is available with key <span className="font-mono">{status.keyId}</span> (Ed25519). Its public key is published with every
          check, so anyone can verify a signature.
        </p>
      ) : (
        <p role="alert" className="rounded-lg bg-error-bg p-3 text-error">
          Signing is unavailable: no signing key is configured on the server (CONTENT_SIGNING_KEY, INT-24). Drafts can be written, but
          nothing can be published as official until a key is set.
        </p>
      )}
      {canSign ? (
        status.myPublisher ? (
          <p className="text-text">
            You are registered to sign as{' '}
            <span lang="ta" className="font-semibold">
              {status.myPublisher.nameTa}
            </span>{' '}
            / <span className="font-semibold">{status.myPublisher.nameEn}</span>.
          </p>
        ) : (
          <p className="rounded-lg bg-warning-bg p-3 text-warning">
            You hold content signing but are not a registered publisher, so you cannot sign. A Tier 5 administrator registers publishers
            under Publishers.
          </p>
        )
      ) : (
        <p className="text-muted">You can read statements and withdraw one with a reason; signing needs content.sign_publish and a registration.</p>
      )}
    </section>
  );
}
