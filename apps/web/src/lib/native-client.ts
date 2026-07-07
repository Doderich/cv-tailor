import { invoke } from "@tauri-apps/api/core";

export type NativeStatus = {
  status: "ok";
  appName: string;
  runtime: "tauri" | "local-http";
  pid: number;
  localApiUrl: string;
};

export type NativeConnection = {
  status: NativeStatus;
  transport: "tauri" | "http";
};

const DEFAULT_LOCAL_API_URL = "http://127.0.0.1:3911";

function localApiUrl() {
  return import.meta.env.VITE_LOCAL_API_URL ?? DEFAULT_LOCAL_API_URL;
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function loadFromTauri(): Promise<NativeConnection | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  const status = await invoke<NativeStatus>("native_status");
  return { status, transport: "tauri" };
}

async function loadFromLocalHttp(): Promise<NativeConnection> {
  const response = await fetch(`${localApiUrl()}/api/status`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Local API returned ${response.status}`);
  }

  return {
    status: await response.json(),
    transport: "http",
  };
}

export async function loadNativeConnection(): Promise<NativeConnection> {
  const tauriConnection = await loadFromTauri().catch(() => null);

  if (tauriConnection) {
    return tauriConnection;
  }

  return loadFromLocalHttp();
}

export function getExpectedLocalApiUrl() {
  return localApiUrl();
}
