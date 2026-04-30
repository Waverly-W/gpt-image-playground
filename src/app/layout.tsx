import { version as appVersion } from '../../package.json';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'GPT Image Playground',
    description: '使用 OpenAI GPT Image 模型生成和编辑图片。',
    icons: {
        icon: '/favicon.svg'
    }
};

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang='zh-CN' className='dark' suppressHydrationWarning>
            <body className='antialiased'>
                <ThemeProvider>
                    {children}
                    <div
                        data-testid='app-version-badge'
                        className='border-border/70 bg-background/85 text-muted-foreground fixed right-3 bottom-3 z-50 rounded-md border px-2 py-1 font-mono text-[11px] leading-none shadow-sm backdrop-blur-sm select-none'
                        aria-label={`应用版本 ${appVersion}`}>
                        v{appVersion}
                    </div>
                </ThemeProvider>
            </body>
        </html>
    );
}
