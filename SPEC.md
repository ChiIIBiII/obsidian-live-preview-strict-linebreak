# Line break specification

This document defines exactly which newlines the plugin marks, and why.

## The rule

> **Only a blank line may produce a visual block break.**

This is a WYSIWYG invariant, not a lint pass. Obsidian's Live Preview shows every
newline as a line break, so the editor implies that pressing <kbd>Enter</kbd> once
started a new block. Often it did not — Markdown silently merges the lines, or the
two blocks run together without the separator they are supposed to have. The plugin
makes that visible.

Every newline in the document gets one of three verdicts.

| Verdict | What it means | How it is shown |
| --- | --- | --- |
| **joined** | Markdown removes this line break and merges the two lines into one paragraph. | The line break is **replaced** by the *joined line break* indicator (default `↵`). The lines render as one, exactly as they will in Reading view. |
| **separated** | Two real blocks with no blank line between them. The break is real, but the canonical form has a blank line. | The line break is **kept**. The *missing blank line* indicator (default `¶`) is appended at the end of the line. |
| **none** | The single newline is the canonical separator here. | Nothing. |

Both indicators are configurable in **Settings → Live Preview Strict Line Break**.

Only the **joined** decoration replaces the newline, because only there do the lines
genuinely merge. Replacing a **separated** newline would pull the next block onto the
previous line — a heading swallowing the paragraph under it, prose rendering inside a
code block — which would misrepresent the layout and diverge from Reading view.

## Where the indicator is drawn

The *joined* indicator always replaces the newline itself.

The *missing blank line* indicator normally sits at the end of the upper line. Some
blocks are replaced by a rendered widget in Live Preview and have no editable line to
hang it on — math blocks (`$$`), tables, and diagram fences (` ```mermaid `). When the
upper line belongs to one of those, the indicator moves to the **start of the lower
line** instead. If both sides are widget-rendered (a table directly followed by a math
block, say) the indicator is dropped rather than rendered invisibly.

Ordinary fenced code, blockquotes and callouts keep their source lines in Live Preview,
so they use the normal end-of-line placement.

## Blank lines

A blank line between two blocks is styled as a paragraph gap (`--p-spacing`, matching
Reading view) and the whole separator is protected from cursor movement. Additional
consecutive blank lines are left untouched and render as ordinary empty lines.

## Verdict by element

`before` / `after` describe the newline at the element's upper and lower boundary;
`inside` describes newlines between the element's own lines. Because `after` element A
and `before` element B are the *same* newline, a boundary is **separated** when either
side calls for a blank line.

### Text blocks

| Element | Before | Inside | After |
| --- | --- | --- | --- |
| Paragraph | separated | **joined** | separated |
| Hard break (`␣␣⏎`, `\⏎`, <kbd>Shift</kbd>+<kbd>Enter</kbd>) | – | none | – |
| ATX heading `# foo` | separated | n/a | separated |
| Setext heading `Title` / `===` | separated | **none** – the underline belongs to the text above | separated |
| Thematic break `***`, `___`, `---` | separated | n/a | separated |

### Quotes and callouts

| Element | Before | Inside | After |
| --- | --- | --- | --- |
| Blockquote `>` | separated | **joined** – `> a` / `> b` is one paragraph | separated |
| Callout `> [!note] Title` | separated | title → body **none**; body lines **joined** | separated |
| Nested callout `> >` | separated | as above, one level down | separated |

A bare `>` line counts as blank, so it splits a quote into two paragraphs.

### Lists

| Element | Before | Inside | After |
| --- | --- | --- | --- |
| Bullet / ordered / task list | separated | between items **none** | separated |
| Nested list | none | **none** | separated |
| Item continuation (`- foo` / `␣␣bar`) | n/a | **joined** | n/a |
| Other blocks inside an item (code, table, …) | separated | per that element | separated |

### Code, math, diagrams

| Element | Before | Inside | After |
| --- | --- | --- | --- |
| Fenced code ` ``` ` / `~~~` | separated | **none** – literal | separated |
| Mermaid ` ```mermaid ` | separated | **none** – literal | separated |
| Indented code (4 spaces) | separated | **none** – literal | separated |
| Math block `$$` | separated | **none** – literal | separated |

### Tables

| Element | Before | Inside | After |
| --- | --- | --- | --- |
| Table | separated | **none** – header, delimiter and body rows | separated |

### Metadata and references

| Element | Before | Inside | After |
| --- | --- | --- | --- |
| YAML properties `---` | – | **none** | none – Live Preview owns this region |
| Footnote definition `[^id]: text` | separated | continuation lines **joined** | separated |
| Sibling footnote / link definitions | – | **none** | – |
| Link reference `[a]: url` | separated | n/a | separated |
| Block identifier `^id` on its own line | **none** – it attaches to the block above | n/a | separated |

### HTML and inline

| Element | Before | Inside | After |
| --- | --- | --- | --- |
| HTML block (`<div>`, `<pre>`, `<!-- -->`, custom tags) | separated | **none** – literal, Markdown is not processed inside | separated |
| Embeds `![[Note]]` | separated | n/a | separated |
| Inline spans `**b**` `==h==` `` `c` `` `$m$` `[[link]]` `[^ref]` `#tag` | – | **joined** – they may span a newline, which becomes a space | – |

## Blocks that silently fail to form

Some constructs cannot interrupt a paragraph. Written directly under a line of text
they are **not** the block they look like — they are ordinary paragraph text, and the
newline above them is therefore **joined**, not **separated**:

| Written as | Actually renders as |
| --- | --- |
| `text` ⏎ `␣␣␣␣foo` | one paragraph — not indented code |
| `text` ⏎ `[a]: /url` | one paragraph — not a link definition |
| `text` ⏎ `5. foo` | one paragraph — ordered lists must start at `1.` to interrupt |
| `text` ⏎ `<my-tag>` | one paragraph — HTML block type 7 cannot interrupt |

These are the cases the plugin is most useful for: the joined indicator appears
exactly where the writer thought they had started a block and had not.

One related trap has a different verdict: `text` ⏎ `-` and `text` ⏎ `---` are a setext
heading, not a list item or a thematic break. The underline attaches to the paragraph
above it, so that newline is **none** — but the newline *below* the underline is
**separated**, because a heading wants a blank line after it.

## Lazy continuation

A line directly below a blockquote or a list item is absorbed into it:

```md
> quote
text            <- becomes part of the quote

- item
text            <- becomes part of the item
```

Both are **joined**, which is why the blank line after a quote or a list is mandatory.

## Implementation

`src/editor/blockClassifier.ts` classifies every line and assigns it a paragraph id,
a leaf block id and a list id. `newlineVerdict()` compares two adjacent lines:

1. Either line blank, or either line is frontmatter → `none`
2. Same paragraph id → `joined`
3. Same block id → `none` (code lines, table rows, …)
4. The next line attaches to this one → `none` (setext underline, callout body, sibling
   definition, block identifier)
5. The next line opens an item of the same list → `none`
6. Otherwise → `separated`

Lines ending in a hard break are excluded before the verdict is taken.

The classifier is a self-contained CommonMark block parser and deliberately does not
use Obsidian's syntax tree, which is unreliable mid-edit inside blockquotes and
callouts and cannot be tested outside Obsidian.
