import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const openDb = async (path) => {
	const db = await open({
		filename: path,
		driver: sqlite3.cached.Database,
		mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
	});
	// db.run('PRAGMA journal_mode = WAL;');
	db.run('PRAGMA journal_mode = MEMORY;');
	// return db;
	return await initDb(db);
};
export { openDb };

// create table if not exist
async function initDb(db) {
	await db.run(`
CREATE TABLE IF NOT EXISTS user (
	uid INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE,
	salt TEXT NOT NULL,
	hash TEXT NOT NULL,
	algo INTEGER NOT NULL DEFAULT 0
);`);

	await db.run(`
CREATE TABLE IF NOT EXISTS chat_log (
	id INTEGER NOT NULL PRIMARY KEY,
	ts INTEGER NOT NULL,
	ip TEXT NOT NULL,
	uuid INTEGER NOT NULL DEFAULT 0,
	name TEXT NOT NULL,
	msg TEXT NOT NULL
);`);

	return db;
};

const saveLog = async (db, msgObj) => {
	try {
		await db.exec(`
INSERT INTO chat_log (
	ts,
	ip,
	name,
	msg
) VALUES (
	${msgObj.t},
	'${msgObj.ip}',
	'${msgObj.name}',
	'${msgObj.msg}'
);`);
	}
	catch (e) {
		console.log('[db][saveLog]', msgObj, e);
	}
	return db;
}
export { saveLog };

const sendLog = async (db, rowFn) => {
	try {
		const t0 = Date.now() - 30 * 60 * 1000; // 30 minutes
		const max = 20;
		await db.each(`
WITH log AS (
	SELECT
		ts,
		ip,
		name,
		msg
	FROM
		chat_log
	WHERE
		ts >= ${t0}
	ORDER BY
		ts DESC
	LIMIT ${max}
)
SELECT * FROM log ORDER BY ts ASC;`, (err, row) => {
			console.log('[db][chat]', err, row);
			if (err) {
				console.log('[db][log]err', err, row);
				return;
			}
			rowFn({
				name: row.name,
				msg: row.msg,
				t: row.ts,
			});
		});
	}
	catch (e) {
		console.log('[db][sendLog]', msgObj, e);
	}
	return db;
};
export { sendLog };
