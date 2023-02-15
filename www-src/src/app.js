import { h, Fragment, render } from 'preact';
import { useState, useRef } from 'preact/hooks';

// import css
import './bulma.min.css';
import './all.min.css';

function App() {
	const [count, setCount] = useState(0);

	return (
		<section class="section">
			<div class="container">
				<h1 class="title">
					Hello World
				</h1>
				<p class="subtitle">
					My first chat room with <strong>Bulma</strong>!
				</p>

				<button class="button is-medium" onClick={() => setCount(count+1)}>
					<span class="icon">
						<i class="fab fa-github"></i>
					</span>
					<span>GitHub click:{count}</span>
				</button>
			</div>
		</section>
	);
}

render(h(App), document.getElementById('app'));
