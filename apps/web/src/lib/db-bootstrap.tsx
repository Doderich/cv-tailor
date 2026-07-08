import { createDb } from "@cv-tailor/db";
import { type ReactNode, useEffect, useRef, useState } from "react";
import Loader from "@/components/loader";
import { DbProvider } from "@/lib/db-provider";

export function DbBootstrap({ children }: { children: ReactNode }) {
	const [db, setDb] = useState<Awaited<ReturnType<typeof createDb>> | null>(
		null,
	);
	const [error, setError] = useState<string>();
	const dbRef = useRef<Awaited<ReturnType<typeof createDb>> | null>(null);

	useEffect(() => {
		let active = true;

		createDb()
			.then((handle) => {
				if (active) {
					dbRef.current = handle;
					setDb(handle);
				}
			})
			.catch((cause: unknown) => {
				if (active) {
					setError(
						cause instanceof Error ? cause.message : "Could not open database.",
					);
				}
			});

		return () => {
			active = false;
			const current = dbRef.current;
			dbRef.current = null;
			if (current) {
				void current.close();
			}
		};
	}, []);

	if (error) {
		return (
			<div className="grid min-h-screen place-items-center p-6 text-center">
				<div className="grid max-w-md gap-2">
					<h1 className="font-semibold text-lg">Database unavailable</h1>
					<p className="text-muted-foreground text-sm">{error}</p>
				</div>
			</div>
		);
	}

	if (!db) {
		return (
			<div className="grid min-h-screen place-items-center">
				<Loader />
			</div>
		);
	}

	return <DbProvider db={db}>{children}</DbProvider>;
}
