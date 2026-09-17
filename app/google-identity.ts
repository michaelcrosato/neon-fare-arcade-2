"use client";

/**
 * Google Identity Services lifecycle. The client ID is public by design for the
 * browser token flow -- there is no client secret anywhere in this project, so
 * there is nothing here that could leak. When the ID is absent the whole
 * feature stays dark and the game runs exactly as it did before.
 */

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/**
 * All three scopes are non-sensitive, which is what lets this app publish
 * without Google verification. `drive.appdata` reaches only the hidden folder
 * Drive creates for this app; it cannot see any file the player owns.
 */
export const DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

export const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.profile",
  DRIVE_APPDATA_SCOPE,
].join(" ");

export const googleSignInConfigured = () => GOOGLE_CLIENT_ID.length > 0;

export type GoogleToken = { accessToken: string; expiresAt: number };
export type GoogleProfile = { id: string; name: string; picture: string };

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type TokenClient = { requestAccessToken: (overrides?: { prompt?: string }) => void };

type GoogleIdentityApi = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type?: string; message?: string }) => void;
      }) => TokenClient;
      revoke: (token: string, done?: () => void) => void;
    };
  };
};

declare global {
  interface Window { google?: GoogleIdentityApi }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const SILENT_TIMEOUT_MS = 12_000;

let scriptLoad: Promise<GoogleIdentityApi> | null = null;

function loadIdentityScript(): Promise<GoogleIdentityApi> {
  if (scriptLoad) return scriptLoad;
  scriptLoad = new Promise<GoogleIdentityApi>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(window.google); return; }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => {
      if (window.google?.accounts?.oauth2) resolve(window.google);
      else reject(new Error("Google sign-in loaded without an OAuth client."));
    });
    script.addEventListener("error", () => reject(new Error("Google sign-in could not be reached.")));
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
  // A failed load must not poison later attempts; the player may just be offline.
  scriptLoad.catch(() => { scriptLoad = null; });
  return scriptLoad;
}

let tokenClient: TokenClient | null = null;
let pending: { resolve: (token: GoogleToken) => void; reject: (error: Error) => void } | null = null;

function settle(outcome: (waiting: NonNullable<typeof pending>) => void) {
  const waiting = pending;
  pending = null;
  if (waiting) outcome(waiting);
}

async function ensureTokenClient(): Promise<TokenClient> {
  if (tokenClient) return tokenClient;
  const api = await loadIdentityScript();
  tokenClient = api.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    callback: (response) => settle((waiting) => {
      if (!response.access_token) {
        waiting.reject(new Error(response.error_description ?? response.error ?? "Google sign-in was cancelled."));
        return;
      }
      // Google shows Drive access as a tick box that can be left unticked. The
      // token still arrives, and Drive then answers 403, which would otherwise
      // surface as an expired session instead of the permission it really is.
      if (!(response.scope ?? "").split(" ").includes(DRIVE_APPDATA_SCOPE)) {
        waiting.reject(new Error("Neon Fare needs the Google Drive box ticked to sync your career."));
        return;
      }
      waiting.resolve({
        accessToken: response.access_token,
        expiresAt: Date.now() + (response.expires_in ?? 3_600) * 1_000,
      });
    }),
    error_callback: (error) => settle((waiting) => {
      waiting.reject(new Error(error.message ?? "Google sign-in was cancelled."));
    }),
  });
  return tokenClient;
}

/**
 * `prompt: ""` renews without interrupting the player when consent is already
 * granted and the Google session is live. It cannot be relied on: browsers
 * block the fallback popup outside a click, so a rejection here means
 * "ask the player to sign in again", not "something broke".
 */
export async function requestGoogleToken(prompt: "" | "consent"): Promise<GoogleToken> {
  if (!googleSignInConfigured()) throw new Error("Google sign-in is not configured.");
  const client = await ensureTokenClient();
  if (pending) throw new Error("A Google sign-in is already in progress.");
  return new Promise<GoogleToken>((resolve, reject) => {
    // A silent renewal can fall back to a popup the browser then blocks, and
    // some browsers never report that, so the promise needs its own deadline.
    const timer = prompt === ""
      ? window.setTimeout(() => settle((waiting) => waiting.reject(new Error("Google sign-in timed out."))), SILENT_TIMEOUT_MS)
      : 0;
    const stopTimer = () => { if (timer) window.clearTimeout(timer); };
    pending = {
      resolve: (token) => { stopTimer(); resolve(token); },
      reject: (error) => { stopTimer(); reject(error); },
    };
    client.requestAccessToken({ prompt });
  });
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Google profile request failed: ${response.status}`);
  const data = await response.json() as { sub?: string; name?: string; given_name?: string; picture?: string };
  return {
    id: data.sub ?? "",
    name: data.given_name ?? data.name ?? "Driver",
    picture: data.picture ?? "",
  };
}

/** Hands the grant back to the player. Signing in again re-asks for consent. */
export function revokeGoogleToken(accessToken: string) {
  return new Promise<void>((resolve) => {
    if (!window.google?.accounts?.oauth2) { resolve(); return; }
    window.google.accounts.oauth2.revoke(accessToken, () => resolve());
  });
}
