import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms — Neon Fare",
  description: "The terms for playing Neon Fare.",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <p className="legal-back"><Link href="/">← BACK TO NEON FARE</Link></p>
      <h1>TERMS</h1>
      <p className="legal-lead">
        Neon Fare is a free browser game offered as-is. Playing it means accepting the terms below.
      </p>

      <h2>Using the game</h2>
      <ul>
        <li>The game is free for personal play. There is nothing to buy and no account is required.</li>
        <li>
          Signing in with Google is optional and only syncs your own career to your own Google Drive.
          See the <Link href="/privacy">privacy page</Link> for exactly what that involves.
        </li>
        <li>Please do not attempt to disrupt the game for other people or misuse the Google sign-in.</li>
      </ul>

      <h2>Your save data</h2>
      <p>
        Saves are kept in your browser and, if you sign in, in your own Google Drive. No backup is held
        anywhere else, so clearing your browser data or withdrawing Google access removes that save
        permanently. Please treat your progress as yours to look after.
      </p>

      <h2>No warranty</h2>
      <p>
        The game is provided without warranty of any kind. It may contain defects, may be changed or
        withdrawn at any time, and may lose saved progress. To the extent the law allows, the developer
        is not liable for any loss arising from using it.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may change as the game does. Continuing to play after a change means accepting the
        updated terms.
      </p>

      <p className="legal-updated">Last updated 17 September 2026.</p>
    </main>
  );
}
