'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ModeToggleProps = {
    currentMode: 'generate' | 'edit';
    onModeChange: (mode: 'generate' | 'edit') => void;
};

export function ModeToggle({ currentMode, onModeChange }: ModeToggleProps) {
    const isEditMode = currentMode === 'edit';

    return (
        <Tabs
            value={currentMode}
            onValueChange={(value) => onModeChange(value as 'generate' | 'edit')}
            className='w-full sm:w-[220px]'>
            <TabsList className='relative grid min-h-12 w-full grid-cols-2 overflow-hidden rounded-full border border-white/15 bg-white/10 p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_16px_36px_rgba(0,0,0,0.35)] backdrop-blur'>
                <span
                    aria-hidden='true'
                    className={`absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-[0_8px_24px_rgba(255,255,255,0.22)] transition-transform duration-300 ease-out ${
                        isEditMode ? 'translate-x-full' : 'translate-x-0'
                    }`}
                />
                <TabsTrigger
                    value='generate'
                    className={`relative z-10 min-h-11 rounded-full border border-transparent px-4 text-sm font-bold transition-colors duration-200 data-[state=active]:!text-neutral-950 dark:data-[state=active]:!text-neutral-950 ${
                        currentMode === 'generate'
                            ? 'text-neutral-950'
                            : 'text-white/65 hover:bg-white/10 hover:text-white'
                    }`}>
                    生成
                </TabsTrigger>
                <TabsTrigger
                    value='edit'
                    className={`relative z-10 min-h-11 rounded-full border border-transparent px-4 text-sm font-bold transition-colors duration-200 data-[state=active]:!text-neutral-950 dark:data-[state=active]:!text-neutral-950 ${
                        isEditMode ? 'text-neutral-950' : 'text-white/65 hover:bg-white/10 hover:text-white'
                    }`}>
                    编辑
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
