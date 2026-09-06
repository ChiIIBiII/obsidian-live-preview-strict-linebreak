/* eslint-disable no-console -- these are opt-in diagnostic commands whose
   whole purpose is to print to the developer console. */
import { Notice, Plugin } from "obsidian";
import { syntaxTree } from "@codemirror/language";
import { getLastSeenEditorView, getDocumentLineClassifications } from "../editor/softLineBreaks";
import { newlineVerdict } from "../editor/blockClassifier";

const LOG_PREFIX = "[Live Preview Strict Line Break]";

export function registerDebugCommands(plugin: Plugin): void {
	plugin.addCommand({
		id: "log-syntax-node-hierarchy",
		name: "Log syntax node hierarchy at cursor",
		editorCallback: (editor) => {
			const editorView = getLastSeenEditorView();
			if (!editorView) {
				new Notice("No active editor view found.");
				return;
			}

			const cursor = editor.getCursor();
			const cursorPos = editor.posToOffset(cursor);
			const state = editorView.state;
			const line = state.doc.lineAt(cursorPos);
			const tree = syntaxTree(state);

			const chainAt = (label: string, pos: number, side: -1 | 0 | 1, useInner = false) => {
				const parts: string[] = [];
				let node = useInner ? tree.resolveInner(pos, side) : tree.resolve(pos, side);
				for (let current: typeof node | null = node; current; current = current.parent) {
					parts.push(`${current.name} [${current.from}..${current.to}]`);
				}
				return `${label} (pos=${pos}, side=${side})\n  ${parts.join("\n  ")}`;
			};

			const stackAt = (label: string, pos: number, side: -1 | 0 | 1) => {
				const parts: string[] = [];
				for (
					let iter: ReturnType<typeof tree.resolveStack> | null = tree.resolveStack(pos, side);
					iter;
					iter = iter.next
				) {
					parts.push(`${iter.node.name} [${iter.node.from}..${iter.node.to}]`);
				}
				return `${label} (pos=${pos}, side=${side})\n  ${parts.join("\n  ")}`;
			};

			const posForLineCheck = line.from + Math.min(1, line.to - line.from);

			console.log(
				[
					`${LOG_PREFIX} Syntax node hierarchy`,
					`cursor: line=${cursor.line + 1}, ch=${cursor.ch}, offset=${cursorPos}`,
					`cm line: number=${line.number}, from=${line.from}, to=${line.to}, text=${JSON.stringify(line.text)}`,
					chainAt("cursor", cursorPos, 0),
					chainAt("cursorInner", cursorPos, 0, true),
					stackAt("cursorStack", cursorPos, 0),
					chainAt("lineStart", line.from, 1),
					chainAt("lineStartInner", line.from, 1, true),
					stackAt("lineStartStack", line.from, 1),
					chainAt("lineCheckPos", posForLineCheck, 1),
					chainAt("lineCheckPosInner", posForLineCheck, 1, true),
					stackAt("lineCheckPosStack", posForLineCheck, 1),
				].join("\n")
			);

			new Notice("Logged syntax node hierarchy to console.");
		},
	});

	plugin.addCommand({
		id: "log-block-classification",
		name: "Log block classification of current note",
		editorCallback: () => {
			const editorView = getLastSeenEditorView();
			if (!editorView) {
				new Notice("No active editor view found.");
				return;
			}

			const state = editorView.state;
			const classifications = getDocumentLineClassifications(state);
			const rows = classifications.map((classification, index) => {
				const lineNumber = index + 1;
				return [
					String(lineNumber).padStart(4, " "),
					classification.kind.padEnd(10, " "),
					`para=${classification.paragraphId ?? "-"}`.padEnd(8, " "),
					`block=${classification.blockId ?? "-"}`.padEnd(9, " "),
					`list=${classification.listId ?? "-"}`.padEnd(8, " "),
					newlineVerdict(classifications, index).padEnd(9, " "),
					JSON.stringify(state.doc.line(lineNumber).text),
				].join(" ");
			});

			console.log(
				[
					`${LOG_PREFIX} Block classification`,
					"line kind       paragraph block    list     newline   text",
					...rows,
				].join("\n")
			);

			new Notice("Logged block classification to console.");
		},
	});
}
