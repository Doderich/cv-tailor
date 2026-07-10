import { describe, expect, it } from "vitest";

import {
	inferJobPositionFromText,
	jobPositionLabel,
	jobPositions,
} from "../job-position";

describe("inferJobPositionFromText", () => {
	it("detects full stack roles", () => {
		expect(
			inferJobPositionFromText("Full-Stack Engineer TypeScript Node.js"),
		).toBe("fullstack");
	});

	it("detects frontend roles", () => {
		expect(inferJobPositionFromText("Senior Frontend Engineer React")).toBe(
			"frontend",
		);
	});

	it("detects mobile roles", () => {
		expect(inferJobPositionFromText("Senior iOS Engineer SwiftUI")).toBe(
			"mobile",
		);
	});

	it("falls back to unspecified", () => {
		expect(inferJobPositionFromText("People Operations Specialist")).toBe(
			"unspecified",
		);
	});
});

describe("jobPositionLabel", () => {
	it("labels every enum value", () => {
		for (const position of jobPositions) {
			expect(jobPositionLabel(position).length).toBeGreaterThan(0);
		}
	});
});
