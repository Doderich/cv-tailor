import { Toaster } from "@cv-tailor/ui/components/sonner";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { AppShell } from "@/components/app-shell";
import { PrintableCv } from "@/components/cv/printable-cv";
import { ThemeProvider } from "@/components/theme-provider";
import { CvAppProvider, useCvApp } from "@/lib/cv-app-context";

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
				defaultTheme="light"
				disableTransitionOnChange
				storageKey="cv-tailor-theme"
			>
				<CvAppProvider>
					<AppShell>
						<Outlet />
					</AppShell>
					<PrintSurface />
				</CvAppProvider>
				<Toaster richColors />
			</ThemeProvider>
			{import.meta.env.DEV ? (
				<TanStackRouterDevtools position="bottom-right" />
			) : null}
		</>
	);
}

function PrintSurface() {
	const { activeGeneratedCv, appState } = useCvApp();

	return (
		<PrintableCv profile={appState.profile} generatedCv={activeGeneratedCv} />
	);
}
