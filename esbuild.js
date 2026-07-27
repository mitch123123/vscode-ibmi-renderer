const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				if (location) {
					console.error(`    ${location.file}:${location.line}:${location.column}:`);
				}
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	const extensionCtx = await esbuild.context({
		entryPoints: ['src/extension.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	});

	const webuiCtx = await esbuild.context({
		entryPoints: ['webui/src/main.js'],
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		platform: 'browser',
		outfile: 'webui/main.js',
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	});

	if (watch) {
		await Promise.all([extensionCtx.watch(), webuiCtx.watch()]);
	} else {
		await Promise.all([extensionCtx.rebuild(), webuiCtx.rebuild()]);
		await Promise.all([extensionCtx.dispose(), webuiCtx.dispose()]);
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
