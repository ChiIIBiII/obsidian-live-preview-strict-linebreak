import { App, PluginSettingTab, Setting } from "obsidian";
import type MyPlugin from "./main";

export interface MyPluginSettings {
	softBreakIndicator: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	softBreakIndicator: "↵",
};

export class MyPluginSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Soft break indicator")
			.setDesc("Character to display for soft line breaks (newlines within paragraphs)")
			.addText((text) =>
				text
					.setPlaceholder("↵")
					.setValue(this.plugin.settings.softBreakIndicator)
					.onChange(async (value) => {
						this.plugin.settings.softBreakIndicator = value || "↵";
						await this.plugin.saveSettings();
					})
			);
	}
}
