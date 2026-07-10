import { describe, expect, it } from "vitest";

import {
	buildJobOfferFromFetchedPage,
	extractTitleCompanyFromJobText,
	parseJobPostingUrl,
} from "../job-posting";

describe("parseJobPostingUrl", () => {
	it("parses StepStone posting slugs into title and company", () => {
		const result = parseJobPostingUrl(
			"https://www.stepstone.de/stellenangebote--Full-Stack-Engineer-m-w-d-TypeScript-Node-js-Fintech-Start-up-Stuttgart-Stuttgart-CapitalFlow-GmbH--14020097-inline.html?rltr=ma_sj_0_0_0_0_0",
		);

		expect(result.title).toContain("Full Stack Engineer");
		expect(result.title).toContain("TypeScript");
		expect(result.company).toBe("CapitalFlow GmbH");
	});
});

describe("extractTitleCompanyFromJobText", () => {
	it("reads the first substantial line as title and company markers from text", () => {
		const result = extractTitleCompanyFromJobText(`
      Full Stack Engineer (m/w/d)

      CapitalFlow GmbH · Stuttgart

      Requirements
      - TypeScript and Node.js
    `);

		expect(result.title).toBe("Full Stack Engineer (m/w/d)");
		expect(result.company).toContain("CapitalFlow GmbH");
	});
});

describe("buildJobOfferFromFetchedPage", () => {
	it("combines fetched text and URL hints into a job offer draft", () => {
		const result = buildJobOfferFromFetchedPage({
			url: "https://www.stepstone.de/stellenangebote--Full-Stack-Engineer-m-w-d-TypeScript-Node-js-Fintech-Start-up-Stuttgart-Stuttgart-CapitalFlow-GmbH--14020097-inline.html",
			text: `
        Full Stack Engineer (m/w/d)
        CapitalFlow GmbH
        We are looking for a TypeScript engineer.
      `,
		});

		expect(result.title).toContain("Full Stack Engineer");
		expect(result.company).toContain("CapitalFlow");
		expect(result.rawText).toContain("TypeScript engineer");
		expect(result.position).toBe("fullstack");
		expect(result.links).toEqual([
			"https://www.stepstone.de/stellenangebote--Full-Stack-Engineer-m-w-d-TypeScript-Node-js-Fintech-Start-up-Stuttgart-Stuttgart-CapitalFlow-GmbH--14020097-inline.html",
		]);
	});
});
