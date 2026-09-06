# Testing guide

How to verify the plugin's behaviour by hand. [SPEC.md](SPEC.md) defines what *should*
happen; this document is how you check that it does.

## 1. Build into the dev vault

```bash
npm install
npm run dev          # watch mode, rebuilds on save
```

`npm run build:test` does the same as a one-shot build. Either writes `main.js`,
`manifest.json` and `styles.css` into:

```
test-vault/.obsidian/plugins/live-preview-strict-linebreak/
```

`test-vault/` is git-ignored. It ships with the plugin pre-enabled in
`community-plugins.json` and with the fixture note `Strict line break test.md`, which
exercises every construct in the spec.

## 2. Open the vault

**Obsidian → Open another vault → Open folder as vault**, pick `test-vault/`, and trust
the author when prompted. Confirm the plugin is on under **Settings → Community
plugins**.

Open `Strict line break test.md` and switch to **Live Preview** (`Ctrl/Cmd+E` toggles
modes). The plugin is deliberately inert in Reading view and in Source mode.

## 3. The two indicators

| Indicator | Default | Meaning | Placement |
| --- | --- | --- | --- |
| Joined line break | `↵` | Markdown removes this line break and merges the two lines. | **Replaces** the newline — the lines render as one. |
| Missing blank line | `¶` | Two real blocks with no blank line between them. | **Keeps** the newline; sits at the end of the upper line, or at the start of the lower one when the upper line is a widget (math, table, mermaid). |

The distinction is the thing to keep an eye on while testing. `↵` means *the layout you
see is what Markdown produces*. `¶` means *the layout is fine, the blank line is
missing*. If you ever see two lines visually merged with a `¶` between them, or two
lines kept apart with a `↵` between them, that is a bug.

## 4. The reference check

Split the screen: the same note in Live Preview on the left, Reading view on the right.
Turn **Settings → Editor → Strict line breaks** **on**, so Reading view obeys the same
Markdown rule the plugin visualises.

Then:

> **Every `↵` in Live Preview must correspond to two lines that Reading view joins into
> one. Every `¶` must correspond to two lines that Reading view keeps apart.**

That single rule catches almost every regression. Scroll both panes together through the
fixture note.

## 5. Section-by-section expectations

Walk the fixture top to bottom.

### 1 — Paragraphs

- ✅ `↵` after the first two lines of the three-line paragraph.
- ❌ Nothing after the line ending in two trailing spaces, or the one ending in `\` —
  those are hard breaks and already render as real breaks.
- ❌ Nothing across a blank line; the blank renders as a paragraph gap instead.

### 2 — Headings

- ✅ `¶` above and below `### Heading right after text`.
- ✅ `↵` inside the two-line paragraph below it.
- ❌ Nothing between `Setext heading` and `==============`, or between
  `Another setext heading` and `----------------------`. The underline belongs to the
  text above it.
- ✅ `¶` after each underline, before the text below.

### 3 — Code

- ❌ **Zero markers inside any code.** Not in the ```` ```js ```` fence, not on the blank
  line inside it, not in the `~~~` fence, not in the nested ```` ```` ```` fence, and not
  in the indented code block including its internal blank line.
- ✅ `¶` after the closing ```` ``` ````, before `Text directly after a closing fence.`
- ✅ `↵` inside `` Inline `code `` / `` across lines` `` — backticks don't make it code.

### 4 — Math and diagrams

Every marker in this section is a **leading** `¶`, at the *start* of the line below.
Math blocks, tables and mermaid fences are replaced by rendered widgets in Live Preview,
so there is no editable line above to attach a trailing marker to.

- ✅ `¶` before `Text directly after multiline block.`
- ✅ `¶` before `Text after single line math.`
- ✅ `¶` before `Text directly after a diagram.`
- ❌ Nothing inside the `$$ … $$` block or the mermaid fence.

### 5 — Lists

- ❌ Nothing between sibling items, nested items, or task items.
- ✅ `↵` after `- item with a continuation line`.
- ✅ `↵` inside the two-line second paragraph of a list item.
- ✅ `¶` on `- Item with code and no empty lines` (before the fence inside the item) and
  after that fence's closing ```` ``` ````.
- ❌ Nothing around the fence in the following item, which *does* have the blank lines.
  Comparing those two items side by side is the clearest demonstration of `¶`.

### 6 — Blockquotes and callouts

- ✅ `↵` between consecutive quote lines.
- ❌ Nothing across the bare `>` separator line — that counts as blank.
- ✅ `↵` on the lazy-continuation line that has no `>`.
- ❌ Nothing after `> [!note] Callout title` — the title is structurally separate — but
  ✅ `↵` between the two body lines. Same for the `> [!warning]` callout with no title.
- ❌ Nothing between quote list items, ✅ `↵` on the item continuation.
- ✅ `↵` between the two nested `> >` lines.

### 7 — Tables

- ❌ Nothing between any table rows, in either table.
- ✅ Leading `¶` before each `text directly after table`, including under the pipe-less
  `a | b` table.
- ✅ `↵` inside `Paragraph with a pipe | character` — one pipe doesn't make a table.

### 8 — HTML and definitions

- ❌ Nothing inside the `<div>` block, and nothing between the two `[ref]:` lines —
  consecutive definitions are siblings.
- ✅ `↵` on the footnote definition's continuation line.
- ✅ `↵` in the paragraph containing an inline `<b>` tag.

### 9 — Thematic break

- ❌ Nothing around `---`; it has blank lines on both sides.

### 10 — Obsidian links

- ✅ `↵` between the two `[[…]]` lines and between the two `![[…]]` embeds. Markdown
  joins those, so a blank line is genuinely required to separate them.

## 6. Verify with the console instead of by eye

Open the developer console (`Ctrl+Shift+I` / `Cmd+Opt+I`), then run the command palette
(`Ctrl/Cmd+P`) → **"Log block classification of current note"**:

```
line kind       paragraph block    list     newline   text
   1 verbatim   para=-   block=1   list=-   none      "---"
  10 paragraph  para=6   block=6   list=-   joined    "This is line one of a paragraph"
  39 verbatim   para=-   block=9   list=-   none      "```js"
  44 verbatim   para=-   block=9   list=-   separated "```"
```

`newline` is the verdict for the line break at the end of that line. This is the fastest
way to check a note of your own — and the only way to tell a *dropped* indicator from a
*missing* one, since both look identical in the editor.

The companion command **"Log syntax node hierarchy at cursor"** dumps Obsidian's own
parse tree at the cursor. The plugin doesn't use it, but it's useful when Obsidian and
the classifier disagree about what a construct is.

## 7. Live-editing checks

The classifier is stateful, so test it mid-type, not just on a saved file.

1. Put the cursor at the end of a line inside the ```` ```js ```` fence and press Enter a
   few times. No markers should appear on the new blank lines.
2. Type a new ```` ``` ```` at the bottom of the note without closing it. Everything
   below should go marker-free; the markers should return the moment you close it.
3. Delete the closing `~~~` of the tilde fence. The rest of the note becomes code —
   correct, that's what Markdown does. Restore it.
4. Add two trailing spaces to a line inside a paragraph. Its `↵` should vanish at once.
5. Type `- ` at the start of a paragraph's second line. The `↵` above should become a
   `¶` — it stopped being a continuation and became a list.
6. Add a `|---|---|` line under `Paragraph with a pipe | character`. It becomes a table,
   the `↵` becomes a leading `¶`.
7. Delete the blank line between two paragraphs. The gap becomes a `¶`. Put it back.

## 8. Settings

- **Settings → Live Preview Strict Line Break** has two fields, **Joined line break** and
  **Missing blank line**. Change one and every affected marker in the open note should
  update **without typing anything** — the settings tab calls `workspace.updateOptions()`.
- Clearing a field falls back to its default (`↵` / `¶`).
- Set both to the same character to confirm you can still tell them apart by behaviour:
  the joined one merges its two lines, the other doesn't.

## 9. Mode checks

| Mode | Expected |
| --- | --- |
| Live Preview | Markers shown |
| Reading view (`Ctrl/Cmd+E`) | No markers, and the document renders normally |
| Source mode (**Settings → Editor → Source mode**) | No markers |

Switching modes back and forth should restore the markers immediately.

## 10. Regression sweep on real notes

Open a few of your own notes, run **"Log block classification of current note"**, and
scan the `kind` column for anything mis-typed — most usefully:

- `paragraph` on a line that is really code
- `verbatim` swallowing the rest of the note, which almost always means an unbalanced
  fence
- `separated` between two lines that Reading view joins, or `joined` between two it
  keeps apart

`classifyLines()` is a pure function over `string[]`, so anything you find can be
reproduced outside Obsidian with a couple of lines and added to the fixture note.

## Known limitations

- When **both** sides of a boundary are widget-rendered — a table directly followed by a
  math block, say — there is no editable line to attach the indicator to, so it is
  dropped rather than drawn invisibly. The console command still reports `separated`.
- The plugin only runs in Live Preview. Reading view and Source mode are untouched by
  design.
