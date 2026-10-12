import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Minimal Google Drive client over the Drive v3 REST API. Tokens live in
 * google_drive_connections, which has no client-facing RLS policy, so
 * everything here runs server-side with the admin client.
 */

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE = "https://www.googleapis.com/drive/v3";
const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

// Refresh a little early so a token doesn't expire mid-sync.
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

type TokenResponse = {
  access_token: string;
  // Only returned on the first consent (and on refresh, rarely).
  refresh_token?: string;
  expires_in: number;
};

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
};

export class GoogleDriveError extends Error {}

// Holds the OAuth state between /api/google-drive/connect and the callback.
export const OAUTH_STATE_COOKIE = "google_drive_oauth_state";

export function isGoogleDriveConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(requestUrl: string) {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    new URL("/api/google-drive/callback", requestUrl).toString()
  );
}

export function buildAuthorizeUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    // offline + consent so Google always returns a refresh token.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

async function requestTokens(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("[google-drive] Token request failed", data);
    if (data.error === "invalid_grant") {
      throw new GoogleDriveError(
        "Google Drive access has expired or was revoked. Disconnect and connect again.",
      );
    }
    throw new GoogleDriveError(data.error_description ?? "Google sign-in failed");
  }
  return data;
}

export function exchangeCodeForTokens(code: string, redirectUri: string) {
  return requestTokens({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

export function expiresAtFrom(tokens: TokenResponse) {
  return new Date(Date.now() + tokens.expires_in * 1000).toISOString();
}

/**
 * Returns a usable access token for the user, refreshing it when the stored
 * one is about to expire.
 */
export async function getAccessToken(userId: string) {
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("google_drive_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (!connection) {
    throw new GoogleDriveError("Google Drive isn't connected");
  }

  if (new Date(connection.expires_at).getTime() - EXPIRY_BUFFER_MS > Date.now()) {
    return connection.access_token as string;
  }

  const tokens = await requestTokens({
    grant_type: "refresh_token",
    refresh_token: connection.refresh_token,
  });

  await admin
    .from("google_drive_connections")
    .update({
      access_token: tokens.access_token,
      // Google usually keeps the same refresh token; store a new one if sent.
      ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
      expires_at: expiresAtFrom(tokens),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return tokens.access_token;
}

async function drive<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${DRIVE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    console.error(`[google-drive] Drive request failed: ${res.status} ${path}`, data);
    if (res.status === 404) throw new GoogleDriveError("Not found in Google Drive");
    throw new GoogleDriveError(
      data?.error?.message ?? `Google Drive request failed (${res.status})`,
    );
  }
  return res.json();
}

export async function getAccountEmail(accessToken: string) {
  const about = await drive<{ user?: { emailAddress?: string } }>(
    accessToken,
    "/about?fields=user(emailAddress)",
  );
  return about.user?.emailAddress ?? null;
}

/**
 * Accepts a folder link (https://drive.google.com/drive/folders/<id>, with
 * or without /u/0/ or ?usp=...) or a bare folder ID.
 */
export function parseFolderId(input: string) {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if (fromUrl) return fromUrl[1];
  const fromQuery = trimmed.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (fromQuery) return fromQuery[1];
  if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

export async function resolveFolder(accessToken: string, input: string) {
  const folderId = parseFolderId(input);
  if (!folderId) {
    throw new GoogleDriveError("Paste the folder's link from Google Drive");
  }

  let item: { id: string; name: string; mimeType: string; trashed?: boolean };
  try {
    item = await drive(
      accessToken,
      `/files/${folderId}?fields=id,name,mimeType,trashed&supportsAllDrives=true`,
    );
  } catch (error) {
    if (error instanceof GoogleDriveError && error.message === "Not found in Google Drive") {
      throw new GoogleDriveError(
        "Folder not found. Check the link, and that it's in the Google account you connected.",
      );
    }
    throw error;
  }
  if (item.mimeType !== FOLDER_MIME_TYPE) {
    throw new GoogleDriveError(`"${item.name}" is a file, not a folder`);
  }
  if (item.trashed) {
    throw new GoogleDriveError(`"${item.name}" is in the trash`);
  }
  return { id: item.id, name: item.name };
}

/** PDFs directly inside the folder (not subfolders). */
export async function listFolderPdfs(accessToken: string, folderId: string) {
  type Page = { files: DriveFile[]; nextPageToken?: string };

  const query = `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`;
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: query,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: "200",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      ...(pageToken && { pageToken }),
    });
    const page = await drive<Page>(accessToken, `/files?${params}`);
    files.push(...page.files);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return files;
}

export async function downloadFile(accessToken: string, fileId: string) {
  const res = await fetch(`${DRIVE}/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new GoogleDriveError(`Failed to download file (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}
