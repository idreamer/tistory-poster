import {
	App,
	Editor,
	MarkdownRenderer,
	MarkdownView,
	Modal,
	Plugin,
	PluginSettingTab,
	Setting,
	requestUrl,
} from "obsidian";

interface TistoryPosterPluginSettings {
	accessToken: string;
	blogName: string;
	tags: string;
}

const DEFAULT_SETTINGS: TistoryPosterPluginSettings = {
	accessToken: "",
	blogName: "",
	tags: "",
};

export default class TistoryPosterPlugin extends Plugin {
	settings: TistoryPosterPluginSettings;

	async onload() {
		await this.loadSettings();

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "post-editor-note",
			name: "Post the editor note",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const tagModal = new TagModal(
					this.app,
					async (tags: string) => {
						const el = document.createElement("div");
						await MarkdownRenderer.renderMarkdown(
							editor.getValue(),
							el,
							this.app.workspace.getActiveFile()?.path ?? "/",
							view
						);

						await postToTistory({
							accessToken: this.settings.accessToken,
							blogName: this.settings.blogName,
							title: view.getDisplayText(),
							content: el.innerHTML,
							tags,
						});
					}
				);

				tagModal.open();
			},
		});
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TistoryPosterSetting(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class TagModal extends Modal {
	tags: string;
	onSubmit: (tags: string) => void;

	constructor(app: App, onSubmit: (tags: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h1", { text: "Insert tags" });

		new Setting(contentEl).setName("Tags").addText((text) =>
			text.onChange((value) => {
				this.tags = value;
			})
		);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Submit")
				.setCta()
				.onClick(() => {
					this.close();
					this.onSubmit(this.tags);
				})
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class TistoryPosterSetting extends PluginSettingTab {
	plugin: TistoryPosterPlugin;

	constructor(app: App, plugin: TistoryPosterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl("h2", { text: "Blog" });

		new Setting(containerEl)
			.setName("Setting Access Token")
			.setDesc(
				"This is a secret token to post an article to tistory blog"
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.accessToken)
					.onChange(async (value) => {
						this.plugin.settings.accessToken = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Setting Blog Name")
			.setDesc("This is a blog name that you want to post an article ")
			.addText((text) => {
				text.setPlaceholder("Enter your blog name")
					.setValue(this.plugin.settings.blogName)
					.onChange(async (value) => {
						this.plugin.settings.blogName = value;
						await this.plugin.saveSettings();
					});
			});
	}
}

type PostParams = {
	accessToken: string;
	blogName: string;
	title: string;
	content: string;
	tags?: string;
};

async function postToTistory({
	accessToken,
	blogName,
	title,
	content,
	tags = "",
}: PostParams) {
	const queries = `access_token=${accessToken}&output=json&blogName=${blogName}&title=${title}&content=${encodeURIComponent(
		content
	)}&visibility=1&category=0&tag=${tags}`;
	const url = `https://www.tistory.com/apis/post/write?${queries}`;

	try {
		await requestUrl({
			url,
			method: "POST",
		});
	} catch (err) {
		console.log("error: ", err);
		throw new Error(err);
	}
}
