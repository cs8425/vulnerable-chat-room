import { readFileSync } from 'fs';
import { parse } from 'url';
import { createServer } from 'node:http';
import { createSecureServer, constants as h2constants } from 'node:http2';
import WebSocket, { WebSocketServer } from 'ws';
import hanlder from 'serve-handler';

import {
	openDb,
	saveLog,
	sendLog,
} from './db.mjs';

const config = {
	skipGz: true,
	dbPath: './db.sqlite',

	useHttps: false,
	cert: './cert/server.crt',
	key: './cert/server.key',
};

const db = await openDb(config.dbPath);
async function shutdown(code = 0) {
	console.log('Closing database...');
	await db.close();
	process.exit(code);
}

process.on('unhandledRejection', (reason, p) => {
	console.error(reason, 'Unhandled Rejection at Promise', p);
}).on('uncaughtException', async (err) => {
	console.error(err, 'Uncaught Exception thrown');
	shutdown(1);
}).on('SIGTERM', async () => {
	shutdown(3);
}).on('SIGINT', async () => {
	shutdown(2);
});

const fileHanlder = (req, res) => hanlder(req, res, {
	public: 'www/',
	etag: true,
	directoryListing: false,
});

const createServerFn = (config.useHttps) ? createSecureServer : createServer;
const server = createServerFn({
	cert: readFileSync(config.cert),
	key: readFileSync(config.key),
	allowHTTP1: true,
});

const {
	HTTP2_HEADER_METHOD,
	HTTP2_HEADER_PATH,
} = h2constants;

server.on('stream', (stream, headers, flags, rawHeaders) => {
	const method = headers[HTTP2_HEADER_METHOD];
	const path = headers[HTTP2_HEADER_PATH];
	console.log('[h2][req]', method, path, stream.session.socket.remoteAddress, headers);
});

server.on('request', (req, res) => {
	console.log('[req]', req.url, req.socket.remoteAddress, req.headers);
	if (config.skipGz) delete req.headers['accept-encoding']; // skip gz

	// for wasm
	res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
	res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

	// Serve files!
	req.addListener('end', function () {
		fileHanlder(req, res);
	}).resume();
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
	const { pathname } = parse(req.url);

	if (pathname === '/ws') {
		wss.handleUpgrade(req, socket, head, (ws) => {
			wss.emit('connection', ws, req);
		});
	} else {
		socket.destroy();
	}
});

wss.on('connection', (ws, req) => {
	const addr = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
	console.log('[ws]', req.url, addr, req.headers);
	ws.on('error', console.error);

	ws.on('message', (data, isBinary) => {
		console.log('[ws][recv]', addr, data.toString());
		const msgObj = msgFilter(data.toString());
		if (!msgObj) return; // skip
		msgObj['t'] = Date.now();
		const out = JSON.stringify(msgObj);

		// add IP
		msgObj['ip'] = addr;

		// save to db
		saveLog(db, msgObj);

		wss.clients.forEach((client) => {
			if (client.readyState === WebSocket.OPEN) {
				// client.send(data, { binary: isBinary });
				client.send(out);
			}
		});
	});

	// send recent chat log
	sendLog(db, (msg) => {
		// console.log('[ws][log]', msg);
		ws.send(JSON.stringify(msg));
	});
});

function sendTime() {
	wss.clients.forEach((client) => {
		const now = Date.now();
		if (client.readyState === WebSocket.OPEN) {
			client.send(`${now}`);
		}
	});
	const t = setTimeout(sendTime, 10 * 1000);
}
// sendTime();

server.listen(8000);

function parseJSON(str) {
	try {
		return JSON.parse(str);
	}
	catch (e) {
		return null;
	}
}

function msgFilter(data) {
	const msgObj = parseJSON(data);
	if (!msgObj) return null;
	const {
		name = '',
		msg = '',
	} = msgObj;
	if (name.length == 0) return null;
	if (msg.length == 0) return null;

	// console.log('[filter]', name.length, name);
	const illegalName = name.match(/(adm[Iil1]n.*|r[Oo0][Oo0]t.*)+$/ig);
	if (!!illegalName) return null;

	return {
		name,
		msg,
	};
}
