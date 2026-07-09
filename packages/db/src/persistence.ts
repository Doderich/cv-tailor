import type Database from "@tauri-apps/plugin-sql";

export function isTauriRuntime() {
	return "__TAURI_INTERNALS__" in globalThis;
}

function toDatabaseError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}

	if (typeof error === "string") {
		return new Error(error);
	}

	if (error && typeof error === "object" && "message" in error) {
		const message = (error as { message?: unknown }).message;
		if (typeof message === "string") {
			return new Error(message);
		}
	}

	return new Error(String(error));
}

function wrapTauriDatabase(database: Database): Database {
	const wrapped = Object.create(database) as Database;

	wrapped.execute = async (sql, bindValues) => {
		try {
			return await database.execute(sql, bindValues);
		} catch (error) {
			throw toDatabaseError(error);
		}
	};

	wrapped.select = async (sql, bindValues) => {
		try {
			return await database.select(sql, bindValues);
		} catch (error) {
			throw toDatabaseError(error);
		}
	};

	return wrapped;
}

export async function createPersistence() {
	if (isTauriRuntime()) {
		const DatabaseClass = (await import("@tauri-apps/plugin-sql")).default;
		const { createTauriSQLitePersistence } = await import(
			"@tanstack/tauri-db-sqlite-persistence"
		);
		const database = wrapTauriDatabase(
			await DatabaseClass.load("sqlite:cv-tailor.db"),
		);
		return createTauriSQLitePersistence({ database });
	}

	const { createBrowserWASQLitePersistence, openBrowserWASQLiteOPFSDatabase } =
		await import("@tanstack/browser-db-sqlite-persistence");
	const database = await openBrowserWASQLiteOPFSDatabase({
		databaseName: "cv-tailor.sqlite",
	});
	return createBrowserWASQLitePersistence({ database });
}
