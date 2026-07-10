import { Label } from "@cv-tailor/ui/components/label";
import { Textarea } from "@cv-tailor/ui/components/textarea";
import { useEffect, useRef, useState } from "react";

export function splitLines(value: string) {
	return value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

export function ArrayLinesTextarea({
	values,
	onChange,
	placeholder,
	rows = 4,
}: {
	values: string[];
	onChange: (values: string[]) => void;
	placeholder?: string;
	rows?: number;
}) {
	const serialized = values.join("\n");
	const [draftText, setDraftText] = useState<string | null>(null);
	const focusedRef = useRef(false);

	useEffect(() => {
		if (!focusedRef.current) {
			setDraftText(null);
		}
	}, [serialized]);

	const displayValue = draftText ?? serialized;

	const commit = (raw: string) => {
		const next = splitLines(raw);
		if (next.join("\n") !== serialized) {
			onChange(next);
		}
		setDraftText(null);
	};

	return (
		<Textarea
			value={displayValue}
			onChange={(event) => setDraftText(event.target.value)}
			onFocus={() => {
				focusedRef.current = true;
			}}
			onBlur={() => {
				focusedRef.current = false;
				commit(draftText ?? displayValue);
			}}
			placeholder={placeholder}
			rows={rows}
		/>
	);
}

export function ArrayLinesField({
	label,
	values,
	onChange,
	placeholder,
	rows = 4,
}: {
	label: string;
	values: string[];
	onChange: (values: string[]) => void;
	placeholder?: string;
	rows?: number;
}) {
	return (
		<div className="grid gap-3">
			<Label>{label}</Label>
			<ArrayLinesTextarea
				values={values}
				onChange={onChange}
				placeholder={placeholder}
				rows={rows}
			/>
		</div>
	);
}
