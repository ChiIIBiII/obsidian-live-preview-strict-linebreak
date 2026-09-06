/**
 * Line level Markdown block classifier.
 *
 * The plugin's rule is a WYSIWYG invariant, not a lint pass: **only a blank
 * line may produce a visual block break.** Every other newline is either
 * structural inside a single construct (list items, table rows, code lines) or
 * it is a newline the reader should be told about. See SPEC.md.
 *
 * Each line is classified and given a set of identities; comparing two adjacent
 * lines then yields one of three verdicts (see `newlineVerdict`):
 *
 *   "joined"    Markdown merges the two lines. The newline disappears.
 *   "separated" Two real blocks that are missing the blank line between them.
 *   "none"      The single newline is the canonical separator. Leave it alone.
 *
 * The classifier is deliberately independent of Obsidian's syntax tree: the
 * tree is unreliable while editing (especially inside blockquotes and callouts)
 * and cannot be tested outside of Obsidian.
 */

export type BlockKind =
	/** Empty line (or a blockquote line with no content), i.e. a block separator. */
	| "blank"
	/** Paragraph content — a newline between two lines of one paragraph is eaten. */
	| "paragraph"
	/** Verbatim content: fenced/indented code, math blocks, HTML blocks, frontmatter. */
	| "verbatim"
	/** Any other block level construct. */
	| "structural";

export interface LineClassification {
	kind: BlockKind;
	/** Lines sharing a non-null id belong to one paragraph, so the newline is eaten. */
	paragraphId: number | null;
	/** Lines sharing a non-null id belong to one leaf block (code fence, table, ...). */
	blockId: number | null;
	/** Identity of the enclosing list, if any. */
	listId: number | null;
	/** This line opens a list item. */
	startsListItem: boolean;
	/** The newline above this line is structural (setext underline, callout body, sibling definition). */
	attachesToPrevious: boolean;
	/** Part of the YAML frontmatter, which Live Preview replaces with the properties widget. */
	isFrontmatter: boolean;
	/**
	 * Live Preview replaces this line with a rendered widget — math blocks, tables
	 * and diagram fences — so it has no `cm-line` of its own and cannot carry an
	 * end-of-line indicator.
	 */
	rendersAsWidget: boolean;
}

export type NewlineVerdict = "none" | "joined" | "separated";

type Container = { type: "quote" } | { type: "item"; indent: number };

type Leaf =
	| { type: "paragraph"; id: number }
	| { type: "fenced"; marker: string; length: number; rendersAsWidget: boolean }
	| { type: "math" }
	| { type: "frontmatter" }
	| { type: "html"; terminator: string | null }
	| { type: "indentedCode" }
	| { type: "table" };

/** A line trait that makes the *following* line attach to it, or vice versa. */
type LineTrait = "callout-header" | "link-def" | "footnote-def" | null;

const QUOTE_PREFIX = /^ {0,3}> ?/;
const LIST_ITEM = /^( {0,3})(?:([-+*])|(\d{1,9})([.)]))(?:([ \t]+)|$)/;
const ATX_HEADING = /^ {0,3}#{1,6}([ \t]|$)/;
const THEMATIC_BREAK = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t]*$/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const MATH_OPEN = /^ {0,3}\$\$/;
const FRONTMATTER_DELIMITER = /^(?:---|\.\.\.)[ \t]*$/;
const HTML_BLOCK_OPEN = /^ {0,3}<[!/?a-zA-Z]/;
const FOOTNOTE_DEFINITION = /^ {0,3}\[\^[^\]\s]+\]:/;
const LINK_REFERENCE_DEFINITION = /^ {0,3}\[[^\]]+\]:[ \t]*\S/;
const CALLOUT_HEADER = /^ {0,3}\[![^\]\n]+\][+-]?([ \t]|$)/;
const TABLE_DELIMITER_ROW = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const QUOTE_MARKERS = /^(?:[ \t]*>+[ \t]?)+/;
const BLOCK_IDENTIFIER = /^ {0,3}\^[a-zA-Z0-9-]+[ \t]*$/;

/** CommonMark HTML block type 1: ends at its closing tag, not at a blank line. */
const HTML_RAW_TEXT_TAGS = new Set(["pre", "script", "style", "textarea"]);
/** CommonMark HTML block type 6: known block level tags, may interrupt a paragraph. */
const HTML_BLOCK_TAGS = new Set([
	"address", "article", "aside", "base", "basefont", "blockquote", "body", "caption",
	"center", "col", "colgroup", "dd", "details", "dialog", "dir", "div", "dl", "dt",
	"fieldset", "figcaption", "figure", "footer", "form", "frame", "frameset", "h1", "h2",
	"h3", "h4", "h5", "h6", "head", "header", "hr", "html", "iframe", "legend", "li",
	"link", "main", "menu", "menuitem", "nav", "noframes", "ol", "optgroup", "option",
	"p", "param", "search", "section", "summary", "table", "tbody", "td", "tfoot", "th",
	"thead", "title", "tr", "track", "ul",
]);

/** Fenced languages that Live Preview renders as a widget instead of as source. */
const WIDGET_RENDERED_LANGUAGES = new Set(["mermaid"]);

const TAB_WIDTH = 4;

function expandTabs(text: string): string {
	return text.includes("\t") ? text.replace(/\t/g, " ".repeat(TAB_WIDTH)) : text;
}

function isBlank(text: string): boolean {
	return text.trim().length === 0;
}

function indentWidth(text: string): number {
	let width = 0;
	while (width < text.length && text[width] === " ") width++;
	return width;
}

function stripIndent(text: string, columns: number): string {
	let removed = 0;
	while (removed < columns && removed < text.length && text[removed] === " ") removed++;
	return text.slice(removed);
}

function matchListItem(text: string): { indent: number; consumed: number; canInterruptParagraph: boolean } | null {
	const match = LIST_ITEM.exec(text);
	if (!match) return null;

	const leading = (match[1] ?? "").length;
	const markerLength = match[2] ? 1 : (match[3] ?? "").length + 1;
	const spaces = (match[5] ?? "").length;
	const afterMarker = leading + markerLength;
	const contentIsEmpty = text.slice(afterMarker + spaces).trim().length === 0;

	// Per CommonMark: more than four spaces after the marker starts an indented
	// code block inside the item, so only one space belongs to the marker.
	const indent = spaces === 0 || spaces > 4 || contentIsEmpty ? afterMarker + 1 : afterMarker + spaces;

	// A list item may only interrupt a paragraph when it has content and, for
	// ordered lists, starts at 1 — otherwise "text\n5. x" would silently become
	// a list instead of the paragraph Markdown actually produces.
	const canInterruptParagraph = !contentIsEmpty && (Boolean(match[2]) || match[3] === "1");

	return { indent, consumed: Math.min(indent, text.length), canInterruptParagraph };
}

function isTableDelimiterRow(text: string): boolean {
	return text.includes("|") && text.includes("-") && TABLE_DELIMITER_ROW.test(text);
}

/** Rough container strip, only used to peek at the following lines. */
function stripQuoteMarkers(text: string): string {
	return text.replace(QUOTE_MARKERS, "");
}

/**
 * A blank line only stays part of an indented code block when a later line is
 * still indented far enough; otherwise it separates two blocks.
 */
function indentedCodeContinuesAfterBlank(
	lines: readonly string[],
	index: number,
	containerIndent: number
): boolean {
	for (let probe = index + 1; probe < lines.length; probe++) {
		const content = stripQuoteMarkers(lines[probe] ?? "");
		if (isBlank(content)) continue;
		return indentWidth(content) >= containerIndent + 4;
	}
	return false;
}

interface HtmlBlockStart {
	/** Lowercase string that closes the block, or null when a blank line closes it. */
	terminator: string | null;
	/** Only type 7 (a generic tag) has to wait for a blank line before it may start. */
	canInterruptParagraph: boolean;
}

function detectHtmlBlock(text: string): HtmlBlockStart | null {
	const trimmed = text.replace(/^ {0,3}/, "");
	if (!trimmed.startsWith("<")) return null;
	if (trimmed.startsWith("<!--")) return { terminator: "-->", canInterruptParagraph: true };
	if (trimmed.startsWith("<?")) return { terminator: "?>", canInterruptParagraph: true };
	if (trimmed.startsWith("<![CDATA[")) return { terminator: "]]>", canInterruptParagraph: true };
	if (/^<![A-Za-z]/.test(trimmed)) return { terminator: ">", canInterruptParagraph: true };

	const tag = /^<\/?([A-Za-z][A-Za-z0-9-]*)/.exec(trimmed)?.[1]?.toLowerCase();
	if (!tag) return null;
	if (HTML_RAW_TEXT_TAGS.has(tag)) return { terminator: `</${tag}>`, canInterruptParagraph: true };
	if (HTML_BLOCK_TAGS.has(tag)) return { terminator: null, canInterruptParagraph: true };
	return { terminator: null, canInterruptParagraph: false };
}

/**
 * Describes which block a line opens. `null` means "plain paragraph text",
 * i.e. a line that continues an open paragraph instead of starting a block.
 */
type LeafStart =
	| {
			kind: BlockKind;
			leaf: Leaf | null;
			trait?: LineTrait;
			attachesToPrevious?: boolean;
			rendersAsWidget?: boolean;
	  }
	| null;

interface LeafStartContext {
	/** True when a paragraph is open that this line could continue. */
	paragraphOpen: boolean;
	/**
	 * True when that paragraph is the innermost open block, i.e. every container
	 * prefix still matched. Constructs that "cannot interrupt a paragraph" are
	 * only blocked in that case — once a container prefix is missing the
	 * paragraph is closing anyway.
	 */
	paragraphDirectlyOpen: boolean;
	/** True when the line sits inside at least one blockquote (callout detection). */
	insideQuote: boolean;
	/** True when this is the very first line of the document (frontmatter). */
	atDocumentStart: boolean;
	/** Content of the following line with quote markers removed, if any. */
	nextLineContent: string | null;
}

function detectLeafStart(text: string, context: LeafStartContext): LeafStart {
	const { paragraphOpen, paragraphDirectlyOpen, insideQuote, atDocumentStart, nextLineContent } = context;

	if (atDocumentStart && /^---[ \t]*$/.test(text)) {
		return { kind: "verbatim", leaf: { type: "frontmatter" } };
	}

	const fence = FENCE_OPEN.exec(text);
	if (fence) {
		const fenceRun = fence[1] ?? "";
		const marker = fenceRun.charAt(0);
		// A backtick fence's info string may not contain a backtick.
		if (!(marker === "`" && (fence[2] ?? "").includes("`"))) {
			const info = (fence[2] ?? "").trim().toLowerCase();
			const rendersAsWidget = WIDGET_RENDERED_LANGUAGES.has(info.split(/[\s{]/)[0] ?? "");
			return {
				kind: "verbatim",
				leaf: { type: "fenced", marker, length: fenceRun.length, rendersAsWidget },
			};
		}
	}

	if (MATH_OPEN.test(text)) {
		const afterOpening = text.replace(MATH_OPEN, "");
		// `$$ x $$` on a single line is a complete block, it opens nothing.
		return afterOpening.includes("$$")
			? { kind: "structural", leaf: null, rendersAsWidget: true }
			: { kind: "verbatim", leaf: { type: "math" } };
	}

	// An indented code block cannot interrupt a paragraph.
	if (indentWidth(text) >= 4) {
		return paragraphOpen ? null : { kind: "verbatim", leaf: { type: "indentedCode" } };
	}

	if (ATX_HEADING.test(text)) return { kind: "structural", leaf: null };
	// Checked before the thematic break: with a paragraph open, `---` is a setext
	// underline, and it belongs to the paragraph above it, so that newline is
	// structural rather than a missing block separator.
	if (paragraphDirectlyOpen && SETEXT_UNDERLINE.test(text)) {
		return { kind: "structural", leaf: null, attachesToPrevious: true };
	}
	if (THEMATIC_BREAK.test(text)) return { kind: "structural", leaf: null };

	if (insideQuote && CALLOUT_HEADER.test(text)) {
		return { kind: "structural", leaf: null, trait: "callout-header" };
	}

	if (nextLineContent !== null && text.includes("|") && isTableDelimiterRow(nextLineContent)) {
		return { kind: "structural", leaf: { type: "table" }, rendersAsWidget: true };
	}

	// A block identifier attaches to the block above it.
	if (BLOCK_IDENTIFIER.test(text)) {
		return { kind: "structural", leaf: null, attachesToPrevious: true };
	}

	// Footnote definitions hold a paragraph, so their continuation lines join.
	if (FOOTNOTE_DEFINITION.test(text)) return { kind: "paragraph", leaf: null, trait: "footnote-def" };

	// An HTML block of type 7 (a generic tag) may not interrupt a paragraph;
	// every other type may, so `<div>` right below a line of text is a block.
	if (HTML_BLOCK_OPEN.test(text)) {
		const html = detectHtmlBlock(text);
		if (html && (!paragraphDirectlyOpen || html.canInterruptParagraph)) {
			// A block whose terminator is already on the opening line closes at once.
			const closedImmediately =
				html.terminator !== null && text.toLowerCase().includes(html.terminator);
			return {
				kind: "verbatim",
				leaf: closedImmediately ? null : { type: "html", terminator: html.terminator },
			};
		}
	}

	// A link reference definition may not interrupt a paragraph either.
	if (!paragraphOpen && LINK_REFERENCE_DEFINITION.test(text)) {
		return { kind: "structural", leaf: null, trait: "link-def" };
	}

	return null;
}

export function classifyLines(rawLines: readonly string[]): LineClassification[] {
	const lines = rawLines.map(expandTabs);
	const rows: LineClassification[] = [];

	let containers: Container[] = [];
	let leaf: Leaf | null = null;
	let nextParagraphId = 1;
	let nextBlockId = 1;
	let nextListId = 1;
	let blockId = 0;
	let listId: number | null = null;
	let previousTrait: LineTrait = null;

	const emit = (
		kind: BlockKind,
		options: {
			paragraphId?: number | null;
			startsListItem?: boolean;
			attachesToPrevious?: boolean;
			isFrontmatter?: boolean;
			rendersAsWidget?: boolean;
		} = {}
	) => {
		const insideList = containers.some((container) => container.type === "item");
		if (insideList) listId = listId ?? nextListId++;
		else listId = null;

		rows.push({
			kind,
			paragraphId: options.paragraphId ?? null,
			blockId,
			listId,
			startsListItem: options.startsListItem ?? false,
			attachesToPrevious: options.attachesToPrevious ?? false,
			isFrontmatter: options.isFrontmatter ?? false,
			rendersAsWidget: options.rendersAsWidget ?? false,
		});
	};

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index] ?? "";
		const inFrontmatter = leaf?.type === "frontmatter";

		// 1. Consume the prefixes of the containers that are currently open.
		let rest = line;
		let matched = 0;
		while (matched < containers.length) {
			const container = containers[matched] as Container;
			if (container.type === "quote") {
				const quote = QUOTE_PREFIX.exec(rest);
				if (!quote) break;
				rest = rest.slice((quote[0] ?? "").length);
			} else if (isBlank(rest)) {
				// A blank line neither matches nor closes a list item.
				rest = "";
			} else if (indentWidth(rest) >= container.indent) {
				rest = stripIndent(rest, container.indent);
			} else {
				break;
			}
			matched++;
		}

		// 2. Continue (or close) an open verbatim / table block. These keep the
		//    block id they were opened with, so their inner newlines are "none".
		if (leaf && matched < containers.length && leaf.type !== "paragraph") {
			// The container prefix is gone, so the block cannot continue.
			leaf = null;
		} else if (leaf && leaf.type === "fenced") {
			const closingRun = FENCE_CLOSE.exec(rest)?.[1] ?? "";
			const rendersAsWidget = leaf.rendersAsWidget;
			if (closingRun.charAt(0) === leaf.marker && closingRun.length >= leaf.length) leaf = null;
			previousTrait = null;
			emit("verbatim", { rendersAsWidget });
			continue;
		} else if (leaf && leaf.type === "math") {
			if (rest.includes("$$")) leaf = null;
			previousTrait = null;
			emit("verbatim", { rendersAsWidget: true });
			continue;
		} else if (leaf && leaf.type === "frontmatter") {
			if (FRONTMATTER_DELIMITER.test(rest)) leaf = null;
			previousTrait = null;
			emit("verbatim", { isFrontmatter: true });
			continue;
		} else if (leaf && leaf.type === "html") {
			const terminator = leaf.terminator;
			if (terminator !== null) {
				if (rest.toLowerCase().includes(terminator)) leaf = null;
				previousTrait = null;
				emit("verbatim");
				continue;
			}
			if (!isBlank(rest)) {
				previousTrait = null;
				emit("verbatim");
				continue;
			}
			leaf = null;
		} else if (leaf && leaf.type === "indentedCode") {
			const containerIndent = containers
				.slice(0, matched)
				.reduce((total, container) => total + (container.type === "item" ? container.indent : 0), 0);
			if (isBlank(rest)) {
				if (indentedCodeContinuesAfterBlank(lines, index, containerIndent)) {
					previousTrait = null;
					emit("verbatim");
					continue;
				}
				leaf = null;
			} else if (indentWidth(rest) >= 4) {
				previousTrait = null;
				emit("verbatim");
				continue;
			} else {
				leaf = null;
			}
		} else if (leaf && leaf.type === "table") {
			if (!isBlank(rest) && rest.includes("|")) {
				previousTrait = null;
				emit("structural", { rendersAsWidget: true });
				continue;
			}
			leaf = null;
		}

		// 3. Blank lines end every leaf block and close unmatched containers.
		if (isBlank(rest)) {
			containers = containers.slice(0, matched);
			leaf = null;
			previousTrait = null;
			blockId = nextBlockId++;
			emit("blank", { isFrontmatter: inFrontmatter });
			continue;
		}

		const paragraphOpen = leaf !== null && leaf.type === "paragraph";
		const paragraphDirectlyOpen = paragraphOpen && matched === containers.length;

		// 4. Open any new containers this line starts.
		const newContainers: Container[] = [];
		let working = rest;
		for (;;) {
			if (THEMATIC_BREAK.test(working)) break;
			const quote = QUOTE_PREFIX.exec(working);
			if (quote) {
				newContainers.push({ type: "quote" });
				working = working.slice((quote[0] ?? "").length);
				continue;
			}
			const item = matchListItem(working);
			if (item && (newContainers.length > 0 || !paragraphDirectlyOpen || item.canInterruptParagraph)) {
				newContainers.push({ type: "item", indent: item.indent });
				working = working.slice(item.consumed);
				continue;
			}
			break;
		}
		const openedContainer = newContainers.length > 0;

		const leafStart = detectLeafStart(working, {
			paragraphOpen: paragraphOpen && !openedContainer,
			paragraphDirectlyOpen: paragraphDirectlyOpen && !openedContainer,
			insideQuote:
				containers.slice(0, matched).some((container) => container.type === "quote") ||
				newContainers.some((container) => container.type === "quote"),
			atDocumentStart: index === 0 && containers.length === 0 && !openedContainer,
			nextLineContent: index + 1 < lines.length ? stripQuoteMarkers(lines[index + 1] ?? "") : null,
		});

		// 5. Plain text below an open paragraph continues that paragraph — even
		//    when a container prefix is missing (Markdown's lazy continuation).
		if (leafStart === null && !openedContainer && leaf && leaf.type === "paragraph") {
			previousTrait = null;
			emit("paragraph", { paragraphId: leaf.id });
			continue;
		}

		// 6. Otherwise this line starts a new block.
		containers = containers.slice(0, matched).concat(newContainers);
		blockId = nextBlockId++;

		const trait = leafStart?.trait ?? null;
		const attachesToPrevious =
			(leafStart?.attachesToPrevious ?? false) ||
			// A callout body line, or a sibling definition, sits directly under its partner.
			previousTrait === "callout-header" ||
			(previousTrait !== null && previousTrait === trait);
		previousTrait = trait;

		const startsListItem = newContainers.some((container) => container.type === "item");

		// Plain text and footnote definitions both open a paragraph.
		if (leafStart === null || leafStart.kind === "paragraph") {
			leaf = { type: "paragraph", id: nextParagraphId++ };
			emit("paragraph", { paragraphId: leaf.id, startsListItem, attachesToPrevious });
			continue;
		}

		leaf = leafStart.leaf;
		emit(leafStart.kind, {
			startsListItem,
			attachesToPrevious,
			isFrontmatter: leafStart.leaf?.type === "frontmatter",
			rendersAsWidget:
				leafStart.rendersAsWidget ??
				(leafStart.leaf?.type === "math" ||
					(leafStart.leaf?.type === "fenced" && leafStart.leaf.rendersAsWidget)),
		});
	}

	return rows;
}

/**
 * Verdict for the newline at the end of `rows[index]`. See SPEC.md for the
 * reasoning behind each rule; the order matters.
 */
export function newlineVerdict(rows: readonly LineClassification[], index: number): NewlineVerdict {
	const current = rows[index];
	const next = rows[index + 1];
	if (!current || !next) return "none";

	// A blank line is the canonical separator, and Live Preview owns frontmatter.
	if (current.kind === "blank" || next.kind === "blank") return "none";
	if (current.isFrontmatter || next.isFrontmatter) return "none";

	// One paragraph: Markdown eats this newline.
	if (current.paragraphId !== null && current.paragraphId === next.paragraphId) return "joined";

	// One leaf block: code lines, table rows, ... the newline is structural.
	if (current.blockId === next.blockId) return "none";

	// Setext underlines, callout bodies, sibling definitions, block identifiers.
	if (next.attachesToPrevious) return "none";

	// Two items of the same list.
	if (next.startsListItem && current.listId !== null && current.listId === next.listId) return "none";

	// Two real blocks with no blank line between them.
	return "separated";
}
