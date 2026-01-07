import { Extension, RangeSetBuilder, StateField, Transaction } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";

const EMPTY_LINE_DECORATION = Decoration.line({
	class: "cm-empty-line",
});

function buildEmptyLineDecorations(doc: Transaction["state"]["doc"]): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();

	for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber++) {
		const line = doc.line(lineNumber);
		// A truly empty CM6 line is rendered as: <div class="cm-line"><br></div>
		if (line.text.length === 0) {
			builder.add(line.from, line.from, EMPTY_LINE_DECORATION);
		}
	}

	return builder.finish();
}

const emptyLineClassField = StateField.define<DecorationSet>({
	create(state) {
		return buildEmptyLineDecorations(state.doc);
	},
	update(previous: DecorationSet, transaction: Transaction) {
		if (!transaction.docChanged) return previous;
		return buildEmptyLineDecorations(transaction.state.doc);
	},
	provide(field) {
		return EditorView.decorations.from(field);
	},
});

export const emptyLineClassExtension: Extension = [emptyLineClassField];
