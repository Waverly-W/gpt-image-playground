'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import React from 'react';

type User = {
    id: string;
    email: string;
    name: string | null;
    role: 'user';
    disabled: boolean;
    createdAt: string;
    updatedAt: string;
};

type UserPatch = Partial<User> & { password?: string };

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
});

function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return dateFormatter.format(date);
}

export default function AdminPage() {
    const [users, setUsers] = React.useState<User[]>([]);
    const [registrationEnabled, setRegistrationEnabled] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [message, setMessage] = React.useState<string | null>(null);
    const [newEmail, setNewEmail] = React.useState('');
    const [newName, setNewName] = React.useState('');
    const [newPassword, setNewPassword] = React.useState('');
    const [query, setQuery] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'disabled'>('all');

    const activeUsers = users.filter((user) => !user.disabled);
    const disabledUsers = users.filter((user) => user.disabled);
    const recentlyUpdatedUsers = [...users]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 3);
    const normalizedQuery = query.trim().toLowerCase();
    const filteredUsers = users.filter((user) => {
        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'active' && !user.disabled) ||
            (statusFilter === 'disabled' && user.disabled);
        const matchesQuery =
            !normalizedQuery ||
            user.email.toLowerCase().includes(normalizedQuery) ||
            (user.name || '').toLowerCase().includes(normalizedQuery);
        return matchesStatus && matchesQuery;
    });

    const api = async (url: string, init?: RequestInit) => {
        const response = await fetch(url, {
            ...init,
            headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) {
            window.location.assign('/login');
            throw new Error(data.error || '未授权');
        }
        if (!response.ok) throw new Error(data.error || '请求失败');
        return data;
    };

    const load = React.useCallback(async () => {
        try {
            setError(null);
            const [usersData, settingsData] = await Promise.all([api('/api/admin/users'), api('/api/admin/settings')]);
            setUsers(usersData.users || []);
            setRegistrationEnabled(Boolean(settingsData.registrationEnabled));
        } catch (err) {
            setError(err instanceof Error ? err.message : '加载失败');
        }
    }, []);

    React.useEffect(() => {
        load();
    }, [load]);

    const createUser = async (event: React.FormEvent) => {
        event.preventDefault();
        try {
            setError(null);
            await api('/api/admin/users', {
                method: 'POST',
                body: JSON.stringify({ email: newEmail, name: newName, password: newPassword })
            });
            setNewEmail('');
            setNewName('');
            setNewPassword('');
            setMessage('用户已创建。');
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : '创建失败');
        }
    };

    const updateUser = async (user: User, patch: UserPatch) => {
        try {
            setError(null);
            await api(`/api/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
            setMessage('用户已更新。');
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : '更新失败');
        }
    };

    const deleteUser = async (user: User) => {
        if (!confirm(`确认删除 ${user.email}？`)) return;
        try {
            setError(null);
            await api(`/api/admin/users/${user.id}`, { method: 'DELETE' });
            setMessage('用户已删除。');
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : '删除失败');
        }
    };

    const toggleRegistration = async (enabled: boolean) => {
        try {
            setError(null);
            const data = await api('/api/admin/settings', {
                method: 'PATCH',
                body: JSON.stringify({ registrationEnabled: enabled })
            });
            setRegistrationEnabled(Boolean(data.registrationEnabled));
            setMessage(enabled ? '已开启注册。' : '已关闭注册。');
        } catch (err) {
            setError(err instanceof Error ? err.message : '设置失败');
        }
    };

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.assign('/login');
    };

    return (
        <main className='min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_32rem),#050505] p-4 text-white md:p-8'>
            <div className='mx-auto max-w-7xl space-y-6'>
                <div className='flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/30'>
                    <div>
                        <div className='mb-2 text-xs font-medium tracking-[0.3em] text-white/40 uppercase'>仪表盘</div>
                        <h1 className='text-3xl font-semibold'>管理员面板</h1>
                        <p className='mt-2 text-sm text-white/60'>管理普通用户、注册开关和账号状态。</p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        <Button
                            asChild
                            variant='outline'
                            className='border-white/20 bg-black/40 text-white hover:bg-white/10'>
                            <Link href='/'>返回应用</Link>
                        </Button>
                        <Button
                            onClick={logout}
                            variant='outline'
                            className='border-white/20 bg-black/40 text-white hover:bg-white/10'>
                            退出登录
                        </Button>
                    </div>
                </div>

                {error && (
                    <Alert variant='destructive' className='border-red-500/40 bg-red-950/40 text-red-100'>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                {message && (
                    <Alert className='border-emerald-500/30 bg-emerald-950/30 text-emerald-100'>
                        <AlertDescription>{message}</AlertDescription>
                    </Alert>
                )}

                <section className='grid gap-4 md:grid-cols-4'>
                    <StatCard label='用户总数' value={users.length} helper='数据库普通用户' />
                    <StatCard label='活跃用户' value={activeUsers.length} helper='可登录并生成图片' />
                    <StatCard label='已禁用' value={disabledUsers.length} helper='无法登录' />
                    <StatCard
                        label='注册状态'
                        value={registrationEnabled ? '开启' : '关闭'}
                        helper={registrationEnabled ? '允许新用户注册' : '暂停注册'}
                    />
                </section>

                <div className='grid gap-6 lg:grid-cols-[1fr_1.4fr]'>
                    <div className='space-y-6'>
                        <Card className='border-white/10 bg-white/[0.04] text-white'>
                            <CardHeader>
                                <CardTitle>系统设置</CardTitle>
                                <CardDescription className='text-white/60'>
                                    关闭后，普通用户不能自行注册。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className='space-y-4'>
                                <div className='flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4'>
                                    <div>
                                        <Label htmlFor='registration' className='text-base'>
                                            {registrationEnabled ? '启用注册' : '暂停注册'}
                                        </Label>
                                        <p className='mt-1 text-sm text-white/50'>管理员创建用户不受此开关影响。</p>
                                    </div>
                                    <Checkbox
                                        id='registration'
                                        checked={registrationEnabled}
                                        onCheckedChange={(checked) => toggleRegistration(Boolean(checked))}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className='border-white/10 bg-white/[0.04] text-white'>
                            <CardHeader>
                                <CardTitle>新增用户</CardTitle>
                                <CardDescription className='text-white/60'>创建后用户可立即登录。</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={createUser} className='space-y-3'>
                                    <Input
                                        placeholder='邮箱'
                                        type='email'
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        required
                                        className='border-white/20 bg-black/50 text-white'
                                    />
                                    <Input
                                        placeholder='名称，可选'
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className='border-white/20 bg-black/50 text-white'
                                    />
                                    <Input
                                        placeholder='初始密码'
                                        type='password'
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className='border-white/20 bg-black/50 text-white'
                                    />
                                    <Button type='submit' className='w-full bg-white text-black hover:bg-white/90'>
                                        创建用户
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className='border-white/10 bg-white/[0.04] text-white'>
                            <CardHeader>
                                <CardTitle>最近更新</CardTitle>
                                <CardDescription className='text-white/60'>最近被修改的 3 个账号。</CardDescription>
                            </CardHeader>
                            <CardContent className='space-y-3'>
                                {recentlyUpdatedUsers.map((user) => (
                                    <div key={user.id} className='rounded-xl border border-white/10 bg-black/30 p-3'>
                                        <div className='flex items-center justify-between gap-3'>
                                            <span className='truncate text-sm font-medium'>{user.email}</span>
                                            <StatusBadge disabled={user.disabled} />
                                        </div>
                                        <p className='mt-1 text-xs text-white/45'>
                                            更新于 {formatDate(user.updatedAt)}
                                        </p>
                                    </div>
                                ))}
                                {recentlyUpdatedUsers.length === 0 && (
                                    <p className='text-sm text-white/60'>暂无普通用户。</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card className='border-white/10 bg-white/[0.04] text-white'>
                        <CardHeader className='space-y-4'>
                            <div>
                                <CardTitle>用户列表</CardTitle>
                                <CardDescription className='text-white/60'>
                                    编辑资料、禁用账号、重置密码或删除用户。
                                </CardDescription>
                            </div>
                            <div className='grid gap-3 md:grid-cols-[1fr_auto]'>
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder='搜索邮箱或名称'
                                    className='border-white/20 bg-black/50 text-white'
                                />
                                <div className='flex rounded-lg border border-white/10 bg-black/40 p-1'>
                                    {(['all', 'active', 'disabled'] as const).map((filter) => (
                                        <button
                                            key={filter}
                                            type='button'
                                            onClick={() => setStatusFilter(filter)}
                                            className={`rounded-md px-3 py-1.5 text-sm transition ${
                                                statusFilter === filter
                                                    ? 'bg-white text-black'
                                                    : 'text-white/60 hover:text-white'
                                            }`}>
                                            {filter === 'all' ? '全部' : filter === 'active' ? '活跃' : '禁用'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className='space-y-3'>
                            {filteredUsers.map((user) => (
                                <UserRow key={user.id} user={user} onUpdate={updateUser} onDelete={deleteUser} />
                            ))}
                            {filteredUsers.length === 0 && (
                                <div className='rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/60'>
                                    没有匹配的用户。
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}

function StatCard({ label, value, helper }: { label: string; value: React.ReactNode; helper: string }) {
    return (
        <Card className='border-white/10 bg-white/[0.04] text-white'>
            <CardContent className='p-5'>
                <div className='text-sm text-white/50'>{label}</div>
                <div className='mt-2 text-3xl font-semibold'>{value}</div>
                <div className='mt-1 text-xs text-white/40'>{helper}</div>
            </CardContent>
        </Card>
    );
}

function StatusBadge({ disabled }: { disabled: boolean }) {
    return (
        <span
            className={`shrink-0 rounded-full px-2 py-1 text-xs ${
                disabled ? 'bg-red-500/15 text-red-200' : 'bg-emerald-500/15 text-emerald-200'
            }`}>
            {disabled ? '已禁用' : '活跃'}
        </span>
    );
}

function UserRow({
    user,
    onUpdate,
    onDelete
}: {
    user: User;
    onUpdate: (user: User, patch: UserPatch) => void;
    onDelete: (user: User) => void;
}) {
    const [email, setEmail] = React.useState(user.email);
    const [name, setName] = React.useState(user.name || '');
    const [password, setPassword] = React.useState('');

    React.useEffect(() => {
        setEmail(user.email);
        setName(user.name || '');
        setPassword('');
    }, [user]);

    const hasProfileChanges = email !== user.email || name !== (user.name || '');

    return (
        <div className='rounded-2xl border border-white/10 bg-black/35 p-4'>
            <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
                <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                        <p className='truncate font-medium'>{user.email}</p>
                        <StatusBadge disabled={user.disabled} />
                    </div>
                    <p className='mt-1 text-xs text-white/45'>
                        创建于 {formatDate(user.createdAt)} · 更新于 {formatDate(user.updatedAt)}
                    </p>
                </div>
                <label className='flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm'>
                    <Checkbox
                        checked={user.disabled}
                        onCheckedChange={(checked) => onUpdate(user, { disabled: Boolean(checked) })}
                    />
                    禁用账号
                </label>
            </div>

            <div className='grid gap-3 md:grid-cols-2'>
                <div className='space-y-1.5'>
                    <Label>邮箱</Label>
                    <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className='border-white/20 bg-black/50 text-white'
                    />
                </div>
                <div className='space-y-1.5'>
                    <Label>名称</Label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder='名称'
                        className='border-white/20 bg-black/50 text-white'
                    />
                </div>
            </div>

            <div className='mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end'>
                <div className='space-y-1.5'>
                    <Label>重置密码</Label>
                    <Input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder='输入新密码，至少 6 位'
                        type='password'
                        minLength={6}
                        className='border-white/20 bg-black/50 text-white'
                    />
                </div>
                <Button
                    variant='outline'
                    className='border-white/20 bg-black text-white hover:bg-white/10'
                    disabled={!hasProfileChanges && !password}
                    onClick={() => onUpdate(user, { email, name, ...(password ? { password } : {}) })}>
                    {password ? '保存并重置密码' : '保存资料'}
                </Button>
                <Button variant='destructive' onClick={() => onDelete(user)}>
                    删除
                </Button>
            </div>
        </div>
    );
}
