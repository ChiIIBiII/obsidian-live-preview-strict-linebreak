export interface FencedCodeBlockState {
	marker: "`" | "~";
	length: number;
}

export interface MathBlockState {
	active: boolean;
}

function getFenceOpening(lineText: string): FencedCodeBlockState | null {
	const match = lineText.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
	if (!match) {
		return null;
	}

	const fence = match[1];
	if (!fence) {
		return null;
	}

	const marker = fence[0];
	if (marker !== "`" && marker !== "~") {
		return null;
	}

	return {
		marker,
		length: fence.length,
	};
}

function isFenceClosing(lineText: string, fenceState: FencedCodeBlockState): boolean {
	const match = lineText.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
	const fence = match?.[1];
	return Boolean(
		fence &&
		fence[0] === fenceState.marker &&
		fence.length >= fenceState.length
	);
}

export function getFencedCodeBlockStateForLine(
	lineText: string,
	activeFenceState: FencedCodeBlockState | null
): {
	lineIsInFencedCodeBlock: boolean;
	nextFenceState: FencedCodeBlockState | null;
} {
	if (activeFenceState) {
		return {
			lineIsInFencedCodeBlock: true,
			nextFenceState: isFenceClosing(lineText, activeFenceState) ? null : activeFenceState,
		};
	}

	const openingFence = getFenceOpening(lineText);
	return {
		lineIsInFencedCodeBlock: openingFence !== null,
		nextFenceState: openingFence,
	};
}

function isMathBlockDelimiter(lineText: string): boolean {
	return /^ {0,3}\$\$[ \t]*$/.test(lineText);
}

export function getMathBlockStateForLine(
	lineText: string,
	mathBlockState: MathBlockState
): {
	lineIsInMathBlock: boolean;
	nextMathBlockState: MathBlockState;
} {
	if (mathBlockState.active) {
		return {
			lineIsInMathBlock: true,
			nextMathBlockState: {
				active: !isMathBlockDelimiter(lineText),
			},
		};
	}

	const startsMathBlock = isMathBlockDelimiter(lineText);
	return {
		lineIsInMathBlock: startsMathBlock,
		nextMathBlockState: {
			active: startsMathBlock,
		},
	};
}