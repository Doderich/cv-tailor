import { Outlet } from "@tanstack/react-router";

export function AnimatedPage() {
	return (
		<div className="page-view-transition min-h-0 min-w-0">
			<Outlet />
		</div>
	);
}
