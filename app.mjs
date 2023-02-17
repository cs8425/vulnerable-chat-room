import { readFileSync } from 'fs';
import { parse } from 'url';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import hanlder from 'serve-handler';
import { time } from 'console';

const config = {
	skipGz: true,
};

const fileHanlder = (req, res) => hanlder(req, res, {
	public: 'www/',
	etag: true,
	directoryListing: false,
});

const server = createServer({
	// cert: readFileSync('/path/to/server.crt'),
	// key: readFileSync('/path/to/server.key'),
});

server.on('request', (req, res) => {
	console.log('[req]', req.url, req.socket.remoteAddress, req.headers);
	if (config.skipGz) delete req.headers['accept-encoding']; // skip gz

	// ffmpeg-wasm
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
	console.log('[ws]', req.url, req.socket.remoteAddress, req.headers);
	ws.on('error', console.error);

	ws.on('message', (data, isBinary) => {
		console.log('[recv]', req.socket.remoteAddress, data.toString());
		const msgObj = msgFilter(data.toString());
		if (!msgObj) return; // skip
		msgObj['t'] = Date.now();
		const out = JSON.stringify(msgObj);

		wss.clients.forEach((client) => {
			if (client.readyState === WebSocket.OPEN) {
				// client.send(data, { binary: isBinary });
				client.send(out);
			}
		});
	});

	// ws.send('something');
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
