import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { version as appVersion } from '../../package.json';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'GPT Image Playground',
    description: "Generate and edit images using OpenAI's GPT Image models.",
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
        <html lang='en' suppressHydrationWarning>
            <body className='antialiased'>
                <ThemeProvider attribute='class' defaultTheme='dark' enableSystem={false} disableTransitionOnChange>
                    {children}
                    <div
                        data-testid='app-version-badge'
                        className='fixed right-3 bottom-3 z-50 rounded-md border border-border/70 bg-background/85 px-2 py-1 font-mono text-[11px] leading-none text-muted-foreground shadow-sm backdrop-blur-sm select-none'
                        aria-label={`App version ${appVersion}`}
                    >
                        v{appVersion}
                    </div>
                </ThemeProvider>
            </body>
        </html>
    );
}
