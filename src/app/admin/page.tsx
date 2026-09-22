'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

type RuntimeSettings = {
    openaiApiKey: string;
    openaiBaseUrl: string;
    imageStorageMode: '' | 'fs' | 'indexeddb' | 'r2';
    r2AccountId: string;
    r2AccessKeyId: string;
    r2SecretAccessKey: string;
    r2Bucket: string;
    r2Endpoint: string;
    r2PublicBaseUrl: string;
    authCookieSecure: 'auto' | 'true' | 'false';
    registrationEnabled: boolean;
};

type PromptTemplateSyncStatus = {
    status: 'idle' | 'running' | 'completed' | 'failed';
    completed: number;
    total: number;
    uploaded: number;
    existing: number;
    skipped: number;
    currentFilename: string | null;
    error: string | null;
    startedAt: string | null;
    finishedAt: string | null;
};

type ManagedModel = {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    isDefault: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
};

const MODEL_RATES_HINT: Record<string, string> = {
    'gpt-image-2': '文本输入: $5/1M · 图像输入: $8/1M · 图像输出: $30/1M',
    'gpt-image-1.5': '文本输入: $5/1M · 图像输入: $8/1M · 图像输出: $32/1M',
    'gpt-image-1': '文本输入: $5/1M · 图像输入: $10/1M · 图像输出: $40/1M',
    'gpt-image-1-mini': '文本输入: $2/1M · 图像输入: $2.5/1M · 图像输出: $8/1M'
};

const BUILTIN_MODEL_IDS = new Set(['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini']);

const emptyRuntimeSettings: RuntimeSettings = {
    openaiApiKey: '',
    openaiBaseUrl: '',
    imageStorageMode: '',
    r2AccountId: '',
    r2AccessKeyId: '',
    r2SecretAccessKey: '',
    r2Bucket: '',
    r2Endpoint: '',
    r2PublicBaseUrl: '',
    authCookieSecure: 'auto',
    registrationEnabled: true
};

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
    const [activeTab, setActiveTab] = React.useState<'users' | 'models'>('users');
    const [users, setUsers] = React.useState<User[]>([]);
    const [models, setModels] = React.useState<ManagedModel[]>([]);
    const [registrationEnabled, setRegistrationEnabled] = React.useState(true);
    const [runtimeSettings, setRuntimeSettings] = React.useState<RuntimeSettings>(emptyRuntimeSettings);
    const [isSavingSettings, setIsSavingSettings] = React.useState(false);
    const [isTestingR2, setIsTestingR2] = React.useState(false);
    const [isSyncingPromptTemplates, setIsSyncingPromptTemplates] = React.useState(false);
    const [promptTemplateSyncStatus, setPromptTemplateSyncStatus] = React.useState<PromptTemplateSyncStatus | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [message, setMessage] = React.useState<string | null>(null);

    // User management state
    const [newEmail, setNewEmail] = React.useState('');
    const [newName, setNewName] = React.useState('');
    const [newPassword, setNewPassword] = React.useState('');
    const [query, setQuery] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'disabled'>('all');

    // Model management state
    const [modelQuery, setModelQuery] = React.useState('');
    const [modelStatusFilter, setModelStatusFilter] = React.useState<'all' | 'enabled' | 'disabled'>('all');
    const [showCreateModel, setShowCreateModel] = React.useState(false);
    const [newModelId, setNewModelId] = React.useState('');
    const [newModelName, setNewModelName] = React.useState('');
    const [newModelDescription, setNewModelDescription] = React.useState('');
    const [newModelSortOrder, setNewModelSortOrder] = React.useState('0');
    const [newModelEnabled, setNewModelEnabled] = React.useState(true);
    const [newModelIsDefault, setNewModelIsDefault] = React.useState(false);
    const [isSubmittingModel, setIsSubmittingModel] = React.useState(false);

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

    const enabledModels = models.filter((m) => m.enabled);
    const disabledModels = models.filter((m) => !m.enabled);
    const currentDefaultModel = models.find((m) => m.isDefault);
    const normalizedModelQuery = modelQuery.trim().toLowerCase();
    const filteredModels = models.filter((m) => {
        const matchesStatus =
            modelStatusFilter === 'all' ||
            (modelStatusFilter === 'enabled' && m.enabled) ||
            (modelStatusFilter === 'disabled' && !m.enabled);
        const matchesQuery =
            !normalizedModelQuery ||
            m.id.toLowerCase().includes(normalizedModelQuery) ||
            m.name.toLowerCase().includes(normalizedModelQuery) ||
            m.description.toLowerCase().includes(normalizedModelQuery);
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
            const [usersData, settingsData, syncStatusData, modelsData] = await Promise.all([
                api('/api/admin/users'),
                api('/api/admin/settings'),
                api('/api/admin/prompt-template-images/sync'),
                api('/api/admin/models')
            ]);
            setUsers(usersData.users || []);
            setRegistrationEnabled(Boolean(settingsData.registrationEnabled));
            setRuntimeSettings({ ...emptyRuntimeSettings, ...settingsData });
            setPromptTemplateSyncStatus(syncStatusData);
            setIsSyncingPromptTemplates(syncStatusData.status === 'running');
            setModels(modelsData.models || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : '加载失败');
        }
    }, []);

    React.useEffect(() => {
        load();
    }, [load]);

    React.useEffect(() => {
        if (!isSyncingPromptTemplates) {
            return;
        }

        const poll = async () => {
            try {
                const data = await api('/api/admin/prompt-template-images/sync');
                setPromptTemplateSyncStatus(data);

                if (data.status === 'completed') {
                    setIsSyncingPromptTemplates(false);
                    setMessage(
                        `模板图片同步完成：已存在 ${data.existing ?? 0} 张，本次上传 ${data.uploaded ?? 0} 张，跳过 ${data.skipped ?? 0} 张。`
                    );
                } else if (data.status === 'failed') {
                    setIsSyncingPromptTemplates(false);
                    setError(data.error || '上传模板图片失败');
                }
            } catch (err) {
                setIsSyncingPromptTemplates(false);
                setError(err instanceof Error ? err.message : '读取上传进度失败');
            }
        };

        void poll();
        const timer = window.setInterval(() => {
            void poll();
        }, 1000);

        return () => window.clearInterval(timer);
    }, [isSyncingPromptTemplates]);

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
            setRuntimeSettings((prev) => ({ ...prev, registrationEnabled: Boolean(data.registrationEnabled) }));
            setMessage(enabled ? '已开启注册。' : '已关闭注册。');
        } catch (err) {
            setError(err instanceof Error ? err.message : '设置失败');
        }
    };

    const updateRuntimeSetting = <K extends keyof RuntimeSettings>(key: K, value: RuntimeSettings[K]) => {
        setRuntimeSettings((prev) => ({ ...prev, [key]: value }));
    };

    const saveRuntimeSettings = async (event: React.FormEvent) => {
        event.preventDefault();
        try {
            setIsSavingSettings(true);
            setError(null);
            const data = await api('/api/admin/settings', {
                method: 'PATCH',
                body: JSON.stringify(runtimeSettings)
            });
            setRuntimeSettings({ ...emptyRuntimeSettings, ...data });
            setRegistrationEnabled(Boolean(data.registrationEnabled));
            setMessage('运行配置已保存。');
        } catch (err) {
            setError(err instanceof Error ? err.message : '保存配置失败');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const testR2Settings = async () => {
        try {
            setIsTestingR2(true);
            setError(null);
            await api('/api/admin/settings/r2-test', {
                method: 'POST',
                body: JSON.stringify(runtimeSettings)
            });
            setMessage('R2 连接测试成功。');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'R2 连接测试失败');
        } finally {
            setIsTestingR2(false);
        }
    };

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.assign('/login');
    };

    const syncPromptTemplateImages = async () => {
        try {
            setIsSyncingPromptTemplates(true);
            setError(null);
            setMessage(null);
            const data = await api('/api/admin/prompt-template-images/sync', {
                method: 'POST',
                body: JSON.stringify(runtimeSettings)
            });
            setPromptTemplateSyncStatus(data);
        } catch (err) {
            setIsSyncingPromptTemplates(false);
            setError(err instanceof Error ? err.message : '上传模板图片失败');
        }
    };

    // Model management actions
    const handleCreateModel = async (event: React.FormEvent) => {
        event.preventDefault();
        try {
            setIsSubmittingModel(true);
            setError(null);
            await api('/api/admin/models', {
                method: 'POST',
                body: JSON.stringify({
                    id: newModelId.trim(),
                    name: newModelName.trim(),
                    description: newModelDescription.trim(),
                    sortOrder: parseInt(newModelSortOrder, 10) || 0,
                    enabled: newModelEnabled,
                    isDefault: newModelIsDefault
                })
            });
            setNewModelId('');
            setNewModelName('');
            setNewModelDescription('');
            setNewModelSortOrder('0');
            setNewModelEnabled(true);
            setNewModelIsDefault(false);
            setShowCreateModel(false);
            setMessage('模型已成功添加。');
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : '创建模型失败');
        } finally {
            setIsSubmittingModel(false);
        }
    };

    const handleUpdateModel = async (
        model: ManagedModel,
        patch: Partial<{ name: string; description: string; enabled: boolean; isDefault: boolean; sortOrder: number }>
    ) => {
        try {
            setError(null);
            await api(`/api/admin/models/${model.id}`, {
                method: 'PATCH',
                body: JSON.stringify(patch)
            });
            setMessage(`模型 "${model.name}" 已更新。`);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : '更新模型失败');
        }
    };

    const handleDeleteModel = async (model: ManagedModel) => {
        if (BUILTIN_MODEL_IDS.has(model.id)) {
            setError('内置核心模型不可删除，可通过停用开关关闭。');
            return;
        }
        if (!confirm(`确认删除自定义模型 "${model.name}" (${model.id})？此操作不可恢复。`)) {
            return;
        }
        try {
            setError(null);
            await api(`/api/admin/models/${model.id}`, {
                method: 'DELETE'
            });
            setMessage(`模型 "${model.name}" 已删除。`);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : '删除模型失败');
        }
    };

    const handleSetDefaultModel = async (model: ManagedModel) => {
        try {
            setError(null);
            await api(`/api/admin/models/${model.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ isDefault: true })
            });
            setMessage(`已将 "${model.name}" 设为系统默认模型。`);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : '设置默认模型失败');
        }
    };

    const handleResetModels = async () => {
        if (!confirm('确认重置模型配置？这将清除所有自定义模型并恢复系统预设核心模型配置。')) {
            return;
        }
        try {
            setError(null);
            await api('/api/admin/models/reset', { method: 'POST' });
            setMessage('模型配置已重置为默认状态。');
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : '重置模型失败');
        }
    };

    return (
        <main className='min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_32rem),#050505] p-4 text-white md:p-8'>
            <div className='mx-auto max-w-7xl space-y-6'>
                <div className='flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/30'>
                    <div>
                        <div className='mb-2 text-xs font-medium tracking-[0.3em] text-white/40 uppercase'>仪表盘</div>
                        <h1 className='text-3xl font-semibold'>管理员面板</h1>
                        <p className='mt-2 text-sm text-white/60'>管理用户账号、模型管理、系统设置与存储配置。</p>
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

                <div className='flex items-center gap-2 border-b border-white/10 pb-4'>
                    <button
                        type='button'
                        onClick={() => setActiveTab('users')}
                        className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                            activeTab === 'users'
                                ? 'bg-white text-black shadow-lg'
                                : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}>
                        用户与系统
                    </button>
                    <button
                        type='button'
                        onClick={() => setActiveTab('models')}
                        className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                            activeTab === 'models'
                                ? 'bg-white text-black shadow-lg'
                                : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}>
                        <span>模型管理</span>
                        <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                activeTab === 'models' ? 'bg-black/15 text-black' : 'bg-white/10 text-white/70'
                            }`}>
                            {models.length}
                        </span>
                    </button>
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

                {/* Users & System Tab */}
                {activeTab === 'users' && (
                    <div className='space-y-6'>
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
                                        <CardTitle>运行配置</CardTitle>
                                        <CardDescription className='text-white/60'>
                                            保存后写入数据库。管理员账号、密码和会话密钥仍由部署环境提供。
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <form onSubmit={saveRuntimeSettings} className='space-y-4'>
                                            <div className='space-y-1.5'>
                                                <Label htmlFor='openaiApiKey'>OpenAI API Key</Label>
                                                <Input
                                                    id='openaiApiKey'
                                                    type='password'
                                                    value={runtimeSettings.openaiApiKey}
                                                    onChange={(e) => updateRuntimeSetting('openaiApiKey', e.target.value)}
                                                    placeholder='sk-...'
                                                    className='border-white/20 bg-black/50 text-white'
                                                />
                                            </div>
                                            <div className='space-y-1.5'>
                                                <Label htmlFor='openaiBaseUrl'>OpenAI Base URL</Label>
                                                <Input
                                                    id='openaiBaseUrl'
                                                    value={runtimeSettings.openaiBaseUrl}
                                                    onChange={(e) => updateRuntimeSetting('openaiBaseUrl', e.target.value)}
                                                    placeholder='https://api.openai.com/v1'
                                                    className='border-white/20 bg-black/50 text-white'
                                                />
                                            </div>
                                            <div className='grid gap-3 md:grid-cols-2'>
                                                <div className='space-y-1.5'>
                                                    <Label htmlFor='imageStorageMode'>图片存储</Label>
                                                    <select
                                                        id='imageStorageMode'
                                                        value={runtimeSettings.imageStorageMode}
                                                        onChange={(e) =>
                                                            updateRuntimeSetting(
                                                                'imageStorageMode',
                                                                e.target.value as RuntimeSettings['imageStorageMode']
                                                            )
                                                        }
                                                        className='h-10 w-full rounded-md border border-white/20 bg-black/50 px-3 text-sm text-white'>
                                                        <option value=''>自动</option>
                                                        <option value='fs'>文件系统</option>
                                                        <option value='indexeddb'>IndexedDB</option>
                                                        <option value='r2'>Cloudflare R2</option>
                                                    </select>
                                                </div>
                                                <div className='space-y-1.5'>
                                                    <Label htmlFor='authCookieSecure'>登录 Cookie Secure</Label>
                                                    <select
                                                        id='authCookieSecure'
                                                        value={runtimeSettings.authCookieSecure}
                                                        onChange={(e) =>
                                                            updateRuntimeSetting(
                                                                'authCookieSecure',
                                                                e.target.value as RuntimeSettings['authCookieSecure']
                                                            )
                                                        }
                                                        className='h-10 w-full rounded-md border border-white/20 bg-black/50 px-3 text-sm text-white'>
                                                        <option value='auto'>自动</option>
                                                        <option value='true'>强制开启</option>
                                                        <option value='false'>强制关闭</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className='grid gap-3 md:grid-cols-2'>
                                                <RuntimeInput
                                                    label='R2 Account ID'
                                                    value={runtimeSettings.r2AccountId}
                                                    onChange={(value) => updateRuntimeSetting('r2AccountId', value)}
                                                />
                                                <RuntimeInput
                                                    label='R2 Bucket'
                                                    value={runtimeSettings.r2Bucket}
                                                    onChange={(value) => updateRuntimeSetting('r2Bucket', value)}
                                                />
                                                <RuntimeInput
                                                    label='R2 Access Key ID'
                                                    value={runtimeSettings.r2AccessKeyId}
                                                    onChange={(value) => updateRuntimeSetting('r2AccessKeyId', value)}
                                                />
                                                <RuntimeInput
                                                    label='R2 Secret Access Key'
                                                    type='password'
                                                    value={runtimeSettings.r2SecretAccessKey}
                                                    onChange={(value) => updateRuntimeSetting('r2SecretAccessKey', value)}
                                                />
                                            </div>
                                            <RuntimeInput
                                                label='R2 Endpoint'
                                                value={runtimeSettings.r2Endpoint}
                                                onChange={(value) => updateRuntimeSetting('r2Endpoint', value)}
                                                placeholder='https://account-id.r2.cloudflarestorage.com'
                                            />
                                            <RuntimeInput
                                                label='R2 Public Base URL'
                                                value={runtimeSettings.r2PublicBaseUrl}
                                                onChange={(value) => updateRuntimeSetting('r2PublicBaseUrl', value)}
                                                placeholder='https://cdn.example.com/assets'
                                            />
                                            <div className='grid gap-3 md:grid-cols-2'>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    disabled={isSavingSettings || isTestingR2}
                                                    onClick={testR2Settings}
                                                    className='border-white/20 bg-black/40 text-white hover:bg-white/10'>
                                                    {isTestingR2 ? '测试中...' : '测试 R2 连接'}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    disabled={isSavingSettings || isTestingR2 || isSyncingPromptTemplates}
                                                    onClick={syncPromptTemplateImages}
                                                    className='border-white/20 bg-black/40 text-white hover:bg-white/10'>
                                                    {isSyncingPromptTemplates ? '上传中...' : '上传模板图片到 R2'}
                                                </Button>
                                            </div>
                                            <div className='grid gap-3 md:grid-cols-1'>
                                                <Button
                                                    type='submit'
                                                    disabled={isSavingSettings || isTestingR2 || isSyncingPromptTemplates}
                                                    className='bg-white text-black hover:bg-white/90'>
                                                    {isSavingSettings ? '保存中...' : '保存运行配置'}
                                                </Button>
                                            </div>
                                            {promptTemplateSyncStatus && (
                                                <div className='rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/70'>
                                                    <div className='flex items-center justify-between gap-3'>
                                                        <span>模板图片上传进度</span>
                                                        <span>
                                                            已处理 {promptTemplateSyncStatus.completed} / {promptTemplateSyncStatus.total} 张
                                                        </span>
                                                    </div>
                                                    <p className='mt-2 text-white/50'>
                                                        已存在 {promptTemplateSyncStatus.existing} 张，本次实际上传 {promptTemplateSyncStatus.uploaded} 张，额外跳过 {promptTemplateSyncStatus.skipped} 张
                                                    </p>
                                                    {promptTemplateSyncStatus.currentFilename && (
                                                        <p className='mt-2 truncate text-white/50'>
                                                            当前文件：{promptTemplateSyncStatus.currentFilename}
                                                        </p>
                                                    )}
                                                    {promptTemplateSyncStatus.error && (
                                                        <p className='mt-2 text-red-300'>{promptTemplateSyncStatus.error}</p>
                                                    )}
                                                </div>
                                            )}
                                        </form>
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
                )}

                {/* Model Management Tab */}
                {activeTab === 'models' && (
                    <div className='space-y-6'>
                        <section className='grid gap-4 md:grid-cols-4'>
                            <StatCard label='模型总数' value={models.length} helper='系统配置的所有生图模型' />
                            <StatCard label='已启用' value={enabledModels.length} helper='前台可供用户选择' />
                            <StatCard label='已停用' value={disabledModels.length} helper='前台不可选' />
                            <StatCard
                                label='默认模型'
                                value={currentDefaultModel?.name || currentDefaultModel?.id || '未设定'}
                                helper='新建任务时的缺省模型'
                            />
                        </section>

                        <Card className='border-white/10 bg-white/[0.04] text-white'>
                            <CardHeader className='space-y-4'>
                                <div className='flex flex-wrap items-center justify-between gap-4'>
                                    <div>
                                        <CardTitle>模型管理</CardTitle>
                                        <CardDescription className='text-white/60'>
                                            配置模型可用性、显示名称、描述与默认生图模型。
                                        </CardDescription>
                                    </div>
                                    <div className='flex flex-wrap gap-2'>
                                        <Button
                                            type='button'
                                            onClick={() => setShowCreateModel(!showCreateModel)}
                                            className='bg-white text-black hover:bg-white/90'>
                                            {showCreateModel ? '收起添加' : '+ 添加自定义模型'}
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            onClick={handleResetModels}
                                            className='border-white/20 bg-black/40 text-white hover:bg-white/10'>
                                            恢复预设模型
                                        </Button>
                                    </div>
                                </div>

                                {showCreateModel && (
                                    <div className='rounded-2xl border border-white/15 bg-black/40 p-5 shadow-inner'>
                                        <h3 className='mb-3 text-lg font-semibold'>添加新模型</h3>
                                        <form onSubmit={handleCreateModel} className='space-y-4'>
                                            <div className='grid gap-4 md:grid-cols-2'>
                                                <div className='space-y-1.5'>
                                                    <Label htmlFor='modelId'>模型 ID *</Label>
                                                    <Input
                                                        id='modelId'
                                                        placeholder='例如 ag/gemini-3.1-flash-image'
                                                        value={newModelId}
                                                        onChange={(e) => setNewModelId(e.target.value)}
                                                        required
                                                        className='border-white/20 bg-black/50 font-mono text-white'
                                                    />
                                                    <p className='text-xs text-white/40'>唯一标识符，调用 API 时传入。</p>
                                                </div>
                                                <div className='space-y-1.5'>
                                                    <Label htmlFor='modelName'>显示名称 *</Label>
                                                    <Input
                                                        id='modelName'
                                                        placeholder='例如 GPT-Image Custom'
                                                        value={newModelName}
                                                        onChange={(e) => setNewModelName(e.target.value)}
                                                        required
                                                        className='border-white/20 bg-black/50 text-white'
                                                    />
                                                    <p className='text-xs text-white/40'>界面下拉框中显示的名称。</p>
                                                </div>
                                            </div>

                                            <div className='space-y-1.5'>
                                                <Label htmlFor='modelDescription'>描述说明</Label>
                                                <Textarea
                                                    id='modelDescription'
                                                    placeholder='简短说明模型的适用场景、优势或特点...'
                                                    value={newModelDescription}
                                                    onChange={(e) => setNewModelDescription(e.target.value)}
                                                    className='border-white/20 bg-black/50 text-white'
                                                    rows={2}
                                                />
                                            </div>

                                            <div className='grid gap-4 md:grid-cols-3 md:items-center'>
                                                <div className='space-y-1.5'>
                                                    <Label htmlFor='modelSortOrder'>排序权重</Label>
                                                    <Input
                                                        id='modelSortOrder'
                                                        type='number'
                                                        value={newModelSortOrder}
                                                        onChange={(e) => setNewModelSortOrder(e.target.value)}
                                                        className='border-white/20 bg-black/50 text-white'
                                                    />
                                                </div>
                                                <div className='flex items-center gap-2 pt-5'>
                                                    <Checkbox
                                                        id='modelEnabled'
                                                        checked={newModelEnabled}
                                                        onCheckedChange={(c) => setNewModelEnabled(Boolean(c))}
                                                    />
                                                    <Label htmlFor='modelEnabled' className='cursor-pointer text-sm'>
                                                        立即启用
                                                    </Label>
                                                </div>
                                                <div className='flex items-center gap-2 pt-5'>
                                                    <Checkbox
                                                        id='modelDefault'
                                                        checked={newModelIsDefault}
                                                        onCheckedChange={(c) => setNewModelIsDefault(Boolean(c))}
                                                    />
                                                    <Label htmlFor='modelDefault' className='cursor-pointer text-sm'>
                                                        设为系统默认模型
                                                    </Label>
                                                </div>
                                            </div>

                                            <div className='flex justify-end gap-2 pt-2'>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    onClick={() => setShowCreateModel(false)}
                                                    className='border-white/20 bg-black text-white hover:bg-white/10'>
                                                    取消
                                                </Button>
                                                <Button
                                                    type='submit'
                                                    disabled={isSubmittingModel}
                                                    className='bg-white text-black hover:bg-white/90'>
                                                    {isSubmittingModel ? '添加中...' : '确认添加'}
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                <div className='grid gap-3 md:grid-cols-[1fr_auto]'>
                                    <Input
                                        value={modelQuery}
                                        onChange={(e) => setModelQuery(e.target.value)}
                                        placeholder='搜索模型 ID、名称或描述'
                                        className='border-white/20 bg-black/50 text-white'
                                    />
                                    <div className='flex rounded-lg border border-white/10 bg-black/40 p-1'>
                                        {(['all', 'enabled', 'disabled'] as const).map((filter) => (
                                            <button
                                                key={filter}
                                                type='button'
                                                onClick={() => setModelStatusFilter(filter)}
                                                className={`rounded-md px-3 py-1.5 text-sm transition ${
                                                    modelStatusFilter === filter
                                                        ? 'bg-white text-black'
                                                        : 'text-white/60 hover:text-white'
                                                }`}>
                                                {filter === 'all' ? '全部' : filter === 'enabled' ? '已启用' : '已停用'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className='space-y-4'>
                                {filteredModels.map((model) => (
                                    <ModelCard
                                        key={model.id}
                                        model={model}
                                        onUpdate={handleUpdateModel}
                                        onSetDefault={handleSetDefaultModel}
                                        onDelete={handleDeleteModel}
                                    />
                                ))}
                                {filteredModels.length === 0 && (
                                    <div className='rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/60'>
                                        没有匹配的模型。
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
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

function RuntimeInput({
    label,
    value,
    onChange,
    type = 'text',
    placeholder
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
}) {
    const id = React.useId();

    return (
        <div className='space-y-1.5'>
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className='border-white/20 bg-black/50 text-white'
            />
        </div>
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

function ModelCard({
    model,
    onUpdate,
    onSetDefault,
    onDelete
}: {
    model: ManagedModel;
    onUpdate: (
        model: ManagedModel,
        patch: Partial<{ name: string; description: string; enabled: boolean; isDefault: boolean; sortOrder: number }>
    ) => void;
    onSetDefault: (model: ManagedModel) => void;
    onDelete: (model: ManagedModel) => void;
}) {
    const isBuiltin = BUILTIN_MODEL_IDS.has(model.id);
    const ratesHint = MODEL_RATES_HINT[model.id];
    const [isEditing, setIsEditing] = React.useState(false);
    const [name, setName] = React.useState(model.name);
    const [description, setDescription] = React.useState(model.description);
    const [sortOrder, setSortOrder] = React.useState(String(model.sortOrder));

    React.useEffect(() => {
        setName(model.name);
        setDescription(model.description);
        setSortOrder(String(model.sortOrder));
    }, [model]);

    const handleSaveEdit = () => {
        onUpdate(model, {
            name: name.trim(),
            description: description.trim(),
            sortOrder: parseInt(sortOrder, 10) || 0
        });
        setIsEditing(false);
    };

    return (
        <div
            className={`rounded-2xl border p-5 transition ${
                model.isDefault
                    ? 'border-emerald-500/40 bg-emerald-950/10'
                    : model.enabled
                      ? 'border-white/10 bg-black/35'
                      : 'border-white/5 bg-white/[0.01] opacity-75'
            }`}>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div className='flex flex-wrap items-center gap-2.5'>
                    <span className='font-semibold text-white text-base'>{model.name}</span>
                    <span className='rounded bg-white/10 px-2 py-0.5 font-mono text-xs text-white/70'>
                        {model.id}
                    </span>
                    {model.isDefault && (
                        <span className='rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300'>
                            默认模型
                        </span>
                    )}
                    {isBuiltin ? (
                        <span className='rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-300'>
                            内置核心
                        </span>
                    ) : (
                        <span className='rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-300'>
                            自定义
                        </span>
                    )}
                    <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            model.enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-500/20 text-zinc-400'
                        }`}>
                        {model.enabled ? '已启用' : '已停用'}
                    </span>
                </div>

                <div className='flex items-center gap-2'>
                    <label className='flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs'>
                        <Checkbox
                            checked={model.enabled}
                            disabled={model.isDefault && model.enabled}
                            onCheckedChange={(checked) => onUpdate(model, { enabled: Boolean(checked) })}
                        />
                        <span>启用该模型</span>
                    </label>

                    {!model.isDefault && (
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={() => onSetDefault(model)}
                            className='border-white/20 bg-black/40 text-xs text-white hover:bg-white/10'>
                            设为默认
                        </Button>
                    )}

                    <Button
                        variant='outline'
                        size='sm'
                        onClick={() => setIsEditing(!isEditing)}
                        className='border-white/20 bg-black/40 text-xs text-white hover:bg-white/10'>
                        {isEditing ? '取消' : '编辑'}
                    </Button>

                    {!isBuiltin && (
                        <Button
                            variant='destructive'
                            size='sm'
                            onClick={() => onDelete(model)}
                            className='text-xs'>
                            删除
                        </Button>
                    )}
                </div>
            </div>

            {model.description && !isEditing && (
                <p className='mt-2.5 text-sm text-white/60'>{model.description}</p>
            )}

            {ratesHint && (
                <div className='mt-3 flex items-center gap-2 text-xs text-white/40'>
                    <span className='font-medium text-white/50'>计费参考:</span>
                    <span>{ratesHint}</span>
                </div>
            )}

            <div className='mt-2 flex items-center gap-4 text-xs text-white/35'>
                <span>排序权重: {model.sortOrder}</span>
                <span>更新于 {formatDate(model.updatedAt)}</span>
            </div>

            {isEditing && (
                <div className='mt-4 rounded-xl border border-white/10 bg-black/50 p-4 space-y-3'>
                    <div className='grid gap-3 md:grid-cols-2'>
                        <div className='space-y-1.5'>
                            <Label className='text-xs'>显示名称</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className='border-white/20 bg-black text-white text-sm'
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <Label className='text-xs'>排序权重</Label>
                            <Input
                                type='number'
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                                className='border-white/20 bg-black text-white text-sm'
                            />
                        </div>
                    </div>
                    <div className='space-y-1.5'>
                        <Label className='text-xs'>模型描述</Label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className='border-white/20 bg-black text-white text-sm'
                        />
                    </div>
                    <div className='flex justify-end gap-2'>
                        <Button
                            size='sm'
                            variant='outline'
                            onClick={() => setIsEditing(false)}
                            className='border-white/20 bg-black text-white hover:bg-white/10 text-xs'>
                            取消
                        </Button>
                        <Button
                            size='sm'
                            onClick={handleSaveEdit}
                            className='bg-white text-black hover:bg-white/90 text-xs'>
                            保存修改
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
