import { Toaster } from "@cv-tailor/ui/components/sonner";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { AppShell } from "@/components/app-shell";
import { PrintableCv } from "@/components/cv/printable-cv";
import { PaletteProvider } from "@/components/palette-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { CvAppProvider, useCvApp } from "@/lib/cv-app-context";
import { DbBootstrap } from "@/lib/db-bootstrap";

import "../index.css";

export type RouterAppContext = Record<string, never>;

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				title: "cv-tailor",
			},
			{
				name: "description",
				content: "cv-tailor is a web application",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.ico",
			},
		],
	}),
});

function RootComponent() {
	return (
		<>
			<HeadContent />
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				disableTransitionOnChange
				enableSystem
				storageKey="cv-tailor-theme"
			>
				<PaletteProvider>
					<DbBootstrap>
						<CvAppProvider>
							<AppShell>
								<Outlet />
							</AppShell>
							<PrintSurface />
						</CvAppProvider>
					</DbBootstrap>
					<Toaster richColors />
				</PaletteProvider>
			</ThemeProvider>
			{import.meta.env.DEV ? (
				<TanStackRouterDevtools position="bottom-right" />
			) : null}
		</>
	);
}

function PrintSurface() {
	const { activeApplication, activeRun, profile } = useCvApp();

	return (
		<PrintableCv
			profile={profile}
			application={activeApplication}
			run={activeRun}
		/>
	);
}
