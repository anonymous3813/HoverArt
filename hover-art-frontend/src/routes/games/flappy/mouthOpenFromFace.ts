import { blendGet, blendshapeTable } from '$lib/face/blendshapeTable.js';

export function mouthOpenFromBlendshapes(
	categories: { categoryName: string; score: number }[] | undefined
): number {
	if (!categories?.length) return 0;
	const t = blendshapeTable(categories);
	const jaw = blendGet(t, 'jawOpen');
	const open = blendGet(t, 'mouthOpen');
	const funnel = blendGet(t, 'mouthFunnel');
	const pucker = blendGet(t, 'mouthPucker');
	const raw = jaw * 0.42 + open * 0.42 + funnel * 0.1 + pucker * 0.06;
	return Math.min(1, Math.pow(Math.max(0, raw), 0.82) * 1.35);
}
