import { App, PluginSettingTab, Setting } from "obsidian";
import type StrictLineBreakPlugin from "./main";

export interface StrictLineBreakSettings {
	/** Shown where Markdown joins two lines into one. Replaces the line break. */
	softBreakIndicator: string;
	/** Shown where two blocks are missing the blank line between them. Keeps the line break. */
	blockBreakIndicator: string;
}

export const DEFAULT_SETTINGS: StrictLineBreakSettings = {
	softBreakIndicator: "↵",
	blockBreakIndicator: "¶",
};

export class StrictLineBreakSettingTab extends PluginSettingTab {
	plugin: StrictLineBreakPlugin;

	constructor(app: App, plugin: StrictLineBreakPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private addIndicatorSetting(
		name: string,
		desc: string,
		key: keyof StrictLineBreakSettings
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS[key])
					.setValue(this.plugin.settings[key])
					.onChange(async (value) => {
						this.plugin.settings[key] = value || DEFAULT_SETTINGS[key];
						await this.plugin.saveSettings();
						// Force open editors to rebuild their decorations.
						this.plugin.app.workspace.updateOptions();
					})
			);
	}

	display(): void {
		this.containerEl.empty();

		this.addIndicatorSetting(
			"Joined line break",
			"Shown where Markdown removes the line break and merges the two lines into one paragraph.",
			"softBreakIndicator"
		);

		this.addIndicatorSetting(
			"Missing blank line",
			"Shown where two blocks follow each other without the blank line between them.",
			"blockBreakIndicator"
		);
	}
}
