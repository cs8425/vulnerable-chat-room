import { h, Fragment, render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';

import { useWs } from './ws.js';

// import css
import './bulma.min.css';
import './all.min.css';

function App() {
	const [count, setCount] = useState(0);
	const msgRef = useRef(null);
	const nameRef = useRef(null);
	const {
		sendMsg,
		lastMsg,
		readyState,
		getWebSocket,
	} = useWs(`ws://${location.host}/ws`);

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

				<button class="button is-medium" onClick={() => setCount(count + 1)}>
					<span class="icon">
						<i class="fab fa-github"></i>
					</span>
					<span>GitHub click:{count}</span>
				</button>
				<hr />

				<div>
					state: {readyState}
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
				<div>
					raw msg: {lastMsg?.data}
				</div>
				<hr />
				<MsgLog lastMsg={lastMsg} />

			</div>
		</section>
	);
}

render(h(App), document.getElementById('app'));

function MsgLog(props) {
	const {
		lastMsg,
	} = props;
	const [_, update] = useState(0);
	const history = useRef((lastMsg !== null) ? [lastMsg] : []);
	useEffect(() => {
		if (lastMsg !== null) {
			const msgObj = JSON.parse(lastMsg.data);
			history.current.unshift(msgObj);
			update((v) => v + 1);
		}
	}, [lastMsg]);

	const ele = history.current?.map((v, i) => {
		// return (<p>{v}</p>);
		return (<MsgBox msg={v.msg} user={v.name} time={v.t} />);
	});
	return (<div>
		{ele}
	</div>);
}

function MsgBox(props) {
	const {
		user,
		msg,
		time,
	} = props;
	const eleRef = useRef(null);
	useEffect(() => {
		if (!eleRef.current) return;
		// eleRef.current.innerHTML = `${user}: ${msg} @${(new Date(time)).toLocaleTimeString()}`;
		eleRef.current.innerHTML = `${msg}`;
	}, [
		eleRef.current,
		user,
		msg,
		time,
	]);
	return (<div class="columns" style="border-top-style: solid;border-top-width: 1px;border-top-color: #aaa;">
		<div class="column is-1">{user}</div>
		<div class="column" ref={eleRef}></div>
		<div class="column is-1">{(new Date(time)).toLocaleTimeString()}</div>
	</div>);
}
