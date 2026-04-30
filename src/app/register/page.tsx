'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';

const registrationErrorLabels: Record<string, string> = {
    'Registration is disabled.': '注册已关闭。',
    'Email and password are required.': '请输入邮箱和密码。',
    'Registration failed.': '注册失败。'
};

const localizeRegistrationError = (message: string | undefined) => {
    if (!message) return '注册失败。';
    return registrationErrorLabels[message] ?? message;
};

export default function RegisterPage() {
    const router = useRouter();
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);

        if (password !== confirmPassword) {
            setError('两次输入的密码不一致。');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(localizeRegistrationError(data.error));
            setSuccess('注册成功，请登录。');
            setTimeout(() => router.push('/login'), 700);
        } catch (err) {
            setError(err instanceof Error ? localizeRegistrationError(err.message) : '注册失败。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className='flex min-h-screen items-center justify-center bg-black p-4 text-white'>
            <Card className='w-full max-w-md border-white/10 bg-white/5 text-white'>
                <CardHeader>
                    <CardTitle>注册</CardTitle>
                    <CardDescription className='text-white/60'>创建普通用户账号。</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className='space-y-4'>
                        {error && (
                            <Alert variant='destructive'>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        {success && (
                            <Alert>
                                <AlertDescription>{success}</AlertDescription>
                            </Alert>
                        )}
                        <div className='space-y-2'>
                            <Label htmlFor='name'>名称，可选</Label>
                            <Input
                                id='name'
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                className='border-white/20 bg-black text-white'
                            />
                        </div>
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
                                minLength={6}
                                className='border-white/20 bg-black text-white'
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='confirmPassword'>确认密码</Label>
                            <Input
                                id='confirmPassword'
                                type='password'
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                required
                                minLength={6}
                                className='border-white/20 bg-black text-white'
                            />
                        </div>
                        <Button
                            type='submit'
                            disabled={loading}
                            className='w-full bg-white text-black hover:bg-white/90'>
                            {loading ? '注册中...' : '注册'}
                        </Button>
                        <p className='text-center text-sm text-white/60'>
                            已有账号？{' '}
                            <Link href='/login' className='text-white underline'>
                                登录
                            </Link>
                        </p>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
