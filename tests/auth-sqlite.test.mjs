import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

process.env.NODE_ENV = 'test';

const dbPath = path.join(tmpdir(), `gpt-image-playground-auth-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
process.env.SQLITE_DB_PATH = dbPath;
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.ADMIN_PASSWORD = 'admin-secret';
process.env.JWT_SECRET = 'test-secret-long-enough-for-signing';

const auth = await import('../src/lib/auth.ts');
const settings = await import('../src/lib/settings.ts');
const users = await import('../src/lib/users.ts');
const db = await import('../src/lib/sqlite-db.ts');

test.after(() => {
    db.closeDbForTests?.();
    if (existsSync(dbPath)) rmSync(dbPath, { force: true });
});

test('settings default registration is enabled and can be disabled', () => {
    assert.equal(settings.isRegistrationEnabled(), true);
    settings.setRegistrationEnabled(false);
    assert.equal(settings.isRegistrationEnabled(), false);
    settings.setRegistrationEnabled(true);
    assert.equal(settings.isRegistrationEnabled(), true);
});

test('creates user with bcrypt hash and authenticates enabled users only', async () => {
    const created = await users.createUser({ email: 'User@Example.com', name: 'Test User', password: 'pass-1234' });

    assert.equal(created.email, 'user@example.com');
    assert.equal(created.name, 'Test User');
    assert.equal(created.role, 'user');
    assert.equal(created.disabled, false);
    assert.equal('passwordHash' in created, false);

    const row = users.getUserByEmail('user@example.com', { includePasswordHash: true });
    assert.ok(row?.passwordHash);
    assert.notEqual(row.passwordHash, 'pass-1234');
    assert.match(row.passwordHash, /^\$2[aby]\$/);

    const authed = await auth.verifyUserCredentials('USER@example.com', 'pass-1234');
    assert.equal(authed?.email, 'user@example.com');

    assert.equal(await auth.verifyUserCredentials('user@example.com', 'wrong'), null);

    users.updateUser(created.id, { disabled: true });
    assert.equal(await auth.verifyUserCredentials('user@example.com', 'pass-1234'), null);
});

test('admin credentials come from environment and are not stored in database', async () => {
    const admin = await auth.verifyAdminCredentials('admin@example.com', 'admin-secret');

    assert.equal(admin?.role, 'admin');
    assert.equal(admin?.email, 'admin@example.com');
    assert.equal(admin?.id, 'admin');
    assert.equal(users.getUserByEmail('admin@example.com'), null);
    assert.equal(await auth.verifyAdminCredentials('admin@example.com', 'bad'), null);
});

test('user CRUD supports list update reset password and delete', async () => {
    const created = await users.createUser({ email: 'crud@example.com', password: 'old-password' });

    assert.ok(users.listUsers().some((user) => user.email === 'crud@example.com'));

    const updated = users.updateUser(created.id, { email: 'crud2@example.com', name: 'Renamed', disabled: true });
    assert.equal(updated.email, 'crud2@example.com');
    assert.equal(updated.name, 'Renamed');
    assert.equal(updated.disabled, true);

    await users.resetUserPassword(created.id, 'new-password');
    users.updateUser(created.id, { disabled: false });
    assert.equal((await auth.verifyUserCredentials('crud2@example.com', 'new-password'))?.id, created.id);
    assert.equal(await auth.verifyUserCredentials('crud2@example.com', 'old-password'), null);

    assert.equal(users.deleteUser(created.id), true);
    assert.equal(users.getUserById(created.id), null);
});

test('JWT session round trip preserves id email and role', async () => {
    const token = await auth.createSessionToken({ id: 'u_123', email: 'jwt@example.com', role: 'user' });
    const session = await auth.verifySessionToken(token);

    assert.equal(session?.id, 'u_123');
    assert.equal(session?.email, 'jwt@example.com');
    assert.equal(session?.role, 'user');
});

test('JWT secret is required in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalJwtSecret = process.env.JWT_SECRET;
    const originalAuthSecret = process.env.AUTH_SECRET;

    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    delete process.env.AUTH_SECRET;

    await assert.rejects(
        () => auth.createSessionToken({ id: 'u_secret', email: 'secret@example.com', role: 'user' }),
        /JWT_SECRET or AUTH_SECRET must be set in production/
    );

    process.env.NODE_ENV = originalNodeEnv;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    if (originalAuthSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalAuthSecret;
});

test('auth cookie is not marked secure for plain HTTP even when NODE_ENV is production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalOverride = process.env.AUTH_COOKIE_SECURE;

    process.env.NODE_ENV = 'production';
    delete process.env.AUTH_COOKIE_SECURE;

    assert.equal(auth.shouldUseSecureAuthCookie(new Request('http://wsl:3000/api/auth/login')), false);
    assert.equal(auth.shouldUseSecureAuthCookie(new Request('https://example.com/api/auth/login')), true);

    process.env.AUTH_COOKIE_SECURE = 'true';
    assert.equal(auth.shouldUseSecureAuthCookie(new Request('http://wsl:3000/api/auth/login')), true);

    process.env.AUTH_COOKIE_SECURE = 'false';
    assert.equal(auth.shouldUseSecureAuthCookie(new Request('https://example.com/api/auth/login')), false);

    process.env.NODE_ENV = originalNodeEnv;
    if (originalOverride === undefined) {
        delete process.env.AUTH_COOKIE_SECURE;
    } else {
        process.env.AUTH_COOKIE_SECURE = originalOverride;
    }
});
