import { getUserByEmail, type UserWithPasswordHash, verifyPassword } from './users';
import { SignJWT, jwtVerify } from 'jose';

export const AUTH_COOKIE_NAME = 'gip_auth_token';

export type SessionUser = {
    id: string;
    email: string;
    role: 'admin' | 'user';
};

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function getJwtSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET or AUTH_SECRET must be set in production.');
        }
        return new TextEncoder().encode('dev-only-change-me-secret');
    }
    return new TextEncoder().encode(secret);
}

export async function verifyAdminCredentials(email: string, password: string): Promise<SessionUser | null> {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) return null;
    if (normalizeEmail(email) !== adminEmail || password !== adminPassword) return null;

    return { id: 'admin', email: adminEmail, role: 'admin' };
}

export async function verifyUserCredentials(email: string, password: string): Promise<SessionUser | null> {
    const user = getUserByEmail(email, { includePasswordHash: true }) as UserWithPasswordHash | null;

    if (!user || user.disabled) return null;
    if (!(await verifyPassword(password, user.passwordHash))) return null;

    return { id: user.id, email: user.email, role: 'user' };
}

export async function verifyCredentials(email: string, password: string): Promise<SessionUser | null> {
    return (await verifyAdminCredentials(email, password)) ?? (await verifyUserCredentials(email, password));
}

export async function createSessionToken(user: SessionUser): Promise<string> {
    return new SignJWT({ email: user.email, role: user.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(user.id)
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(getJwtSecret());
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionUser | null> {
    if (!token) return null;

    try {
        const { payload } = await jwtVerify(token, getJwtSecret());
        const id = payload.sub;
        const email = payload.email;
        const role = payload.role;

        if (typeof id !== 'string' || typeof email !== 'string' || (role !== 'admin' && role !== 'user')) {
            return null;
        }

        return { id, email, role };
    } catch {
        return null;
    }
}

export function shouldUseSecureAuthCookie(request?: Request): boolean {
    if (process.env.AUTH_COOKIE_SECURE === 'true') return true;
    if (process.env.AUTH_COOKIE_SECURE === 'false') return false;
    if (process.env.NODE_ENV !== 'production') return false;

    const forwardedProto = request?.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
    if (forwardedProto) return forwardedProto === 'https';

    try {
        return request ? new URL(request.url).protocol === 'https:' : false;
    } catch {
        return false;
    }
}
