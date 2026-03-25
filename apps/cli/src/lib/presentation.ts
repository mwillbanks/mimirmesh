import type { PresentationProfile } from "@mimirmesh/ui";
import { option } from "pastel";
import zod from "zod/v4";

type PresentationOptionConfig = {
	allowJson?: boolean;
	allowNonInteractive?: boolean;
};

type HelpShape = {
	help: typeof helpOption;
};

type JsonShape = {
	json: typeof jsonOption;
};

type NonInteractiveShape = {
	nonInteractive: typeof nonInteractiveOption;
};

type EmptyShape = Record<never, never>;

type WithPresentationShape<T extends zod.ZodRawShape, C extends PresentationOptionConfig> = T &
	HelpShape &
	(C["allowJson"] extends false ? EmptyShape : JsonShape) &
	(C["allowNonInteractive"] extends true ? NonInteractiveShape : EmptyShape);

const helpOption = zod
	.boolean()
	.optional()
	.describe(
		option({
			description: "Show command-specific help, flags, and non-interactive usage guidance",
			alias: "h",
		}),
	);

const jsonOption = zod
	.boolean()
	.optional()
	.describe(
		option({
			description: "Emit machine-readable JSON output instead of the human-readable CLI surface",
			alias: "j",
		}),
	);

const nonInteractiveOption = zod
	.boolean()
	.optional()
	.describe(
		option({
			description: "Skip prompts and use the documented automation-safe path",
		}),
	);

export const withPresentationOptions = <
	T extends zod.ZodRawShape,
	C extends PresentationOptionConfig = PresentationOptionConfig,
>(
	shape: T,
	config: C = {} as C,
): zod.ZodObject<WithPresentationShape<T, C>> => {
	const nextShape = {
		...shape,
		help: helpOption,
		...(config.allowJson === false ? {} : { json: jsonOption }),
		...(config.allowNonInteractive ? { nonInteractive: nonInteractiveOption } : {}),
	} as WithPresentationShape<T, C>;

	return zod.object(nextShape) as unknown as zod.ZodObject<WithPresentationShape<T, C>>;
};

export type PresentationOptions = {
	help?: boolean;
	json?: boolean;
	nonInteractive?: boolean;
};

const resolveColorSupport = (): PresentationProfile["colorSupport"] => {
	if (!process.stdout.isTTY || process.env.NO_COLOR) {
		return "none";
	}

	const depth =
		typeof process.stdout.getColorDepth === "function" ? process.stdout.getColorDepth() : 1;
	if (depth >= 8) {
		return "rich";
	}
	if (depth > 1) {
		return "basic";
	}
	return "none";
};

export const resolvePresentationProfile = (
	options: PresentationOptions = {},
	modeOverride?: PresentationProfile["mode"],
): PresentationProfile => {
	const columns = process.stdout.columns ?? 80;
	const rows = process.stdout.rows ?? 24;

	return {
		mode: modeOverride ?? (options.json ? "direct-machine" : "direct-human"),
		interactive:
			!options.nonInteractive && Boolean(process.stdout.isTTY) && Boolean(process.stdin.isTTY),
		reducedMotion:
			process.env.MIMIRMESH_REDUCED_MOTION === "1" ||
			process.env.CI === "true" ||
			process.env.TERM === "dumb",
		colorSupport: resolveColorSupport(),
		screenReaderFriendlyText: true,
		terminalSizeClass:
			columns < 100 || rows < 28 ? "compact" : columns >= 140 ? "wide" : "standard",
	};
};
