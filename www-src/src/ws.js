import { useEffect, useRef, useState, useCallback } from "preact/hooks";

const ReadyState = {
	CONNECTING: 0,
	OPEN: 1,
	CLOSING: 2,
	CLOSED: 3,
};
Object.freeze(ReadyState);

function useWs(endpoint) {
	const webSocketRef = useRef(null);
	const [lastMsg, setLastMsg] = useState(null);
	const [readyState, setReadyState] = useState(ReadyState.CONNECTING);

	const getWebSocket = useCallback(() => {
		return webSocketRef.current;
	}, []);

	const sendMsg = useCallback((message) => {
		if (webSocketRef.current?.readyState === ReadyState.OPEN) {
			webSocketRef.current.send(message);
		}
	}, []);

	useEffect(() => {
		if (endpoint === null) return;
		const ws = new WebSocket(endpoint);

		// bind event
		ws.onopen = (ev) => {
			console.log('[ws]open', ws, ev);
			setReadyState(ReadyState.OPEN);
		};
		ws.onclose = (ev) => {
			console.log('[ws]close', ws, ev);
			setReadyState(ReadyState.CLOSED);
		}
		ws.onmessage = (msg) => {
			console.log('[ws]', ws, msg);
			setLastMsg(msg);
		};
		ws.onerror = (err) => {
			console.log('[ws]err', ws, err);
			setReadyState(ReadyState.CLOSED);
			ws.close();
		}

		webSocketRef.current = ws;

		return () => {
			if (webSocketRef.current) webSocketRef.current = null;
			setLastMsg(null);
		};
	}, [endpoint]);

	return {
		sendMsg,
		lastMsg,
		readyState,
		getWebSocket,
	};
}
export { useWs, ReadyState };
