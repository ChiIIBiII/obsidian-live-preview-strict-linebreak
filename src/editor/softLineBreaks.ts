import { Extension, RangeSetBuilder, StateEffect, StateField, Transaction } from "@codemirror/state";
import {
	Decoration,
	DecorationSet,
	EditorView,
	WidgetType,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { MyPluginSettings } from "../settings";
import { editorLivePreviewField } from "obsidian";

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

function endsWithMarkdownHardBreak(lineText: string): boolean {
	return lineText.endsWith("  ") || lineText.endsWith("\\");
}

function nextIsListItem(state: Transaction["state"], lineNumber: number): boolean {
	const line = state.doc.line(lineNumber + 1);
	const tree = syntaxTree(state);
	let node: any = tree.resolve(line.from + 1);
	
	// console.log(`Line ${lineNumber}: "${line.text}"`);
	while (node) {
		// console.log(`  - Node: ${node.name}`);
		if (node.name.includes("list")) {
			return true;
		}
		node = node.parent;
	}
	
	return false;
}

function createSoftLineBreaksField(settings: MyPluginSettings): StateField<DecorationSet> {
	return StateField.define<DecorationSet>({
		create() {
			return Decoration.none;
		},
		update(oldState: DecorationSet, transaction: Transaction) {
			if (!transaction.state.field(editorLivePreviewField)) {
				return Decoration.none;
			}
			const builder = new RangeSetBuilder<Decoration>();
			const doc = transaction.state.doc;

			for (let lineNumber = 1; lineNumber < doc.lines; lineNumber++) {
				const line = doc.line(lineNumber);
				const nextLine = doc.line(lineNumber + 1);

				if (line.text.trim().length === 0 || nextLine.text.trim().length === 0) continue;
				if (endsWithMarkdownHardBreak(line.text)) continue;
				if (nextIsListItem(transaction.state, lineNumber)) continue;

				builder.add(line.to, line.to + 1, createSoftBreakDecoration(settings.softBreakIndicator));
			}

			return builder.finish();
		},

		provide(field: StateField<DecorationSet>): Extension {
			return EditorView.decorations.from(field);
		},
	});
}

export function softLineBreaksExtension(settings: MyPluginSettings): Extension {
	return [createSoftLineBreaksField(settings)];
}
