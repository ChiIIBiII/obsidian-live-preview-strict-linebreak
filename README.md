# Live Preview Strict Line Break

An Obsidian plugin that makes Live Preview honest about line breaks. Live Preview shows
every newline as a line break, which implies that pressing Enter once started a new
block. Often it did not: Markdown silently merges the lines, or two blocks run together
without the blank line that separates them. This plugin marks both cases.

The rule is a single invariant: **only a blank line may produce a visual block break.**

## Features

- **Joined line breaks** (default `↵`) — where Markdown removes the line break and
  merges the two lines into one paragraph, the break is replaced by the indicator and
  the lines render as one, exactly as they will in Reading view.
- **Missing blank lines** (default `¶`) — where two real blocks follow each other with
  no blank line between them, the break is kept and the indicator is drawn beside it:
  at the end of the upper line, or at the start of the lower one when the upper line is
  a rendered widget (math, table, mermaid).
- Both indicators are configurable, and both render at reduced opacity.
- Blank lines are styled as the paragraph gap Reading view uses.
- Nothing is marked inside code blocks, math blocks, tables, frontmatter or HTML, and
  nothing is marked between list items or table rows — there the single newline is the
  correct separator.
- Purely visual: the document on disk is never changed.

## Documentation

- **[SPEC.md](SPEC.md)** — the complete per-element specification of which newlines are
  marked and why.
- **[TESTING.md](TESTING.md)** — how to verify the behaviour by hand against the fixture
  note in the dev vault.

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

### Testing

`npm run build:test` builds into `test-vault/`, a git-ignored dev vault with the plugin
pre-enabled and a fixture note covering every construct in the spec. See
[TESTING.md](TESTING.md) for the full procedure.

### Behaviour changes

`SPEC.md` is the source of truth for which newlines get marked. Change it together with
`src/editor/blockClassifier.ts`, and extend the fixture note so the new case is covered
by [TESTING.md](TESTING.md).

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
     "description": "Marks line breaks that Markdown removes, and block boundaries that are missing their blank line, in Live Preview.",
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
