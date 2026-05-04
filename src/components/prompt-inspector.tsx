import type { PromptBlock } from '@/lib/prompt-builder/types';

export type PromptInspectorBlock = Pick<PromptBlock, 'id' | 'title' | 'enabled' | 'content'>;

type PromptInspectorProps = {
    rawPrompt?: string;
    fullPrompt: string;
    blocks?: PromptInspectorBlock[];
    warnings?: string[];
    defaultOpen?: boolean;
    compact?: boolean;
};

const PROMPT_BLOCK_TITLE_LABELS: Record<string, string> = {
    TASK: '任务',
    SPECS: '规格',
    DESC: '描述',
    STYLE: '风格',
    'TEXT POLICY': '文字策略',
    QUALITY: '质量',
    'EDIT TASK': '编辑任务',
    'SOURCE IMAGE': '源图',
    'STYLE REFERENCE': '风格参考',
    'COLOR REFERENCE': '色彩参考',
    'LAYOUT REFERENCE': '构图参考',
    'CONTENT ASSET': '内容素材',
    'MASK POLICY': '蒙版策略',
    'REPAINT INSTRUCTION': '局部重绘',
    'EDIT INSTRUCTION': '编辑指令'
};

export function getPromptBlockTitleLabel(title: string): string {
    return PROMPT_BLOCK_TITLE_LABELS[title] ?? title;
}

export function PromptInspector({
    rawPrompt,
    fullPrompt,
    blocks = [],
    warnings = [],
    defaultOpen = true,
    compact = false
}: PromptInspectorProps) {
    const enabledBlocks = blocks.filter((promptBlock) => promptBlock.enabled);
    const shouldShowRawPrompt = rawPrompt && rawPrompt !== fullPrompt;

    return (
        <details
            open={defaultOpen}
            className='group rounded-md border border-white/10 bg-black/80 p-3 text-sm text-white/75'>
            <summary className='flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium text-white marker:hidden'>
                <span>提示词检查器</span>
                <span className='text-white/45'>
                    {enabledBlocks.length > 0 ? `${enabledBlocks.length} 个控制块` : '自由提示词'}
                </span>
            </summary>

            <div className={`mt-3 flex flex-col ${compact ? 'gap-3' : 'gap-4'}`}>
                {shouldShowRawPrompt && (
                    <section className='space-y-1.5'>
                        <h4 className='text-xs font-medium text-white/65'>原始提示词</h4>
                        <p className='rounded border border-white/10 bg-neutral-950 p-2 text-xs leading-5 break-words whitespace-pre-wrap text-white/65'>
                            {rawPrompt}
                        </p>
                    </section>
                )}

                <section className='space-y-1.5'>
                    <h4 className='text-xs font-medium text-white/65'>最终提示词</h4>
                    <pre
                        className={`overflow-y-auto rounded border border-white/10 bg-neutral-950 p-2 text-xs leading-5 break-words whitespace-pre-wrap text-white/75 ${
                            compact ? 'max-h-36' : 'max-h-52'
                        }`}>
                        {fullPrompt}
                    </pre>
                </section>

                {enabledBlocks.length > 0 && (
                    <section className='space-y-2'>
                        <div className='flex items-center justify-between gap-3'>
                            <h4 className='text-xs font-medium text-white/65'>启用控制块</h4>
                            <span className='text-xs text-white/40'>{enabledBlocks.length}</span>
                        </div>
                        <div className='flex flex-col gap-2'>
                            {enabledBlocks.map((promptBlock) => (
                                <div key={promptBlock.id} className='rounded border border-white/10 bg-white/[0.03] p-2'>
                                    <div className='mb-1 text-xs font-medium text-white'>
                                        {getPromptBlockTitleLabel(promptBlock.title)}
                                    </div>
                                    <p className='text-xs leading-5 break-words whitespace-pre-wrap text-white/60'>
                                        {promptBlock.content}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {warnings.length > 0 && (
                    <section className='space-y-2'>
                        <h4 className='text-xs font-medium text-amber-200'>警告</h4>
                        <ul className='space-y-1 text-xs leading-5 text-amber-200'>
                            {warnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </details>
    );
}
