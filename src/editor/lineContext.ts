import type { Transaction } from "@codemirror/state";
import type { Tree } from "@lezer/common";
import { parentsContainKeywords } from "./syntaxContext";

export function startsWithQuoteAndListMarker(lineText: string): boolean {
	return /^\s*>+\s*([-+*]|\d+\.)\s+/.test(lineText);
}

function lineHasNonEmptyContent(lineText: string): boolean {
	return lineText.replace(/^\s*>+\s*/, "").trim().length > 0;
}

export function lineIsInList(
	state: Transaction["state"],
	tree: Tree,
	lineNumber: number
): boolean {
	const line = state.doc.line(lineNumber);
	if (!lineHasNonEmptyContent(line.text)) {
		return false;
	}

	return parentsContainKeywords(state, tree, lineNumber, ["list"]);
}

export function lineIsInTable(
	state: Transaction["state"],
	tree: Tree,
	lineNumber: number
): boolean {
	const line = state.doc.line(lineNumber);
	if (!lineHasNonEmptyContent(line.text)) {
		return false;
	}

	return parentsContainKeywords(state, tree, lineNumber, ["table"]);
}