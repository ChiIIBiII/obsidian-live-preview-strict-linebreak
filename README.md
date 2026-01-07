# Live Preview Strict Line Break

An Obsidian plugin that enforces strict line breaks in Live Preview mode. Single line breaks are visualized with a custom character at 50% opacity, making it easier to see where soft line breaks occur without affecting document rendering.

## Features

- Displays a custom marker (¬) for single line breaks in Live Preview mode
- Visual feedback at 50% opacity for clear but non-intrusive visibility
- Seamless integration with Obsidian's native Live Preview renderer
- No impact on exported or final document appearance

## Installation

### From Obsidian Community Plugins

1. Open Obsidian **Settings** → **Community plugins** → **Browse**
2. Search for "Live Preview Strict Line Break"
3. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [release](https://github.com/ChiIIBiII/obsidian-live-preview-strict-linebreak/releases)
2. Create a folder: `<your-vault>/.obsidian/plugins/live-preview-strict-linebreak/`
3. Copy the downloaded files into that folder
4. Reload Obsidian
5. Enable the plugin in **Settings** → **Community plugins**

## Development

### Prerequisites

- Node.js v16 or higher
- npm or yarn

### Setup

```bash
npm install
```

### Development (Watch Mode)

```bash
npm run dev
```

This will compile TypeScript to JavaScript and watch for changes, automatically rebuilding as you edit.

### Build for Release

```bash
npm run build
```

This creates the production bundle in `main.js`.

### Linting

```bash
npm run lint
```

Uses ESLint to check code quality.

## Publishing

### Initial Release Setup

1. Update version in `manifest.json` (e.g., `1.0.0`)
2. Commit and push changes:
   ```bash
   git add .
   git commit -m "Release v1.0.0"
   git push
   ```
3. Create a GitHub release with tag matching the version (no leading `v`):
   ```bash
   git tag 1.0.0
   git push origin 1.0.0
   ```
4. On GitHub, create a [new release](https://github.com/ChiIIBiII/obsidian-live-preview-strict-linebreak/releases) and attach:
   - `manifest.json`
   - `main.js`
   - `styles.css`

### Submit to Obsidian Community Plugins

1. Fork [obsidian-releases](https://github.com/obsidianmd/obsidian-releases)
2. Add your plugin to `community-plugins.json`:
   ```json
   {
     "id": "live-preview-strict-linebreak",
     "name": "Live Preview Strict Line Break",
     "author": "ChiIIBiII",
     "description": "Enables strict line breaks in Obsidian's Live Preview mode. Single line breaks are shown as a custom character with 50% opacity.",
     "repo": "ChiIIBiII/obsidian-live-preview-strict-linebreak"
   }
   ```
3. Create a Pull Request
4. Wait for review and approval (typically 1–3 weeks)

### Version Updates

For subsequent releases:

1. Update `manifest.json` version
2. Use `npm version patch|minor|major` to bump versions and update `versions.json` automatically
3. Commit, tag, push, and create a new GitHub release with the artifacts

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

See [LICENSE](LICENSE) for details.
