import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <h1>Terms of Service</h1>
      <p>Last updated: 12 April 2026</p>

      <h2>Informational product only</h2>
      <p>
        BetMate provides sports statistics, tracking, and recommendations. BetMate does not accept wagers, hold funds, place bets, route users to place bets, or provide betting services.
      </p>

      <h2>No guaranteed outcomes</h2>
      <p>
        Recommendations are generated from available data and model outputs. They are not guarantees, financial advice, or instructions to wager.
      </p>

      <h2>Age requirement</h2>
      <p>
        You must be 18 years or older to use BetMate. If you do not meet this requirement, do not create an account or use the app.
      </p>

      <h2>Paper tracking</h2>
      <p>
        Stakes, bankrolls, and paper bets inside BetMate are simulated tracking records only. They do not represent deposits, withdrawals, or real-money transactions with BetMate.
      </p>

      <h2>Responsible use</h2>
      <p>
        If sports betting causes stress or harm, contact <a href="https://www.gamblinghelponline.org.au/">Gambling Help Online</a>.
      </p>

      <Link className="btn btn-secondary" href="/login">Back</Link>
    </main>
  );
}
