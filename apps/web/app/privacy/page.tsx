import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <h1>Privacy Policy</h1>
      <p>Last updated: 12 April 2026</p>

      <h2>Data collected</h2>
      <p>
        BetMate stores account details such as email address, display name, account creation date, age confirmation timestamp, Terms acceptance timestamp, plan tier, strategy preferences, and app usage records such as paper tracking entries.
      </p>

      <h2>Third-party services</h2>
      <p>
        BetMate uses Supabase for authentication and account data. Stripe may be used for subscriptions in a future release. Analytics may be added only where it can be kept separate from sensitive account data.
      </p>

      <h2>How data is used</h2>
      <p>
        Account data is used to authenticate users, protect authenticated pages, store preferences, and operate the recommendation and tracking experience.
      </p>

      <h2>Your rights</h2>
      <p>
        You can request access, correction, or deletion of your account data. Deletion requests may retain limited records where required for security, compliance, or abuse prevention.
      </p>

      <Link className="btn btn-secondary" href="/login">Back</Link>
    </main>
  );
}
