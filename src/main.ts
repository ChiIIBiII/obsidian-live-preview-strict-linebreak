import { Notice, Plugin } from "obsidian";
import { syntaxTree } from "@codemirror/language";
import { softLineBreaksExtension, getLastSeenEditorView } from "./editor/softLineBreaks";
import { emptyLineClassExtension } from "./editor/emptyLineClass";
import { MyPluginSettings, DEFAULT_SETTINGS, MyPluginSettingTab } from "./settings";

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerEditorExtension([
			softLineBreaksExtension(this.settings)
		]);

		this.addSettingTab(new MyPluginSettingTab(this.app, this));

		this.addCommand({
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
					let node: any = useInner ? tree.resolveInner(pos, side) : tree.resolve(pos, side);
					while (node) {
						parts.push(`${node.name} [${node.from}..${node.to}]`);
						node = node.parent;
					}
					return `${label} (pos=${pos}, side=${side})\n  ${parts.join("\n  ")}`;
				};

				const stackAt = (label: string, pos: number, side: -1 | 0 | 1) => {
					const parts: string[] = [];
					for (let iter: any = tree.resolveStack(pos, side); iter; iter = iter.next) {
						parts.push(`${iter.node.name} [${iter.node.from}..${iter.node.to}]`);
					}
					return `${label} (pos=${pos}, side=${side})\n  ${parts.join("\n  ")}`;
				};

				const posForLineCheck = line.from + Math.min(1, line.to - line.from);

				console.log(
					[
						"[Live Preview Strict Line Break] Syntax node hierarchy",
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
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {}
}
