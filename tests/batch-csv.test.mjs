import assert from 'node:assert/strict';
import test from 'node:test';

const batch = await import('../src/lib/batch-csv.ts');

const defaults = {
    model: 'gpt-image-2',
    n: 1,
    size: 'auto',
    customWidth: 1024,
    customHeight: 1024,
    quality: 'auto',
    output_format: 'png',
    output_compression: 100,
    background: 'auto',
    moderation: 'auto',
    stream: false,
    partial_images: 2
};

test('exports a batch CSV template with generation parameter columns', () => {
    const template = batch.createBatchCsvTemplate(defaults);
    const [header, example] = template.trim().split('\n');

    assert.equal(
        header,
        'prompt,model,n,size,width,height,quality,output_format,output_compression,background,moderation,stream,partial_images'
    );
    assert.match(example, /^"一只写实风格的猫宇航员漂浮在太空中",gpt-image-2,1,auto/);
});

test('parses quoted prompts and applies defaults for empty parameter cells', () => {
    const csv = [
        'prompt,model,n,size,width,height,quality,output_format,output_compression,background,moderation,stream,partial_images',
        '"poster, with comma",,,,,,,,,,,,',
        '"quoted ""word"" prompt",gpt-image-1,2,square,,,high,jpeg,80,opaque,low,false,'
    ].join('\n');

    const result = batch.parseBatchCsv(csv, defaults);

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.rows, [
        {
            line: 2,
            prompt: 'poster, with comma',
            model: 'gpt-image-2',
            n: 1,
            size: 'auto',
            customWidth: 1024,
            customHeight: 1024,
            quality: 'auto',
            output_format: 'png',
            output_compression: 100,
            background: 'auto',
            moderation: 'auto',
            stream: false,
            partial_images: 2
        },
        {
            line: 3,
            prompt: 'quoted "word" prompt',
            model: 'gpt-image-1',
            n: 2,
            size: 'square',
            customWidth: 1024,
            customHeight: 1024,
            quality: 'high',
            output_format: 'jpeg',
            output_compression: 80,
            background: 'opaque',
            moderation: 'low',
            stream: false,
            partial_images: 2
        }
    ]);
});

test('reports row validation errors with line numbers', () => {
    const csv = [
        'prompt,model,n,size,width,height,quality,output_format,output_compression,background,moderation,stream,partial_images',
        ',gpt-image-2,1,auto,,,,png,,,,,',
        'valid prompt,bad-model,11,custom,17,1024,ultra,gif,120,clear,none,yes,4'
    ].join('\n');

    const result = batch.parseBatchCsv(csv, defaults);

    assert.equal(result.rows.length, 0);
    assert.deepEqual(result.errors, [
        '第 2 行：prompt 不能为空。',
        '第 3 行：model 必须是 gpt-image-2、gpt-image-1.5、gpt-image-1 或 gpt-image-1-mini。',
        '第 3 行：n 必须是 1 到 10 的整数。',
        '第 3 行：custom 尺寸需要合法的 width 和 height。宽度和高度都必须是 16 的倍数。',
        '第 3 行：quality 必须是 auto、low、medium 或 high。',
        '第 3 行：output_format 必须是 png、jpeg 或 webp。',
        '第 3 行：output_compression 必须是 0 到 100 的整数。',
        '第 3 行：background 必须是 auto、opaque 或 transparent。',
        '第 3 行：moderation 必须是 auto 或 low。',
        '第 3 行：partial_images 必须是 1、2 或 3。'
    ]);
});

test('converts parsed rows to API form data in CSV order', () => {
    const [row] = batch.parseBatchCsv(
        [
            'prompt,model,n,size,width,height,quality,output_format,output_compression,background,moderation,stream,partial_images',
            'custom prompt,gpt-image-2,1,custom,2048,1024,medium,webp,75,auto,low,true,3'
        ].join('\n'),
        defaults
    ).rows;

    const formData = batch.createBatchJobFormData(row);

    assert.deepEqual(Array.from(formData.entries()), [
        ['mode', 'generate'],
        ['model', 'gpt-image-2'],
        ['prompt', 'custom prompt'],
        ['n', '1'],
        ['size', '2048x1024'],
        ['quality', 'medium'],
        ['output_format', 'webp'],
        ['output_compression', '75'],
        ['background', 'auto'],
        ['moderation', 'low'],
        ['stream', 'true'],
        ['partial_images', '3']
    ]);
});
