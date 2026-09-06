import { Plugin } from "obsidian";
import { softLineBreaksExtension } from "./editor/softLineBreaks";
import { registerDebugCommands } from "./commands/debugCommands";
import { StrictLineBreakSettings, DEFAULT_SETTINGS, StrictLineBreakSettingTab } from "./settings";

export default class StrictLineBreakPlugin extends Plugin {
	settings: StrictLineBreakSettings;

	async onload() {
		await this.loadSettings();

		this.registerEditorExtension([softLineBreaksExtension(this.settings)]);

		this.addSettingTab(new StrictLineBreakSettingTab(this.app, this));

		registerDebugCommands(this);
	}

	async loadSettings() {
		const stored = (await this.loadData()) as Partial<StrictLineBreakSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {}
}
