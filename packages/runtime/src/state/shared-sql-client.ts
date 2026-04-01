const sharedSqlMaxConnections = 4;
const sharedSqlIdleTimeoutSeconds = 5;
const sharedSqlMaxLifetimeSeconds = 300;
const sharedSqlConnectionTimeoutSeconds = 10;

const createBunSqlClient = (options: {
	url: string;
	max: number;
	idleTimeout: number;
	maxLifetime: number;
	connectionTimeout: number;
}) => new Bun.SQL(options);

export type SharedSqlClient = ReturnType<typeof createBunSqlClient>;

export type SharedSqlClientFactoryOptions = {
	url: string;
	max: number;
	idleTimeout: number;
	maxLifetime: number;
	connectionTimeout: number;
};

type SharedSqlClientFactory = (options: SharedSqlClientFactoryOptions) => SharedSqlClient;
type SharedSqlClientValidator = (client: SharedSqlClient) => Promise<void>;

type SharedSqlClientEntry = {
	clientId: string;
	url: string;
	sql: SharedSqlClient;
	refCount: number;
};

const sharedSqlClients = new Map<string, SharedSqlClientEntry>();
const sharedSqlClientCreations = new Map<string, Promise<SharedSqlClientEntry>>();

let nextSharedSqlClientId = 1;

const defaultFactory: SharedSqlClientFactory = (options) => createBunSqlClient(options);

const defaultValidator: SharedSqlClientValidator = async (client) => {
	await client`SELECT 1`;
};

const buildSharedSqlOptions = (url: string): SharedSqlClientFactoryOptions => ({
	url,
	max: sharedSqlMaxConnections,
	idleTimeout: sharedSqlIdleTimeoutSeconds,
	maxLifetime: sharedSqlMaxLifetimeSeconds,
	connectionTimeout: sharedSqlConnectionTimeoutSeconds,
});

const closeSqlClient = async (client: SharedSqlClient): Promise<void> => {
	await client.close();
};

const disposeSharedSqlClientEntry = async (
	cacheKey: string,
	expectedClientId?: string,
): Promise<void> => {
	const entry = sharedSqlClients.get(cacheKey);
	if (!entry) {
		return;
	}
	if (expectedClientId && entry.clientId !== expectedClientId) {
		return;
	}
	sharedSqlClients.delete(cacheKey);
	await closeSqlClient(entry.sql).catch(() => undefined);
};

const createSharedSqlHandle = (cacheKey: string, entry: SharedSqlClientEntry): SharedSqlClient => {
	let released = false;
	const release = async (): Promise<void> => {
		if (released) {
			return;
		}
		released = true;
		const current = sharedSqlClients.get(cacheKey);
		if (!current || current.clientId !== entry.clientId) {
			return;
		}
		current.refCount = Math.max(0, current.refCount - 1);
	};

	const target = (() => undefined) as unknown as SharedSqlClient;
	return new Proxy(target as unknown as (...args: unknown[]) => unknown, {
		apply(_target, _thisArg, argArray) {
			return Reflect.apply(
				entry.sql as unknown as (...args: unknown[]) => unknown,
				entry.sql,
				argArray,
			);
		},
		get(_target, property) {
			if (property === "close") {
				return release;
			}
			const value = Reflect.get(entry.sql as unknown as object, property, entry.sql);
			return typeof value === "function" ? value.bind(entry.sql) : value;
		},
	}) as SharedSqlClient;
};

const createSharedSqlClientEntry = async (
	cacheKey: string,
	url: string,
	createClient: SharedSqlClientFactory,
	validateClient: SharedSqlClientValidator,
): Promise<SharedSqlClientEntry> => {
	const sql = createClient(buildSharedSqlOptions(url));
	try {
		await validateClient(sql);
		const entry: SharedSqlClientEntry = {
			clientId: `shared-sql-${nextSharedSqlClientId++}`,
			url,
			sql,
			refCount: 0,
		};
		sharedSqlClients.set(cacheKey, entry);
		return entry;
	} catch (error) {
		await closeSqlClient(sql).catch(() => undefined);
		throw error;
	}
};

const resolveSharedSqlClientEntry = async (options: {
	url: string;
	cacheKey: string;
	createClient: SharedSqlClientFactory;
	validateClient: SharedSqlClientValidator;
}): Promise<SharedSqlClientEntry> => {
	const existing = sharedSqlClients.get(options.cacheKey);
	if (existing) {
		try {
			await options.validateClient(existing.sql);
			return existing;
		} catch {
			await disposeSharedSqlClientEntry(options.cacheKey, existing.clientId);
		}
	}

	const pending = sharedSqlClientCreations.get(options.cacheKey);
	if (pending) {
		return pending;
	}

	const creation = createSharedSqlClientEntry(
		options.cacheKey,
		options.url,
		options.createClient,
		options.validateClient,
	).finally(() => {
		if (sharedSqlClientCreations.get(options.cacheKey) === creation) {
			sharedSqlClientCreations.delete(options.cacheKey);
		}
	});
	sharedSqlClientCreations.set(options.cacheKey, creation);
	return creation;
};

export const acquireSharedSqlClient = async (options: {
	url: string;
	cacheKey?: string;
	createClient?: SharedSqlClientFactory;
	validateClient?: SharedSqlClientValidator;
}): Promise<{ sql: SharedSqlClient; url: string; clientId: string }> => {
	const cacheKey = options.cacheKey ?? options.url;
	const entry = await resolveSharedSqlClientEntry({
		url: options.url,
		cacheKey,
		createClient: options.createClient ?? defaultFactory,
		validateClient: options.validateClient ?? defaultValidator,
	});
	entry.refCount += 1;
	return {
		sql: createSharedSqlHandle(cacheKey, entry),
		url: entry.url,
		clientId: entry.clientId,
	};
};

export const closeAllSharedSqlClients = async (): Promise<void> => {
	await Promise.allSettled([...sharedSqlClientCreations.values()]);
	const entries = [...sharedSqlClients.values()];
	sharedSqlClients.clear();
	await Promise.allSettled(entries.map((entry) => closeSqlClient(entry.sql)));
};

export const resetSharedSqlClientsForTests = async (): Promise<void> => {
	await closeAllSharedSqlClients();
	sharedSqlClientCreations.clear();
	nextSharedSqlClientId = 1;
};
