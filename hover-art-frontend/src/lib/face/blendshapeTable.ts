export type BlendCategory = { categoryName: string; score: number };

/**
 * Symbol table: blendshape name → score. One pass over categories, then O(1) lookups.
 */
export function blendshapeTable(categories: BlendCategory[] | undefined): Map<string, number> {
	const table = new Map<string, number>();
	if (!categories) return table;
	for (const c of categories) {
		table.set(c.categoryName, c.score);
	}
	return table;
}

export function blendGet(table: Map<string, number>, name: string): number {
	return table.get(name) ?? 0;
}
