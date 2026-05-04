import { SCENE_CATALOG } from './catalogs/scenes';
import { STYLE_CATALOG } from './catalogs/styles';

export { SCENE_CATALOG } from './catalogs/scenes';
export { STYLE_CATALOG } from './catalogs/styles';
export { LANGUAGE_PROMPTS, TEXT_POLICY_PROMPTS } from './catalogs/text-policies';

export function findScene(sceneId: string | undefined) {
    if (!sceneId) return undefined;
    return SCENE_CATALOG.find((item) => item.id === sceneId);
}

export function findStyle(styleId: string | undefined) {
    if (!styleId) return undefined;
    return STYLE_CATALOG.find((item) => item.id === styleId);
}
