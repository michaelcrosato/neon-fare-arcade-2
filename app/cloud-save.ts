"use client";

import { CLOUD_SAVE_FILENAME, readCloudSave, type CloudSave } from "@/game/career-sync";

/**
 * Transport for the career save. The file lives in `appDataFolder`, a hidden
 * per-app folder inside the player's own Google Drive: this game can read and
 * write only what it put there, and never sees any other file the player owns.
 * There is no Neon Fare server and no Neon Fare database in this path.
 */

const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const MULTIPART_BOUNDARY = "neon-fare-save-boundary";

/** The access token expired or the grant was withdrawn: renew, then retry. */
export class CloudAuthError extends Error {}

async function driveFetch(accessToken: string, url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 401 || response.status === 403) {
    throw new CloudAuthError("Google sign-in expired.");
  }
  if (!response.ok) throw new Error(`Google Drive request failed: ${response.status}`);
  return response;
}

export async function findCloudSaveFile(accessToken: string): Promise<string | null> {
  const query = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name = '${CLOUD_SAVE_FILENAME}' and trashed = false`,
    fields: "files(id)",
    pageSize: "1",
  });
  const response = await driveFetch(accessToken, `${DRIVE_FILES}?${query}`);
  const data = await response.json() as { files?: { id?: string }[] };
  return data.files?.[0]?.id ?? null;
}

/** A save this app cannot parse is reported as absent, never as an error. */
export async function readCloudSaveFile(accessToken: string, fileId: string): Promise<CloudSave | null> {
  const response = await driveFetch(accessToken, `${DRIVE_FILES}/${fileId}?alt=media`);
  try {
    return readCloudSave(await response.json());
  } catch {
    return null;
  }
}

export async function writeCloudSaveFile(
  accessToken: string,
  fileId: string | null,
  save: CloudSave,
): Promise<string> {
  const body = JSON.stringify(save);

  if (fileId) {
    const response = await driveFetch(accessToken, `${DRIVE_UPLOAD}/${fileId}?uploadType=media&fields=id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await response.json() as { id?: string };
    return data.id ?? fileId;
  }

  // Creating needs metadata and content in one request; `parents` is what pins
  // the file inside the hidden app folder rather than the player's real Drive.
  const metadata = JSON.stringify({ name: CLOUD_SAVE_FILENAME, parents: ["appDataFolder"] });
  const multipart = [
    `--${MULTIPART_BOUNDARY}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${MULTIPART_BOUNDARY}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    body,
    `--${MULTIPART_BOUNDARY}--`,
    "",
  ].join("\r\n");

  const response = await driveFetch(accessToken, `${DRIVE_UPLOAD}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${MULTIPART_BOUNDARY}` },
    body: multipart,
  });
  const data = await response.json() as { id?: string };
  if (!data.id) throw new Error("Google Drive did not return a save file id.");
  return data.id;
}
