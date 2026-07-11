import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import "./i18n";
import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen";

function supportsViewTransitions() {
	return (
		typeof document !== "undefined" &&
		"startViewTransition" in document &&
		typeof document.startViewTransition === "function"
	);
}

const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	scrollRestoration: true,
	defaultPendingComponent: () => <Loader />,
	defaultViewTransition: supportsViewTransitions(),
	context: {},
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.getElementById("app");

if (!rootElement) {
	throw new Error("Root element not found");
}

if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(<RouterProvider router={router} />);
}
