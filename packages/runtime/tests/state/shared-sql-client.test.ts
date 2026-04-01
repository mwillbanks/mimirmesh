import { afterEach, describe, expect, test } from "bun:test";

import {
	acquireSharedSqlClient,
	closeAllSharedSqlClients,
	resetSharedSqlClientsForTests,
	type SharedSqlClient,
	type SharedSqlClientFactoryOptions,
} from "../../src/state/shared-sql-client";

type FakeSqlTracker = {
	closeCalls: number;
	queryCalls: number;
	unsafeCalls: number;
	beginCalls: number;
	createdOptions: SharedSqlClientFactoryOptions[];
};

const createFakeSqlClient = (tracker: FakeSqlTracker): SharedSqlClient => {
	const sql = (async () => {
		tracker.queryCalls += 1;
		return [];
	}) as unknown as SharedSqlClient;

	sql.unsafe = ((..._args: unknown[]) => {
		tracker.unsafeCalls += 1;
		return [];
	}) as unknown as SharedSqlClient["unsafe"];
	sql.begin = ((...args: unknown[]) => {
		tracker.beginCalls += 1;
		const callback = args.at(-1) as (transaction: SharedSqlClient) => Promise<unknown>;
		return callback(sql);
	}) as unknown as SharedSqlClient["begin"];
	sql.close = async () => {
		tracker.closeCalls += 1;
	};

	return sql;
};

const createTracker = (): FakeSqlTracker => ({
	closeCalls: 0,
	queryCalls: 0,
	unsafeCalls: 0,
	beginCalls: 0,
	createdOptions: [],
});

afterEach(async () => {
	await resetSharedSqlClientsForTests();
});

describe("shared SQL client manager", () => {
	test("reuses a single client across concurrent acquisitions for the same database", async () => {
		const tracker = createTracker();
		let validateCalls = 0;
		const createClient = (options: SharedSqlClientFactoryOptions): SharedSqlClient => {
			tracker.createdOptions.push(options);
			return createFakeSqlClient(tracker);
		};

		const acquisitions = await Promise.all(
			Array.from({ length: 12 }, () =>
				acquireSharedSqlClient({
					url: "postgres://mimirmesh:mimirmesh@127.0.0.1:5432/mimirmesh",
					createClient,
					validateClient: async () => {
						validateCalls += 1;
					},
				}),
			),
		);

		expect(tracker.createdOptions).toHaveLength(1);
		expect(new Set(acquisitions.map((entry) => entry.clientId)).size).toBe(1);
		expect(tracker.createdOptions[0]).toMatchObject({
			max: 4,
			idleTimeout: 5,
			maxLifetime: 300,
			connectionTimeout: 10,
		});
		expect(validateCalls).toBeGreaterThanOrEqual(1);

		await Promise.all(acquisitions.map((entry) => entry.sql.close()));
		expect(tracker.closeCalls).toBe(0);

		await closeAllSharedSqlClients();
		expect(tracker.closeCalls).toBe(1);
	});

	test("recreates the shared client after validation detects a stale pool", async () => {
		const tracker = createTracker();
		let failValidation = false;
		const createClient = (options: SharedSqlClientFactoryOptions): SharedSqlClient => {
			tracker.createdOptions.push(options);
			return createFakeSqlClient(tracker);
		};

		const first = await acquireSharedSqlClient({
			url: "postgres://mimirmesh:mimirmesh@127.0.0.1:5432/mimirmesh",
			createClient,
			validateClient: async () => {
				if (failValidation) {
					throw new Error("stale client");
				}
			},
		});
		await first.sql.close();

		failValidation = true;
		const second = await acquireSharedSqlClient({
			url: "postgres://mimirmesh:mimirmesh@127.0.0.1:5432/mimirmesh",
			createClient,
			validateClient: async () => {
				if (failValidation) {
					failValidation = false;
					throw new Error("stale client");
				}
			},
		});

		expect(tracker.createdOptions).toHaveLength(2);
		expect(second.clientId).not.toBe(first.clientId);
		expect(tracker.closeCalls).toBe(1);
		await second.sql.close();
	});
});
