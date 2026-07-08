import type { DbHandle } from "@cv-tailor/db";
import { createContext, type ReactNode, useContext } from "react";

const DbContext = createContext<DbHandle | undefined>(undefined);

export function DbProvider({
	db,
	children,
}: {
	db: DbHandle;
	children: ReactNode;
}) {
	return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb() {
	const context = useContext(DbContext);
	if (!context) {
		throw new Error("useDb must be used inside DbProvider.");
	}

	return context;
}
