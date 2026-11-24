module.exports = [
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:crypto [external] (node:crypto, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:crypto", () => require("node:crypto"));

module.exports = mod;
}),
"[project]/app/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {
__turbopack_context__.s([
    "default",
    ()=>Home
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/auth.ts [app-rsc] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
async function Home() {
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["currentUser"])() ? '/dashboard' : '/login');
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/app/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", (function(__turbopack_context__){

__turbopack_context__.n(__turbopack_context__.i("[project]/app/page.tsx [app-rsc] (ecmascript)"));
}),
"[project]/lib/auth.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {
__turbopack_context__.s([
    "FLASH_COOKIE",
    ()=>FLASH_COOKIE,
    "canManageDept",
    ()=>canManageDept,
    "createSession",
    ()=>createSession,
    "currentUser",
    ()=>currentUser,
    "deny",
    ()=>deny,
    "deptScope",
    ()=>deptScope,
    "destroySession",
    ()=>destroySession,
    "flash",
    ()=>flash,
    "requireRole",
    ()=>requireRole,
    "requireUser",
    ()=>requireUser,
    "takeFlash",
    ()=>takeFlash
]);
/**
 * Login sessions, flash messages, and role-based access control.
 *
 * At login the server makes a random token and puts it in an httpOnly cookie. The database keeps
 * only the token's SHA-256 hash, so a copy of the database cannot be used to log in.
 * Sessions expire after 8 hours without activity.
 */ var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/db.ts [app-rsc] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
;
;
const COOKIE = 'classsched_session';
const LIFETIME = "interval '8 hours'";
function hashToken(token) {
    return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHash"])('sha256').update(token).digest('hex');
}
async function sessionId() {
    const token = (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])()).get(COOKIE)?.value;
    return token && /^[0-9a-f]{64}$/.test(token) ? hashToken(token) : null;
}
async function createSession(userId) {
    const token = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomBytes"])(32).toString('hex');
    await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].exec(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sql"]`INSERT INTO sessions (id, user_id, expires_at)
                    VALUES (${hashToken(token)}, ${userId}, NOW() + ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["raw"])(LIFETIME)})`);
    // Clean up expired sessions now and then.
    if (Math.random() < 0.05) await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].exec(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sql"]`DELETE FROM sessions WHERE expires_at < NOW()`);
    const secure = (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["headers"])()).get('x-forwarded-proto') === 'https';
    (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])()).set(COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/'
    });
}
async function destroySession() {
    const id = await sessionId();
    if (id) await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].exec(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sql"]`DELETE FROM sessions WHERE id = ${id}`);
    (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])()).delete(COOKIE);
}
const currentUser = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cache"])(async ()=>{
    const id = await sessionId();
    if (!id) return null;
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["db"].row(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sql"]`
    UPDATE sessions s SET expires_at = NOW() + ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["raw"])(LIFETIME)}
    FROM users u
    WHERE s.id = ${id} AND s.expires_at > NOW() AND u.id = s.user_id AND u.is_active
    RETURNING u.*`);
});
async function requireUser() {
    const user = await currentUser();
    if (!user) (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])('/login');
    return user;
}
async function requireRole(...roles) {
    const user = await requireUser();
    if (!roles.includes(user.role)) (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])('/denied');
    return user;
}
function deptScope(user) {
    return user.role === 'chair' ? user.department_id : null;
}
function canManageDept(user, departmentId) {
    if (user.role === 'admin') return true;
    return user.role === 'chair' && departmentId != null && Number(departmentId) === user.department_id;
}
const FLASH_COOKIE = 'classsched_flash';
function readFlash(value) {
    try {
        const list = JSON.parse(decodeURIComponent(value ?? '[]'));
        return Array.isArray(list) ? list.filter((f)=>typeof f?.message === 'string').slice(-10) : [];
    } catch  {
        return [];
    }
}
async function flash(message, type = 'success') {
    const store = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])();
    const list = [
        ...readFlash(store.get(FLASH_COOKIE)?.value),
        {
            message,
            type
        }
    ];
    store.set(FLASH_COOKIE, encodeURIComponent(JSON.stringify(list)), {
        path: '/',
        sameSite: 'lax',
        maxAge: 60
    });
}
async function takeFlash() {
    return readFlash((await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])()).get(FLASH_COOKIE)?.value);
}
async function deny() {
    await flash('You are not allowed to do that.', 'error');
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])('/dashboard');
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/lib/db.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {
__turbopack_context__.s([
    "Sql",
    ()=>Sql,
    "db",
    ()=>db,
    "isConstraintError",
    ()=>isConstraintError,
    "join",
    ()=>join,
    "raw",
    ()=>raw,
    "sql",
    ()=>sql,
    "transaction",
    ()=>transaction
]);
/**
 * PostgreSQL access.
 *
 * Queries are written with the `sql` tag:   db.rows(sql`SELECT * FROM users WHERE id = ${id}`)
 * Every ${value} becomes a numbered parameter ($1, $2, ...), never pasted into the text,
 * so user input cannot change the query (no SQL injection).
 */ var __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$pg$29$__ = __turbopack_context__.i("[externals]/pg [external] (pg, esm_import, [project]/node_modules/pg)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$pg$29$__
]);
[__TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$pg$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
// Return NUMERIC and COUNT(*) results as JavaScript numbers instead of strings.
__TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$pg$29$__["types"].setTypeParser(1700, (v)=>parseFloat(v));
__TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$pg$29$__["types"].setTypeParser(20, (v)=>parseInt(v, 10));
class Sql {
    strings;
    values;
    constructor(strings, values){
        this.strings = strings;
        this.values = values;
    }
}
function sql(strings, ...values) {
    return new Sql(strings, values);
}
function raw(text) {
    return new Sql([
        text
    ], []);
}
function join(parts, separator = ', ') {
    if (parts.length === 0) return raw('');
    return new Sql([
        '',
        ...Array(parts.length - 1).fill(separator),
        ''
    ], parts);
}
function compile(q, values) {
    let text = q.strings[0];
    q.values.forEach((value, i)=>{
        if (value instanceof Sql) {
            text += compile(value, values);
        } else {
            values.push(value);
            text += '$' + values.length;
        }
        text += q.strings[i + 1];
    });
    return text;
}
// ---------- Connection pool ----------
const globalForPg = globalThis;
function getPool() {
    if (!globalForPg.pgPool) {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL is not set. Add it to .env.local, or to the Environment Variables of your Vercel project.');
        }
        globalForPg.pgPool = new __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$2c$__$5b$project$5d2f$node_modules$2f$pg$29$__["Pool"]({
            connectionString: process.env.DATABASE_URL,
            max: 5,
            idleTimeoutMillis: 10_000
        });
    }
    return globalForPg.pgPool;
}
function makeDb(getClient) {
    async function rows(q) {
        const values = [];
        const text = compile(q, values);
        const result = await getClient().query(text, values);
        return result.rows;
    }
    async function row(q) {
        return (await rows(q))[0] ?? null;
    }
    async function val(q) {
        const r = await row(q);
        return r ? Object.values(r)[0] : null;
    }
    async function exec(q) {
        const values = [];
        const text = compile(q, values);
        const result = await getClient().query(text, values);
        return result.rowCount ?? 0;
    }
    /** Rows as { id: label } pairs, for <select> lists. */ async function pairs(q) {
        return (await rows(q)).map((r)=>{
            const [k, v] = Object.values(r);
            return [
                k,
                String(v)
            ];
        });
    }
    return {
        rows,
        row,
        val,
        exec,
        pairs
    };
}
const db = makeDb(getPool);
async function transaction(fn) {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const result = await fn(makeDb(()=>client));
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally{
        client.release();
    }
}
function isConstraintError(err) {
    const code = err?.code;
    return code === '23505' || code === '23503';
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1sqkhpa2__uds._.js.map