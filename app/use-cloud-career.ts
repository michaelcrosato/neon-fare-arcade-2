"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { CareerState } from "@/game/career";
import {
  careerFingerprint,
  makeCloudSave,
  planCareerSync,
  type CareerSummary,
  type CloudSave,
} from "@/game/career-sync";
import {
  fetchGoogleProfile,
  googleSignInConfigured,
  requestGoogleToken,
  type GoogleProfile,
  type GoogleToken,
} from "./google-identity";
import { findCloudSaveFile, readCloudSaveFile, writeCloudSaveFile } from "./cloud-save";

/**
 * Optional account sync for the career. The device save stays authoritative
 * during play -- nothing here ever sits between a run and localStorage -- and
 * the account copy is a mirror, pulled on sign-in and pushed once progress
 * settles. Signed out, offline, or unconfigured, the game is unaffected.
 *
 * Every Google request starts from a click. The GIS token flow opens a popup
 * even when it has nothing to ask, so a browser blocks it outside a user
 * gesture; anything that reconnects on a timer fails with a blocked popup.
 * That is why a lapsed token pauses syncing and waits rather than retrying.
 */

const SESSION_KEY = "neon-fare-google-session-v1";
const PUSH_DELAY_MS = 1_500;
const TOKEN_LEEWAY_MS = 60_000;

export type CloudSaveStatus =
  | { kind: "unavailable" }
  | { kind: "signed-out" }
  | { kind: "connecting" }
  | { kind: "syncing"; profile: GoogleProfile }
  | { kind: "synced"; profile: GoogleProfile; savedAt: number }
  | { kind: "paused"; profile: GoogleProfile }
  | { kind: "conflict"; profile: GoogleProfile; local: CareerSummary; remote: CareerSummary }
  | { kind: "error"; message: string };

export type CloudCareerApi = {
  status: CloudSaveStatus;
  /** False until the device career has loaded; connecting before then is unsafe. */
  ready: boolean;
  /** True once this device has connected before, so the prompt can be softer. */
  returning: boolean;
  signIn: () => void;
  signOut: () => void;
  keepLocalCareer: () => void;
  keepCloudCareer: () => void;
  dismissError: () => void;
};

function describe(error: unknown) {
  const message = error instanceof Error ? error.message : "Google sync failed.";
  return /popup|cancel/i.test(message) ? "Google sign-in was closed or blocked." : message;
}

function readSessionFlag() {
  try { return window.localStorage.getItem(SESSION_KEY) === "1"; } catch { return false; }
}

export function useCloudCareer(options: {
  careerRef: RefObject<CareerState>;
  career: CareerState;
  ready: boolean;
  replaceCareer: (next: CareerState) => CareerState;
}): CloudCareerApi {
  const { career, careerRef, ready, replaceCareer } = options;
  const [status, setStatus] = useState<CloudSaveStatus>(
    () => (googleSignInConfigured() ? { kind: "signed-out" } : { kind: "unavailable" }),
  );
  const [returning, setReturning] = useState(false);

  const tokenRef = useRef<GoogleToken | null>(null);
  const fileIdRef = useRef<string | null>(null);
  const remoteRef = useRef<CloudSave | null>(null);
  const syncedRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  const ensureToken = useCallback(async (prompt: "" | "consent") => {
    const current = tokenRef.current;
    if (current && current.expiresAt - TOKEN_LEEWAY_MS > Date.now()) return current.accessToken;
    const token = await requestGoogleToken(prompt);
    tokenRef.current = token;
    return token.accessToken;
  }, []);

  const markSynced = useCallback((profile: GoogleProfile, fingerprint: string) => {
    syncedRef.current = fingerprint;
    setStatus({ kind: "synced", profile, savedAt: Date.now() });
  }, []);

  const connect = useCallback(async (prompt: "" | "consent") => {
    // Connecting before the device career has loaded would compare the account
    // against an empty career, and adopt the account save over real progress.
    if (busyRef.current || !ready) return;
    busyRef.current = true;
    setStatus({ kind: "connecting" });
    try {
      const accessToken = await ensureToken(prompt);
      const profile = await fetchGoogleProfile(accessToken);
      setStatus({ kind: "syncing", profile });
      // Recorded here rather than after a successful sync, because adopting a
      // career and resolving a conflict both leave before that point, and a
      // device that forgets it has connected re-asks for consent every time.
      try { window.localStorage.setItem(SESSION_KEY, "1"); } catch { /* This visit still syncs. */ }
      setReturning(true);

      const fileId = await findCloudSaveFile(accessToken);
      fileIdRef.current = fileId;
      const remote = fileId ? await readCloudSaveFile(accessToken, fileId) : null;
      remoteRef.current = remote;

      const local = makeCloudSave(careerRef.current, Date.now());
      const plan = planCareerSync(local, remote);

      if (plan.kind === "choose") {
        setStatus({ kind: "conflict", profile, local: plan.local, remote: plan.remote });
        return;
      }
      if (plan.kind === "adopt" && remote) {
        replaceCareer(remote.career);
        markSynced(profile, careerFingerprint(remote.career));
        return;
      }
      if (plan.kind === "upload") {
        fileIdRef.current = await writeCloudSaveFile(accessToken, fileId, local);
      }
      markSynced(profile, careerFingerprint(local.career));
    } catch (error) {
      tokenRef.current = null;
      setStatus({ kind: "error", message: describe(error) });
    } finally {
      busyRef.current = false;
    }
  }, [careerRef, ensureToken, markSynced, ready, replaceCareer]);

  /**
   * Pushes progress that is already safe on the device. An hour-old token
   * cannot be renewed without a click, so that case pauses syncing and keeps
   * the career untouched instead of surfacing a failure the player cannot fix.
   */
  const push = useCallback(async (next: CareerState, profile: GoogleProfile) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const accessToken = await ensureToken("");
      fileIdRef.current = await writeCloudSaveFile(accessToken, fileIdRef.current, makeCloudSave(next, Date.now()));
      markSynced(profile, careerFingerprint(next));
    } catch {
      tokenRef.current = null;
      setStatus({ kind: "paused", profile });
    } finally {
      busyRef.current = false;
    }
  }, [ensureToken, markSynced]);

  // Only the label depends on this, and it is deferred so the effect body never
  // sets state synchronously and the first paint matches the server markup.
  useEffect(() => {
    if (!googleSignInConfigured()) return;
    const timer = window.setTimeout(() => setReturning(readSessionFlag()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Progress reaches the account only after it is already safe on the device,
  // and only once it settles, so banking a run never waits on the network.
  useEffect(() => {
    if (status.kind !== "synced" || !ready) return;
    if (careerFingerprint(career) === syncedRef.current) return;
    const profile = status.profile;
    const timer = window.setTimeout(() => { void push(career, profile); }, PUSH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [career, push, ready, status]);

  // A returning device skips the consent screen; a new one has to see it.
  const signIn = useCallback(() => { void connect(readSessionFlag() ? "" : "consent"); }, [connect]);

  const signOut = useCallback(() => {
    // The Google grant is left in place so signing back in is a single click.
    // Players remove it for good from their Google account permissions page.
    try { window.localStorage.removeItem(SESSION_KEY); } catch { /* Nothing to forget. */ }
    tokenRef.current = null;
    fileIdRef.current = null;
    remoteRef.current = null;
    syncedRef.current = null;
    setReturning(false);
    setStatus({ kind: "signed-out" });
  }, []);

  const keepLocalCareer = useCallback(() => {
    if (status.kind !== "conflict") return;
    syncedRef.current = null;
    void push(careerRef.current, status.profile);
  }, [careerRef, push, status]);

  const keepCloudCareer = useCallback(() => {
    const remote = remoteRef.current;
    if (status.kind !== "conflict" || !remote) return;
    replaceCareer(remote.career);
    markSynced(status.profile, careerFingerprint(remote.career));
  }, [markSynced, replaceCareer, status]);

  const dismissError = useCallback(() => {
    setStatus(googleSignInConfigured() ? { kind: "signed-out" } : { kind: "unavailable" });
  }, []);

  return { status, ready, returning, signIn, signOut, keepLocalCareer, keepCloudCareer, dismissError };
}
