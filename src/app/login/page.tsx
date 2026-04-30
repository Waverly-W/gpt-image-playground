'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import React from 'react';

const authErrorLabels: Record<string, string> = {
    'Email and password are required.': '请输入邮箱和密码。',
    'Invalid email or password.': '邮箱或密码无效。',
    'Authentication is not configured on the server.': '服务器未配置认证。',
    'Login failed.': '登录失败。'
};

const localizeAuthError = (message: string | undefined) => {
    if (!message) return '登录失败。';
    return authErrorLabels[message] ?? message;
};

export default function LoginPage() {
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const bodyText = await response.text();
            let data: { error?: string; user?: { role?: string } } = {};
            try {
                data = bodyText ? JSON.parse(bodyText) : {};
            } catch {
                data = {};
            }
            if (!response.ok) throw new Error(localizeAuthError(data.error));

            const targetPath = data.user?.role === 'admin' ? '/admin' : '/';
            window.location.assign(targetPath);
        } catch (err) {
            setError(err instanceof Error ? localizeAuthError(err.message) : '登录失败。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className='flex min-h-screen items-center justify-center bg-black p-4 text-white'>
            <Card className='w-full max-w-md border-white/10 bg-white/5 text-white'>
                <CardHeader>
                    <CardTitle>登录</CardTitle>
                    <CardDescription className='text-white/60'>登录后使用 GPT Image Playground。</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className='space-y-4'>
                        {error && (
                            <Alert variant='destructive'>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <div className='space-y-2'>
                            <Label htmlFor='email'>邮箱</Label>
                            <Input
                                id='email'
                                type='email'
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                                className='border-white/20 bg-black text-white'
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='password'>密码</Label>
                            <Input
                                id='password'
                                type='password'
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                                className='border-white/20 bg-black text-white'
                            />
                        </div>
                        <Button
                            type='submit'
                            disabled={loading}
                            className='w-full bg-white text-black hover:bg-white/90'>
                            {loading ? '登录中...' : '登录'}
                        </Button>
                        <p className='text-center text-sm text-white/60'>
                            没有账号？{' '}
                            <Link href='/register' className='text-white underline'>
                                注册
                            </Link>
                        </p>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
