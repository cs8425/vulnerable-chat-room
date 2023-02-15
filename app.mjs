import { readFileSync } from 'fs';
import { parse } from 'url';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import hanlder from 'serve-handler';

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

	// res.writeHead(200, { 'Content-Type': 'application/json' });
	// res.end(JSON.stringify({
	// 	data: 'Hello World!',
	// }));

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
		console.log('received: %s', data);
	});

	ws.send('something');
});

server.listen(8000);
