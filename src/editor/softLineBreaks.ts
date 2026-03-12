import { EditorState, Extension, RangeSetBuilder, StateField, Transaction } from "@codemirror/state";
import {
	Decoration,
	DecorationSet,
	EditorView,
	WidgetType,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { MyPluginSettings } from "../settings";
import { editorEditorField, editorLivePreviewField } from "obsidian";
import {
	getFencedCodeBlockStateForLine,
	getMathBlockStateForLine,
} from "./blockStates";
import type { FencedCodeBlockState, MathBlockState } from "./blockStates";
import {
	lineIsInList,
	lineIsInTable,
	startsWithQuoteAndListMarker,
} from "./lineContext";
import { parentsContainKeywords } from "./syntaxContext";

let lastSeenEditorView: EditorView | null = null;

interface SoftLineBreakFieldValue {
	decorations: DecorationSet;
	protectedRanges: DecorationSet;
}

const EMPTY_SOFT_LINE_BREAKS: SoftLineBreakFieldValue = {
	decorations: Decoration.none,
	protectedRanges: Decoration.none,
};

export function getLastSeenEditorView(): EditorView | null {
	return lastSeenEditorView;
}

function captureEditorView(state: EditorState): void {
	const view = state.field(editorEditorField, false);
	if (view) lastSeenEditorView = view;
}

class SoftBreakIndicatorWidget extends WidgetType {
	constructor(private indicator: string) {
		super();
	}

	toDOM(): HTMLElement {
		const el = document.createElement("span");
		el.className = "cm-softbreak-indicator";
		el.setAttribute("aria-hidden", "true");
		el.setAttribute("title", "Soft line break (newline)");
		el.style.opacity = "0.50";
		el.textContent = this.indicator;
		return el;
	}

	ignoreEvent(): boolean {
		return true;
	}
}

function createSoftBreakDecoration(indicator: string): Decoration {
	return Decoration.replace({
		widget: new SoftBreakIndicatorWidget(indicator),
	});
}

function createParagraphGapLineDecoration(): Decoration {
	return Decoration.line({
		attributes: {
			class: "cm-paragraph-gap",
		},
	});
}

function createProtectedParagraphRangeDecoration(): Decoration {
	return Decoration.mark({});
}

function endsWithMarkdownHardBreak(lineText: string): boolean {
	return lineText.endsWith("  ") || lineText.endsWith("\\");
}

function createSoftLineBreaksField(settings: MyPluginSettings): StateField<SoftLineBreakFieldValue> {
	return StateField.define<SoftLineBreakFieldValue>({
		create(state) {
			captureEditorView(state);
			return EMPTY_SOFT_LINE_BREAKS;
		},
		update(_oldState: SoftLineBreakFieldValue, transaction: Transaction) {
			captureEditorView(transaction.state);
			if (!transaction.state.field(editorLivePreviewField)) {
				return EMPTY_SOFT_LINE_BREAKS;
			}
			const decorationBuilder = new RangeSetBuilder<Decoration>();
			const protectedRangeBuilder = new RangeSetBuilder<Decoration>();
			const doc = transaction.state.doc;
			const tree = syntaxTree(transaction.state);
			let fencedCodeBlockState: FencedCodeBlockState | null = null;
			let mathBlockState: MathBlockState = { active: false };

			var lineNumber = 1;
			while (lineNumber < doc.lines) {
				const line = doc.line(lineNumber);
				const nextLine = doc.line(lineNumber + 1);
				const fencedCodeBlockInfo = getFencedCodeBlockStateForLine(line.text, fencedCodeBlockState);
				const nextLineFencedCodeBlockInfo = getFencedCodeBlockStateForLine(nextLine.text, fencedCodeBlockInfo.nextFenceState);
				const mathBlockInfo = getMathBlockStateForLine(line.text, mathBlockState);
				const nextLineMathBlockInfo = getMathBlockStateForLine(nextLine.text, mathBlockInfo.nextMathBlockState);
				const currentLineIsInList = lineIsInList(transaction.state, tree, lineNumber);
				const nextLineIsInList = lineIsInList(transaction.state, tree, lineNumber + 1);
				const currentLineIsInTable = lineIsInTable(transaction.state, tree, lineNumber);
				const nextLineIsInTable = lineIsInTable(transaction.state, tree, lineNumber + 1);
				const currentLineIsInParserCodeBlock = parentsContainKeywords(transaction.state, tree, lineNumber, ["fencedcode", "codeblock"]);
				const nextLineIsInParserCodeBlock = parentsContainKeywords(transaction.state, tree, lineNumber + 1, ["fencedcode", "codeblock"]);
				const currentLineIsInParserMathBlock = parentsContainKeywords(transaction.state, tree, lineNumber, ["math"]);
				const nextLineIsInParserMathBlock = parentsContainKeywords(transaction.state, tree, lineNumber + 1, ["math"]);
				const currentAndNextLineAreInCodeBlock =
					(fencedCodeBlockInfo.lineIsInFencedCodeBlock || currentLineIsInParserCodeBlock) &&
					(nextLineFencedCodeBlockInfo.lineIsInFencedCodeBlock || nextLineIsInParserCodeBlock);
				const currentAndNextLineAreInMathBlock =
					(mathBlockInfo.lineIsInMathBlock || currentLineIsInParserMathBlock) &&
					(nextLineMathBlockInfo.lineIsInMathBlock || nextLineIsInParserMathBlock);
				const currentAndNextLineAreInList = currentLineIsInList && nextLineIsInList;
				const currentAndNextLineAreInTable = currentLineIsInTable && nextLineIsInTable;
				fencedCodeBlockState = fencedCodeBlockInfo.nextFenceState;
				mathBlockState = mathBlockInfo.nextMathBlockState;
				// const nextNextLine = doc.line(lineNumber + 2);

				// keep hard line breaks
				if (endsWithMarkdownHardBreak(line.text)) {
					lineNumber += 1;
					continue;
				}

				if (
					currentAndNextLineAreInCodeBlock ||
					currentAndNextLineAreInMathBlock ||
					currentAndNextLineAreInList ||
					currentAndNextLineAreInTable
				) {
					lineNumber += 1;
					continue;
				}

				// inside quotes obsidian doesn't understand lists when editing so we have to do this manually
				if (
					startsWithQuoteAndListMarker(line.text) && startsWithQuoteAndListMarker(nextLine.text)) {
					lineNumber += 1;
					continue;
				}

				let nextLineIsEmpty: boolean;
				if (parentsContainKeywords(transaction.state, tree, lineNumber, ["quote"])) {
					nextLineIsEmpty = (
						nextLine.text.trim() === ">" || // quote symbol is fine
						nextLine.text.trim().length === 0 // for some reason obsidian allows non-quote-symbol lines in quotes

					);
				} else {
					nextLineIsEmpty = nextLine.text.trim().length === 0;
				}

				// we have line break plus empty line which should become a new paragraph
				// so keep the line visible, style it as a paragraph gap, and protect the
				// full separator span from cursor movement and edits.
				if (nextLineIsEmpty && nextLine.number != doc.lines) {
					const paragraphGapLineDecoration = createParagraphGapLineDecoration();
					const protectedParagraphRangeDecoration = createProtectedParagraphRangeDecoration();
					const protectedParagraphGapFrom = line.to;
					const protectedParagraphGapTo = doc.line(lineNumber + 2).from;

					decorationBuilder.add(nextLine.from, nextLine.from, paragraphGapLineDecoration);
					protectedRangeBuilder.add(protectedParagraphGapFrom, protectedParagraphGapTo, protectedParagraphRangeDecoration);
					lineNumber += 2;
					continue;
				}

				// In every other case replace the line break with the defined indicator
				decorationBuilder.add(line.to, line.to + 1, createSoftBreakDecoration(settings.softBreakIndicator));
				lineNumber += 1;
			}

			return {
				decorations: decorationBuilder.finish(),
				protectedRanges: protectedRangeBuilder.finish(),
			};
		},

		provide(field: StateField<SoftLineBreakFieldValue>): Extension {
			return [
				EditorView.decorations.from(field, (value) => value.decorations),
				EditorView.atomicRanges.of((view) => view.state.field(field).protectedRanges),
			];
		},
	});
}

export function softLineBreaksExtension(settings: MyPluginSettings): Extension {
	return [createSoftLineBreaksField(settings)];
}
