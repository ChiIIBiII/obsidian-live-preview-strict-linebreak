import { Notice, Plugin } from "obsidian";
import { softLineBreaksExtension } from "./editor/softLineBreaks";
import { emptyLineClassExtension } from "./editor/emptyLineClass";
import { MyPluginSettings, DEFAULT_SETTINGS, MyPluginSettingTab } from "./settings";

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerEditorExtension([
			softLineBreaksExtension(this.settings),
			emptyLineClassExtension
		]);

		this.addSettingTab(new MyPluginSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {}
}
