import { blendGet, blendshapeTable } from '$lib/face/blendshapeTable';

export type FaceSample = {
	t: number;
	brow: number;
	jaw: number;
	smile: number;
	squint: number;
};

export function sampleFaceFromBlendshapes(
	categories: { categoryName: string; score: number }[] | undefined,
	t: number
): FaceSample | null {
	if (!categories?.length) return null;
	const sym = blendshapeTable(categories);
	const smileL = blendGet(sym, 'mouthSmileLeft');
	const smileR = blendGet(sym, 'mouthSmileRight');
	const brow = blendGet(sym, 'browInnerUp');
	const jaw = blendGet(sym, 'jawOpen');
	const squint = (blendGet(sym, 'eyeSquintLeft') + blendGet(sym, 'eyeSquintRight')) / 2;
	return {
		t,
		brow,
		jaw,
		smile: (smileL + smileR) / 2,
		squint
	};
}

export function summarizeFace(samples: FaceSample[]) {
	if (samples.length === 0) {
		return {
			avgBrow: 0,
			jawStdev: 0,
			avgSmile: 0,
			avgSquint: 0
		};
	}
	const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
	const jaws = samples.map((s) => s.jaw);
	const m = mean(jaws);
	const variance = jaws.reduce((acc, x) => acc + (x - m) ** 2, 0) / jaws.length;
	const stdev = Math.sqrt(variance);
	return {
		avgBrow: mean(samples.map((s) => s.brow)),
		jawStdev: stdev,
		avgSmile: mean(samples.map((s) => s.smile)),
		avgSquint: mean(samples.map((s) => s.squint))
	};
}
