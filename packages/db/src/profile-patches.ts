import type { BaseProfile, ProfileRecord } from "@cv-tailor/core";

export const MALTE_GERMAN_PROFILE_PATCH_ID = "malte-german-node-fullstack-v1";

const MALTE_GERMAN_PROFILE_ID = "profile-mrcsnltz-lp02wd";

const malteGermanProfilePatch: Partial<BaseProfile> = {
	summary:
		"Fullstack Software Engineer mit Startup-Erfahrung im TypeScript/Node.js-Ökosystem (Next.js, tRPC). Seit 2021 TypeScript, seit April 2023 professionell als Fullstack-Entwickler. Ich plane und setze Features eigenständig end-to-end um – von Konzeption bis Production Deployment – in SaaS-Plattformen, Cross-Platform-Apps und KI-gestützten Automatisierungs-Workflows. Erfahrung mit PostgreSQL, GCP und Turborepo-Monorepos in schnell wachsenden Umgebungen.",
	targetRoles: [
		"Full Stack Engineer (TypeScript/Node.js)",
		"Frontend Developer (Next.js / React)",
		"Fullstack Software Engineer",
		"Mobile Developer (Flutter)",
		"Product Engineer",
	],
	skills: [
		"Angular",
		"BLoC",
		"Capacitor",
		"CI/CD",
		"Django",
		"Django REST Framework",
		"Drizzle",
		"Firebase",
		"Flutter",
		"GCP",
		"Git",
		"GraphQL",
		"Hive",
		"Ionic",
		"Jest",
		"n8n",
		"Next.js",
		"Node.js",
		"OneSignal",
		"PostgreSQL",
		"React",
		"Redis",
		"Tailwind CSS",
		"tRPC",
		"Turborepo",
		"TypeScript",
		"Vitest",
		"Windmill",
		"Zitadel",
	],
	projects: [
		{
			id: "project-1",
			name: "Proftime",
			role: "Entwickler",
			url: "https://malte-budig.de/projekte",
			description:
				"Moderne Webanwendung zur digitalen Planung und Abrechnung von Lehrverpflichtungen an Hochschulen.",
			bullets: [
				"Entwicklung einer Webanwendung zur digitalen Planung und Abrechnung von Lehrverpflichtungen an Hochschulen",
			],
			technologies: [
				"React",
				"Tanstack Router",
				"Tanstack Query",
				"ShadcnUI",
			],
		},
		{
			id: "project-2",
			name: "CV Tailor",
			role: "Entwickler",
			url: "",
			description:
				"Desktop-Web-App zum Erstellen und Anpassen von Bewerbungs-CVs mit KI-Unterstützung.",
			bullets: [
				"TypeScript/Turborepo-Monorepo mit pnpm Workspaces, Vitest-Tests und produktionsnahem Deployment-Setup",
			],
			technologies: [
				"TypeScript",
				"Turborepo",
				"Vitest",
				"tRPC",
				"PostgreSQL",
			],
		},
	],
};

function patchExperience(
	experience: ProfileRecord["experience"],
): ProfileRecord["experience"] {
	return experience.map((item) => {
		if (item.id === "exp-1") {
			return {
				...item,
				bullets: [
					"Fullstack-Entwicklung mit Next.js und tRPC in einer produktiven Multi-System-SaaS-Plattform – Feature-Bereiche eigenständig von Konzeption bis Production Deployment",
					"Aufbau eines Scheduler-Systems zur Verwaltung von Kundenterminen und operativen Workflows",
					"Implementierung eines KI-Features zur Umwandlung von Kundenfeedback in strukturierte, verwertbare Daten",
					"Entwicklung von mobilen Guides für Außendienstmitarbeiter sowie eines Chat-Systems mit Templates zur Verbesserung der Kommunikationseffizienz",
					"Einführung einer Teststrategie mit nachweisbarem Einfluss auf die Entwicklungsgeschwindigkeit",
					"Arbeit mit System-Integrationen und Automatisierungs-Workflows (GCP, n8n, Windmill)",
					"Übernahme von Verantwortung über die Rolle hinaus: Durchführung technischer Interviews, Mentoring von Praktikanten, Pflege und Stabilisierung bestehender Codebasen",
				],
				technologies: [
					"BLoC",
					"Django",
					"Django REST Framework",
					"Drizzle",
					"Firebase",
					"Flutter",
					"GCP",
					"Hive",
					"Next.js",
					"Node.js",
					"PostgreSQL",
					"Tailwind CSS",
					"tRPC",
					"Turborepo",
					"Zitadel",
				],
			};
		}

		if (item.id === "exp-2") {
			return {
				...item,
				technologies: [
					"Angular",
					"Capacitor",
					"GraphQL",
					"Ionic",
					"n8n",
					"Next.js",
					"Node.js",
					"OneSignal",
					"React",
					"Redis",
					"Tailwind CSS",
				],
			};
		}

		return item;
	});
}

export function applyMalteGermanProfilePatch(
	profile: ProfileRecord,
): ProfileRecord {
	if (profile.id !== MALTE_GERMAN_PROFILE_ID) {
		return profile;
	}

	return {
		...profile,
		...malteGermanProfilePatch,
		experience: patchExperience(profile.experience),
		projects: malteGermanProfilePatch.projects ?? profile.projects,
		updatedAt: new Date().toISOString(),
	};
}

export function applyKnownProfilePatches(
	appliedPatchIds: string[] | undefined,
	profiles: Iterable<ProfileRecord>,
) {
	if (appliedPatchIds?.includes(MALTE_GERMAN_PROFILE_PATCH_ID)) {
		return { profiles: [...profiles], appliedPatchIds: appliedPatchIds ?? [] };
	}

	const nextProfiles = [...profiles].map((profile) =>
		profile.id === MALTE_GERMAN_PROFILE_ID
			? applyMalteGermanProfilePatch(profile)
			: profile,
	);

	const profileWasPatched = nextProfiles.some(
		(profile, index) => profile !== [...profiles][index],
	);

	if (!profileWasPatched) {
		return { profiles: nextProfiles, appliedPatchIds: appliedPatchIds ?? [] };
	}

	return {
		profiles: nextProfiles,
		appliedPatchIds: [
			...(appliedPatchIds ?? []),
			MALTE_GERMAN_PROFILE_PATCH_ID,
		],
	};
}
