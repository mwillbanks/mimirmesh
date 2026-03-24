export default {
	"*": ["bunx biome check --write --unsafe --no-errors-on-unmatched --files-ignore-unknown=true"],
	"**/*.{ts,tsx,js,jsx,mts,cts}": [() => "bunx tsc --noEmit"],
};
