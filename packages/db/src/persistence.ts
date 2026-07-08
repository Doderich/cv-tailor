export function isTauriRuntime() {
	return "__TAURI_INTERNALS__" in globalThis;
}

export async function createPersistence() {
	if (isTauriRuntime()) {
		const Database = (await import("@tauri-apps/plugin-sql")).default;
		const { createTauriSQLitePersistence } = await import(
			"@tanstack/tauri-db-sqlite-persistence"
		);
		const database = await Database.load("sqlite:cv-tailor.db");
		return createTauriSQLitePersistence({ database });
	}

	const { createBrowserWASQLitePersistence, openBrowserWASQLiteOPFSDatabase } =
		await import("@tanstack/browser-db-sqlite-persistence");
	const database = await openBrowserWASQLiteOPFSDatabase({
		databaseName: "cv-tailor.sqlite",
	});
	return createBrowserWASQLitePersistence({ database });
}
