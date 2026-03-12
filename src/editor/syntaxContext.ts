import type { Transaction } from "@codemirror/state";
import type { Tree } from "@lezer/common";

type SyntaxTreeSide = -1 | 0 | 1;

function nodeOrParentsContainKeywords(node: any, keywords: string[]): boolean {
	while (node) {
		const name = (node.name ?? "").toString().toLowerCase();
		if (keywords.some(kw => name.includes(kw))) {
			return true;
		}
		node = node.parent;
	}

	return false;
}

function getLineContextPositions(
	state: Transaction["state"],
	lineNumber: number
): Array<{ pos: number; side: SyntaxTreeSide }> {
	const line = state.doc.line(lineNumber);
	const positions = new Map<string, { pos: number; side: SyntaxTreeSide }>();
	const addPosition = (pos: number, side: SyntaxTreeSide) => {
		const clampedPos = Math.max(0, Math.min(pos, state.doc.length));
		positions.set(`${clampedPos}:${side}`, { pos: clampedPos, side });
	};

	addPosition(line.from, -1);
	addPosition(line.from, 1);
	addPosition(line.to, -1);
	addPosition(line.to, 1);

	if (line.from < line.to) {
		addPosition(line.from + Math.min(1, line.to - line.from), 0);
	} else {
		if (line.from > 0) addPosition(line.from - 1, -1);
		if (line.to < state.doc.length) addPosition(line.to + 1, 1);
	}

	return Array.from(positions.values());
}

export function parentsContainKeywords(
	state: Transaction["state"],
	tree: Tree,
	lineNumber: number,
	keywords: string[]
): boolean {
	for (const { pos, side } of getLineContextPositions(state, lineNumber)) {
		if (nodeOrParentsContainKeywords(tree.resolveInner(pos, side), keywords)) {
			return true;
		}

		for (let iter: ReturnType<typeof tree.resolveStack> | null = tree.resolveStack(pos, side); iter; iter = iter.next) {
			if (nodeOrParentsContainKeywords(iter.node, keywords)) {
				return true;
			}
		}
	}

	return false;
}