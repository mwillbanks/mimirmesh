import type zod from "zod/v4";

import { resolvePresentationProfile, withPresentationOptions } from "../lib/presentation";
import { DashboardScreen } from "../ui";

export const isDefault = true;

export const options = withPresentationOptions({}, { allowJson: false });

type Props = {
	options: zod.infer<typeof options>;
};

export default function IndexCommand({ options }: Props) {
	return <DashboardScreen presentation={resolvePresentationProfile(options, "tui")} />;
}
