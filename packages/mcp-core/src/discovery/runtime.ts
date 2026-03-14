import {
	loadRoutingTable,
	loadRuntimeConnection,
	type RoutingTable,
	type RuntimeConnection,
} from "@mimirmesh/runtime";

export const loadRuntimeRoutingContext = async (
	projectRoot: string,
): Promise<{
	routing: RoutingTable | null;
	connection: RuntimeConnection | null;
}> => {
	const [routing, connection] = await Promise.all([
		loadRoutingTable(projectRoot),
		loadRuntimeConnection(projectRoot),
	]);
	return { routing, connection };
};
