import http from 'http';
import https from 'https';
import os from 'os';
import fs from 'fs';
import path from 'path';
// import { sep } from 'node:path';

// import esbuild from 'esbuild';
import * as esbuild from 'esbuild';
import hanlder from 'serve-handler';
import comm from './esbuild-comm.js';

const config = {
	devPort: 8008,
	apiHostname: '127.0.0.1',
	apiPort: 8000,
	apiHTTPS: false,
	skipGz: true,
};

const needProxyFn = (url, req) => {
	return url.pathname.match(/^\/.*\/api\/.*$/) || url.pathname.match(/^\/ws*$/);
}

const ostemp = (os.type() === 'Linux') ? '/dev/shm' : os.tmpdir();
const tmpdir = fs.mkdtempSync(path.join(ostemp, 'esbuild-')) || './dev-tmp/dist';
const cleanFn = () => {
	console.log('[clean]', tmpdir);
	fs.rmSync(tmpdir, { recursive: true, force: true });
	process.exit();
};
process.on('exit', cleanFn);
process.on('SIGINT', cleanFn); //catches ctrl+c event


const fileHanlder = (req, res) => hanlder(req, res, {
	"public": tmpdir,
	"etag": true,
});

let ctx = await esbuild.context({
	define: { 'process.env.NODE_ENV': '"development"' }, // production
	entryPoints: ['src/app.js'],
	bundle: true,
	// minify: true,
	// pure: ['console.log'],
	sourcemap: true,
	sourcesContent: true,
	target: [
		// 'es2015',
		'es2020',
	],
	// outfile: 'dist/main.js',
	outdir: tmpdir,
	loader: {
		'.js': 'jsx',
		'.png': 'file',
		'.jpg': 'file',
		'.gif': 'file',
		'.svg': 'file',
		'.woff': 'file',
		'.woff2': 'file',
		'.ttf': 'file',
		'.eot': 'file',
		'.wasm': 'file',
	},
	jsxFactory: 'h',
	jsxFragment: 'Fragment',
	plugins: [
		comm.reactOnResolvePlugin,
		comm.copyPlugin,
	],
	// watch: {
	// 	onRebuild(error, result) {
	// 		if (error) {
	// 			console.error('watch build failed:', error);
	// 		} else {
	// 			console.log('watch build succeeded:', result);
	// 		}
	// 	},
	// },
});

await ctx.watch();
console.log('watching...');

// Then start a proxy server on port config.devPort
http.createServer((req, res) => {
	const options = {
		path: req.url,
		method: req.method,
		headers: req.headers,
		timeout: 20 * 1000, // 20s timeout
	}

	let proxy = false;
	const url = new URL(req.url, `http://${req.headers.host}`)
	if (needProxyFn(url, req)) {
		options.hostname = config.apiHostname;
		options.port = config.apiPort;
		options.headers.host = config.apiHostname;
		proxy = true;
	}
	console.log('[req]', req.url, req.headers, proxy);

	if (config.skipGz) delete req.headers['accept-encoding']; // skip gz

	if (proxy) {
		// Forward each incoming request to api server
		const proxyReq = ((config.apiHTTPS) ? https : http).request(options, proxyRes => {
			// forward the response from esbuild to the client
			res.writeHead(proxyRes.statusCode, proxyRes.headers);
			proxyRes.pipe(res, { end: true });
		});
		const sendErr = (err) => {
			res.statusCode = 502;
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(err, null, '\t'));
		}
		proxyReq.on('timeout', () => {
			console.log('[req]timeout', req.url, options);
			try {
				sendErr({ errorMsg: 'proxy timeout!' });
			}
			catch (ex) {
			}
			proxyReq.destroy();
		});
		proxyReq.on('error', (err) => {
			if (proxyReq.destroyed) return;
			console.log('[req]err', req.url, err);
			sendErr(err);
		});

		// Forward the body of the request to esbuild
		req.pipe(proxyReq, { end: true });
		return;
	}

	// ffmpeg-wasm
	res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
	res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

	// Serve files!
	req.addListener('end', function () {
		fileHanlder(req, res);
	}).resume();
	// fileHanlder(req, res);

}).listen(config.devPort);
