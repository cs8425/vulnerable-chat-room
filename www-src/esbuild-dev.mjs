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

process.on('unhandledRejection', (reason, p) => {
	console.error(reason, 'Unhandled Rejection at Promise', p);
}).on('uncaughtException', err => {
	console.error(err, 'Uncaught Exception thrown');
	process.exit(1);
});

// this function from 'node-http-proxy'
// https://github.com/http-party/node-http-proxy/blob/master/lib/http-proxy/passes/ws-incoming.js#L81-L96
const createHttpHeader = function (line, headers) {
	/*
	 node-http-proxy
	
	  Copyright (c) 2010-2016 Charlie Robbins, Jarrett Cruger & the Contributors.
	
	  Permission is hereby granted, free of charge, to any person obtaining
	  a copy of this software and associated documentation files (the
	  "Software"), to deal in the Software without restriction, including
	  without limitation the rights to use, copy, modify, merge, publish,
	  distribute, sublicense, and/or sell copies of the Software, and to
	  permit persons to whom the Software is furnished to do so, subject to
	  the following conditions:
	
	  The above copyright notice and this permission notice shall be
	  included in all copies or substantial portions of the Software.
	
	  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
	  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
	  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
	  LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
	  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
	  WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
	*/
	return Object.keys(headers).reduce(function (head, key) {
		var value = headers[key];

		if (!Array.isArray(value)) {
			head.push(key + ': ' + value);
			return head;
		}

		for (var i = 0; i < value.length; i++) {
			head.push(key + ': ' + value[i]);
		}
		return head;
	}, [line]).join('\r\n') + '\r\n\r\n';
}

const setConnTimeout = (req) => {
	req.setTimeout(0);
	if (req.setNoDelay) req.setNoDelay(true);
	if (req.setSocketKeepAlive) req.setSocketKeepAlive(true, 0);
	const socket = req.socket;
	if (socket) setConnTimeout(socket);
};

// Then start a proxy server on port config.devPort
const srv = http.createServer({
	headersTimeout: 0,
	requestTimeout: 0,
}, (req, res) => {
	const options = {
		path: req.url,
		method: req.method,
		headers: req.headers,
		timeout: 20 * 1000, // 20s timeout
	}
	req.setTimeout(options.timeout);

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
			console.log('[proxyRes]', proxyRes.statusCode, proxyRes.headers);

			// forward the response from esbuild to the client
			res.writeHead(proxyRes.statusCode, proxyRes.headers);
			proxyRes.pipe(res, { end: true });
		});
		const sendErr = (err) => {
			res.statusCode = 502;
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(err, null, '\t'));
		}
		proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
			console.log('[req]upgrade', req.url, proxyHead);
			req.unpipe(proxyReq);
			setConnTimeout(req);
			setConnTimeout(proxyReq);

			if (proxyHead && proxyHead.length) proxySocket.unshift(proxyHead);
			const socket = req.socket;
			socket.write(createHttpHeader('HTTP/1.1 101 Switching Protocols', proxyRes.headers));

			proxySocket.on('close', () => { console.log('[proxySocket]close') });
			proxySocket.on('error', (err) => { console.log('[proxySocket]err', err) });
			socket.on('close', () => { console.log('[socket] close') });
			socket.on('error', (err) => { console.log('[socket]err', err) });

			proxySocket.pipe(socket);
			socket.pipe(proxySocket);
		});
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

		// Forward the body of the request to api server
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
