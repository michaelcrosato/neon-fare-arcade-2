"use client";

import type { CareerSummary } from "@/game/career-sync";
import type { CloudCareerApi } from "./use-cloud-career";

/**
 * Presentation for the optional Google account sync. Every rule -- which save
 * wins, when a push happens, what counts as a conflict -- belongs to
 * game/career-sync.ts and use-cloud-career.ts. This file only renders state.
 */

function initials(name: string) {
  const letter = name.trim().charAt(0);
  return letter ? letter.toUpperCase() : "D";
}

function savedWhen(updatedAt: number) {
  if (!updatedAt) return "DATE UNKNOWN";
  return new Date(updatedAt)
    .toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

function CareerChoice({ label, summary, note, onChoose }: Readonly<{
  label: string;
  summary: CareerSummary;
  note: string;
  onChoose: () => void;
}>) {
  return (
    <button
      className="cloud-save-choice"
      onClick={onChoose}
      aria-label={`${label}. ${summary.runsCompleted} runs, bank $${summary.bank}. ${note}`}
    >
      <b>{label}</b>
      <dl>
        <div><dt>RUNS</dt><dd>{summary.runsCompleted}</dd></div>
        <div><dt>BANK</dt><dd>${summary.bank}</dd></div>
        <div><dt>LIFETIME FARE</dt><dd>${summary.lifetimeFare}</dd></div>
        <div><dt>DELIVERIES</dt><dd>{summary.lifetimeDeliveries}</dd></div>
      </dl>
      <em>{savedWhen(summary.updatedAt)}</em>
      <small>{note}</small>
    </button>
  );
}

export function CloudSavePanel({ cloud }: Readonly<{ cloud: CloudCareerApi }>) {
  const { status, ready, returning } = cloud;
  if (status.kind === "unavailable") return null;

  if (status.kind === "conflict") {
    return (
      <div className="cloud-save-conflict" role="dialog" aria-modal="true" aria-labelledby="cloud-save-conflict-title">
        <div>
          <h2 id="cloud-save-conflict-title">TWO CAREERS, ONE ACCOUNT</h2>
          <p>
            This device and your Google account each hold runs the other never saw.
            Pick the one to keep — the other is replaced and cannot be recovered.
          </p>
          <div className="cloud-save-choices">
            <CareerChoice
              label="THIS DEVICE"
              summary={status.local}
              note="Keeps what you played here."
              onChoose={cloud.keepLocalCareer}
            />
            <CareerChoice
              label="GOOGLE ACCOUNT"
              summary={status.remote}
              note="Keeps what you played elsewhere."
              onChoose={cloud.keepCloudCareer}
            />
          </div>
          <button className="cloud-save-cancel" onClick={cloud.signOut}>STAY OFFLINE FOR NOW</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cloud-save" data-state={status.kind}>
      <p className="cloud-save-live" role="status" aria-live="polite">
        {status.kind === "connecting" ? "Connecting to Google." : null}
        {status.kind === "syncing" ? "Syncing your career." : null}
        {status.kind === "synced" ? `Career synced to Google as ${status.profile.name}.` : null}
        {status.kind === "paused" ? "Google sync paused. Your career is still saved on this device." : null}
        {status.kind === "error" ? status.message : null}
      </p>

      {status.kind === "signed-out" ? (
        <button
          className="cloud-save-button"
          disabled={!ready}
          onClick={cloud.signIn}
          aria-label={returning
            ? "Resume Google sync for your career"
            : "Sign in with Google to sync your career across devices"}
        >
          <i aria-hidden="true">G</i>
          <span>
            <b>{returning ? "RESUME GOOGLE SYNC" : "SYNC WITH GOOGLE"}</b>
            <em>{returning ? "PICK UP WHERE YOU LEFT OFF" : "CARRY YOUR CAREER BETWEEN DEVICES"}</em>
          </span>
        </button>
      ) : null}

      {status.kind === "connecting" || status.kind === "syncing" ? (
        <p className="cloud-save-status">
          <b>{status.kind === "connecting" ? "CONNECTING" : "SYNCING"}</b>
          <em>{status.kind === "syncing" ? status.profile.name.toUpperCase() : "GOOGLE"}</em>
        </p>
      ) : null}

      {status.kind === "synced" ? (
        <p className="cloud-save-status is-synced">
          <i aria-hidden="true">{initials(status.profile.name)}</i>
          <b>{status.profile.name.toUpperCase()}</b>
          <em>CAREER SYNCED</em>
          <button onClick={cloud.signOut} aria-label="Sign out of Google. Your career stays on this device.">
            SIGN OUT
          </button>
        </p>
      ) : null}

      {/*
        Google cannot renew a token without a click, so a lapsed session waits
        here instead of failing. Nothing is at risk: the device save is current.
      */}
      {status.kind === "paused" ? (
        <p className="cloud-save-status is-paused">
          <b>SYNC PAUSED</b>
          <em>SAVED ON THIS DEVICE</em>
          <button onClick={cloud.signIn} aria-label="Resume Google sync for your career">RESUME</button>
        </p>
      ) : null}

      {status.kind === "error" ? (
        <p className="cloud-save-status is-error">
          <b>SYNC UNAVAILABLE</b>
          <em>{status.message}</em>
          <button onClick={cloud.dismissError} aria-label="Dismiss the Google sync error and keep playing on this device">
            KEEP PLAYING
          </button>
        </p>
      ) : null}
    </div>
  );
}
