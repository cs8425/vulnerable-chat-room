import { h, Fragment } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';

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
export { MsgBox };

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
export { MsgLog };
