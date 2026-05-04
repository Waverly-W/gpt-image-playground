import assert from 'node:assert/strict';
import test from 'node:test';

const scenes = await import('../src/lib/prompt-builder/catalogs/scenes.ts');
const styles = await import('../src/lib/prompt-builder/catalogs/styles.ts');
const textPolicies = await import('../src/lib/prompt-builder/catalogs/text-policies.ts');
const catalogs = await import('../src/lib/prompt-builder/catalogs.ts');

test('prompt builder catalogs are split into scene style and text policy modules', () => {
    assert.equal(scenes.SCENE_CATALOG.length, 8);
    assert.equal(styles.STYLE_CATALOG.length, 12);
    assert.equal(Object.keys(textPolicies.TEXT_POLICY_PROMPTS).length, 4);
});

test('prompt builder catalogs cover the P1 high-frequency creation scenes', () => {
    assert.deepEqual(
        scenes.SCENE_CATALOG.map((scene) => scene.id),
        ['poster', 'infographic', 'character', 'product', 'style-report', 'social-post', 'educational', 'portrait']
    );
});

test('legacy catalog barrel re-exports the split catalogs', () => {
    assert.equal(catalogs.SCENE_CATALOG, scenes.SCENE_CATALOG);
    assert.equal(catalogs.STYLE_CATALOG, styles.STYLE_CATALOG);
    assert.equal(catalogs.TEXT_POLICY_PROMPTS, textPolicies.TEXT_POLICY_PROMPTS);
});
