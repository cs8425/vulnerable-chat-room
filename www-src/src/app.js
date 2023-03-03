import { h, Fragment, render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';

import {
	useWs,
	ReadyState,
} from './ws.js';

import {
	MsgLog,
} from './MsgLog.jsx';

// import css
import './bulma.min.css';
import './all.min.css';

function App() {
	const msgRef = useRef(null);
	const nameRef = useRef(null);
	const https = location.protocol === 'https:';
	const [wsURL, setWsURL] = useState(`${(https) ? 'wss' : 'ws'}://${location.host}/ws`);
	const {
		sendMsg,
		lastMsg,
		readyState,
		getWebSocket,
	} = useWs(wsURL);

	const state2btn = {
		[ReadyState.CONNECTING]: ['connecting', true, ''],
		[ReadyState.OPEN]: ['connected', false, 'close'],
		[ReadyState.CLOSING]: ['closing', true, ''],
		[ReadyState.CLOSED]: ['closed', false, 'connect'],
	};
	const connBtnFn = (e) => {
		switch (readyState) {
			case ReadyState.CLOSED:
				const wsURL0 = wsURL;
				setWsURL(null);
				setTimeout(() => {
					setWsURL(wsURL0);
				}, 100);
				break;
			case ReadyState.OPEN:
				getWebSocket()?.close();
				break;
		}
	};

	const send = (e) => {
		console.log('[send]', e, nameRef.current?.value, msgRef.current?.value);
		if (msgRef.current === null || nameRef.current === null) return;
		const name = nameRef.current?.value;
		const msg = msgRef.current?.value;
		if (name === '') {
			alert('please set your name!');
			return;
		}
		if (msg === '') return;
		sendMsg(JSON.stringify({
			name: name,
			msg: msg,
		}));
		msgRef.current.value = '';
	}
	const handleInput = (e) => {
		if (!e.shiftKey && e.key === 'Enter') send();
	};

	return (
		<section class="section">
			<div class="container is-fluid">
				<h1 class="title">
					Simple Chat Room
				</h1>
				<p class="subtitle">
					chat room for <strong>test</strong> only!
				</p>
				<hr />

				<div class="field has-addons">
					<p class="control">
						<a class="button is-static">state</a>
					</p>
					<div class="control">
						<input class="input" type="text" value={state2btn[readyState][0]} readOnly />
					</div>
					<div class="control">
						<a class={`button is-info ${(state2btn[readyState][1]) ? 'is-loading' : ''}`} onClick={connBtnFn}>{state2btn[readyState][2]}</a>
					</div>
				</div>
				<div class="field has-addons">
					<div class="control">
						<input
							class="input"
							type="text"
							placeholder="name..."
							ref={nameRef}
						/>
					</div>
					<div class="control is-expanded">
						<input
							class="input"
							type="text"
							placeholder="message to send..."
							ref={msgRef}
							onKeyup={handleInput}
						/>
					</div>
					<div class="control">
						<button
							class="button is-primary"
							onClick={send}
						>send</button>
					</div>
				</div>
				<article class="message">
					<div class="message-header">
						<p>raw msg</p>
					</div>
					<div class="message-body">{lastMsg?.data}</div>
				</article>
				<hr />
				<MsgLog lastMsg={lastMsg} />

			</div>
		</section>
	);
}

render(h(App), document.getElementById('app'));
