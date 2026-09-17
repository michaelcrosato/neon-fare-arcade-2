import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — Neon Fare",
  description: "What Neon Fare stores, where it is stored, and how to remove it.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <p className="legal-back"><Link href="/">← BACK TO NEON FARE</Link></p>
      <h1>PRIVACY</h1>
      <p className="legal-lead">
        Neon Fare is a browser game with no server of its own. It collects nothing, stores nothing
        about you on our side, and there is no analytics, advertising or tracking anywhere in it.
      </p>

      <h2>If you never sign in</h2>
      <p>
        Everything stays on your device. Your career, settings and preferences are written to your
        browser&rsquo;s local storage and never leave it. Clearing site data for this site erases all of it.
      </p>

      <h2>If you sign in with Google</h2>
      <p>Signing in is optional and exists for one reason: to carry your career between your own devices.</p>
      <ul>
        <li>
          <b>Your save is written to your own Google Drive</b>, into the hidden per-app folder Drive
          provides (<code>appDataFolder</code>). It is your file, in your account, counting against your
          storage. We never receive a copy.
        </li>
        <li>
          <b>Neon Fare cannot see the rest of your Drive.</b> The permission it requests
          (<code>drive.appdata</code>) reaches only the folder Drive created for this game. Your documents,
          photos and other files are not visible to it, and it cannot ask for them later without a new
          consent screen.
        </li>
        <li>
          <b>Your name is used only to show who is signed in.</b> It is held in the browser tab while you
          play and is discarded when you close it. Neon Fare does not request your email address.
        </li>
        <li><b>Nothing is shared with anyone.</b> There is no third party in this path other than Google.</li>
      </ul>

      <h2>Removing your data</h2>
      <ul>
        <li>
          Withdraw access at{" "}
          <a href="https://myaccount.google.com/permissions" rel="noreferrer noopener" target="_blank">
            myaccount.google.com/permissions
          </a>. This also deletes the hidden app folder and the save inside it.
        </li>
        <li>Clear site data in your browser to remove the copy held on the device.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions about this policy can go to the developer contact listed on the Google consent screen
        shown when you sign in.
      </p>

      <p className="legal-updated">Last updated 17 September 2026.</p>
    </main>
  );
}
