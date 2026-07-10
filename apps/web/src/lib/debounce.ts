export function createDebouncedCallback<T extends (...args: never[]) => void>(
	fn: T,
	delayMs: number,
) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let latestArgs: Parameters<T> | undefined;

	const debounced = (...args: Parameters<T>) => {
		latestArgs = args;
		if (timer) {
			clearTimeout(timer);
		}
		timer = setTimeout(() => {
			timer = undefined;
			if (latestArgs) {
				fn(...latestArgs);
				latestArgs = undefined;
			}
		}, delayMs);
	};

	const flush = () => {
		if (timer) {
			clearTimeout(timer);
			timer = undefined;
		}
		if (latestArgs) {
			fn(...latestArgs);
			latestArgs = undefined;
		}
	};

	const cancel = () => {
		if (timer) {
			clearTimeout(timer);
			timer = undefined;
		}
		latestArgs = undefined;
	};

	return { debounced, flush, cancel };
}
