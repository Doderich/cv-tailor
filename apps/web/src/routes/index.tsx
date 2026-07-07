import { Button } from "@cv-tailor/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@cv-tailor/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, RefreshCw, Server } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  getExpectedLocalApiUrl,
  loadNativeConnection,
  type NativeConnection,
} from "@/lib/native-client";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

const TITLE_TEXT = `
 ██████╗ ███████╗████████╗████████╗███████╗██████╗
 ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗
 ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝
 ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗
 ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║
 ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝

 ████████╗    ███████╗████████╗ █████╗  ██████╗██╗  ██╗
 ╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝
    ██║       ███████╗   ██║   ███████║██║     █████╔╝
    ██║       ╚════██║   ██║   ██╔══██║██║     ██╔═██╗
    ██║       ███████║   ██║   ██║  ██║╚██████╗██║  ██╗
    ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
 `;

function HomeComponent() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: "loading",
  });

  const refreshConnection = useCallback(async () => {
    setConnectionState({ status: "loading" });

    try {
      const connection = await loadNativeConnection();
      setConnectionState({ status: "connected", connection });
    } catch (error) {
      setConnectionState({
        status: "disconnected",
        message: error instanceof Error ? error.message : "Unable to reach local API",
      });
    }
  }, []);

  useEffect(() => {
    void refreshConnection();
  }, [refreshConnection]);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-2">
      <pre className="overflow-x-auto font-mono text-sm">{TITLE_TEXT}</pre>
      <div className="grid gap-6">
        <ApiStatusPanel state={connectionState} onRefresh={refreshConnection} />
      </div>
    </div>
  );
}

type ConnectionState =
  | { status: "loading" }
  | { status: "connected"; connection: NativeConnection }
  | { status: "disconnected"; message: string };

function ApiStatusPanel({
  state,
  onRefresh,
}: {
  state: ConnectionState;
  onRefresh: () => void;
}) {
  const isLoading = state.status === "loading";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="size-4" />
          API Status
        </CardTitle>
        <CardDescription>{statusDescription(state)}</CardDescription>
        <CardAction>
          <Button
            aria-label="Refresh API status"
            disabled={isLoading}
            onClick={onRefresh}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <RefreshCw className={isLoading ? "animate-spin" : undefined} />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {state.status === "connected" ? (
          <ConnectedStatus connection={state.connection} />
        ) : state.status === "disconnected" ? (
          <DisconnectedStatus message={state.message} />
        ) : (
          <div className="grid min-h-24 place-items-center text-muted-foreground text-sm">
            Checking local connection
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectedStatus({ connection }: { connection: NativeConnection }) {
  const { status } = connection;

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 text-emerald-600 text-sm dark:text-emerald-400">
        <CheckCircle2 className="size-4" />
        Connected
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <StatusItem label="Runtime" value={status.runtime} />
        <StatusItem label="Transport" value={connection.transport} />
        <StatusItem label="Process ID" value={status.pid.toString()} />
        <StatusItem label="Local API" value={status.localApiUrl} />
      </dl>
    </div>
  );
}

function DisconnectedStatus({ message }: { message: string }) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 text-destructive text-sm">
        <AlertCircle className="size-4" />
        Disconnected
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <StatusItem label="Expected API" value={getExpectedLocalApiUrl()} />
        <StatusItem label="Error" value={message} />
      </dl>
    </div>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="min-w-0">
        <code className="block overflow-hidden text-ellipsis whitespace-nowrap border bg-muted px-2 py-1">
          {value}
        </code>
      </dd>
    </div>
  );
}

function statusDescription(state: ConnectionState) {
  if (state.status === "connected") {
    return "Tauri application bridge is reachable.";
  }

  if (state.status === "disconnected") {
    return "Tauri application bridge is offline.";
  }

  return "Checking Tauri application bridge.";
}
