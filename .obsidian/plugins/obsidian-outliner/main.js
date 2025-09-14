'use strict';

var obsidian = require('obsidian');
var view = require('@codemirror/view');
var language = require('@codemirror/language');
var state = require('@codemirror/state');

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

class MoveCursorToPreviousUnfoldedLine {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const list = this.root.getListUnderCursor();
        const cursor = this.root.getCursor();
        const lines = list.getLinesInfo();
        const lineNo = lines.findIndex((l) => {
            return (cursor.ch === l.from.ch + list.getCheckboxLength() &&
                cursor.line === l.from.line);
        });
        if (lineNo === 0) {
            this.moveCursorToPreviousUnfoldedItem(root, cursor);
        }
        else if (lineNo > 0) {
            this.moveCursorToPreviousNoteLine(root, lines, lineNo);
        }
    }
    moveCursorToPreviousNoteLine(root, lines, lineNo) {
        this.stopPropagation = true;
        this.updated = true;
        root.replaceCursor(lines[lineNo - 1].to);
    }
    moveCursorToPreviousUnfoldedItem(root, cursor) {
        const prev = root.getListUnderLine(cursor.line - 1);
        if (!prev) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        if (prev.isFolded()) {
            const foldRoot = prev.getTopFoldRoot();
            const firstLineEnd = foldRoot.getLinesInfo()[0].to;
            root.replaceCursor(firstLineEnd);
        }
        else {
            root.replaceCursor(prev.getLastLineContentEnd());
        }
    }
}

function getEditorFromState(state) {
    const { editor } = state.field(obsidian.editorInfoField);
    if (!editor) {
        return null;
    }
    return new MyEditor(editor);
}
function foldInside(view, from, to) {
    let found = null;
    language.foldedRanges(view.state).between(from, to, (from, to) => {
        if (!found || found.from > from)
            found = { from, to };
    });
    return found;
}
class MyEditor {
    constructor(e) {
        this.e = e;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.view = this.e.cm;
    }
    getCursor() {
        return this.e.getCursor();
    }
    getLine(n) {
        return this.e.getLine(n);
    }
    lastLine() {
        return this.e.lastLine();
    }
    listSelections() {
        return this.e.listSelections();
    }
    getRange(from, to) {
        return this.e.getRange(from, to);
    }
    replaceRange(replacement, from, to) {
        return this.e.replaceRange(replacement, from, to);
    }
    setSelections(selections) {
        this.e.setSelections(selections);
    }
    setValue(text) {
        this.e.setValue(text);
    }
    getValue() {
        return this.e.getValue();
    }
    offsetToPos(offset) {
        return this.e.offsetToPos(offset);
    }
    posToOffset(pos) {
        return this.e.posToOffset(pos);
    }
    fold(n) {
        const { view } = this;
        const l = view.lineBlockAt(view.state.doc.line(n + 1).from);
        const range = language.foldable(view.state, l.from, l.to);
        if (!range || range.from === range.to) {
            return;
        }
        view.dispatch({ effects: [language.foldEffect.of(range)] });
    }
    unfold(n) {
        const { view } = this;
        const l = view.lineBlockAt(view.state.doc.line(n + 1).from);
        const range = foldInside(view, l.from, l.to);
        if (!range) {
            return;
        }
        view.dispatch({ effects: [language.unfoldEffect.of(range)] });
    }
    getAllFoldedLines() {
        const c = language.foldedRanges(this.view.state).iter();
        const res = [];
        while (c.value) {
            res.push(this.offsetToPos(c.from).line);
            c.next();
        }
        return res;
    }
    triggerOnKeyDown(e) {
        view.runScopeHandlers(this.view, e, "editor");
    }
    getZoomRange() {
        if (!window.ObsidianZoomPlugin) {
            return null;
        }
        return window.ObsidianZoomPlugin.getZoomRange(this.e);
    }
    zoomOut() {
        if (!window.ObsidianZoomPlugin) {
            return;
        }
        window.ObsidianZoomPlugin.zoomOut(this.e);
    }
    zoomIn(line) {
        if (!window.ObsidianZoomPlugin) {
            return;
        }
        window.ObsidianZoomPlugin.zoomIn(this.e, line);
    }
    tryRefreshZoom(line) {
        if (!window.ObsidianZoomPlugin) {
            return;
        }
        if (window.ObsidianZoomPlugin.refreshZoom) {
            window.ObsidianZoomPlugin.refreshZoom(this.e);
        }
        else {
            window.ObsidianZoomPlugin.zoomIn(this.e, line);
        }
    }
}

function createKeymapRunCallback(config) {
    const check = config.check || (() => true);
    const { run } = config;
    return (view) => {
        const editor = getEditorFromState(view.state);
        if (!check(editor)) {
            return false;
        }
        const { shouldUpdate, shouldStopPropagation } = run(editor);
        return shouldUpdate || shouldStopPropagation;
    };
}

class ArrowLeftAndCtrlArrowLeftBehaviourOverride {
    constructor(plugin, settings, imeDetector, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return (this.settings.keepCursorWithinContent !== "never" &&
                !this.imeDetector.isOpened());
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new MoveCursorToPreviousUnfoldedLine(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    key: "ArrowLeft",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
                {
                    win: "c-ArrowLeft",
                    linux: "c-ArrowLeft",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

function cmpPos(a, b) {
    return a.line - b.line || a.ch - b.ch;
}
function maxPos(a, b) {
    return cmpPos(a, b) < 0 ? b : a;
}
function minPos(a, b) {
    return cmpPos(a, b) < 0 ? a : b;
}
function isRangesIntersects(a, b) {
    return cmpPos(a[1], b[0]) >= 0 && cmpPos(a[0], b[1]) <= 0;
}
function recalculateNumericBullets(root) {
    function visit(parent) {
        let index = 1;
        for (const child of parent.getChildren()) {
            if (/\d+\./.test(child.getBullet())) {
                child.replateBullet(`${index++}.`);
            }
            visit(child);
        }
    }
    visit(root);
}
let idSeq = 0;
class List {
    constructor(root, indent, bullet, optionalCheckbox, spaceAfterBullet, firstLine, foldRoot) {
        this.root = root;
        this.indent = indent;
        this.bullet = bullet;
        this.optionalCheckbox = optionalCheckbox;
        this.spaceAfterBullet = spaceAfterBullet;
        this.foldRoot = foldRoot;
        this.parent = null;
        this.children = [];
        this.notesIndent = null;
        this.lines = [];
        this.id = idSeq++;
        this.lines.push(firstLine);
    }
    getID() {
        return this.id;
    }
    getNotesIndent() {
        return this.notesIndent;
    }
    setNotesIndent(notesIndent) {
        if (this.notesIndent !== null) {
            throw new Error(`Notes indent already provided`);
        }
        this.notesIndent = notesIndent;
    }
    addLine(text) {
        if (this.notesIndent === null) {
            throw new Error(`Unable to add line, notes indent should be provided first`);
        }
        this.lines.push(text);
    }
    replaceLines(lines) {
        if (lines.length > 1 && this.notesIndent === null) {
            throw new Error(`Unable to add line, notes indent should be provided first`);
        }
        this.lines = lines;
    }
    getLineCount() {
        return this.lines.length;
    }
    getRoot() {
        return this.root;
    }
    getChildren() {
        return this.children.concat();
    }
    getLinesInfo() {
        const startLine = this.root.getContentLinesRangeOf(this)[0];
        return this.lines.map((row, i) => {
            const line = startLine + i;
            const startCh = i === 0 ? this.getContentStartCh() : this.notesIndent.length;
            const endCh = startCh + row.length;
            return {
                text: row,
                from: { line, ch: startCh },
                to: { line, ch: endCh },
            };
        });
    }
    getLines() {
        return this.lines.concat();
    }
    getFirstLineContentStart() {
        const startLine = this.root.getContentLinesRangeOf(this)[0];
        return {
            line: startLine,
            ch: this.getContentStartCh(),
        };
    }
    getFirstLineContentStartAfterCheckbox() {
        const startLine = this.root.getContentLinesRangeOf(this)[0];
        return {
            line: startLine,
            ch: this.getContentStartCh() + this.getCheckboxLength(),
        };
    }
    getLastLineContentEnd() {
        const endLine = this.root.getContentLinesRangeOf(this)[1];
        const endCh = this.lines.length === 1
            ? this.getContentStartCh() + this.lines[0].length
            : this.notesIndent.length + this.lines[this.lines.length - 1].length;
        return {
            line: endLine,
            ch: endCh,
        };
    }
    getContentEndIncludingChildren() {
        return this.getLastChild().getLastLineContentEnd();
    }
    getLastChild() {
        let lastChild = this;
        while (!lastChild.isEmpty()) {
            lastChild = lastChild.getChildren().last();
        }
        return lastChild;
    }
    getContentStartCh() {
        return this.indent.length + this.bullet.length + 1;
    }
    isFolded() {
        if (this.foldRoot) {
            return true;
        }
        if (this.parent) {
            return this.parent.isFolded();
        }
        return false;
    }
    isFoldRoot() {
        return this.foldRoot;
    }
    getTopFoldRoot() {
        let tmp = this;
        let foldRoot = null;
        while (tmp) {
            if (tmp.isFoldRoot()) {
                foldRoot = tmp;
            }
            tmp = tmp.parent;
        }
        return foldRoot;
    }
    getLevel() {
        if (!this.parent) {
            return 0;
        }
        return this.parent.getLevel() + 1;
    }
    unindentContent(from, till) {
        this.indent = this.indent.slice(0, from) + this.indent.slice(till);
        if (this.notesIndent !== null) {
            this.notesIndent =
                this.notesIndent.slice(0, from) + this.notesIndent.slice(till);
        }
        for (const child of this.children) {
            child.unindentContent(from, till);
        }
    }
    indentContent(indentPos, indentChars) {
        this.indent =
            this.indent.slice(0, indentPos) +
                indentChars +
                this.indent.slice(indentPos);
        if (this.notesIndent !== null) {
            this.notesIndent =
                this.notesIndent.slice(0, indentPos) +
                    indentChars +
                    this.notesIndent.slice(indentPos);
        }
        for (const child of this.children) {
            child.indentContent(indentPos, indentChars);
        }
    }
    getFirstLineIndent() {
        return this.indent;
    }
    getBullet() {
        return this.bullet;
    }
    getSpaceAfterBullet() {
        return this.spaceAfterBullet;
    }
    getCheckboxLength() {
        return this.optionalCheckbox.length;
    }
    replateBullet(bullet) {
        this.bullet = bullet;
    }
    getParent() {
        return this.parent;
    }
    addBeforeAll(list) {
        this.children.unshift(list);
        list.parent = this;
    }
    addAfterAll(list) {
        this.children.push(list);
        list.parent = this;
    }
    removeChild(list) {
        const i = this.children.indexOf(list);
        this.children.splice(i, 1);
        list.parent = null;
    }
    addBefore(before, list) {
        const i = this.children.indexOf(before);
        this.children.splice(i, 0, list);
        list.parent = this;
    }
    addAfter(before, list) {
        const i = this.children.indexOf(before);
        this.children.splice(i + 1, 0, list);
        list.parent = this;
    }
    getPrevSiblingOf(list) {
        const i = this.children.indexOf(list);
        return i > 0 ? this.children[i - 1] : null;
    }
    getNextSiblingOf(list) {
        const i = this.children.indexOf(list);
        return i >= 0 && i < this.children.length ? this.children[i + 1] : null;
    }
    isEmpty() {
        return this.children.length === 0;
    }
    print() {
        let res = "";
        for (let i = 0; i < this.lines.length; i++) {
            res +=
                i === 0
                    ? this.indent + this.bullet + this.spaceAfterBullet
                    : this.notesIndent;
            res += this.lines[i];
            res += "\n";
        }
        for (const child of this.children) {
            res += child.print();
        }
        return res;
    }
    clone(newRoot) {
        const clone = new List(newRoot, this.indent, this.bullet, this.optionalCheckbox, this.spaceAfterBullet, "", this.foldRoot);
        clone.id = this.id;
        clone.lines = this.lines.concat();
        clone.notesIndent = this.notesIndent;
        for (const child of this.children) {
            clone.addAfterAll(child.clone(newRoot));
        }
        return clone;
    }
}
class Root {
    constructor(start, end, selections) {
        this.start = start;
        this.end = end;
        this.rootList = new List(this, "", "", "", "", "", false);
        this.selections = [];
        this.replaceSelections(selections);
    }
    getRootList() {
        return this.rootList;
    }
    getContentRange() {
        return [this.getContentStart(), this.getContentEnd()];
    }
    getContentStart() {
        return Object.assign({}, this.start);
    }
    getContentEnd() {
        return Object.assign({}, this.end);
    }
    getSelections() {
        return this.selections.map((s) => ({
            anchor: Object.assign({}, s.anchor),
            head: Object.assign({}, s.head),
        }));
    }
    hasSingleCursor() {
        if (!this.hasSingleSelection()) {
            return false;
        }
        const selection = this.selections[0];
        return (selection.anchor.line === selection.head.line &&
            selection.anchor.ch === selection.head.ch);
    }
    hasSingleSelection() {
        return this.selections.length === 1;
    }
    getSelection() {
        const selection = this.selections[this.selections.length - 1];
        const from = selection.anchor.ch > selection.head.ch
            ? selection.head.ch
            : selection.anchor.ch;
        const to = selection.anchor.ch > selection.head.ch
            ? selection.anchor.ch
            : selection.head.ch;
        return Object.assign(Object.assign({}, selection), { from,
            to });
    }
    getCursor() {
        return Object.assign({}, this.selections[this.selections.length - 1].head);
    }
    replaceCursor(cursor) {
        this.selections = [{ anchor: cursor, head: cursor }];
    }
    replaceSelections(selections) {
        if (selections.length < 1) {
            throw new Error(`Unable to create Root without selections`);
        }
        this.selections = selections;
    }
    getListUnderCursor() {
        return this.getListUnderLine(this.getCursor().line);
    }
    getListUnderLine(line) {
        if (line < this.start.line || line > this.end.line) {
            return;
        }
        let result = null;
        let index = this.start.line;
        const visitArr = (ll) => {
            for (const l of ll) {
                const listFromLine = index;
                const listTillLine = listFromLine + l.getLineCount() - 1;
                if (line >= listFromLine && line <= listTillLine) {
                    result = l;
                }
                else {
                    index = listTillLine + 1;
                    visitArr(l.getChildren());
                }
                if (result !== null) {
                    return;
                }
            }
        };
        visitArr(this.rootList.getChildren());
        return result;
    }
    getContentLinesRangeOf(list) {
        let result = null;
        let line = this.start.line;
        const visitArr = (ll) => {
            for (const l of ll) {
                const listFromLine = line;
                const listTillLine = listFromLine + l.getLineCount() - 1;
                if (l === list) {
                    result = [listFromLine, listTillLine];
                }
                else {
                    line = listTillLine + 1;
                    visitArr(l.getChildren());
                }
                if (result !== null) {
                    return;
                }
            }
        };
        visitArr(this.rootList.getChildren());
        return result;
    }
    getChildren() {
        return this.rootList.getChildren();
    }
    print() {
        let res = "";
        for (const child of this.rootList.getChildren()) {
            res += child.print();
        }
        return res.replace(/\n$/, "");
    }
    clone() {
        const clone = new Root(Object.assign({}, this.start), Object.assign({}, this.end), this.getSelections());
        clone.rootList = this.rootList.clone(clone);
        return clone;
    }
}

class DeleteTillPreviousLineContentEnd {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const list = root.getListUnderCursor();
        const cursor = root.getCursor();
        const lines = list.getLinesInfo();
        const lineNo = lines.findIndex((l) => cursor.ch === l.from.ch && cursor.line === l.from.line);
        if (lineNo === 0) {
            this.mergeWithPreviousItem(root, cursor, list);
        }
        else if (lineNo > 0) {
            this.mergeNotes(root, cursor, list, lines, lineNo);
        }
    }
    mergeNotes(root, cursor, list, lines, lineNo) {
        this.stopPropagation = true;
        this.updated = true;
        const prevLineNo = lineNo - 1;
        root.replaceCursor({
            line: cursor.line - 1,
            ch: lines[prevLineNo].text.length + lines[prevLineNo].from.ch,
        });
        lines[prevLineNo].text += lines[lineNo].text;
        lines.splice(lineNo, 1);
        list.replaceLines(lines.map((l) => l.text));
    }
    mergeWithPreviousItem(root, cursor, list) {
        if (root.getChildren()[0] === list && list.isEmpty()) {
            return;
        }
        this.stopPropagation = true;
        const prev = root.getListUnderLine(cursor.line - 1);
        if (!prev) {
            return;
        }
        const bothAreEmpty = prev.isEmpty() && list.isEmpty();
        const prevIsEmptyAndSameLevel = prev.isEmpty() && !list.isEmpty() && prev.getLevel() === list.getLevel();
        const listIsEmptyAndPrevIsParent = list.isEmpty() && prev.getLevel() === list.getLevel() - 1;
        if (bothAreEmpty || prevIsEmptyAndSameLevel || listIsEmptyAndPrevIsParent) {
            this.updated = true;
            const parent = list.getParent();
            const prevEnd = prev.getLastLineContentEnd();
            if (!prev.getNotesIndent() && list.getNotesIndent()) {
                prev.setNotesIndent(prev.getFirstLineIndent() +
                    list.getNotesIndent().slice(list.getFirstLineIndent().length));
            }
            const oldLines = prev.getLines();
            const newLines = list.getLines();
            oldLines[oldLines.length - 1] += newLines[0];
            const resultLines = oldLines.concat(newLines.slice(1));
            prev.replaceLines(resultLines);
            parent.removeChild(list);
            for (const c of list.getChildren()) {
                list.removeChild(c);
                prev.addAfterAll(c);
            }
            root.replaceCursor(prevEnd);
            recalculateNumericBullets(root);
        }
    }
}

class BackspaceBehaviourOverride {
    constructor(plugin, settings, imeDetector, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return (this.settings.keepCursorWithinContent !== "never" &&
                !this.imeDetector.isOpened());
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new DeleteTillPreviousLineContentEnd(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    key: "Backspace",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

const BETTER_LISTS_BODY_CLASS = "outliner-plugin-better-lists";
class BetterListsStyles {
    constructor(settings, obsidianSettings) {
        this.settings = settings;
        this.obsidianSettings = obsidianSettings;
        this.updateBodyClass = () => {
            const shouldExists = this.obsidianSettings.isDefaultThemeEnabled() &&
                this.settings.betterListsStyles;
            const exists = document.body.classList.contains(BETTER_LISTS_BODY_CLASS);
            if (shouldExists && !exists) {
                document.body.classList.add(BETTER_LISTS_BODY_CLASS);
            }
            if (!shouldExists && exists) {
                document.body.classList.remove(BETTER_LISTS_BODY_CLASS);
            }
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.updateBodyClass();
            this.updateBodyClassInterval = window.setInterval(() => {
                this.updateBodyClass();
            }, 1000);
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            clearInterval(this.updateBodyClassInterval);
            document.body.classList.remove(BETTER_LISTS_BODY_CLASS);
        });
    }
}

class SelectAllContent {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleSelection()) {
            return;
        }
        const selection = root.getSelections()[0];
        const [rootStart, rootEnd] = root.getContentRange();
        const selectionFrom = minPos(selection.anchor, selection.head);
        const selectionTo = maxPos(selection.anchor, selection.head);
        if (selectionFrom.line < rootStart.line ||
            selectionTo.line > rootEnd.line) {
            return false;
        }
        if (selectionFrom.line === rootStart.line &&
            selectionFrom.ch === rootStart.ch &&
            selectionTo.line === rootEnd.line &&
            selectionTo.ch === rootEnd.ch) {
            return false;
        }
        const list = root.getListUnderCursor();
        const contentStart = list.getFirstLineContentStartAfterCheckbox();
        const contentEnd = list.getLastLineContentEnd();
        const listUnderSelectionFrom = root.getListUnderLine(selectionFrom.line);
        const listStart = listUnderSelectionFrom.getFirstLineContentStartAfterCheckbox();
        const listEnd = listUnderSelectionFrom.getContentEndIncludingChildren();
        this.stopPropagation = true;
        this.updated = true;
        if (selectionFrom.line === contentStart.line &&
            selectionFrom.ch === contentStart.ch &&
            selectionTo.line === contentEnd.line &&
            selectionTo.ch === contentEnd.ch) {
            if (list.getChildren().length) {
                // select sub lists
                root.replaceSelections([
                    { anchor: contentStart, head: list.getContentEndIncludingChildren() },
                ]);
            }
            else {
                // select whole list
                root.replaceSelections([{ anchor: rootStart, head: rootEnd }]);
            }
        }
        else if (listStart.ch == selectionFrom.ch &&
            listEnd.line == selectionTo.line &&
            listEnd.ch == selectionTo.ch) {
            // select whole list
            root.replaceSelections([{ anchor: rootStart, head: rootEnd }]);
        }
        else if ((selectionFrom.line > contentStart.line ||
            (selectionFrom.line == contentStart.line &&
                selectionFrom.ch >= contentStart.ch)) &&
            (selectionTo.line < contentEnd.line ||
                (selectionTo.line == contentEnd.line &&
                    selectionTo.ch <= contentEnd.ch))) {
            // select whole line
            root.replaceSelections([{ anchor: contentStart, head: contentEnd }]);
        }
        else {
            this.stopPropagation = false;
            this.updated = false;
            return false;
        }
        return true;
    }
}

class CtrlAAndCmdABehaviourOverride {
    constructor(plugin, settings, imeDetector, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return (this.settings.overrideSelectAllBehaviour && !this.imeDetector.isOpened());
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new SelectAllContent(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    key: "c-a",
                    mac: "m-a",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class DeleteTillNextLineContentStart {
    constructor(root) {
        this.root = root;
        this.deleteTillPreviousLineContentEnd =
            new DeleteTillPreviousLineContentEnd(root);
    }
    shouldStopPropagation() {
        return this.deleteTillPreviousLineContentEnd.shouldStopPropagation();
    }
    shouldUpdate() {
        return this.deleteTillPreviousLineContentEnd.shouldUpdate();
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const list = root.getListUnderCursor();
        const cursor = root.getCursor();
        const lines = list.getLinesInfo();
        const lineNo = lines.findIndex((l) => cursor.ch === l.to.ch && cursor.line === l.to.line);
        if (lineNo === lines.length - 1) {
            const nextLine = lines[lineNo].to.line + 1;
            const nextList = root.getListUnderLine(nextLine);
            if (!nextList) {
                return;
            }
            root.replaceCursor(nextList.getFirstLineContentStart());
            this.deleteTillPreviousLineContentEnd.perform();
        }
        else if (lineNo >= 0) {
            root.replaceCursor(lines[lineNo + 1].from);
            this.deleteTillPreviousLineContentEnd.perform();
        }
    }
}

class DeleteBehaviourOverride {
    constructor(plugin, settings, imeDetector, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return (this.settings.keepCursorWithinContent !== "never" &&
                !this.imeDetector.isOpened());
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new DeleteTillNextLineContentStart(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    key: "Delete",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class MoveListToDifferentPosition {
    constructor(root, listToMove, placeToMove, whereToMove, defaultIndentChars) {
        this.root = root;
        this.listToMove = listToMove;
        this.placeToMove = placeToMove;
        this.whereToMove = whereToMove;
        this.defaultIndentChars = defaultIndentChars;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        if (this.listToMove === this.placeToMove) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        const cursorAnchor = this.calculateCursorAnchor();
        this.moveList();
        this.changeIndent();
        this.restoreCursor(cursorAnchor);
        recalculateNumericBullets(this.root);
    }
    calculateCursorAnchor() {
        const cursorLine = this.root.getCursor().line;
        const lines = [
            this.listToMove.getFirstLineContentStart().line,
            this.listToMove.getLastLineContentEnd().line,
            this.placeToMove.getFirstLineContentStart().line,
            this.placeToMove.getLastLineContentEnd().line,
        ];
        const listStartLine = Math.min(...lines);
        const listEndLine = Math.max(...lines);
        if (cursorLine < listStartLine || cursorLine > listEndLine) {
            return null;
        }
        const cursor = this.root.getCursor();
        const cursorList = this.root.getListUnderLine(cursor.line);
        const cursorListStart = cursorList.getFirstLineContentStart();
        const lineDiff = cursor.line - cursorListStart.line;
        const chDiff = cursor.ch - cursorListStart.ch;
        return { cursorList, lineDiff, chDiff };
    }
    moveList() {
        this.listToMove.getParent().removeChild(this.listToMove);
        switch (this.whereToMove) {
            case "before":
                this.placeToMove
                    .getParent()
                    .addBefore(this.placeToMove, this.listToMove);
                break;
            case "after":
                this.placeToMove
                    .getParent()
                    .addAfter(this.placeToMove, this.listToMove);
                break;
            case "inside":
                this.placeToMove.addBeforeAll(this.listToMove);
                break;
        }
    }
    changeIndent() {
        const oldIndent = this.listToMove.getFirstLineIndent();
        const newIndent = this.whereToMove === "inside"
            ? this.placeToMove.getFirstLineIndent() + this.defaultIndentChars
            : this.placeToMove.getFirstLineIndent();
        this.listToMove.unindentContent(0, oldIndent.length);
        this.listToMove.indentContent(0, newIndent);
    }
    restoreCursor(cursorAnchor) {
        if (cursorAnchor) {
            const cursorListStart = cursorAnchor.cursorList.getFirstLineContentStart();
            this.root.replaceCursor({
                line: cursorListStart.line + cursorAnchor.lineDiff,
                ch: cursorListStart.ch + cursorAnchor.chDiff,
            });
        }
        else {
            // When you move a list, the screen scrolls to the cursor.
            // It is better to move the cursor into the viewport than let the screen scroll.
            this.root.replaceCursor(this.listToMove.getLastLineContentEnd());
        }
    }
}

const BODY_CLASS = "outliner-plugin-dnd";
class DragAndDrop {
    constructor(plugin, settings, obisidian, parser, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.obisidian = obisidian;
        this.parser = parser;
        this.operationPerformer = operationPerformer;
        this.preStart = null;
        this.state = null;
        this.handleSettingsChange = () => {
            if (!isFeatureSupported()) {
                return;
            }
            if (this.settings.dragAndDrop) {
                document.body.classList.add(BODY_CLASS);
            }
            else {
                document.body.classList.remove(BODY_CLASS);
            }
        };
        this.handleMouseDown = (e) => {
            if (!isFeatureSupported() ||
                !this.settings.dragAndDrop ||
                !isClickOnBullet(e)) {
                return;
            }
            const view = getEditorViewFromHTMLElement(e.target);
            if (!view) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            this.preStart = {
                x: e.x,
                y: e.y,
                view,
            };
        };
        this.handleMouseMove = (e) => {
            if (this.preStart) {
                this.startDragging();
            }
            if (this.state) {
                this.detectAndDrawDropZone(e.x, e.y);
            }
        };
        this.handleMouseUp = () => {
            if (this.preStart) {
                this.preStart = null;
            }
            if (this.state) {
                this.stopDragging();
            }
        };
        this.handleKeyDown = (e) => {
            if (this.state && e.code === "Escape") {
                this.cancelDragging();
            }
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension([
                draggingLinesStateField,
                droppingLinesStateField,
            ]);
            this.enableFeatureToggle();
            this.createDropZone();
            this.addEventListeners();
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            this.removeEventListeners();
            this.removeDropZone();
            this.disableFeatureToggle();
        });
    }
    enableFeatureToggle() {
        this.settings.onChange(this.handleSettingsChange);
        this.handleSettingsChange();
    }
    disableFeatureToggle() {
        this.settings.removeCallback(this.handleSettingsChange);
        document.body.classList.remove(BODY_CLASS);
    }
    createDropZone() {
        this.dropZonePadding = document.createElement("div");
        this.dropZonePadding.classList.add("outliner-plugin-drop-zone-padding");
        this.dropZone = document.createElement("div");
        this.dropZone.classList.add("outliner-plugin-drop-zone");
        this.dropZone.style.display = "none";
        this.dropZone.appendChild(this.dropZonePadding);
        document.body.appendChild(this.dropZone);
    }
    removeDropZone() {
        document.body.removeChild(this.dropZone);
        this.dropZonePadding = null;
        this.dropZone = null;
    }
    addEventListeners() {
        document.addEventListener("mousedown", this.handleMouseDown, {
            capture: true,
        });
        document.addEventListener("mousemove", this.handleMouseMove);
        document.addEventListener("mouseup", this.handleMouseUp);
        document.addEventListener("keydown", this.handleKeyDown);
    }
    removeEventListeners() {
        document.removeEventListener("mousedown", this.handleMouseDown, {
            capture: true,
        });
        document.removeEventListener("mousemove", this.handleMouseMove);
        document.removeEventListener("mouseup", this.handleMouseUp);
        document.removeEventListener("keydown", this.handleKeyDown);
    }
    startDragging() {
        const { x, y, view } = this.preStart;
        this.preStart = null;
        const editor = getEditorFromState(view.state);
        const pos = editor.offsetToPos(view.posAtCoords({ x, y }));
        const root = this.parser.parse(editor, pos);
        const list = root.getListUnderLine(pos.line);
        const state = new DragAndDropState(view, editor, root, list);
        if (!state.hasDropVariants()) {
            return;
        }
        this.state = state;
        this.highlightDraggingLines();
    }
    detectAndDrawDropZone(x, y) {
        this.state.calculateNearestDropVariant(x, y);
        this.drawDropZone();
    }
    cancelDragging() {
        this.state.dropVariant = null;
        this.stopDragging();
    }
    stopDragging() {
        this.unhightlightDraggingLines();
        this.hideDropZone();
        this.applyChanges();
        this.state = null;
    }
    applyChanges() {
        if (!this.state.dropVariant) {
            return;
        }
        const { state } = this;
        const { dropVariant, editor, root, list } = state;
        const newRoot = this.parser.parse(editor, root.getContentStart());
        if (!isSameRoots(root, newRoot)) {
            new obsidian.Notice(`The item cannot be moved. The page content changed during the move.`, 5000);
            return;
        }
        this.operationPerformer.eval(root, new MoveListToDifferentPosition(root, list, dropVariant.placeToMove, dropVariant.whereToMove, this.obisidian.getDefaultIndentChars()), editor);
    }
    highlightDraggingLines() {
        const { state } = this;
        const { list, editor, view } = state;
        const lines = [];
        const fromLine = list.getFirstLineContentStart().line;
        const tillLine = list.getContentEndIncludingChildren().line;
        for (let i = fromLine; i <= tillLine; i++) {
            lines.push(editor.posToOffset({ line: i, ch: 0 }));
        }
        view.dispatch({
            effects: [dndStarted.of(lines)],
        });
        document.body.classList.add("outliner-plugin-dragging");
    }
    unhightlightDraggingLines() {
        document.body.classList.remove("outliner-plugin-dragging");
        this.state.view.dispatch({
            effects: [dndEnded.of()],
        });
    }
    drawDropZone() {
        const { state } = this;
        const { view, editor, dropVariant } = state;
        const newParent = dropVariant.whereToMove === "inside"
            ? dropVariant.placeToMove
            : dropVariant.placeToMove.getParent();
        const newParentIsRootList = !newParent.getParent();
        {
            const width = Math.round(view.contentDOM.offsetWidth -
                (dropVariant.left - this.state.leftPadding));
            this.dropZone.style.display = "block";
            this.dropZone.style.top = dropVariant.top + "px";
            this.dropZone.style.left = dropVariant.left + "px";
            this.dropZone.style.width = width + "px";
        }
        {
            const level = newParent.getLevel();
            const indentWidth = this.state.tabWidth;
            const width = indentWidth * level;
            const dashPadding = 3;
            const dashWidth = indentWidth - dashPadding;
            const color = getComputedStyle(document.body).getPropertyValue("--color-accent");
            this.dropZonePadding.style.width = `${width}px`;
            this.dropZonePadding.style.marginLeft = `-${width}px`;
            this.dropZonePadding.style.backgroundImage = `url('data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20${width}%204%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cline%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%22${width}%22%20y2%3D%220%22%20stroke%3D%22${color}%22%20stroke-width%3D%228%22%20stroke-dasharray%3D%22${dashWidth}%20${dashPadding}%22%2F%3E%3C%2Fsvg%3E')`;
        }
        this.state.view.dispatch({
            effects: [
                dndMoved.of(newParentIsRootList
                    ? null
                    : editor.posToOffset({
                        line: newParent.getFirstLineContentStart().line,
                        ch: 0,
                    })),
            ],
        });
    }
    hideDropZone() {
        this.dropZone.style.display = "none";
    }
}
class DragAndDropState {
    constructor(view, editor, root, list) {
        this.view = view;
        this.editor = editor;
        this.root = root;
        this.list = list;
        this.dropVariants = new Map();
        this.dropVariant = null;
        this.leftPadding = 0;
        this.tabWidth = 0;
        this.collectDropVariants();
        this.calculateLeftPadding();
        this.calculateTabWidth();
    }
    getDropVariants() {
        return Array.from(this.dropVariants.values());
    }
    hasDropVariants() {
        return this.dropVariants.size > 0;
    }
    calculateNearestDropVariant(x, y) {
        const { view, editor } = this;
        const dropVariants = this.getDropVariants();
        for (const v of dropVariants) {
            const { placeToMove } = v;
            v.left = this.leftPadding + (v.level - 1) * this.tabWidth;
            const positionAfterList = v.whereToMove === "after" || v.whereToMove === "inside";
            const line = positionAfterList
                ? placeToMove.getContentEndIncludingChildren().line
                : placeToMove.getFirstLineContentStart().line;
            const linePos = editor.posToOffset({
                line,
                ch: 0,
            });
            v.top = view.coordsAtPos(linePos, -1).top;
            if (positionAfterList) {
                v.top += view.lineBlockAt(linePos).height;
            }
            // Better vertical alignment
            v.top -= 8;
        }
        const nearestLineTop = dropVariants
            .sort((a, b) => Math.abs(y - a.top) - Math.abs(y - b.top))
            .first().top;
        const variansOnNearestLine = dropVariants.filter((v) => Math.abs(v.top - nearestLineTop) <= 4);
        this.dropVariant = variansOnNearestLine
            .sort((a, b) => Math.abs(x - a.left) - Math.abs(x - b.left))
            .first();
    }
    addDropVariant(v) {
        this.dropVariants.set(`${v.line} ${v.level}`, v);
    }
    collectDropVariants() {
        const visit = (lists) => {
            for (const placeToMove of lists) {
                const lineBefore = placeToMove.getFirstLineContentStart().line;
                const lineAfter = placeToMove.getContentEndIncludingChildren().line + 1;
                const level = placeToMove.getLevel();
                this.addDropVariant({
                    line: lineBefore,
                    level,
                    left: 0,
                    top: 0,
                    placeToMove,
                    whereToMove: "before",
                });
                this.addDropVariant({
                    line: lineAfter,
                    level,
                    left: 0,
                    top: 0,
                    placeToMove,
                    whereToMove: "after",
                });
                if (placeToMove === this.list) {
                    continue;
                }
                if (placeToMove.isEmpty()) {
                    this.addDropVariant({
                        line: lineAfter,
                        level: level + 1,
                        left: 0,
                        top: 0,
                        placeToMove,
                        whereToMove: "inside",
                    });
                }
                else {
                    visit(placeToMove.getChildren());
                }
            }
        };
        visit(this.root.getChildren());
    }
    calculateLeftPadding() {
        this.leftPadding = this.view.coordsAtPos(0, -1).left;
    }
    calculateTabWidth() {
        const { view } = this;
        const singleIndent = language.indentString(view.state, language.getIndentUnit(view.state));
        for (let i = 1; i <= view.state.doc.lines; i++) {
            const line = view.state.doc.line(i);
            if (line.text.startsWith(singleIndent)) {
                const a = view.coordsAtPos(line.from, -1);
                const b = view.coordsAtPos(line.from + singleIndent.length, -1);
                this.tabWidth = b.left - a.left;
                return;
            }
        }
        this.tabWidth = view.defaultCharacterWidth * language.getIndentUnit(view.state);
    }
}
const dndStarted = state.StateEffect.define({
    map: (lines, change) => lines.map((l) => change.mapPos(l)),
});
const dndMoved = state.StateEffect.define({
    map: (line, change) => (line !== null ? change.mapPos(line) : line),
});
const dndEnded = state.StateEffect.define();
const draggingLineDecoration = view.Decoration.line({
    class: "outliner-plugin-dragging-line",
});
const droppingLineDecoration = view.Decoration.line({
    class: "outliner-plugin-dropping-line",
});
const draggingLinesStateField = state.StateField.define({
    create: () => view.Decoration.none,
    update: (dndState, tr) => {
        dndState = dndState.map(tr.changes);
        for (const e of tr.effects) {
            if (e.is(dndStarted)) {
                dndState = dndState.update({
                    add: e.value.map((l) => draggingLineDecoration.range(l, l)),
                });
            }
            if (e.is(dndEnded)) {
                dndState = view.Decoration.none;
            }
        }
        return dndState;
    },
    provide: (f) => view.EditorView.decorations.from(f),
});
const droppingLinesStateField = state.StateField.define({
    create: () => view.Decoration.none,
    update: (dndDroppingState, tr) => {
        dndDroppingState = dndDroppingState.map(tr.changes);
        for (const e of tr.effects) {
            if (e.is(dndMoved)) {
                dndDroppingState =
                    e.value === null
                        ? view.Decoration.none
                        : view.Decoration.set(droppingLineDecoration.range(e.value, e.value));
            }
            if (e.is(dndEnded)) {
                dndDroppingState = view.Decoration.none;
            }
        }
        return dndDroppingState;
    },
    provide: (f) => view.EditorView.decorations.from(f),
});
function getEditorViewFromHTMLElement(e) {
    while (e && !e.classList.contains("cm-editor")) {
        e = e.parentElement;
    }
    if (!e) {
        return null;
    }
    return view.EditorView.findFromDOM(e);
}
function isClickOnBullet(e) {
    let el = e.target;
    while (el) {
        if (el.classList.contains("cm-formatting-list") ||
            el.classList.contains("cm-fold-indicator") ||
            el.classList.contains("task-list-item-checkbox")) {
            return true;
        }
        el = el.parentElement;
    }
    return false;
}
function isSameRoots(a, b) {
    const [aStart, aEnd] = a.getContentRange();
    const [bStart, bEnd] = b.getContentRange();
    if (cmpPos(aStart, bStart) !== 0 || cmpPos(aEnd, bEnd) !== 0) {
        return false;
    }
    return a.print() === b.print();
}
function isFeatureSupported() {
    return obsidian.Platform.isDesktop;
}

class KeepCursorOutsideFoldedLines {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const cursor = root.getCursor();
        const list = root.getListUnderCursor();
        if (!list.isFolded()) {
            return;
        }
        const foldRoot = list.getTopFoldRoot();
        const firstLineEnd = foldRoot.getLinesInfo()[0].to;
        if (cursor.line > firstLineEnd.line) {
            this.updated = true;
            this.stopPropagation = true;
            root.replaceCursor(firstLineEnd);
        }
    }
}

class KeepCursorWithinListContent {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const cursor = root.getCursor();
        const list = root.getListUnderCursor();
        const contentStart = list.getFirstLineContentStartAfterCheckbox();
        const linePrefix = contentStart.line === cursor.line
            ? contentStart.ch
            : list.getNotesIndent().length;
        if (cursor.ch < linePrefix) {
            this.updated = true;
            this.stopPropagation = true;
            root.replaceCursor({
                line: cursor.line,
                ch: linePrefix,
            });
        }
    }
}

class EditorSelectionsBehaviourOverride {
    constructor(plugin, settings, parser, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.parser = parser;
        this.operationPerformer = operationPerformer;
        this.transactionExtender = (tr) => {
            if (this.settings.keepCursorWithinContent === "never" || !tr.selection) {
                return null;
            }
            const editor = getEditorFromState(tr.startState);
            setTimeout(() => {
                this.handleSelectionsChanges(editor);
            }, 0);
            return null;
        };
        this.handleSelectionsChanges = (editor) => {
            const root = this.parser.parse(editor);
            if (!root) {
                return;
            }
            {
                const { shouldStopPropagation } = this.operationPerformer.eval(root, new KeepCursorOutsideFoldedLines(root), editor);
                if (shouldStopPropagation) {
                    return;
                }
            }
            this.operationPerformer.eval(root, new KeepCursorWithinListContent(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(state.EditorState.transactionExtender.of(this.transactionExtender));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

const checkboxRe = `\\[[^\\[\\]]\\][ \t]`;

function isEmptyLineOrEmptyCheckbox(line) {
    return line === "" || line === "[ ] ";
}

class CreateNewItem {
    constructor(root, defaultIndentChars, getZoomRange) {
        this.root = root;
        this.defaultIndentChars = defaultIndentChars;
        this.getZoomRange = getZoomRange;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleSelection()) {
            return;
        }
        const selection = root.getSelection();
        if (!selection || selection.anchor.line !== selection.head.line) {
            return;
        }
        const list = root.getListUnderCursor();
        const lines = list.getLinesInfo();
        if (lines.length === 1 && isEmptyLineOrEmptyCheckbox(lines[0].text)) {
            return;
        }
        const cursor = root.getCursor();
        const lineUnderCursor = lines.find((l) => l.from.line === cursor.line);
        if (cursor.ch < lineUnderCursor.from.ch) {
            return;
        }
        const { oldLines, newLines } = lines.reduce((acc, line) => {
            if (cursor.line > line.from.line) {
                acc.oldLines.push(line.text);
            }
            else if (cursor.line === line.from.line) {
                const left = line.text.slice(0, selection.from - line.from.ch);
                const right = line.text.slice(selection.to - line.from.ch);
                acc.oldLines.push(left);
                acc.newLines.push(right);
            }
            else if (cursor.line < line.from.line) {
                acc.newLines.push(line.text);
            }
            return acc;
        }, {
            oldLines: [],
            newLines: [],
        });
        const codeBlockBacticks = oldLines.join("\n").split("```").length - 1;
        const isInsideCodeblock = codeBlockBacticks > 0 && codeBlockBacticks % 2 !== 0;
        if (isInsideCodeblock) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        const zoomRange = this.getZoomRange.getZoomRange();
        const listIsZoomingRoot = Boolean(zoomRange &&
            list.getFirstLineContentStart().line >= zoomRange.from.line &&
            list.getLastLineContentEnd().line <= zoomRange.from.line);
        const hasChildren = !list.isEmpty();
        const childIsFolded = list.isFoldRoot();
        const endPos = list.getLastLineContentEnd();
        const endOfLine = cursor.line === endPos.line && cursor.ch === endPos.ch;
        const onChildLevel = listIsZoomingRoot || (hasChildren && !childIsFolded && endOfLine);
        const indent = onChildLevel
            ? hasChildren
                ? list.getChildren()[0].getFirstLineIndent()
                : list.getFirstLineIndent() + this.defaultIndentChars
            : list.getFirstLineIndent();
        const bullet = onChildLevel && hasChildren
            ? list.getChildren()[0].getBullet()
            : list.getBullet();
        const spaceAfterBullet = onChildLevel && hasChildren
            ? list.getChildren()[0].getSpaceAfterBullet()
            : list.getSpaceAfterBullet();
        const prefix = oldLines[0].match(checkboxRe) ? "[ ] " : "";
        const newList = new List(list.getRoot(), indent, bullet, prefix, spaceAfterBullet, prefix + newLines.shift(), false);
        if (newLines.length > 0) {
            newList.setNotesIndent(list.getNotesIndent());
            for (const line of newLines) {
                newList.addLine(line);
            }
        }
        if (onChildLevel) {
            list.addBeforeAll(newList);
        }
        else {
            if (!childIsFolded || !endOfLine) {
                const children = list.getChildren();
                for (const child of children) {
                    list.removeChild(child);
                    newList.addAfterAll(child);
                }
            }
            list.getParent().addAfter(list, newList);
        }
        list.replaceLines(oldLines);
        const newListStart = newList.getFirstLineContentStart();
        root.replaceCursor({
            line: newListStart.line,
            ch: newListStart.ch + prefix.length,
        });
        recalculateNumericBullets(root);
    }
}

class OutdentList {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const list = root.getListUnderCursor();
        const parent = list.getParent();
        const grandParent = parent.getParent();
        if (!grandParent) {
            return;
        }
        this.updated = true;
        const listStartLineBefore = root.getContentLinesRangeOf(list)[0];
        const indentRmFrom = parent.getFirstLineIndent().length;
        const indentRmTill = list.getFirstLineIndent().length;
        parent.removeChild(list);
        grandParent.addAfter(parent, list);
        list.unindentContent(indentRmFrom, indentRmTill);
        const listStartLineAfter = root.getContentLinesRangeOf(list)[0];
        const lineDiff = listStartLineAfter - listStartLineBefore;
        const chDiff = indentRmTill - indentRmFrom;
        const cursor = root.getCursor();
        root.replaceCursor({
            line: cursor.line + lineDiff,
            ch: cursor.ch - chDiff,
        });
        recalculateNumericBullets(root);
    }
}

class OutdentListIfItsEmpty {
    constructor(root) {
        this.root = root;
        this.outdentList = new OutdentList(root);
    }
    shouldStopPropagation() {
        return this.outdentList.shouldStopPropagation();
    }
    shouldUpdate() {
        return this.outdentList.shouldUpdate();
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        const list = root.getListUnderCursor();
        const lines = list.getLines();
        if (lines.length > 1 ||
            !isEmptyLineOrEmptyCheckbox(lines[0]) ||
            list.getLevel() === 1) {
            return;
        }
        this.outdentList.perform();
    }
}

class EnterBehaviourOverride {
    constructor(plugin, settings, imeDetector, obsidianSettings, parser, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.obsidianSettings = obsidianSettings;
        this.parser = parser;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return this.settings.overrideEnterBehaviour && !this.imeDetector.isOpened();
        };
        this.run = (editor) => {
            const root = this.parser.parse(editor);
            if (!root) {
                return {
                    shouldUpdate: false,
                    shouldStopPropagation: false,
                };
            }
            {
                const res = this.operationPerformer.eval(root, new OutdentListIfItsEmpty(root), editor);
                if (res.shouldStopPropagation) {
                    return res;
                }
            }
            {
                const defaultIndentChars = this.obsidianSettings.getDefaultIndentChars();
                const zoomRange = editor.getZoomRange();
                const getZoomRange = {
                    getZoomRange: () => zoomRange,
                };
                const res = this.operationPerformer.eval(root, new CreateNewItem(root, defaultIndentChars, getZoomRange), editor);
                if (res.shouldUpdate && zoomRange) {
                    editor.tryRefreshZoom(zoomRange.from.line);
                }
                return res;
            }
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(state.Prec.highest(view.keymap.of([
                {
                    key: "Enter",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ])));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

function createEditorCallback(cb) {
    return (editor) => {
        const myEditor = new MyEditor(editor);
        const shouldStopPropagation = cb(myEditor);
        if (!shouldStopPropagation &&
            window.event &&
            window.event.type === "keydown") {
            myEditor.triggerOnKeyDown(window.event);
        }
    };
}

class ListsFoldingCommands {
    constructor(plugin, obsidianSettings) {
        this.plugin = plugin;
        this.obsidianSettings = obsidianSettings;
        this.fold = (editor) => {
            return this.setFold(editor, "fold");
        };
        this.unfold = (editor) => {
            return this.setFold(editor, "unfold");
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.addCommand({
                id: "fold",
                icon: "chevrons-down-up",
                name: "Fold the list",
                editorCallback: createEditorCallback(this.fold),
                hotkeys: [
                    {
                        modifiers: ["Mod"],
                        key: "ArrowUp",
                    },
                ],
            });
            this.plugin.addCommand({
                id: "unfold",
                icon: "chevrons-up-down",
                name: "Unfold the list",
                editorCallback: createEditorCallback(this.unfold),
                hotkeys: [
                    {
                        modifiers: ["Mod"],
                        key: "ArrowDown",
                    },
                ],
            });
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    setFold(editor, type) {
        if (!this.obsidianSettings.getFoldSettings().foldIndent) {
            new obsidian.Notice(`Unable to ${type} because folding is disabled. Please enable "Fold indent" in Obsidian settings.`, 5000);
            return true;
        }
        const cursor = editor.getCursor();
        if (type === "fold") {
            editor.fold(cursor.line);
        }
        else {
            editor.unfold(cursor.line);
        }
        return true;
    }
}

class IndentList {
    constructor(root, defaultIndentChars) {
        this.root = root;
        this.defaultIndentChars = defaultIndentChars;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const list = root.getListUnderCursor();
        const parent = list.getParent();
        const prev = parent.getPrevSiblingOf(list);
        if (!prev) {
            return;
        }
        this.updated = true;
        const listStartLineBefore = root.getContentLinesRangeOf(list)[0];
        const indentPos = list.getFirstLineIndent().length;
        let indentChars = "";
        if (indentChars === "" && !prev.isEmpty()) {
            indentChars = prev
                .getChildren()[0]
                .getFirstLineIndent()
                .slice(prev.getFirstLineIndent().length);
        }
        if (indentChars === "") {
            indentChars = list
                .getFirstLineIndent()
                .slice(parent.getFirstLineIndent().length);
        }
        if (indentChars === "" && !list.isEmpty()) {
            indentChars = list.getChildren()[0].getFirstLineIndent();
        }
        if (indentChars === "") {
            indentChars = this.defaultIndentChars;
        }
        parent.removeChild(list);
        prev.addAfterAll(list);
        list.indentContent(indentPos, indentChars);
        const listStartLineAfter = root.getContentLinesRangeOf(list)[0];
        const lineDiff = listStartLineAfter - listStartLineBefore;
        const cursor = root.getCursor();
        root.replaceCursor({
            line: cursor.line + lineDiff,
            ch: cursor.ch + indentChars.length,
        });
        recalculateNumericBullets(root);
    }
}

class MoveListDown {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const list = root.getListUnderCursor();
        const parent = list.getParent();
        const grandParent = parent.getParent();
        const next = parent.getNextSiblingOf(list);
        const listStartLineBefore = root.getContentLinesRangeOf(list)[0];
        if (!next && grandParent) {
            const newParent = grandParent.getNextSiblingOf(parent);
            if (newParent) {
                this.updated = true;
                parent.removeChild(list);
                newParent.addBeforeAll(list);
            }
        }
        else if (next) {
            this.updated = true;
            parent.removeChild(list);
            parent.addAfter(next, list);
        }
        if (!this.updated) {
            return;
        }
        const listStartLineAfter = root.getContentLinesRangeOf(list)[0];
        const lineDiff = listStartLineAfter - listStartLineBefore;
        const cursor = root.getCursor();
        root.replaceCursor({
            line: cursor.line + lineDiff,
            ch: cursor.ch,
        });
        recalculateNumericBullets(root);
    }
}

class MoveListUp {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        const list = root.getListUnderCursor();
        const parent = list.getParent();
        const grandParent = parent.getParent();
        const prev = parent.getPrevSiblingOf(list);
        const listStartLineBefore = root.getContentLinesRangeOf(list)[0];
        if (!prev && grandParent) {
            const newParent = grandParent.getPrevSiblingOf(parent);
            if (newParent) {
                this.updated = true;
                parent.removeChild(list);
                newParent.addAfterAll(list);
            }
        }
        else if (prev) {
            this.updated = true;
            parent.removeChild(list);
            parent.addBefore(prev, list);
        }
        if (!this.updated) {
            return;
        }
        const listStartLineAfter = root.getContentLinesRangeOf(list)[0];
        const lineDiff = listStartLineAfter - listStartLineBefore;
        const cursor = root.getCursor();
        root.replaceCursor({
            line: cursor.line + lineDiff,
            ch: cursor.ch,
        });
        recalculateNumericBullets(root);
    }
}

class ListsMovementCommands {
    constructor(plugin, obsidianSettings, operationPerformer) {
        this.plugin = plugin;
        this.obsidianSettings = obsidianSettings;
        this.operationPerformer = operationPerformer;
        this.moveListDown = (editor) => {
            const { shouldStopPropagation } = this.operationPerformer.perform((root) => new MoveListDown(root), editor);
            return shouldStopPropagation;
        };
        this.moveListUp = (editor) => {
            const { shouldStopPropagation } = this.operationPerformer.perform((root) => new MoveListUp(root), editor);
            return shouldStopPropagation;
        };
        this.indentList = (editor) => {
            const { shouldStopPropagation } = this.operationPerformer.perform((root) => new IndentList(root, this.obsidianSettings.getDefaultIndentChars()), editor);
            return shouldStopPropagation;
        };
        this.outdentList = (editor) => {
            const { shouldStopPropagation } = this.operationPerformer.perform((root) => new OutdentList(root), editor);
            return shouldStopPropagation;
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.addCommand({
                id: "move-list-item-up",
                icon: "arrow-up",
                name: "Move list and sublists up",
                editorCallback: createEditorCallback(this.moveListUp),
                hotkeys: [
                    {
                        modifiers: ["Mod", "Shift"],
                        key: "ArrowUp",
                    },
                ],
            });
            this.plugin.addCommand({
                id: "move-list-item-down",
                icon: "arrow-down",
                name: "Move list and sublists down",
                editorCallback: createEditorCallback(this.moveListDown),
                hotkeys: [
                    {
                        modifiers: ["Mod", "Shift"],
                        key: "ArrowDown",
                    },
                ],
            });
            this.plugin.addCommand({
                id: "indent-list",
                icon: "indent",
                name: "Indent the list and sublists",
                editorCallback: createEditorCallback(this.indentList),
                hotkeys: [],
            });
            this.plugin.addCommand({
                id: "outdent-list",
                icon: "outdent",
                name: "Outdent the list and sublists",
                editorCallback: createEditorCallback(this.outdentList),
                hotkeys: [],
            });
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class DeleteTillCurrentLineContentStart {
    constructor(root) {
        this.root = root;
        this.stopPropagation = false;
        this.updated = false;
    }
    shouldStopPropagation() {
        return this.stopPropagation;
    }
    shouldUpdate() {
        return this.updated;
    }
    perform() {
        const { root } = this;
        if (!root.hasSingleCursor()) {
            return;
        }
        this.stopPropagation = true;
        this.updated = true;
        const cursor = root.getCursor();
        const list = root.getListUnderCursor();
        const lines = list.getLinesInfo();
        const lineNo = lines.findIndex((l) => l.from.line === cursor.line);
        lines[lineNo].text = lines[lineNo].text.slice(cursor.ch - lines[lineNo].from.ch);
        list.replaceLines(lines.map((l) => l.text));
        root.replaceCursor(lines[lineNo].from);
    }
}

class MetaBackspaceBehaviourOverride {
    constructor(plugin, settings, imeDetector, operationPerformer) {
        this.plugin = plugin;
        this.settings = settings;
        this.imeDetector = imeDetector;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return (this.settings.keepCursorWithinContent !== "never" &&
                !this.imeDetector.isOpened());
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new DeleteTillCurrentLineContentStart(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(view.keymap.of([
                {
                    mac: "m-Backspace",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ]));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class ObsidianOutlinerPluginSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin, settings) {
        super(app, plugin);
        this.settings = settings;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        new obsidian.Setting(containerEl)
            .setName("Stick the cursor to the content")
            .setDesc("Don't let the cursor move to the bullet position.")
            .addDropdown((dropdown) => {
            dropdown
                .addOptions({
                never: "Never",
                "bullet-only": "Stick cursor out of bullets",
                "bullet-and-checkbox": "Stick cursor out of bullets and checkboxes",
            })
                .setValue(this.settings.keepCursorWithinContent)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.keepCursorWithinContent = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Enhance the Tab key")
            .setDesc("Make Tab and Shift-Tab behave the same as other outliners.")
            .addToggle((toggle) => {
            toggle
                .setValue(this.settings.overrideTabBehaviour)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.overrideTabBehaviour = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Enhance the Enter key")
            .setDesc("Make the Enter key behave the same as other outliners.")
            .addToggle((toggle) => {
            toggle
                .setValue(this.settings.overrideEnterBehaviour)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.overrideEnterBehaviour = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Enhance the Ctrl+A or Cmd+A behavior")
            .setDesc("Press the hotkey once to select the current list item. Press the hotkey twice to select the entire list.")
            .addToggle((toggle) => {
            toggle
                .setValue(this.settings.overrideSelectAllBehaviour)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.overrideSelectAllBehaviour = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Improve the style of your lists")
            .setDesc("Styles are only compatible with built-in Obsidian themes and may not be compatible with other themes.")
            .addToggle((toggle) => {
            toggle
                .setValue(this.settings.betterListsStyles)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.betterListsStyles = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Draw vertical indentation lines")
            .addToggle((toggle) => {
            toggle.setValue(this.settings.verticalLines).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.verticalLines = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Vertical indentation line click action")
            .addDropdown((dropdown) => {
            dropdown
                .addOptions({
                none: "None",
                "zoom-in": "Zoom In",
                "toggle-folding": "Toggle Folding",
            })
                .setValue(this.settings.verticalLinesAction)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.verticalLinesAction = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl).setName("Drag-and-Drop").addToggle((toggle) => {
            toggle.setValue(this.settings.dragAndDrop).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.dragAndDrop = value;
                yield this.settings.save();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName("Debug mode")
            .setDesc("Open DevTools (Command+Option+I or Control+Shift+I) to copy the debug logs.")
            .addToggle((toggle) => {
            toggle.setValue(this.settings.debug).onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.settings.debug = value;
                yield this.settings.save();
            }));
        });
    }
}
class SettingsTab {
    constructor(plugin, settings) {
        this.plugin = plugin;
        this.settings = settings;
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.addSettingTab(new ObsidianOutlinerPluginSettingTab(this.plugin.app, this.plugin, this.settings));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class ShiftTabBehaviourOverride {
    constructor(plugin, imeDetector, settings, operationPerformer) {
        this.plugin = plugin;
        this.imeDetector = imeDetector;
        this.settings = settings;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return this.settings.overrideTabBehaviour && !this.imeDetector.isOpened();
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new OutdentList(root), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(state.Prec.highest(view.keymap.of([
                {
                    key: "s-Tab",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ])));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class SystemInfoModal extends obsidian.Modal {
    constructor(app, settings) {
        super(app);
        this.settings = settings;
    }
    onOpen() {
        return __awaiter(this, void 0, void 0, function* () {
            this.titleEl.setText("System Information");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const app = this.app;
            const data = {
                process: {
                    arch: process.arch,
                    platform: process.platform,
                },
                app: {
                    internalPlugins: {
                        config: app.internalPlugins.config,
                    },
                    isMobile: app.isMobile,
                    plugins: {
                        enabledPlugins: Array.from(app.plugins.enabledPlugins),
                        manifests: Object.keys(app.plugins.manifests).reduce((acc, key) => {
                            acc[key] = {
                                version: app.plugins.manifests[key].version,
                            };
                            return acc;
                        }, {}),
                    },
                    vault: {
                        config: app.vault.config,
                    },
                },
                plugin: {
                    settings: { values: this.settings.getValues() },
                },
            };
            const text = JSON.stringify(data, null, 2);
            const pre = this.contentEl.createEl("pre");
            pre.setText(text);
            pre.setCssStyles({
                overflow: "scroll",
                maxHeight: "300px",
            });
            const button = this.contentEl.createEl("button");
            button.setText("Copy and Close");
            button.onClickEvent(() => {
                navigator.clipboard.writeText("```json\n" + text + "\n```");
                this.close();
            });
        });
    }
}
class SystemInfo {
    constructor(plugin, settings) {
        this.plugin = plugin;
        this.settings = settings;
        this.callback = () => {
            const modal = new SystemInfoModal(this.plugin.app, this.settings);
            modal.open();
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.addCommand({
                id: "system-info",
                name: "Show System Info",
                callback: this.callback,
                hotkeys: [
                    {
                        modifiers: ["Mod", "Shift", "Alt"],
                        key: "I",
                    },
                ],
            });
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

class TabBehaviourOverride {
    constructor(plugin, imeDetector, obsidianSettings, settings, operationPerformer) {
        this.plugin = plugin;
        this.imeDetector = imeDetector;
        this.obsidianSettings = obsidianSettings;
        this.settings = settings;
        this.operationPerformer = operationPerformer;
        this.check = () => {
            return this.settings.overrideTabBehaviour && !this.imeDetector.isOpened();
        };
        this.run = (editor) => {
            return this.operationPerformer.perform((root) => new IndentList(root, this.obsidianSettings.getDefaultIndentChars()), editor);
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.plugin.registerEditorExtension(state.Prec.highest(view.keymap.of([
                {
                    key: "Tab",
                    run: createKeymapRunCallback({
                        check: this.check,
                        run: this.run,
                    }),
                },
            ])));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}

const VERTICAL_LINES_BODY_CLASS = "outliner-plugin-vertical-lines";
class VerticalLinesPluginValue {
    constructor(settings, obsidianSettings, parser, view) {
        this.settings = settings;
        this.obsidianSettings = obsidianSettings;
        this.parser = parser;
        this.view = view;
        this.lineElements = [];
        this.waitForEditor = () => {
            const editor = getEditorFromState(this.view.state);
            if (!editor) {
                setTimeout(this.waitForEditor, 0);
                return;
            }
            this.editor = editor;
            this.scheduleRecalculate();
        };
        this.onScroll = (e) => {
            const { scrollLeft, scrollTop } = e.target;
            this.scroller.scrollTo(scrollLeft, scrollTop);
        };
        this.scheduleRecalculate = () => {
            clearTimeout(this.scheduled);
            this.scheduled = setTimeout(this.calculate, 0);
        };
        this.calculate = () => {
            this.lines = [];
            if (this.settings.verticalLines &&
                this.obsidianSettings.isDefaultThemeEnabled() &&
                this.view.viewportLineBlocks.length > 0 &&
                this.view.visibleRanges.length > 0) {
                const fromLine = this.editor.offsetToPos(this.view.viewport.from).line;
                const toLine = this.editor.offsetToPos(this.view.viewport.to).line;
                const lists = this.parser.parseRange(this.editor, fromLine, toLine);
                for (const list of lists) {
                    this.lastLine = list.getContentEnd().line;
                    for (const c of list.getChildren()) {
                        this.recursive(c);
                    }
                }
                this.lines.sort((a, b) => a.top === b.top ? a.left - b.left : a.top - b.top);
            }
            this.updateDom();
        };
        this.onClick = (e) => {
            e.preventDefault();
            const line = this.lines[Number(e.target.dataset.index)];
            switch (this.settings.verticalLinesAction) {
                case "zoom-in":
                    this.zoomIn(line);
                    break;
                case "toggle-folding":
                    this.toggleFolding(line);
                    break;
            }
        };
        this.view.scrollDOM.addEventListener("scroll", this.onScroll);
        this.settings.onChange(this.scheduleRecalculate);
        this.prepareDom();
        this.waitForEditor();
    }
    prepareDom() {
        this.contentContainer = document.createElement("div");
        this.contentContainer.classList.add("outliner-plugin-list-lines-content-container");
        this.scroller = document.createElement("div");
        this.scroller.classList.add("outliner-plugin-list-lines-scroller");
        this.scroller.appendChild(this.contentContainer);
        this.view.dom.appendChild(this.scroller);
    }
    update(update) {
        if (update.docChanged ||
            update.viewportChanged ||
            update.geometryChanged ||
            update.transactions.some((tr) => tr.reconfigured)) {
            this.scheduleRecalculate();
        }
    }
    getNextSibling(list) {
        let listTmp = list;
        let p = listTmp.getParent();
        while (p) {
            const nextSibling = p.getNextSiblingOf(listTmp);
            if (nextSibling) {
                return nextSibling;
            }
            listTmp = p;
            p = listTmp.getParent();
        }
        return null;
    }
    recursive(list, parentCtx = {}) {
        const children = list.getChildren();
        if (children.length === 0) {
            return;
        }
        const fromOffset = this.editor.posToOffset({
            line: list.getFirstLineContentStart().line,
            ch: list.getFirstLineIndent().length,
        });
        const nextSibling = this.getNextSibling(list);
        const tillOffset = this.editor.posToOffset({
            line: nextSibling
                ? nextSibling.getFirstLineContentStart().line - 1
                : this.lastLine,
            ch: 0,
        });
        let visibleFrom = this.view.visibleRanges[0].from;
        let visibleTo = this.view.visibleRanges[this.view.visibleRanges.length - 1].to;
        const zoomRange = this.editor.getZoomRange();
        if (zoomRange) {
            visibleFrom = Math.max(visibleFrom, this.editor.posToOffset(zoomRange.from));
            visibleTo = Math.min(visibleTo, this.editor.posToOffset(zoomRange.to));
        }
        if (fromOffset > visibleTo || tillOffset < visibleFrom) {
            return;
        }
        const coords = this.view.coordsAtPos(fromOffset, 1);
        if (parentCtx.rootLeft === undefined) {
            parentCtx.rootLeft = coords.left;
        }
        const left = Math.floor(coords.right - parentCtx.rootLeft);
        const top = visibleFrom > 0 && fromOffset < visibleFrom
            ? -20
            : this.view.lineBlockAt(fromOffset).top;
        const bottom = tillOffset > visibleTo
            ? this.view.lineBlockAt(visibleTo - 1).bottom
            : this.view.lineBlockAt(tillOffset).bottom;
        const height = bottom - top;
        if (height > 0 && !list.isFolded()) {
            const nextSibling = list.getParent().getNextSiblingOf(list);
            const hasNextSibling = !!nextSibling &&
                this.editor.posToOffset(nextSibling.getFirstLineContentStart()) <=
                    visibleTo;
            this.lines.push({
                top,
                left,
                height: `calc(${height}px ${hasNextSibling ? "- 1.5em" : "- 2em"})`,
                list,
            });
        }
        for (const child of children) {
            if (!child.isEmpty()) {
                this.recursive(child, parentCtx);
            }
        }
    }
    zoomIn(line) {
        const editor = getEditorFromState(this.view.state);
        editor.zoomIn(line.list.getFirstLineContentStart().line);
    }
    toggleFolding(line) {
        const { list } = line;
        if (list.isEmpty()) {
            return;
        }
        let needToUnfold = true;
        const linesToToggle = [];
        for (const c of list.getChildren()) {
            if (c.isEmpty()) {
                continue;
            }
            if (!c.isFolded()) {
                needToUnfold = false;
            }
            linesToToggle.push(c.getFirstLineContentStart().line);
        }
        const editor = getEditorFromState(this.view.state);
        for (const l of linesToToggle) {
            if (needToUnfold) {
                editor.unfold(l);
            }
            else {
                editor.fold(l);
            }
        }
    }
    updateDom() {
        const cmScroll = this.view.scrollDOM;
        const cmContent = this.view.contentDOM;
        const cmContentContainer = cmContent.parentElement;
        const cmSizer = cmContentContainer.parentElement;
        /**
         * Obsidian can add additional elements into Content Manager.
         * The most obvious case is the 'embedded-backlinks' core plugin that adds a menu inside a Content Manager.
         * We must take heights of all of these elements into account
         * to be able to calculate the correct size of lines' container.
         */
        let cmSizerChildrenSumHeight = 0;
        for (let i = 0; i < cmSizer.children.length; i++) {
            cmSizerChildrenSumHeight += cmSizer.children[i].clientHeight;
        }
        this.scroller.style.top = cmScroll.offsetTop + "px";
        this.contentContainer.style.height = cmSizerChildrenSumHeight + "px";
        this.contentContainer.style.marginLeft =
            cmContentContainer.offsetLeft + "px";
        this.contentContainer.style.marginTop =
            cmContent.firstElementChild.offsetTop - 24 + "px";
        for (let i = 0; i < this.lines.length; i++) {
            if (this.lineElements.length === i) {
                const e = document.createElement("div");
                e.classList.add("outliner-plugin-list-line");
                e.dataset.index = String(i);
                e.addEventListener("mousedown", this.onClick);
                this.contentContainer.appendChild(e);
                this.lineElements.push(e);
            }
            const l = this.lines[i];
            const e = this.lineElements[i];
            e.style.top = l.top + "px";
            e.style.left = l.left + "px";
            e.style.height = l.height;
            e.style.display = "block";
        }
        for (let i = this.lines.length; i < this.lineElements.length; i++) {
            const e = this.lineElements[i];
            e.style.top = "0px";
            e.style.left = "0px";
            e.style.height = "0px";
            e.style.display = "none";
        }
    }
    destroy() {
        this.settings.removeCallback(this.scheduleRecalculate);
        this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
        this.view.dom.removeChild(this.scroller);
        clearTimeout(this.scheduled);
    }
}
class VerticalLines {
    constructor(plugin, settings, obsidianSettings, parser) {
        this.plugin = plugin;
        this.settings = settings;
        this.obsidianSettings = obsidianSettings;
        this.parser = parser;
        this.updateBodyClass = () => {
            const shouldExists = this.obsidianSettings.isDefaultThemeEnabled() &&
                this.settings.verticalLines;
            const exists = document.body.classList.contains(VERTICAL_LINES_BODY_CLASS);
            if (shouldExists && !exists) {
                document.body.classList.add(VERTICAL_LINES_BODY_CLASS);
            }
            if (!shouldExists && exists) {
                document.body.classList.remove(VERTICAL_LINES_BODY_CLASS);
            }
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.updateBodyClass();
            this.updateBodyClassInterval = window.setInterval(() => {
                this.updateBodyClass();
            }, 1000);
            this.plugin.registerEditorExtension(view.ViewPlugin.define((view) => new VerticalLinesPluginValue(this.settings, this.obsidianSettings, this.parser, view)));
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            clearInterval(this.updateBodyClassInterval);
            document.body.classList.remove(VERTICAL_LINES_BODY_CLASS);
        });
    }
}

class ChangesApplicator {
    apply(editor, prevRoot, newRoot) {
        const changes = this.calculateChanges(editor, prevRoot, newRoot);
        if (changes) {
            const { replacement, changeFrom, changeTo } = changes;
            const { unfold, fold } = this.calculateFoldingOprations(prevRoot, newRoot, changeFrom, changeTo);
            for (const line of unfold) {
                editor.unfold(line);
            }
            editor.replaceRange(replacement, changeFrom, changeTo);
            for (const line of fold) {
                editor.fold(line);
            }
        }
        editor.setSelections(newRoot.getSelections());
    }
    calculateChanges(editor, prevRoot, newRoot) {
        const rootRange = prevRoot.getContentRange();
        const oldString = editor.getRange(rootRange[0], rootRange[1]);
        const newString = newRoot.print();
        const changeFrom = Object.assign({}, rootRange[0]);
        const changeTo = Object.assign({}, rootRange[1]);
        let oldTmp = oldString;
        let newTmp = newString;
        while (true) {
            const nlIndex = oldTmp.lastIndexOf("\n");
            if (nlIndex < 0) {
                break;
            }
            const oldLine = oldTmp.slice(nlIndex);
            const newLine = newTmp.slice(-oldLine.length);
            if (oldLine !== newLine) {
                break;
            }
            oldTmp = oldTmp.slice(0, -oldLine.length);
            newTmp = newTmp.slice(0, -oldLine.length);
            const nlIndex2 = oldTmp.lastIndexOf("\n");
            changeTo.ch =
                nlIndex2 >= 0 ? oldTmp.length - nlIndex2 - 1 : oldTmp.length;
            changeTo.line--;
        }
        while (true) {
            const nlIndex = oldTmp.indexOf("\n");
            if (nlIndex < 0) {
                break;
            }
            const oldLine = oldTmp.slice(0, nlIndex + 1);
            const newLine = newTmp.slice(0, oldLine.length);
            if (oldLine !== newLine) {
                break;
            }
            changeFrom.line++;
            oldTmp = oldTmp.slice(oldLine.length);
            newTmp = newTmp.slice(oldLine.length);
        }
        if (oldTmp === newTmp) {
            return null;
        }
        return {
            replacement: newTmp,
            changeFrom,
            changeTo,
        };
    }
    calculateFoldingOprations(prevRoot, newRoot, changeFrom, changeTo) {
        const changedRange = [changeFrom, changeTo];
        const prevLists = getAllChildren(prevRoot);
        const newLists = getAllChildren(newRoot);
        const unfold = [];
        const fold = [];
        for (const prevList of prevLists.values()) {
            if (!prevList.isFoldRoot()) {
                continue;
            }
            const newList = newLists.get(prevList.getID());
            if (!newList) {
                continue;
            }
            const prevListRange = [
                prevList.getFirstLineContentStart(),
                prevList.getContentEndIncludingChildren(),
            ];
            if (isRangesIntersects(prevListRange, changedRange)) {
                unfold.push(prevList.getFirstLineContentStart().line);
                fold.push(newList.getFirstLineContentStart().line);
            }
        }
        unfold.sort((a, b) => b - a);
        fold.sort((a, b) => b - a);
        return { unfold, fold };
    }
}
function getAllChildrenReduceFn(acc, child) {
    acc.set(child.getID(), child);
    child.getChildren().reduce(getAllChildrenReduceFn, acc);
    return acc;
}
function getAllChildren(root) {
    return root.getChildren().reduce(getAllChildrenReduceFn, new Map());
}

class IMEDetector {
    constructor() {
        this.composition = false;
        this.onCompositionStart = () => {
            this.composition = true;
        };
        this.onCompositionEnd = () => {
            this.composition = false;
        };
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            document.addEventListener("compositionstart", this.onCompositionStart);
            document.addEventListener("compositionend", this.onCompositionEnd);
        });
    }
    unload() {
        return __awaiter(this, void 0, void 0, function* () {
            document.removeEventListener("compositionend", this.onCompositionEnd);
            document.removeEventListener("compositionstart", this.onCompositionStart);
        });
    }
    isOpened() {
        return this.composition && obsidian.Platform.isDesktop;
    }
}

class Logger {
    constructor(settings) {
        this.settings = settings;
    }
    log(method, ...args) {
        if (!this.settings.debug) {
            return;
        }
        console.info(method, ...args);
    }
    bind(method) {
        return (...args) => this.log(method, ...args);
    }
}

function getHiddenObsidianConfig(app) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return app.vault.config;
}
class ObsidianSettings {
    constructor(app) {
        this.app = app;
    }
    isLegacyEditorEnabled() {
        const config = Object.assign({ legacyEditor: false }, getHiddenObsidianConfig(this.app));
        return config.legacyEditor;
    }
    isDefaultThemeEnabled() {
        const config = Object.assign({ cssTheme: "" }, getHiddenObsidianConfig(this.app));
        return config.cssTheme === "";
    }
    getTabsSettings() {
        return Object.assign({ useTab: true, tabSize: 4 }, getHiddenObsidianConfig(this.app));
    }
    getFoldSettings() {
        return Object.assign({ foldIndent: true }, getHiddenObsidianConfig(this.app));
    }
    getDefaultIndentChars() {
        const { useTab, tabSize } = this.getTabsSettings();
        return useTab ? "\t" : new Array(tabSize).fill(" ").join("");
    }
}

class OperationPerformer {
    constructor(parser, changesApplicator) {
        this.parser = parser;
        this.changesApplicator = changesApplicator;
    }
    eval(root, op, editor) {
        const prevRoot = root.clone();
        op.perform();
        if (op.shouldUpdate()) {
            this.changesApplicator.apply(editor, prevRoot, root);
        }
        return {
            shouldUpdate: op.shouldUpdate(),
            shouldStopPropagation: op.shouldStopPropagation(),
        };
    }
    perform(cb, editor, cursor = editor.getCursor()) {
        const root = this.parser.parse(editor, cursor);
        if (!root) {
            return { shouldUpdate: false, shouldStopPropagation: false };
        }
        const op = cb(root);
        return this.eval(root, op, editor);
    }
}

const bulletSignRe = `(?:[-*+]|\\d+\\.)`;
const optionalCheckboxRe = `(?:${checkboxRe})?`;
const listItemWithoutSpacesRe = new RegExp(`^${bulletSignRe}( |\t)`);
const listItemRe = new RegExp(`^[ \t]*${bulletSignRe}( |\t)`);
const stringWithSpacesRe = new RegExp(`^[ \t]+`);
const parseListItemRe = new RegExp(`^([ \t]*)(${bulletSignRe})( |\t)(${optionalCheckboxRe})(.*)$`);
class Parser {
    constructor(logger, settings) {
        this.logger = logger;
        this.settings = settings;
    }
    parseRange(editor, fromLine = 0, toLine = editor.lastLine()) {
        const lists = [];
        for (let i = fromLine; i <= toLine; i++) {
            const line = editor.getLine(i);
            if (i === fromLine || this.isListItem(line)) {
                const list = this.parseWithLimits(editor, i, fromLine, toLine);
                if (list) {
                    lists.push(list);
                    i = list.getContentEnd().line;
                }
            }
        }
        return lists;
    }
    parse(editor, cursor = editor.getCursor()) {
        return this.parseWithLimits(editor, cursor.line, 0, editor.lastLine());
    }
    parseWithLimits(editor, parsingStartLine, limitFrom, limitTo) {
        const d = this.logger.bind("parseList");
        const error = (msg) => {
            d(msg);
            return null;
        };
        const line = editor.getLine(parsingStartLine);
        let listLookingPos = null;
        if (this.isListItem(line)) {
            listLookingPos = parsingStartLine;
        }
        else if (this.isLineWithIndent(line)) {
            let listLookingPosSearch = parsingStartLine - 1;
            while (listLookingPosSearch >= 0) {
                const line = editor.getLine(listLookingPosSearch);
                if (this.isListItem(line)) {
                    listLookingPos = listLookingPosSearch;
                    break;
                }
                else if (this.isLineWithIndent(line)) {
                    listLookingPosSearch--;
                }
                else {
                    break;
                }
            }
        }
        if (listLookingPos === null) {
            return null;
        }
        let listStartLine = null;
        let listStartLineLookup = listLookingPos;
        while (listStartLineLookup >= 0) {
            const line = editor.getLine(listStartLineLookup);
            if (!this.isListItem(line) && !this.isLineWithIndent(line)) {
                break;
            }
            if (this.isListItemWithoutSpaces(line)) {
                listStartLine = listStartLineLookup;
                if (listStartLineLookup <= limitFrom) {
                    break;
                }
            }
            listStartLineLookup--;
        }
        if (listStartLine === null) {
            return null;
        }
        let listEndLine = listLookingPos;
        let listEndLineLookup = listLookingPos;
        while (listEndLineLookup <= editor.lastLine()) {
            const line = editor.getLine(listEndLineLookup);
            if (!this.isListItem(line) && !this.isLineWithIndent(line)) {
                break;
            }
            if (!this.isEmptyLine(line)) {
                listEndLine = listEndLineLookup;
            }
            if (listEndLineLookup >= limitTo) {
                listEndLine = limitTo;
                break;
            }
            listEndLineLookup++;
        }
        if (listStartLine > parsingStartLine || listEndLine < parsingStartLine) {
            return null;
        }
        // if the last line contains only spaces and that's incorrect indent, then ignore the last line
        // https://github.com/vslinko/obsidian-outliner/issues/368
        if (listEndLine > listStartLine) {
            const lastLine = editor.getLine(listEndLine);
            if (lastLine.trim().length === 0) {
                const prevLine = editor.getLine(listEndLine - 1);
                const [, prevLineIndent] = /^(\s*)/.exec(prevLine);
                if (!lastLine.startsWith(prevLineIndent)) {
                    listEndLine--;
                }
            }
        }
        const root = new Root({ line: listStartLine, ch: 0 }, { line: listEndLine, ch: editor.getLine(listEndLine).length }, editor.listSelections().map((r) => ({
            anchor: { line: r.anchor.line, ch: r.anchor.ch },
            head: { line: r.head.line, ch: r.head.ch },
        })));
        let currentParent = root.getRootList();
        let currentList = null;
        let currentIndent = "";
        const foldedLines = editor.getAllFoldedLines();
        for (let l = listStartLine; l <= listEndLine; l++) {
            const line = editor.getLine(l);
            const matches = parseListItemRe.exec(line);
            if (matches) {
                const [, indent, bullet, spaceAfterBullet] = matches;
                let [, , , , optionalCheckbox, content] = matches;
                content = optionalCheckbox + content;
                if (this.settings.keepCursorWithinContent !== "bullet-and-checkbox") {
                    optionalCheckbox = "";
                }
                const compareLength = Math.min(currentIndent.length, indent.length);
                const indentSlice = indent.slice(0, compareLength);
                const currentIndentSlice = currentIndent.slice(0, compareLength);
                if (indentSlice !== currentIndentSlice) {
                    const expected = currentIndentSlice
                        .replace(/ /g, "S")
                        .replace(/\t/g, "T");
                    const got = indentSlice.replace(/ /g, "S").replace(/\t/g, "T");
                    return error(`Unable to parse list: expected indent "${expected}", got "${got}"`);
                }
                if (indent.length > currentIndent.length) {
                    currentParent = currentList;
                    currentIndent = indent;
                }
                else if (indent.length < currentIndent.length) {
                    while (currentParent.getFirstLineIndent().length >= indent.length &&
                        currentParent.getParent()) {
                        currentParent = currentParent.getParent();
                    }
                    currentIndent = indent;
                }
                const foldRoot = foldedLines.includes(l);
                currentList = new List(root, indent, bullet, optionalCheckbox, spaceAfterBullet, content, foldRoot);
                currentParent.addAfterAll(currentList);
            }
            else if (this.isLineWithIndent(line)) {
                if (!currentList) {
                    return error(`Unable to parse list: expected list item, got empty line`);
                }
                const indentToCheck = currentList.getNotesIndent() || currentIndent;
                if (line.indexOf(indentToCheck) !== 0) {
                    const expected = indentToCheck.replace(/ /g, "S").replace(/\t/g, "T");
                    const got = line
                        .match(/^[ \t]*/)[0]
                        .replace(/ /g, "S")
                        .replace(/\t/g, "T");
                    return error(`Unable to parse list: expected indent "${expected}", got "${got}"`);
                }
                if (!currentList.getNotesIndent()) {
                    const matches = line.match(/^[ \t]+/);
                    if (!matches || matches[0].length <= currentIndent.length) {
                        if (/^\s+$/.test(line)) {
                            continue;
                        }
                        return error(`Unable to parse list: expected some indent, got no indent`);
                    }
                    currentList.setNotesIndent(matches[0]);
                }
                currentList.addLine(line.slice(currentList.getNotesIndent().length));
            }
            else {
                return error(`Unable to parse list: expected list item or note, got "${line}"`);
            }
        }
        return root;
    }
    isEmptyLine(line) {
        return line.length === 0;
    }
    isLineWithIndent(line) {
        return stringWithSpacesRe.test(line);
    }
    isListItem(line) {
        return listItemRe.test(line);
    }
    isListItemWithoutSpaces(line) {
        return listItemWithoutSpacesRe.test(line);
    }
}

const DEFAULT_SETTINGS = {
    styleLists: true,
    debug: false,
    stickCursor: "bullet-and-checkbox",
    betterEnter: true,
    betterTab: true,
    selectAll: true,
    listLines: false,
    listLineAction: "toggle-folding",
    dnd: true,
    previousRelease: null,
};
class Settings {
    constructor(storage) {
        this.storage = storage;
        this.callbacks = new Set();
    }
    get keepCursorWithinContent() {
        // Adaptor for users migrating from older version of the plugin.
        if (this.values.stickCursor === true) {
            return "bullet-and-checkbox";
        }
        else if (this.values.stickCursor === false) {
            return "never";
        }
        return this.values.stickCursor;
    }
    set keepCursorWithinContent(value) {
        this.set("stickCursor", value);
    }
    get overrideTabBehaviour() {
        return this.values.betterTab;
    }
    set overrideTabBehaviour(value) {
        this.set("betterTab", value);
    }
    get overrideEnterBehaviour() {
        return this.values.betterEnter;
    }
    set overrideEnterBehaviour(value) {
        this.set("betterEnter", value);
    }
    get overrideSelectAllBehaviour() {
        return this.values.selectAll;
    }
    set overrideSelectAllBehaviour(value) {
        this.set("selectAll", value);
    }
    get betterListsStyles() {
        return this.values.styleLists;
    }
    set betterListsStyles(value) {
        this.set("styleLists", value);
    }
    get verticalLines() {
        return this.values.listLines;
    }
    set verticalLines(value) {
        this.set("listLines", value);
    }
    get verticalLinesAction() {
        return this.values.listLineAction;
    }
    set verticalLinesAction(value) {
        this.set("listLineAction", value);
    }
    get dragAndDrop() {
        return this.values.dnd;
    }
    set dragAndDrop(value) {
        this.set("dnd", value);
    }
    get debug() {
        return this.values.debug;
    }
    set debug(value) {
        this.set("debug", value);
    }
    get previousRelease() {
        return this.values.previousRelease;
    }
    set previousRelease(value) {
        this.set("previousRelease", value);
    }
    onChange(cb) {
        this.callbacks.add(cb);
    }
    removeCallback(cb) {
        this.callbacks.delete(cb);
    }
    reset() {
        for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
            this.set(k, v);
        }
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.values = Object.assign({}, DEFAULT_SETTINGS, yield this.storage.loadData());
        });
    }
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.storage.saveData(this.values);
        });
    }
    getValues() {
        return Object.assign({}, this.values);
    }
    set(key, value) {
        this.values[key] = value;
        for (const cb of this.callbacks) {
            cb();
        }
    }
}

class ObsidianOutlinerPlugin extends obsidian.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Loading obsidian-outliner`);
            yield this.prepareSettings();
            this.obsidianSettings = new ObsidianSettings(this.app);
            this.logger = new Logger(this.settings);
            this.parser = new Parser(this.logger, this.settings);
            this.changesApplicator = new ChangesApplicator();
            this.operationPerformer = new OperationPerformer(this.parser, this.changesApplicator);
            this.imeDetector = new IMEDetector();
            yield this.imeDetector.load();
            this.features = [
                // service features
                // new ReleaseNotesAnnouncement(this, this.settings),
                new SettingsTab(this, this.settings),
                new SystemInfo(this, this.settings),
                // general features
                new ListsMovementCommands(this, this.obsidianSettings, this.operationPerformer),
                new ListsFoldingCommands(this, this.obsidianSettings),
                // features based on settings.keepCursorWithinContent
                new EditorSelectionsBehaviourOverride(this, this.settings, this.parser, this.operationPerformer),
                new ArrowLeftAndCtrlArrowLeftBehaviourOverride(this, this.settings, this.imeDetector, this.operationPerformer),
                new BackspaceBehaviourOverride(this, this.settings, this.imeDetector, this.operationPerformer),
                new MetaBackspaceBehaviourOverride(this, this.settings, this.imeDetector, this.operationPerformer),
                new DeleteBehaviourOverride(this, this.settings, this.imeDetector, this.operationPerformer),
                // features based on settings.overrideTabBehaviour
                new TabBehaviourOverride(this, this.imeDetector, this.obsidianSettings, this.settings, this.operationPerformer),
                new ShiftTabBehaviourOverride(this, this.imeDetector, this.settings, this.operationPerformer),
                // features based on settings.overrideEnterBehaviour
                new EnterBehaviourOverride(this, this.settings, this.imeDetector, this.obsidianSettings, this.parser, this.operationPerformer),
                // features based on settings.overrideSelectAllBehaviour
                new CtrlAAndCmdABehaviourOverride(this, this.settings, this.imeDetector, this.operationPerformer),
                // features based on settings.betterListsStyles
                new BetterListsStyles(this.settings, this.obsidianSettings),
                // features based on settings.verticalLines
                new VerticalLines(this, this.settings, this.obsidianSettings, this.parser),
                // features based on settings.dragAndDrop
                new DragAndDrop(this, this.settings, this.obsidianSettings, this.parser, this.operationPerformer),
            ];
            for (const feature of this.features) {
                yield feature.load();
            }
        });
    }
    onunload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`Unloading obsidian-outliner`);
            yield this.imeDetector.unload();
            for (const feature of this.features) {
                yield feature.unload();
            }
        });
    }
    prepareSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = new Settings(this);
            yield this.settings.load();
        });
    }
}

module.exports = ObsidianOutlinerPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsInNyYy9vcGVyYXRpb25zL01vdmVDdXJzb3JUb1ByZXZpb3VzVW5mb2xkZWRMaW5lLnRzIiwic3JjL2VkaXRvci9pbmRleC50cyIsInNyYy91dGlscy9jcmVhdGVLZXltYXBSdW5DYWxsYmFjay50cyIsInNyYy9mZWF0dXJlcy9BcnJvd0xlZnRBbmRDdHJsQXJyb3dMZWZ0QmVoYXZpb3VyT3ZlcnJpZGUudHMiLCJzcmMvcm9vdC9pbmRleC50cyIsInNyYy9vcGVyYXRpb25zL0RlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kLnRzIiwic3JjL2ZlYXR1cmVzL0JhY2tzcGFjZUJlaGF2aW91ck92ZXJyaWRlLnRzIiwic3JjL2ZlYXR1cmVzL0JldHRlckxpc3RzU3R5bGVzLnRzIiwic3JjL29wZXJhdGlvbnMvU2VsZWN0QWxsQ29udGVudC50cyIsInNyYy9mZWF0dXJlcy9DdHJsQUFuZENtZEFCZWhhdmlvdXJPdmVycmlkZS50cyIsInNyYy9vcGVyYXRpb25zL0RlbGV0ZVRpbGxOZXh0TGluZUNvbnRlbnRTdGFydC50cyIsInNyYy9mZWF0dXJlcy9EZWxldGVCZWhhdmlvdXJPdmVycmlkZS50cyIsInNyYy9vcGVyYXRpb25zL01vdmVMaXN0VG9EaWZmZXJlbnRQb3NpdGlvbi50cyIsInNyYy9mZWF0dXJlcy9EcmFnQW5kRHJvcC50cyIsInNyYy9vcGVyYXRpb25zL0tlZXBDdXJzb3JPdXRzaWRlRm9sZGVkTGluZXMudHMiLCJzcmMvb3BlcmF0aW9ucy9LZWVwQ3Vyc29yV2l0aGluTGlzdENvbnRlbnQudHMiLCJzcmMvZmVhdHVyZXMvRWRpdG9yU2VsZWN0aW9uc0JlaGF2aW91ck92ZXJyaWRlLnRzIiwic3JjL3V0aWxzL2NoZWNrYm94UmUudHMiLCJzcmMvdXRpbHMvaXNFbXB0eUxpbmVPckVtcHR5Q2hlY2tib3gudHMiLCJzcmMvb3BlcmF0aW9ucy9DcmVhdGVOZXdJdGVtLnRzIiwic3JjL29wZXJhdGlvbnMvT3V0ZGVudExpc3QudHMiLCJzcmMvb3BlcmF0aW9ucy9PdXRkZW50TGlzdElmSXRzRW1wdHkudHMiLCJzcmMvZmVhdHVyZXMvRW50ZXJCZWhhdmlvdXJPdmVycmlkZS50cyIsInNyYy91dGlscy9jcmVhdGVFZGl0b3JDYWxsYmFjay50cyIsInNyYy9mZWF0dXJlcy9MaXN0c0ZvbGRpbmdDb21tYW5kcy50cyIsInNyYy9vcGVyYXRpb25zL0luZGVudExpc3QudHMiLCJzcmMvb3BlcmF0aW9ucy9Nb3ZlTGlzdERvd24udHMiLCJzcmMvb3BlcmF0aW9ucy9Nb3ZlTGlzdFVwLnRzIiwic3JjL2ZlYXR1cmVzL0xpc3RzTW92ZW1lbnRDb21tYW5kcy50cyIsInNyYy9vcGVyYXRpb25zL0RlbGV0ZVRpbGxDdXJyZW50TGluZUNvbnRlbnRTdGFydC50cyIsInNyYy9mZWF0dXJlcy9NZXRhQmFja3NwYWNlQmVoYXZpb3VyT3ZlcnJpZGUudHMiLCJzcmMvZmVhdHVyZXMvU2V0dGluZ3NUYWIudHMiLCJzcmMvZmVhdHVyZXMvU2hpZnRUYWJCZWhhdmlvdXJPdmVycmlkZS50cyIsInNyYy9mZWF0dXJlcy9TeXN0ZW1JbmZvLnRzIiwic3JjL2ZlYXR1cmVzL1RhYkJlaGF2aW91ck92ZXJyaWRlLnRzIiwic3JjL2ZlYXR1cmVzL1ZlcnRpY2FsTGluZXMudHMiLCJzcmMvc2VydmljZXMvQ2hhbmdlc0FwcGxpY2F0b3IudHMiLCJzcmMvc2VydmljZXMvSU1FRGV0ZWN0b3IudHMiLCJzcmMvc2VydmljZXMvTG9nZ2VyLnRzIiwic3JjL3NlcnZpY2VzL09ic2lkaWFuU2V0dGluZ3MudHMiLCJzcmMvc2VydmljZXMvT3BlcmF0aW9uUGVyZm9ybWVyLnRzIiwic3JjL3NlcnZpY2VzL1BhcnNlci50cyIsInNyYy9zZXJ2aWNlcy9TZXR0aW5ncy50cyIsInNyYy9PYnNpZGlhbk91dGxpbmVyUGx1Z2luLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uXHJcblxyXG5QZXJtaXNzaW9uIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBhbmQvb3IgZGlzdHJpYnV0ZSB0aGlzIHNvZnR3YXJlIGZvciBhbnlcclxucHVycG9zZSB3aXRoIG9yIHdpdGhvdXQgZmVlIGlzIGhlcmVieSBncmFudGVkLlxyXG5cclxuVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiBBTkQgVEhFIEFVVEhPUiBESVNDTEFJTVMgQUxMIFdBUlJBTlRJRVMgV0lUSFxyXG5SRUdBUkQgVE8gVEhJUyBTT0ZUV0FSRSBJTkNMVURJTkcgQUxMIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFlcclxuQU5EIEZJVE5FU1MuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1IgQkUgTElBQkxFIEZPUiBBTlkgU1BFQ0lBTCwgRElSRUNULFxyXG5JTkRJUkVDVCwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIE9SIEFOWSBEQU1BR0VTIFdIQVRTT0VWRVIgUkVTVUxUSU5HIEZST01cclxuTE9TUyBPRiBVU0UsIERBVEEgT1IgUFJPRklUUywgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIE5FR0xJR0VOQ0UgT1JcclxuT1RIRVIgVE9SVElPVVMgQUNUSU9OLCBBUklTSU5HIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFVTRSBPUlxyXG5QRVJGT1JNQU5DRSBPRiBUSElTIFNPRlRXQVJFLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG4vKiBnbG9iYWwgUmVmbGVjdCwgUHJvbWlzZSwgU3VwcHJlc3NlZEVycm9yLCBTeW1ib2wsIEl0ZXJhdG9yICovXHJcblxyXG52YXIgZXh0ZW5kU3RhdGljcyA9IGZ1bmN0aW9uKGQsIGIpIHtcclxuICAgIGV4dGVuZFN0YXRpY3MgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgfHxcclxuICAgICAgICAoeyBfX3Byb3RvX186IFtdIH0gaW5zdGFuY2VvZiBBcnJheSAmJiBmdW5jdGlvbiAoZCwgYikgeyBkLl9fcHJvdG9fXyA9IGI7IH0pIHx8XHJcbiAgICAgICAgZnVuY3Rpb24gKGQsIGIpIHsgZm9yICh2YXIgcCBpbiBiKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGIsIHApKSBkW3BdID0gYltwXTsgfTtcclxuICAgIHJldHVybiBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXh0ZW5kcyhkLCBiKSB7XHJcbiAgICBpZiAodHlwZW9mIGIgIT09IFwiZnVuY3Rpb25cIiAmJiBiICE9PSBudWxsKVxyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDbGFzcyBleHRlbmRzIHZhbHVlIFwiICsgU3RyaW5nKGIpICsgXCIgaXMgbm90IGEgY29uc3RydWN0b3Igb3IgbnVsbFwiKTtcclxuICAgIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbiAgICBmdW5jdGlvbiBfXygpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGQ7IH1cclxuICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2Fzc2lnbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgX19hc3NpZ24gPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uIF9fYXNzaWduKHQpIHtcclxuICAgICAgICBmb3IgKHZhciBzLCBpID0gMSwgbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcclxuICAgICAgICAgICAgcyA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApKSB0W3BdID0gc1twXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gX19hc3NpZ24uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVzdChzLCBlKSB7XHJcbiAgICB2YXIgdCA9IHt9O1xyXG4gICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApICYmIGUuaW5kZXhPZihwKSA8IDApXHJcbiAgICAgICAgdFtwXSA9IHNbcF07XHJcbiAgICBpZiAocyAhPSBudWxsICYmIHR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzID09PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIHAgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHMpOyBpIDwgcC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoZS5pbmRleE9mKHBbaV0pIDwgMCAmJiBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwocywgcFtpXSkpXHJcbiAgICAgICAgICAgICAgICB0W3BbaV1dID0gc1twW2ldXTtcclxuICAgICAgICB9XHJcbiAgICByZXR1cm4gdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpIHtcclxuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aCwgciA9IGMgPCAzID8gdGFyZ2V0IDogZGVzYyA9PT0gbnVsbCA/IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwga2V5KSA6IGRlc2MsIGQ7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QuZGVjb3JhdGUgPT09IFwiZnVuY3Rpb25cIikgciA9IFJlZmxlY3QuZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpO1xyXG4gICAgZWxzZSBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgaWYgKGQgPSBkZWNvcmF0b3JzW2ldKSByID0gKGMgPCAzID8gZChyKSA6IGMgPiAzID8gZCh0YXJnZXQsIGtleSwgcikgOiBkKHRhcmdldCwga2V5KSkgfHwgcjtcclxuICAgIHJldHVybiBjID4gMyAmJiByICYmIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGtleSwgciksIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3BhcmFtKHBhcmFtSW5kZXgsIGRlY29yYXRvcikge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uICh0YXJnZXQsIGtleSkgeyBkZWNvcmF0b3IodGFyZ2V0LCBrZXksIHBhcmFtSW5kZXgpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2VzRGVjb3JhdGUoY3RvciwgZGVzY3JpcHRvckluLCBkZWNvcmF0b3JzLCBjb250ZXh0SW4sIGluaXRpYWxpemVycywgZXh0cmFJbml0aWFsaXplcnMpIHtcclxuICAgIGZ1bmN0aW9uIGFjY2VwdChmKSB7IGlmIChmICE9PSB2b2lkIDAgJiYgdHlwZW9mIGYgIT09IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkZ1bmN0aW9uIGV4cGVjdGVkXCIpOyByZXR1cm4gZjsgfVxyXG4gICAgdmFyIGtpbmQgPSBjb250ZXh0SW4ua2luZCwga2V5ID0ga2luZCA9PT0gXCJnZXR0ZXJcIiA/IFwiZ2V0XCIgOiBraW5kID09PSBcInNldHRlclwiID8gXCJzZXRcIiA6IFwidmFsdWVcIjtcclxuICAgIHZhciB0YXJnZXQgPSAhZGVzY3JpcHRvckluICYmIGN0b3IgPyBjb250ZXh0SW5bXCJzdGF0aWNcIl0gPyBjdG9yIDogY3Rvci5wcm90b3R5cGUgOiBudWxsO1xyXG4gICAgdmFyIGRlc2NyaXB0b3IgPSBkZXNjcmlwdG9ySW4gfHwgKHRhcmdldCA/IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBjb250ZXh0SW4ubmFtZSkgOiB7fSk7XHJcbiAgICB2YXIgXywgZG9uZSA9IGZhbHNlO1xyXG4gICAgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcclxuICAgICAgICB2YXIgY29udGV4dCA9IHt9O1xyXG4gICAgICAgIGZvciAodmFyIHAgaW4gY29udGV4dEluKSBjb250ZXh0W3BdID0gcCA9PT0gXCJhY2Nlc3NcIiA/IHt9IDogY29udGV4dEluW3BdO1xyXG4gICAgICAgIGZvciAodmFyIHAgaW4gY29udGV4dEluLmFjY2VzcykgY29udGV4dC5hY2Nlc3NbcF0gPSBjb250ZXh0SW4uYWNjZXNzW3BdO1xyXG4gICAgICAgIGNvbnRleHQuYWRkSW5pdGlhbGl6ZXIgPSBmdW5jdGlvbiAoZikgeyBpZiAoZG9uZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBhZGQgaW5pdGlhbGl6ZXJzIGFmdGVyIGRlY29yYXRpb24gaGFzIGNvbXBsZXRlZFwiKTsgZXh0cmFJbml0aWFsaXplcnMucHVzaChhY2NlcHQoZiB8fCBudWxsKSk7IH07XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9ICgwLCBkZWNvcmF0b3JzW2ldKShraW5kID09PSBcImFjY2Vzc29yXCIgPyB7IGdldDogZGVzY3JpcHRvci5nZXQsIHNldDogZGVzY3JpcHRvci5zZXQgfSA6IGRlc2NyaXB0b3Jba2V5XSwgY29udGV4dCk7XHJcbiAgICAgICAgaWYgKGtpbmQgPT09IFwiYWNjZXNzb3JcIikge1xyXG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSB2b2lkIDApIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsIHx8IHR5cGVvZiByZXN1bHQgIT09IFwib2JqZWN0XCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QgZXhwZWN0ZWRcIik7XHJcbiAgICAgICAgICAgIGlmIChfID0gYWNjZXB0KHJlc3VsdC5nZXQpKSBkZXNjcmlwdG9yLmdldCA9IF87XHJcbiAgICAgICAgICAgIGlmIChfID0gYWNjZXB0KHJlc3VsdC5zZXQpKSBkZXNjcmlwdG9yLnNldCA9IF87XHJcbiAgICAgICAgICAgIGlmIChfID0gYWNjZXB0KHJlc3VsdC5pbml0KSkgaW5pdGlhbGl6ZXJzLnVuc2hpZnQoXyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKF8gPSBhY2NlcHQocmVzdWx0KSkge1xyXG4gICAgICAgICAgICBpZiAoa2luZCA9PT0gXCJmaWVsZFwiKSBpbml0aWFsaXplcnMudW5zaGlmdChfKTtcclxuICAgICAgICAgICAgZWxzZSBkZXNjcmlwdG9yW2tleV0gPSBfO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGlmICh0YXJnZXQpIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGNvbnRleHRJbi5uYW1lLCBkZXNjcmlwdG9yKTtcclxuICAgIGRvbmUgPSB0cnVlO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcnVuSW5pdGlhbGl6ZXJzKHRoaXNBcmcsIGluaXRpYWxpemVycywgdmFsdWUpIHtcclxuICAgIHZhciB1c2VWYWx1ZSA9IGFyZ3VtZW50cy5sZW5ndGggPiAyO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbml0aWFsaXplcnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICB2YWx1ZSA9IHVzZVZhbHVlID8gaW5pdGlhbGl6ZXJzW2ldLmNhbGwodGhpc0FyZywgdmFsdWUpIDogaW5pdGlhbGl6ZXJzW2ldLmNhbGwodGhpc0FyZyk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdXNlVmFsdWUgPyB2YWx1ZSA6IHZvaWQgMDtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Byb3BLZXkoeCkge1xyXG4gICAgcmV0dXJuIHR5cGVvZiB4ID09PSBcInN5bWJvbFwiID8geCA6IFwiXCIuY29uY2F0KHgpO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc2V0RnVuY3Rpb25OYW1lKGYsIG5hbWUsIHByZWZpeCkge1xyXG4gICAgaWYgKHR5cGVvZiBuYW1lID09PSBcInN5bWJvbFwiKSBuYW1lID0gbmFtZS5kZXNjcmlwdGlvbiA/IFwiW1wiLmNvbmNhdChuYW1lLmRlc2NyaXB0aW9uLCBcIl1cIikgOiBcIlwiO1xyXG4gICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShmLCBcIm5hbWVcIiwgeyBjb25maWd1cmFibGU6IHRydWUsIHZhbHVlOiBwcmVmaXggPyBcIlwiLmNvbmNhdChwcmVmaXgsIFwiIFwiLCBuYW1lKSA6IG5hbWUgfSk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSkge1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0Lm1ldGFkYXRhID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiBSZWZsZWN0Lm1ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXRlcih0aGlzQXJnLCBfYXJndW1lbnRzLCBQLCBnZW5lcmF0b3IpIHtcclxuICAgIGZ1bmN0aW9uIGFkb3B0KHZhbHVlKSB7IHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFAgPyB2YWx1ZSA6IG5ldyBQKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJlc29sdmUodmFsdWUpOyB9KTsgfVxyXG4gICAgcmV0dXJuIG5ldyAoUCB8fCAoUCA9IFByb21pc2UpKShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgZnVuY3Rpb24gZnVsZmlsbGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHJlamVjdGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yW1widGhyb3dcIl0odmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHN0ZXAocmVzdWx0KSB7IHJlc3VsdC5kb25lID8gcmVzb2x2ZShyZXN1bHQudmFsdWUpIDogYWRvcHQocmVzdWx0LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpOyB9XHJcbiAgICAgICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pKS5uZXh0KCkpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2dlbmVyYXRvcih0aGlzQXJnLCBib2R5KSB7XHJcbiAgICB2YXIgXyA9IHsgbGFiZWw6IDAsIHNlbnQ6IGZ1bmN0aW9uKCkgeyBpZiAodFswXSAmIDEpIHRocm93IHRbMV07IHJldHVybiB0WzFdOyB9LCB0cnlzOiBbXSwgb3BzOiBbXSB9LCBmLCB5LCB0LCBnID0gT2JqZWN0LmNyZWF0ZSgodHlwZW9mIEl0ZXJhdG9yID09PSBcImZ1bmN0aW9uXCIgPyBJdGVyYXRvciA6IE9iamVjdCkucHJvdG90eXBlKTtcclxuICAgIHJldHVybiBnLm5leHQgPSB2ZXJiKDApLCBnW1widGhyb3dcIl0gPSB2ZXJiKDEpLCBnW1wicmV0dXJuXCJdID0gdmVyYigyKSwgdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIChnW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXM7IH0pLCBnO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IHJldHVybiBmdW5jdGlvbiAodikgeyByZXR1cm4gc3RlcChbbiwgdl0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKG9wKSB7XHJcbiAgICAgICAgaWYgKGYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJHZW5lcmF0b3IgaXMgYWxyZWFkeSBleGVjdXRpbmcuXCIpO1xyXG4gICAgICAgIHdoaWxlIChnICYmIChnID0gMCwgb3BbMF0gJiYgKF8gPSAwKSksIF8pIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChmID0gMSwgeSAmJiAodCA9IG9wWzBdICYgMiA/IHlbXCJyZXR1cm5cIl0gOiBvcFswXSA/IHlbXCJ0aHJvd1wiXSB8fCAoKHQgPSB5W1wicmV0dXJuXCJdKSAmJiB0LmNhbGwoeSksIDApIDogeS5uZXh0KSAmJiAhKHQgPSB0LmNhbGwoeSwgb3BbMV0pKS5kb25lKSByZXR1cm4gdDtcclxuICAgICAgICAgICAgaWYgKHkgPSAwLCB0KSBvcCA9IFtvcFswXSAmIDIsIHQudmFsdWVdO1xyXG4gICAgICAgICAgICBzd2l0Y2ggKG9wWzBdKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDA6IGNhc2UgMTogdCA9IG9wOyBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgNDogXy5sYWJlbCsrOyByZXR1cm4geyB2YWx1ZTogb3BbMV0sIGRvbmU6IGZhbHNlIH07XHJcbiAgICAgICAgICAgICAgICBjYXNlIDU6IF8ubGFiZWwrKzsgeSA9IG9wWzFdOyBvcCA9IFswXTsgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDc6IG9wID0gXy5vcHMucG9wKCk7IF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghKHQgPSBfLnRyeXMsIHQgPSB0Lmxlbmd0aCA+IDAgJiYgdFt0Lmxlbmd0aCAtIDFdKSAmJiAob3BbMF0gPT09IDYgfHwgb3BbMF0gPT09IDIpKSB7IF8gPSAwOyBjb250aW51ZTsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gMyAmJiAoIXQgfHwgKG9wWzFdID4gdFswXSAmJiBvcFsxXSA8IHRbM10pKSkgeyBfLmxhYmVsID0gb3BbMV07IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSA2ICYmIF8ubGFiZWwgPCB0WzFdKSB7IF8ubGFiZWwgPSB0WzFdOyB0ID0gb3A7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHQgJiYgXy5sYWJlbCA8IHRbMl0pIHsgXy5sYWJlbCA9IHRbMl07IF8ub3BzLnB1c2gob3ApOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0WzJdKSBfLm9wcy5wb3AoKTtcclxuICAgICAgICAgICAgICAgICAgICBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIG9wID0gYm9keS5jYWxsKHRoaXNBcmcsIF8pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHsgb3AgPSBbNiwgZV07IHkgPSAwOyB9IGZpbmFsbHkgeyBmID0gdCA9IDA7IH1cclxuICAgICAgICBpZiAob3BbMF0gJiA1KSB0aHJvdyBvcFsxXTsgcmV0dXJuIHsgdmFsdWU6IG9wWzBdID8gb3BbMV0gOiB2b2lkIDAsIGRvbmU6IHRydWUgfTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2NyZWF0ZUJpbmRpbmcgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgdmFyIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG0sIGspO1xyXG4gICAgaWYgKCFkZXNjIHx8IChcImdldFwiIGluIGRlc2MgPyAhbS5fX2VzTW9kdWxlIDogZGVzYy53cml0YWJsZSB8fCBkZXNjLmNvbmZpZ3VyYWJsZSkpIHtcclxuICAgICAgICBkZXNjID0geyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gbVtrXTsgfSB9O1xyXG4gICAgfVxyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIGsyLCBkZXNjKTtcclxufSkgOiAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICBvW2syXSA9IG1ba107XHJcbn0pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXhwb3J0U3RhcihtLCBvKSB7XHJcbiAgICBmb3IgKHZhciBwIGluIG0pIGlmIChwICE9PSBcImRlZmF1bHRcIiAmJiAhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG8sIHApKSBfX2NyZWF0ZUJpbmRpbmcobywgbSwgcCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3ZhbHVlcyhvKSB7XHJcbiAgICB2YXIgcyA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBTeW1ib2wuaXRlcmF0b3IsIG0gPSBzICYmIG9bc10sIGkgPSAwO1xyXG4gICAgaWYgKG0pIHJldHVybiBtLmNhbGwobyk7XHJcbiAgICBpZiAobyAmJiB0eXBlb2Ygby5sZW5ndGggPT09IFwibnVtYmVyXCIpIHJldHVybiB7XHJcbiAgICAgICAgbmV4dDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAobyAmJiBpID49IG8ubGVuZ3RoKSBvID0gdm9pZCAwO1xyXG4gICAgICAgICAgICByZXR1cm4geyB2YWx1ZTogbyAmJiBvW2krK10sIGRvbmU6ICFvIH07XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IocyA/IFwiT2JqZWN0IGlzIG5vdCBpdGVyYWJsZS5cIiA6IFwiU3ltYm9sLml0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVhZChvLCBuKSB7XHJcbiAgICB2YXIgbSA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvW1N5bWJvbC5pdGVyYXRvcl07XHJcbiAgICBpZiAoIW0pIHJldHVybiBvO1xyXG4gICAgdmFyIGkgPSBtLmNhbGwobyksIHIsIGFyID0gW10sIGU7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIHdoaWxlICgobiA9PT0gdm9pZCAwIHx8IG4tLSA+IDApICYmICEociA9IGkubmV4dCgpKS5kb25lKSBhci5wdXNoKHIudmFsdWUpO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKGVycm9yKSB7IGUgPSB7IGVycm9yOiBlcnJvciB9OyB9XHJcbiAgICBmaW5hbGx5IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBpZiAociAmJiAhci5kb25lICYmIChtID0gaVtcInJldHVyblwiXSkpIG0uY2FsbChpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZmluYWxseSB7IGlmIChlKSB0aHJvdyBlLmVycm9yOyB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYXI7XHJcbn1cclxuXHJcbi8qKiBAZGVwcmVjYXRlZCAqL1xyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWQoKSB7XHJcbiAgICBmb3IgKHZhciBhciA9IFtdLCBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKylcclxuICAgICAgICBhciA9IGFyLmNvbmNhdChfX3JlYWQoYXJndW1lbnRzW2ldKSk7XHJcbiAgICByZXR1cm4gYXI7XHJcbn1cclxuXHJcbi8qKiBAZGVwcmVjYXRlZCAqL1xyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheXMoKSB7XHJcbiAgICBmb3IgKHZhciBzID0gMCwgaSA9IDAsIGlsID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGlsOyBpKyspIHMgKz0gYXJndW1lbnRzW2ldLmxlbmd0aDtcclxuICAgIGZvciAodmFyIHIgPSBBcnJheShzKSwgayA9IDAsIGkgPSAwOyBpIDwgaWw7IGkrKylcclxuICAgICAgICBmb3IgKHZhciBhID0gYXJndW1lbnRzW2ldLCBqID0gMCwgamwgPSBhLmxlbmd0aDsgaiA8IGpsOyBqKyssIGsrKylcclxuICAgICAgICAgICAgcltrXSA9IGFbal07XHJcbiAgICByZXR1cm4gcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXkodG8sIGZyb20sIHBhY2spIHtcclxuICAgIGlmIChwYWNrIHx8IGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIGZvciAodmFyIGkgPSAwLCBsID0gZnJvbS5sZW5ndGgsIGFyOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKGFyIHx8ICEoaSBpbiBmcm9tKSkge1xyXG4gICAgICAgICAgICBpZiAoIWFyKSBhciA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20sIDAsIGkpO1xyXG4gICAgICAgICAgICBhcltpXSA9IGZyb21baV07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRvLmNvbmNhdChhciB8fCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChmcm9tKSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0KHYpIHtcclxuICAgIHJldHVybiB0aGlzIGluc3RhbmNlb2YgX19hd2FpdCA/ICh0aGlzLnYgPSB2LCB0aGlzKSA6IG5ldyBfX2F3YWl0KHYpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0dlbmVyYXRvcih0aGlzQXJnLCBfYXJndW1lbnRzLCBnZW5lcmF0b3IpIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgZyA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSwgaSwgcSA9IFtdO1xyXG4gICAgcmV0dXJuIGkgPSBPYmplY3QuY3JlYXRlKCh0eXBlb2YgQXN5bmNJdGVyYXRvciA9PT0gXCJmdW5jdGlvblwiID8gQXN5bmNJdGVyYXRvciA6IE9iamVjdCkucHJvdG90eXBlKSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiLCBhd2FpdFJldHVybiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIGF3YWl0UmV0dXJuKGYpIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBQcm9taXNlLnJlc29sdmUodikudGhlbihmLCByZWplY3QpOyB9OyB9XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4sIGYpIHsgaWYgKGdbbl0pIHsgaVtuXSA9IGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAoYSwgYikgeyBxLnB1c2goW24sIHYsIGEsIGJdKSA+IDEgfHwgcmVzdW1lKG4sIHYpOyB9KTsgfTsgaWYgKGYpIGlbbl0gPSBmKGlbbl0pOyB9IH1cclxuICAgIGZ1bmN0aW9uIHJlc3VtZShuLCB2KSB7IHRyeSB7IHN0ZXAoZ1tuXSh2KSk7IH0gY2F0Y2ggKGUpIHsgc2V0dGxlKHFbMF1bM10sIGUpOyB9IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAocikgeyByLnZhbHVlIGluc3RhbmNlb2YgX19hd2FpdCA/IFByb21pc2UucmVzb2x2ZShyLnZhbHVlLnYpLnRoZW4oZnVsZmlsbCwgcmVqZWN0KSA6IHNldHRsZShxWzBdWzJdLCByKTsgfVxyXG4gICAgZnVuY3Rpb24gZnVsZmlsbCh2YWx1ZSkgeyByZXN1bWUoXCJuZXh0XCIsIHZhbHVlKTsgfVxyXG4gICAgZnVuY3Rpb24gcmVqZWN0KHZhbHVlKSB7IHJlc3VtZShcInRocm93XCIsIHZhbHVlKTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKGYsIHYpIHsgaWYgKGYodiksIHEuc2hpZnQoKSwgcS5sZW5ndGgpIHJlc3VtZShxWzBdWzBdLCBxWzBdWzFdKTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0RlbGVnYXRvcihvKSB7XHJcbiAgICB2YXIgaSwgcDtcclxuICAgIHJldHVybiBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiwgZnVuY3Rpb24gKGUpIHsgdGhyb3cgZTsgfSksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4sIGYpIHsgaVtuXSA9IG9bbl0gPyBmdW5jdGlvbiAodikgeyByZXR1cm4gKHAgPSAhcCkgPyB7IHZhbHVlOiBfX2F3YWl0KG9bbl0odikpLCBkb25lOiBmYWxzZSB9IDogZiA/IGYodikgOiB2OyB9IDogZjsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY1ZhbHVlcyhvKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIG0gPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgaTtcclxuICAgIHJldHVybiBtID8gbS5jYWxsKG8pIDogKG8gPSB0eXBlb2YgX192YWx1ZXMgPT09IFwiZnVuY3Rpb25cIiA/IF9fdmFsdWVzKG8pIDogb1tTeW1ib2wuaXRlcmF0b3JdKCksIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpKTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpW25dID0gb1tuXSAmJiBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkgeyB2ID0gb1tuXSh2KSwgc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgdi5kb25lLCB2LnZhbHVlKTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShyZXNvbHZlLCByZWplY3QsIGQsIHYpIHsgUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZnVuY3Rpb24odikgeyByZXNvbHZlKHsgdmFsdWU6IHYsIGRvbmU6IGQgfSk7IH0sIHJlamVjdCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWFrZVRlbXBsYXRlT2JqZWN0KGNvb2tlZCwgcmF3KSB7XHJcbiAgICBpZiAoT2JqZWN0LmRlZmluZVByb3BlcnR5KSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb29rZWQsIFwicmF3XCIsIHsgdmFsdWU6IHJhdyB9KTsgfSBlbHNlIHsgY29va2VkLnJhdyA9IHJhdzsgfVxyXG4gICAgcmV0dXJuIGNvb2tlZDtcclxufTtcclxuXHJcbnZhciBfX3NldE1vZHVsZURlZmF1bHQgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBcImRlZmF1bHRcIiwgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogdiB9KTtcclxufSkgOiBmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBvW1wiZGVmYXVsdFwiXSA9IHY7XHJcbn07XHJcblxyXG52YXIgb3duS2V5cyA9IGZ1bmN0aW9uKG8pIHtcclxuICAgIG93bktleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyB8fCBmdW5jdGlvbiAobykge1xyXG4gICAgICAgIHZhciBhciA9IFtdO1xyXG4gICAgICAgIGZvciAodmFyIGsgaW4gbykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBrKSkgYXJbYXIubGVuZ3RoXSA9IGs7XHJcbiAgICAgICAgcmV0dXJuIGFyO1xyXG4gICAgfTtcclxuICAgIHJldHVybiBvd25LZXlzKG8pO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0U3Rhcihtb2QpIHtcclxuICAgIGlmIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpIHJldHVybiBtb2Q7XHJcbiAgICB2YXIgcmVzdWx0ID0ge307XHJcbiAgICBpZiAobW9kICE9IG51bGwpIGZvciAodmFyIGsgPSBvd25LZXlzKG1vZCksIGkgPSAwOyBpIDwgay5sZW5ndGg7IGkrKykgaWYgKGtbaV0gIT09IFwiZGVmYXVsdFwiKSBfX2NyZWF0ZUJpbmRpbmcocmVzdWx0LCBtb2QsIGtbaV0pO1xyXG4gICAgX19zZXRNb2R1bGVEZWZhdWx0KHJlc3VsdCwgbW9kKTtcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydERlZmF1bHQobW9kKSB7XHJcbiAgICByZXR1cm4gKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgPyBtb2QgOiB7IGRlZmF1bHQ6IG1vZCB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZEdldChyZWNlaXZlciwgc3RhdGUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIGdldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHJlYWQgcHJpdmF0ZSBtZW1iZXIgZnJvbSBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xyXG4gICAgcmV0dXJuIGtpbmQgPT09IFwibVwiID8gZiA6IGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyKSA6IGYgPyBmLnZhbHVlIDogc3RhdGUuZ2V0KHJlY2VpdmVyKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRTZXQocmVjZWl2ZXIsIHN0YXRlLCB2YWx1ZSwga2luZCwgZikge1xyXG4gICAgaWYgKGtpbmQgPT09IFwibVwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBtZXRob2QgaXMgbm90IHdyaXRhYmxlXCIpO1xyXG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgc2V0dGVyXCIpO1xyXG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3Qgd3JpdGUgcHJpdmF0ZSBtZW1iZXIgdG8gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiAoa2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIsIHZhbHVlKSA6IGYgPyBmLnZhbHVlID0gdmFsdWUgOiBzdGF0ZS5zZXQocmVjZWl2ZXIsIHZhbHVlKSksIHZhbHVlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZEluKHN0YXRlLCByZWNlaXZlcikge1xyXG4gICAgaWYgKHJlY2VpdmVyID09PSBudWxsIHx8ICh0eXBlb2YgcmVjZWl2ZXIgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHJlY2VpdmVyICE9PSBcImZ1bmN0aW9uXCIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHVzZSAnaW4nIG9wZXJhdG9yIG9uIG5vbi1vYmplY3RcIik7XHJcbiAgICByZXR1cm4gdHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciA9PT0gc3RhdGUgOiBzdGF0ZS5oYXMocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hZGREaXNwb3NhYmxlUmVzb3VyY2UoZW52LCB2YWx1ZSwgYXN5bmMpIHtcclxuICAgIGlmICh2YWx1ZSAhPT0gbnVsbCAmJiB2YWx1ZSAhPT0gdm9pZCAwKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgdmFsdWUgIT09IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBleHBlY3RlZC5cIik7XHJcbiAgICAgICAgdmFyIGRpc3Bvc2UsIGlubmVyO1xyXG4gICAgICAgIGlmIChhc3luYykge1xyXG4gICAgICAgICAgICBpZiAoIVN5bWJvbC5hc3luY0Rpc3Bvc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNEaXNwb3NlIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgICAgICAgICAgZGlzcG9zZSA9IHZhbHVlW1N5bWJvbC5hc3luY0Rpc3Bvc2VdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZGlzcG9zZSA9PT0gdm9pZCAwKSB7XHJcbiAgICAgICAgICAgIGlmICghU3ltYm9sLmRpc3Bvc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuZGlzcG9zZSBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICAgICAgICAgIGRpc3Bvc2UgPSB2YWx1ZVtTeW1ib2wuZGlzcG9zZV07XHJcbiAgICAgICAgICAgIGlmIChhc3luYykgaW5uZXIgPSBkaXNwb3NlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIGRpc3Bvc2UgIT09IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdCBub3QgZGlzcG9zYWJsZS5cIik7XHJcbiAgICAgICAgaWYgKGlubmVyKSBkaXNwb3NlID0gZnVuY3Rpb24oKSB7IHRyeSB7IGlubmVyLmNhbGwodGhpcyk7IH0gY2F0Y2ggKGUpIHsgcmV0dXJuIFByb21pc2UucmVqZWN0KGUpOyB9IH07XHJcbiAgICAgICAgZW52LnN0YWNrLnB1c2goeyB2YWx1ZTogdmFsdWUsIGRpc3Bvc2U6IGRpc3Bvc2UsIGFzeW5jOiBhc3luYyB9KTtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKGFzeW5jKSB7XHJcbiAgICAgICAgZW52LnN0YWNrLnB1c2goeyBhc3luYzogdHJ1ZSB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiB2YWx1ZTtcclxuXHJcbn1cclxuXHJcbnZhciBfU3VwcHJlc3NlZEVycm9yID0gdHlwZW9mIFN1cHByZXNzZWRFcnJvciA9PT0gXCJmdW5jdGlvblwiID8gU3VwcHJlc3NlZEVycm9yIDogZnVuY3Rpb24gKGVycm9yLCBzdXBwcmVzc2VkLCBtZXNzYWdlKSB7XHJcbiAgICB2YXIgZSA9IG5ldyBFcnJvcihtZXNzYWdlKTtcclxuICAgIHJldHVybiBlLm5hbWUgPSBcIlN1cHByZXNzZWRFcnJvclwiLCBlLmVycm9yID0gZXJyb3IsIGUuc3VwcHJlc3NlZCA9IHN1cHByZXNzZWQsIGU7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19kaXNwb3NlUmVzb3VyY2VzKGVudikge1xyXG4gICAgZnVuY3Rpb24gZmFpbChlKSB7XHJcbiAgICAgICAgZW52LmVycm9yID0gZW52Lmhhc0Vycm9yID8gbmV3IF9TdXBwcmVzc2VkRXJyb3IoZSwgZW52LmVycm9yLCBcIkFuIGVycm9yIHdhcyBzdXBwcmVzc2VkIGR1cmluZyBkaXNwb3NhbC5cIikgOiBlO1xyXG4gICAgICAgIGVudi5oYXNFcnJvciA9IHRydWU7XHJcbiAgICB9XHJcbiAgICB2YXIgciwgcyA9IDA7XHJcbiAgICBmdW5jdGlvbiBuZXh0KCkge1xyXG4gICAgICAgIHdoaWxlIChyID0gZW52LnN0YWNrLnBvcCgpKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXIuYXN5bmMgJiYgcyA9PT0gMSkgcmV0dXJuIHMgPSAwLCBlbnYuc3RhY2sucHVzaChyKSwgUHJvbWlzZS5yZXNvbHZlKCkudGhlbihuZXh0KTtcclxuICAgICAgICAgICAgICAgIGlmIChyLmRpc3Bvc2UpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gci5kaXNwb3NlLmNhbGwoci52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHIuYXN5bmMpIHJldHVybiBzIHw9IDIsIFByb21pc2UucmVzb2x2ZShyZXN1bHQpLnRoZW4obmV4dCwgZnVuY3Rpb24oZSkgeyBmYWlsKGUpOyByZXR1cm4gbmV4dCgpOyB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGVsc2UgcyB8PSAxO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICBmYWlsKGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChzID09PSAxKSByZXR1cm4gZW52Lmhhc0Vycm9yID8gUHJvbWlzZS5yZWplY3QoZW52LmVycm9yKSA6IFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICAgIGlmIChlbnYuaGFzRXJyb3IpIHRocm93IGVudi5lcnJvcjtcclxuICAgIH1cclxuICAgIHJldHVybiBuZXh0KCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Jld3JpdGVSZWxhdGl2ZUltcG9ydEV4dGVuc2lvbihwYXRoLCBwcmVzZXJ2ZUpzeCkge1xyXG4gICAgaWYgKHR5cGVvZiBwYXRoID09PSBcInN0cmluZ1wiICYmIC9eXFwuXFwuP1xcLy8udGVzdChwYXRoKSkge1xyXG4gICAgICAgIHJldHVybiBwYXRoLnJlcGxhY2UoL1xcLih0c3gpJHwoKD86XFwuZCk/KSgoPzpcXC5bXi4vXSs/KT8pXFwuKFtjbV0/KXRzJC9pLCBmdW5jdGlvbiAobSwgdHN4LCBkLCBleHQsIGNtKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0c3ggPyBwcmVzZXJ2ZUpzeCA/IFwiLmpzeFwiIDogXCIuanNcIiA6IGQgJiYgKCFleHQgfHwgIWNtKSA/IG0gOiAoZCArIGV4dCArIFwiLlwiICsgY20udG9Mb3dlckNhc2UoKSArIFwianNcIik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcGF0aDtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQge1xyXG4gICAgX19leHRlbmRzOiBfX2V4dGVuZHMsXHJcbiAgICBfX2Fzc2lnbjogX19hc3NpZ24sXHJcbiAgICBfX3Jlc3Q6IF9fcmVzdCxcclxuICAgIF9fZGVjb3JhdGU6IF9fZGVjb3JhdGUsXHJcbiAgICBfX3BhcmFtOiBfX3BhcmFtLFxyXG4gICAgX19lc0RlY29yYXRlOiBfX2VzRGVjb3JhdGUsXHJcbiAgICBfX3J1bkluaXRpYWxpemVyczogX19ydW5Jbml0aWFsaXplcnMsXHJcbiAgICBfX3Byb3BLZXk6IF9fcHJvcEtleSxcclxuICAgIF9fc2V0RnVuY3Rpb25OYW1lOiBfX3NldEZ1bmN0aW9uTmFtZSxcclxuICAgIF9fbWV0YWRhdGE6IF9fbWV0YWRhdGEsXHJcbiAgICBfX2F3YWl0ZXI6IF9fYXdhaXRlcixcclxuICAgIF9fZ2VuZXJhdG9yOiBfX2dlbmVyYXRvcixcclxuICAgIF9fY3JlYXRlQmluZGluZzogX19jcmVhdGVCaW5kaW5nLFxyXG4gICAgX19leHBvcnRTdGFyOiBfX2V4cG9ydFN0YXIsXHJcbiAgICBfX3ZhbHVlczogX192YWx1ZXMsXHJcbiAgICBfX3JlYWQ6IF9fcmVhZCxcclxuICAgIF9fc3ByZWFkOiBfX3NwcmVhZCxcclxuICAgIF9fc3ByZWFkQXJyYXlzOiBfX3NwcmVhZEFycmF5cyxcclxuICAgIF9fc3ByZWFkQXJyYXk6IF9fc3ByZWFkQXJyYXksXHJcbiAgICBfX2F3YWl0OiBfX2F3YWl0LFxyXG4gICAgX19hc3luY0dlbmVyYXRvcjogX19hc3luY0dlbmVyYXRvcixcclxuICAgIF9fYXN5bmNEZWxlZ2F0b3I6IF9fYXN5bmNEZWxlZ2F0b3IsXHJcbiAgICBfX2FzeW5jVmFsdWVzOiBfX2FzeW5jVmFsdWVzLFxyXG4gICAgX19tYWtlVGVtcGxhdGVPYmplY3Q6IF9fbWFrZVRlbXBsYXRlT2JqZWN0LFxyXG4gICAgX19pbXBvcnRTdGFyOiBfX2ltcG9ydFN0YXIsXHJcbiAgICBfX2ltcG9ydERlZmF1bHQ6IF9faW1wb3J0RGVmYXVsdCxcclxuICAgIF9fY2xhc3NQcml2YXRlRmllbGRHZXQ6IF9fY2xhc3NQcml2YXRlRmllbGRHZXQsXHJcbiAgICBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0OiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0LFxyXG4gICAgX19jbGFzc1ByaXZhdGVGaWVsZEluOiBfX2NsYXNzUHJpdmF0ZUZpZWxkSW4sXHJcbiAgICBfX2FkZERpc3Bvc2FibGVSZXNvdXJjZTogX19hZGREaXNwb3NhYmxlUmVzb3VyY2UsXHJcbiAgICBfX2Rpc3Bvc2VSZXNvdXJjZXM6IF9fZGlzcG9zZVJlc291cmNlcyxcclxuICAgIF9fcmV3cml0ZVJlbGF0aXZlSW1wb3J0RXh0ZW5zaW9uOiBfX3Jld3JpdGVSZWxhdGl2ZUltcG9ydEV4dGVuc2lvbixcclxufTtcclxuIiwiaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5cbmltcG9ydCB7IExpc3RMaW5lLCBQb3NpdGlvbiwgUm9vdCB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBNb3ZlQ3Vyc29yVG9QcmV2aW91c1VuZm9sZGVkTGluZSBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdDogUm9vdCkge31cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcFByb3BhZ2F0aW9uO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZWQ7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcblxuICAgIGlmICghcm9vdC5oYXNTaW5nbGVDdXJzb3IoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxpc3QgPSB0aGlzLnJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgY29uc3QgY3Vyc29yID0gdGhpcy5yb290LmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGxpbmVzID0gbGlzdC5nZXRMaW5lc0luZm8oKTtcbiAgICBjb25zdCBsaW5lTm8gPSBsaW5lcy5maW5kSW5kZXgoKGwpID0+IHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIGN1cnNvci5jaCA9PT0gbC5mcm9tLmNoICsgbGlzdC5nZXRDaGVja2JveExlbmd0aCgpICYmXG4gICAgICAgIGN1cnNvci5saW5lID09PSBsLmZyb20ubGluZVxuICAgICAgKTtcbiAgICB9KTtcblxuICAgIGlmIChsaW5lTm8gPT09IDApIHtcbiAgICAgIHRoaXMubW92ZUN1cnNvclRvUHJldmlvdXNVbmZvbGRlZEl0ZW0ocm9vdCwgY3Vyc29yKTtcbiAgICB9IGVsc2UgaWYgKGxpbmVObyA+IDApIHtcbiAgICAgIHRoaXMubW92ZUN1cnNvclRvUHJldmlvdXNOb3RlTGluZShyb290LCBsaW5lcywgbGluZU5vKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG1vdmVDdXJzb3JUb1ByZXZpb3VzTm90ZUxpbmUoXG4gICAgcm9vdDogUm9vdCxcbiAgICBsaW5lczogTGlzdExpbmVbXSxcbiAgICBsaW5lTm86IG51bWJlcixcbiAgKSB7XG4gICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG5cbiAgICByb290LnJlcGxhY2VDdXJzb3IobGluZXNbbGluZU5vIC0gMV0udG8pO1xuICB9XG5cbiAgcHJpdmF0ZSBtb3ZlQ3Vyc29yVG9QcmV2aW91c1VuZm9sZGVkSXRlbShyb290OiBSb290LCBjdXJzb3I6IFBvc2l0aW9uKSB7XG4gICAgY29uc3QgcHJldiA9IHJvb3QuZ2V0TGlzdFVuZGVyTGluZShjdXJzb3IubGluZSAtIDEpO1xuXG4gICAgaWYgKCFwcmV2KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG5cbiAgICBpZiAocHJldi5pc0ZvbGRlZCgpKSB7XG4gICAgICBjb25zdCBmb2xkUm9vdCA9IHByZXYuZ2V0VG9wRm9sZFJvb3QoKTtcbiAgICAgIGNvbnN0IGZpcnN0TGluZUVuZCA9IGZvbGRSb290LmdldExpbmVzSW5mbygpWzBdLnRvO1xuICAgICAgcm9vdC5yZXBsYWNlQ3Vyc29yKGZpcnN0TGluZUVuZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJvb3QucmVwbGFjZUN1cnNvcihwcmV2LmdldExhc3RMaW5lQ29udGVudEVuZCgpKTtcbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCB7IEVkaXRvciwgZWRpdG9ySW5mb0ZpZWxkIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7XG4gIGZvbGRFZmZlY3QsXG4gIGZvbGRhYmxlLFxuICBmb2xkZWRSYW5nZXMsXG4gIHVuZm9sZEVmZmVjdCxcbn0gZnJvbSBcIkBjb2RlbWlycm9yL2xhbmd1YWdlXCI7XG5pbXBvcnQgeyBFZGl0b3JTdGF0ZSB9IGZyb20gXCJAY29kZW1pcnJvci9zdGF0ZVwiO1xuaW1wb3J0IHsgRWRpdG9yVmlldywgcnVuU2NvcGVIYW5kbGVycyB9IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmV4cG9ydCBjbGFzcyBNeUVkaXRvclBvc2l0aW9uIHtcbiAgbGluZTogbnVtYmVyO1xuICBjaDogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgTXlFZGl0b3JSYW5nZSB7XG4gIGZyb206IE15RWRpdG9yUG9zaXRpb247XG4gIHRvOiBNeUVkaXRvclBvc2l0aW9uO1xufVxuXG5leHBvcnQgY2xhc3MgTXlFZGl0b3JTZWxlY3Rpb24ge1xuICBhbmNob3I6IE15RWRpdG9yUG9zaXRpb247XG4gIGhlYWQ6IE15RWRpdG9yUG9zaXRpb247XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRFZGl0b3JGcm9tU3RhdGUoc3RhdGU6IEVkaXRvclN0YXRlKSB7XG4gIGNvbnN0IHsgZWRpdG9yIH0gPSBzdGF0ZS5maWVsZChlZGl0b3JJbmZvRmllbGQpO1xuXG4gIGlmICghZWRpdG9yKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gbmV3IE15RWRpdG9yKGVkaXRvcik7XG59XG5cbmRlY2xhcmUgZ2xvYmFsIHtcbiAgaW50ZXJmYWNlIFdpbmRvdyB7XG4gICAgT2JzaWRpYW5ab29tUGx1Z2luPzoge1xuICAgICAgZ2V0Wm9vbVJhbmdlKGU6IEVkaXRvcik6IE15RWRpdG9yUmFuZ2U7XG4gICAgICB6b29tT3V0KGU6IEVkaXRvcik6IHZvaWQ7XG4gICAgICB6b29tSW4oZTogRWRpdG9yLCBsaW5lOiBudW1iZXIpOiB2b2lkO1xuICAgICAgcmVmcmVzaFpvb20/KGU6IEVkaXRvcik6IHZvaWQ7XG4gICAgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmb2xkSW5zaWRlKHZpZXc6IEVkaXRvclZpZXcsIGZyb206IG51bWJlciwgdG86IG51bWJlcikge1xuICBsZXQgZm91bmQ6IHsgZnJvbTogbnVtYmVyOyB0bzogbnVtYmVyIH0gfCBudWxsID0gbnVsbDtcbiAgZm9sZGVkUmFuZ2VzKHZpZXcuc3RhdGUpLmJldHdlZW4oZnJvbSwgdG8sIChmcm9tLCB0bykgPT4ge1xuICAgIGlmICghZm91bmQgfHwgZm91bmQuZnJvbSA+IGZyb20pIGZvdW5kID0geyBmcm9tLCB0byB9O1xuICB9KTtcbiAgcmV0dXJuIGZvdW5kO1xufVxuXG5leHBvcnQgY2xhc3MgTXlFZGl0b3Ige1xuICBwcml2YXRlIHZpZXc6IEVkaXRvclZpZXc7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBlOiBFZGl0b3IpIHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIHRoaXMudmlldyA9ICh0aGlzLmUgYXMgYW55KS5jbTtcbiAgfVxuXG4gIGdldEN1cnNvcigpOiBNeUVkaXRvclBvc2l0aW9uIHtcbiAgICByZXR1cm4gdGhpcy5lLmdldEN1cnNvcigpO1xuICB9XG5cbiAgZ2V0TGluZShuOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmUuZ2V0TGluZShuKTtcbiAgfVxuXG4gIGxhc3RMaW5lKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuZS5sYXN0TGluZSgpO1xuICB9XG5cbiAgbGlzdFNlbGVjdGlvbnMoKTogTXlFZGl0b3JTZWxlY3Rpb25bXSB7XG4gICAgcmV0dXJuIHRoaXMuZS5saXN0U2VsZWN0aW9ucygpO1xuICB9XG5cbiAgZ2V0UmFuZ2UoZnJvbTogTXlFZGl0b3JQb3NpdGlvbiwgdG86IE15RWRpdG9yUG9zaXRpb24pOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmUuZ2V0UmFuZ2UoZnJvbSwgdG8pO1xuICB9XG5cbiAgcmVwbGFjZVJhbmdlKFxuICAgIHJlcGxhY2VtZW50OiBzdHJpbmcsXG4gICAgZnJvbTogTXlFZGl0b3JQb3NpdGlvbixcbiAgICB0bzogTXlFZGl0b3JQb3NpdGlvbixcbiAgKTogdm9pZCB7XG4gICAgcmV0dXJuIHRoaXMuZS5yZXBsYWNlUmFuZ2UocmVwbGFjZW1lbnQsIGZyb20sIHRvKTtcbiAgfVxuXG4gIHNldFNlbGVjdGlvbnMoc2VsZWN0aW9uczogTXlFZGl0b3JTZWxlY3Rpb25bXSk6IHZvaWQge1xuICAgIHRoaXMuZS5zZXRTZWxlY3Rpb25zKHNlbGVjdGlvbnMpO1xuICB9XG5cbiAgc2V0VmFsdWUodGV4dDogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5lLnNldFZhbHVlKHRleHQpO1xuICB9XG5cbiAgZ2V0VmFsdWUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5lLmdldFZhbHVlKCk7XG4gIH1cblxuICBvZmZzZXRUb1BvcyhvZmZzZXQ6IG51bWJlcik6IE15RWRpdG9yUG9zaXRpb24ge1xuICAgIHJldHVybiB0aGlzLmUub2Zmc2V0VG9Qb3Mob2Zmc2V0KTtcbiAgfVxuXG4gIHBvc1RvT2Zmc2V0KHBvczogTXlFZGl0b3JQb3NpdGlvbik6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuZS5wb3NUb09mZnNldChwb3MpO1xuICB9XG5cbiAgZm9sZChuOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCB7IHZpZXcgfSA9IHRoaXM7XG4gICAgY29uc3QgbCA9IHZpZXcubGluZUJsb2NrQXQodmlldy5zdGF0ZS5kb2MubGluZShuICsgMSkuZnJvbSk7XG4gICAgY29uc3QgcmFuZ2UgPSBmb2xkYWJsZSh2aWV3LnN0YXRlLCBsLmZyb20sIGwudG8pO1xuXG4gICAgaWYgKCFyYW5nZSB8fCByYW5nZS5mcm9tID09PSByYW5nZS50bykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZpZXcuZGlzcGF0Y2goeyBlZmZlY3RzOiBbZm9sZEVmZmVjdC5vZihyYW5nZSldIH0pO1xuICB9XG5cbiAgdW5mb2xkKG46IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IHsgdmlldyB9ID0gdGhpcztcbiAgICBjb25zdCBsID0gdmlldy5saW5lQmxvY2tBdCh2aWV3LnN0YXRlLmRvYy5saW5lKG4gKyAxKS5mcm9tKTtcbiAgICBjb25zdCByYW5nZSA9IGZvbGRJbnNpZGUodmlldywgbC5mcm9tLCBsLnRvKTtcblxuICAgIGlmICghcmFuZ2UpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2aWV3LmRpc3BhdGNoKHsgZWZmZWN0czogW3VuZm9sZEVmZmVjdC5vZihyYW5nZSldIH0pO1xuICB9XG5cbiAgZ2V0QWxsRm9sZGVkTGluZXMoKTogbnVtYmVyW10ge1xuICAgIGNvbnN0IGMgPSBmb2xkZWRSYW5nZXModGhpcy52aWV3LnN0YXRlKS5pdGVyKCk7XG4gICAgY29uc3QgcmVzOiBudW1iZXJbXSA9IFtdO1xuICAgIHdoaWxlIChjLnZhbHVlKSB7XG4gICAgICByZXMucHVzaCh0aGlzLm9mZnNldFRvUG9zKGMuZnJvbSkubGluZSk7XG4gICAgICBjLm5leHQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuXG4gIHRyaWdnZXJPbktleURvd24oZTogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuICAgIHJ1blNjb3BlSGFuZGxlcnModGhpcy52aWV3LCBlLCBcImVkaXRvclwiKTtcbiAgfVxuXG4gIGdldFpvb21SYW5nZSgpOiBNeUVkaXRvclJhbmdlIHwgbnVsbCB7XG4gICAgaWYgKCF3aW5kb3cuT2JzaWRpYW5ab29tUGx1Z2luKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gd2luZG93Lk9ic2lkaWFuWm9vbVBsdWdpbi5nZXRab29tUmFuZ2UodGhpcy5lKTtcbiAgfVxuXG4gIHpvb21PdXQoKSB7XG4gICAgaWYgKCF3aW5kb3cuT2JzaWRpYW5ab29tUGx1Z2luKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgd2luZG93Lk9ic2lkaWFuWm9vbVBsdWdpbi56b29tT3V0KHRoaXMuZSk7XG4gIH1cblxuICB6b29tSW4obGluZTogbnVtYmVyKSB7XG4gICAgaWYgKCF3aW5kb3cuT2JzaWRpYW5ab29tUGx1Z2luKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgd2luZG93Lk9ic2lkaWFuWm9vbVBsdWdpbi56b29tSW4odGhpcy5lLCBsaW5lKTtcbiAgfVxuXG4gIHRyeVJlZnJlc2hab29tKGxpbmU6IG51bWJlcikge1xuICAgIGlmICghd2luZG93Lk9ic2lkaWFuWm9vbVBsdWdpbikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh3aW5kb3cuT2JzaWRpYW5ab29tUGx1Z2luLnJlZnJlc2hab29tKSB7XG4gICAgICB3aW5kb3cuT2JzaWRpYW5ab29tUGx1Z2luLnJlZnJlc2hab29tKHRoaXMuZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdpbmRvdy5PYnNpZGlhblpvb21QbHVnaW4uem9vbUluKHRoaXMuZSwgbGluZSk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBFZGl0b3JWaWV3IH0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IsIGdldEVkaXRvckZyb21TdGF0ZSB9IGZyb20gXCIuLi9lZGl0b3JcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKGNvbmZpZzoge1xuICBjaGVjaz86IChlZGl0b3I6IE15RWRpdG9yKSA9PiBib29sZWFuO1xuICBydW46IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgc2hvdWxkVXBkYXRlOiBib29sZWFuO1xuICAgIHNob3VsZFN0b3BQcm9wYWdhdGlvbjogYm9vbGVhbjtcbiAgfTtcbn0pIHtcbiAgY29uc3QgY2hlY2sgPSBjb25maWcuY2hlY2sgfHwgKCgpID0+IHRydWUpO1xuICBjb25zdCB7IHJ1biB9ID0gY29uZmlnO1xuXG4gIHJldHVybiAodmlldzogRWRpdG9yVmlldyk6IGJvb2xlYW4gPT4ge1xuICAgIGNvbnN0IGVkaXRvciA9IGdldEVkaXRvckZyb21TdGF0ZSh2aWV3LnN0YXRlKTtcblxuICAgIGlmICghY2hlY2soZWRpdG9yKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IHsgc2hvdWxkVXBkYXRlLCBzaG91bGRTdG9wUHJvcGFnYXRpb24gfSA9IHJ1bihlZGl0b3IpO1xuXG4gICAgcmV0dXJuIHNob3VsZFVwZGF0ZSB8fCBzaG91bGRTdG9wUHJvcGFnYXRpb247XG4gIH07XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsga2V5bWFwIH0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBNb3ZlQ3Vyc29yVG9QcmV2aW91c1VuZm9sZGVkTGluZSB9IGZyb20gXCIuLi9vcGVyYXRpb25zL01vdmVDdXJzb3JUb1ByZXZpb3VzVW5mb2xkZWRMaW5lXCI7XG5pbXBvcnQgeyBJTUVEZXRlY3RvciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9JTUVEZXRlY3RvclwiO1xuaW1wb3J0IHsgT3BlcmF0aW9uUGVyZm9ybWVyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcbmltcG9ydCB7IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrIH0gZnJvbSBcIi4uL3V0aWxzL2NyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrXCI7XG5cbmV4cG9ydCBjbGFzcyBBcnJvd0xlZnRBbmRDdHJsQXJyb3dMZWZ0QmVoYXZpb3VyT3ZlcnJpZGUgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgICBwcml2YXRlIGltZURldGVjdG9yOiBJTUVEZXRlY3RvcixcbiAgICBwcml2YXRlIG9wZXJhdGlvblBlcmZvcm1lcjogT3BlcmF0aW9uUGVyZm9ybWVyLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihcbiAgICAgIGtleW1hcC5vZihbXG4gICAgICAgIHtcbiAgICAgICAgICBrZXk6IFwiQXJyb3dMZWZ0XCIsXG4gICAgICAgICAgcnVuOiBjcmVhdGVLZXltYXBSdW5DYWxsYmFjayh7XG4gICAgICAgICAgICBjaGVjazogdGhpcy5jaGVjayxcbiAgICAgICAgICAgIHJ1bjogdGhpcy5ydW4sXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB3aW46IFwiYy1BcnJvd0xlZnRcIixcbiAgICAgICAgICBsaW51eDogXCJjLUFycm93TGVmdFwiLFxuICAgICAgICAgIHJ1bjogY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2soe1xuICAgICAgICAgICAgY2hlY2s6IHRoaXMuY2hlY2ssXG4gICAgICAgICAgICBydW46IHRoaXMucnVuLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgXSksXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG5cbiAgcHJpdmF0ZSBjaGVjayA9ICgpID0+IHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5zZXR0aW5ncy5rZWVwQ3Vyc29yV2l0aGluQ29udGVudCAhPT0gXCJuZXZlclwiICYmXG4gICAgICAhdGhpcy5pbWVEZXRlY3Rvci5pc09wZW5lZCgpXG4gICAgKTtcbiAgfTtcblxuICBwcml2YXRlIHJ1biA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLnBlcmZvcm0oXG4gICAgICAocm9vdCkgPT4gbmV3IE1vdmVDdXJzb3JUb1ByZXZpb3VzVW5mb2xkZWRMaW5lKHJvb3QpLFxuICAgICAgZWRpdG9yLFxuICAgICk7XG4gIH07XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gY21wUG9zKGE6IFBvc2l0aW9uLCBiOiBQb3NpdGlvbikge1xuICByZXR1cm4gYS5saW5lIC0gYi5saW5lIHx8IGEuY2ggLSBiLmNoO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF4UG9zKGE6IFBvc2l0aW9uLCBiOiBQb3NpdGlvbikge1xuICByZXR1cm4gY21wUG9zKGEsIGIpIDwgMCA/IGIgOiBhO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWluUG9zKGE6IFBvc2l0aW9uLCBiOiBQb3NpdGlvbikge1xuICByZXR1cm4gY21wUG9zKGEsIGIpIDwgMCA/IGEgOiBiO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNSYW5nZXNJbnRlcnNlY3RzKFxuICBhOiBbUG9zaXRpb24sIFBvc2l0aW9uXSxcbiAgYjogW1Bvc2l0aW9uLCBQb3NpdGlvbl0sXG4pIHtcbiAgcmV0dXJuIGNtcFBvcyhhWzFdLCBiWzBdKSA+PSAwICYmIGNtcFBvcyhhWzBdLCBiWzFdKSA8PSAwO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyhyb290OiBSb290KSB7XG4gIGZ1bmN0aW9uIHZpc2l0KHBhcmVudDogUm9vdCB8IExpc3QpIHtcbiAgICBsZXQgaW5kZXggPSAxO1xuXG4gICAgZm9yIChjb25zdCBjaGlsZCBvZiBwYXJlbnQuZ2V0Q2hpbGRyZW4oKSkge1xuICAgICAgaWYgKC9cXGQrXFwuLy50ZXN0KGNoaWxkLmdldEJ1bGxldCgpKSkge1xuICAgICAgICBjaGlsZC5yZXBsYXRlQnVsbGV0KGAke2luZGV4Kyt9LmApO1xuICAgICAgfVxuXG4gICAgICB2aXNpdChjaGlsZCk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXQocm9vdCk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUG9zaXRpb24ge1xuICBjaDogbnVtYmVyO1xuICBsaW5lOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGlzdExpbmUge1xuICB0ZXh0OiBzdHJpbmc7XG4gIGZyb206IFBvc2l0aW9uO1xuICB0bzogUG9zaXRpb247XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmFuZ2Uge1xuICBhbmNob3I6IFBvc2l0aW9uO1xuICBoZWFkOiBQb3NpdGlvbjtcbn1cblxubGV0IGlkU2VxID0gMDtcblxuZXhwb3J0IGNsYXNzIExpc3Qge1xuICBwcml2YXRlIGlkOiBudW1iZXI7XG4gIHByaXZhdGUgcGFyZW50OiBMaXN0IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgY2hpbGRyZW46IExpc3RbXSA9IFtdO1xuICBwcml2YXRlIG5vdGVzSW5kZW50OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBsaW5lczogc3RyaW5nW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJvb3Q6IFJvb3QsXG4gICAgcHJpdmF0ZSBpbmRlbnQ6IHN0cmluZyxcbiAgICBwcml2YXRlIGJ1bGxldDogc3RyaW5nLFxuICAgIHByaXZhdGUgb3B0aW9uYWxDaGVja2JveDogc3RyaW5nLFxuICAgIHByaXZhdGUgc3BhY2VBZnRlckJ1bGxldDogc3RyaW5nLFxuICAgIGZpcnN0TGluZTogc3RyaW5nLFxuICAgIHByaXZhdGUgZm9sZFJvb3Q6IGJvb2xlYW4sXG4gICkge1xuICAgIHRoaXMuaWQgPSBpZFNlcSsrO1xuICAgIHRoaXMubGluZXMucHVzaChmaXJzdExpbmUpO1xuICB9XG5cbiAgZ2V0SUQoKSB7XG4gICAgcmV0dXJuIHRoaXMuaWQ7XG4gIH1cblxuICBnZXROb3Rlc0luZGVudCgpOiBzdHJpbmcgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5ub3Rlc0luZGVudDtcbiAgfVxuXG4gIHNldE5vdGVzSW5kZW50KG5vdGVzSW5kZW50OiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5ub3Rlc0luZGVudCAhPT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBOb3RlcyBpbmRlbnQgYWxyZWFkeSBwcm92aWRlZGApO1xuICAgIH1cbiAgICB0aGlzLm5vdGVzSW5kZW50ID0gbm90ZXNJbmRlbnQ7XG4gIH1cblxuICBhZGRMaW5lKHRleHQ6IHN0cmluZykge1xuICAgIGlmICh0aGlzLm5vdGVzSW5kZW50ID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBVbmFibGUgdG8gYWRkIGxpbmUsIG5vdGVzIGluZGVudCBzaG91bGQgYmUgcHJvdmlkZWQgZmlyc3RgLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICB0aGlzLmxpbmVzLnB1c2godGV4dCk7XG4gIH1cblxuICByZXBsYWNlTGluZXMobGluZXM6IHN0cmluZ1tdKSB7XG4gICAgaWYgKGxpbmVzLmxlbmd0aCA+IDEgJiYgdGhpcy5ub3Rlc0luZGVudCA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgVW5hYmxlIHRvIGFkZCBsaW5lLCBub3RlcyBpbmRlbnQgc2hvdWxkIGJlIHByb3ZpZGVkIGZpcnN0YCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgdGhpcy5saW5lcyA9IGxpbmVzO1xuICB9XG5cbiAgZ2V0TGluZUNvdW50KCkge1xuICAgIHJldHVybiB0aGlzLmxpbmVzLmxlbmd0aDtcbiAgfVxuXG4gIGdldFJvb3QoKSB7XG4gICAgcmV0dXJuIHRoaXMucm9vdDtcbiAgfVxuXG4gIGdldENoaWxkcmVuKCkge1xuICAgIHJldHVybiB0aGlzLmNoaWxkcmVuLmNvbmNhdCgpO1xuICB9XG5cbiAgZ2V0TGluZXNJbmZvKCk6IExpc3RMaW5lW10ge1xuICAgIGNvbnN0IHN0YXJ0TGluZSA9IHRoaXMucm9vdC5nZXRDb250ZW50TGluZXNSYW5nZU9mKHRoaXMpWzBdO1xuXG4gICAgcmV0dXJuIHRoaXMubGluZXMubWFwKChyb3csIGkpID0+IHtcbiAgICAgIGNvbnN0IGxpbmUgPSBzdGFydExpbmUgKyBpO1xuICAgICAgY29uc3Qgc3RhcnRDaCA9XG4gICAgICAgIGkgPT09IDAgPyB0aGlzLmdldENvbnRlbnRTdGFydENoKCkgOiB0aGlzLm5vdGVzSW5kZW50Lmxlbmd0aDtcbiAgICAgIGNvbnN0IGVuZENoID0gc3RhcnRDaCArIHJvdy5sZW5ndGg7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRleHQ6IHJvdyxcbiAgICAgICAgZnJvbTogeyBsaW5lLCBjaDogc3RhcnRDaCB9LFxuICAgICAgICB0bzogeyBsaW5lLCBjaDogZW5kQ2ggfSxcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBnZXRMaW5lcygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIHRoaXMubGluZXMuY29uY2F0KCk7XG4gIH1cblxuICBnZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKSB7XG4gICAgY29uc3Qgc3RhcnRMaW5lID0gdGhpcy5yb290LmdldENvbnRlbnRMaW5lc1JhbmdlT2YodGhpcylbMF07XG5cbiAgICByZXR1cm4ge1xuICAgICAgbGluZTogc3RhcnRMaW5lLFxuICAgICAgY2g6IHRoaXMuZ2V0Q29udGVudFN0YXJ0Q2goKSxcbiAgICB9O1xuICB9XG5cbiAgZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0QWZ0ZXJDaGVja2JveCgpIHtcbiAgICBjb25zdCBzdGFydExpbmUgPSB0aGlzLnJvb3QuZ2V0Q29udGVudExpbmVzUmFuZ2VPZih0aGlzKVswXTtcblxuICAgIHJldHVybiB7XG4gICAgICBsaW5lOiBzdGFydExpbmUsXG4gICAgICBjaDogdGhpcy5nZXRDb250ZW50U3RhcnRDaCgpICsgdGhpcy5nZXRDaGVja2JveExlbmd0aCgpLFxuICAgIH07XG4gIH1cblxuICBnZXRMYXN0TGluZUNvbnRlbnRFbmQoKSB7XG4gICAgY29uc3QgZW5kTGluZSA9IHRoaXMucm9vdC5nZXRDb250ZW50TGluZXNSYW5nZU9mKHRoaXMpWzFdO1xuICAgIGNvbnN0IGVuZENoID1cbiAgICAgIHRoaXMubGluZXMubGVuZ3RoID09PSAxXG4gICAgICAgID8gdGhpcy5nZXRDb250ZW50U3RhcnRDaCgpICsgdGhpcy5saW5lc1swXS5sZW5ndGhcbiAgICAgICAgOiB0aGlzLm5vdGVzSW5kZW50Lmxlbmd0aCArIHRoaXMubGluZXNbdGhpcy5saW5lcy5sZW5ndGggLSAxXS5sZW5ndGg7XG5cbiAgICByZXR1cm4ge1xuICAgICAgbGluZTogZW5kTGluZSxcbiAgICAgIGNoOiBlbmRDaCxcbiAgICB9O1xuICB9XG5cbiAgZ2V0Q29udGVudEVuZEluY2x1ZGluZ0NoaWxkcmVuKCkge1xuICAgIHJldHVybiB0aGlzLmdldExhc3RDaGlsZCgpLmdldExhc3RMaW5lQ29udGVudEVuZCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRMYXN0Q2hpbGQoKSB7XG4gICAgbGV0IGxhc3RDaGlsZDogTGlzdCA9IHRoaXM7XG5cbiAgICB3aGlsZSAoIWxhc3RDaGlsZC5pc0VtcHR5KCkpIHtcbiAgICAgIGxhc3RDaGlsZCA9IGxhc3RDaGlsZC5nZXRDaGlsZHJlbigpLmxhc3QoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbGFzdENoaWxkO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRDb250ZW50U3RhcnRDaCgpIHtcbiAgICByZXR1cm4gdGhpcy5pbmRlbnQubGVuZ3RoICsgdGhpcy5idWxsZXQubGVuZ3RoICsgMTtcbiAgfVxuXG4gIGlzRm9sZGVkKCk6IGJvb2xlYW4ge1xuICAgIGlmICh0aGlzLmZvbGRSb290KSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5wYXJlbnQpIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcmVudC5pc0ZvbGRlZCgpO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlzRm9sZFJvb3QoKSB7XG4gICAgcmV0dXJuIHRoaXMuZm9sZFJvb3Q7XG4gIH1cblxuICBnZXRUb3BGb2xkUm9vdCgpIHtcbiAgICBsZXQgdG1wOiBMaXN0ID0gdGhpcztcbiAgICBsZXQgZm9sZFJvb3Q6IExpc3QgfCBudWxsID0gbnVsbDtcbiAgICB3aGlsZSAodG1wKSB7XG4gICAgICBpZiAodG1wLmlzRm9sZFJvb3QoKSkge1xuICAgICAgICBmb2xkUm9vdCA9IHRtcDtcbiAgICAgIH1cbiAgICAgIHRtcCA9IHRtcC5wYXJlbnQ7XG4gICAgfVxuICAgIHJldHVybiBmb2xkUm9vdDtcbiAgfVxuXG4gIGdldExldmVsKCk6IG51bWJlciB7XG4gICAgaWYgKCF0aGlzLnBhcmVudCkge1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucGFyZW50LmdldExldmVsKCkgKyAxO1xuICB9XG5cbiAgdW5pbmRlbnRDb250ZW50KGZyb206IG51bWJlciwgdGlsbDogbnVtYmVyKSB7XG4gICAgdGhpcy5pbmRlbnQgPSB0aGlzLmluZGVudC5zbGljZSgwLCBmcm9tKSArIHRoaXMuaW5kZW50LnNsaWNlKHRpbGwpO1xuICAgIGlmICh0aGlzLm5vdGVzSW5kZW50ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGVzSW5kZW50ID1cbiAgICAgICAgdGhpcy5ub3Rlc0luZGVudC5zbGljZSgwLCBmcm9tKSArIHRoaXMubm90ZXNJbmRlbnQuc2xpY2UodGlsbCk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBjaGlsZCBvZiB0aGlzLmNoaWxkcmVuKSB7XG4gICAgICBjaGlsZC51bmluZGVudENvbnRlbnQoZnJvbSwgdGlsbCk7XG4gICAgfVxuICB9XG5cbiAgaW5kZW50Q29udGVudChpbmRlbnRQb3M6IG51bWJlciwgaW5kZW50Q2hhcnM6IHN0cmluZykge1xuICAgIHRoaXMuaW5kZW50ID1cbiAgICAgIHRoaXMuaW5kZW50LnNsaWNlKDAsIGluZGVudFBvcykgK1xuICAgICAgaW5kZW50Q2hhcnMgK1xuICAgICAgdGhpcy5pbmRlbnQuc2xpY2UoaW5kZW50UG9zKTtcbiAgICBpZiAodGhpcy5ub3Rlc0luZGVudCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5ub3Rlc0luZGVudCA9XG4gICAgICAgIHRoaXMubm90ZXNJbmRlbnQuc2xpY2UoMCwgaW5kZW50UG9zKSArXG4gICAgICAgIGluZGVudENoYXJzICtcbiAgICAgICAgdGhpcy5ub3Rlc0luZGVudC5zbGljZShpbmRlbnRQb3MpO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgY2hpbGQgb2YgdGhpcy5jaGlsZHJlbikge1xuICAgICAgY2hpbGQuaW5kZW50Q29udGVudChpbmRlbnRQb3MsIGluZGVudENoYXJzKTtcbiAgICB9XG4gIH1cblxuICBnZXRGaXJzdExpbmVJbmRlbnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5kZW50O1xuICB9XG5cbiAgZ2V0QnVsbGV0KCkge1xuICAgIHJldHVybiB0aGlzLmJ1bGxldDtcbiAgfVxuXG4gIGdldFNwYWNlQWZ0ZXJCdWxsZXQoKSB7XG4gICAgcmV0dXJuIHRoaXMuc3BhY2VBZnRlckJ1bGxldDtcbiAgfVxuXG4gIGdldENoZWNrYm94TGVuZ3RoKCkge1xuICAgIHJldHVybiB0aGlzLm9wdGlvbmFsQ2hlY2tib3gubGVuZ3RoO1xuICB9XG5cbiAgcmVwbGF0ZUJ1bGxldChidWxsZXQ6IHN0cmluZykge1xuICAgIHRoaXMuYnVsbGV0ID0gYnVsbGV0O1xuICB9XG5cbiAgZ2V0UGFyZW50KCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudDtcbiAgfVxuXG4gIGFkZEJlZm9yZUFsbChsaXN0OiBMaXN0KSB7XG4gICAgdGhpcy5jaGlsZHJlbi51bnNoaWZ0KGxpc3QpO1xuICAgIGxpc3QucGFyZW50ID0gdGhpcztcbiAgfVxuXG4gIGFkZEFmdGVyQWxsKGxpc3Q6IExpc3QpIHtcbiAgICB0aGlzLmNoaWxkcmVuLnB1c2gobGlzdCk7XG4gICAgbGlzdC5wYXJlbnQgPSB0aGlzO1xuICB9XG5cbiAgcmVtb3ZlQ2hpbGQobGlzdDogTGlzdCkge1xuICAgIGNvbnN0IGkgPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YobGlzdCk7XG4gICAgdGhpcy5jaGlsZHJlbi5zcGxpY2UoaSwgMSk7XG4gICAgbGlzdC5wYXJlbnQgPSBudWxsO1xuICB9XG5cbiAgYWRkQmVmb3JlKGJlZm9yZTogTGlzdCwgbGlzdDogTGlzdCkge1xuICAgIGNvbnN0IGkgPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YoYmVmb3JlKTtcbiAgICB0aGlzLmNoaWxkcmVuLnNwbGljZShpLCAwLCBsaXN0KTtcbiAgICBsaXN0LnBhcmVudCA9IHRoaXM7XG4gIH1cblxuICBhZGRBZnRlcihiZWZvcmU6IExpc3QsIGxpc3Q6IExpc3QpIHtcbiAgICBjb25zdCBpID0gdGhpcy5jaGlsZHJlbi5pbmRleE9mKGJlZm9yZSk7XG4gICAgdGhpcy5jaGlsZHJlbi5zcGxpY2UoaSArIDEsIDAsIGxpc3QpO1xuICAgIGxpc3QucGFyZW50ID0gdGhpcztcbiAgfVxuXG4gIGdldFByZXZTaWJsaW5nT2YobGlzdDogTGlzdCkge1xuICAgIGNvbnN0IGkgPSB0aGlzLmNoaWxkcmVuLmluZGV4T2YobGlzdCk7XG4gICAgcmV0dXJuIGkgPiAwID8gdGhpcy5jaGlsZHJlbltpIC0gMV0gOiBudWxsO1xuICB9XG5cbiAgZ2V0TmV4dFNpYmxpbmdPZihsaXN0OiBMaXN0KSB7XG4gICAgY29uc3QgaSA9IHRoaXMuY2hpbGRyZW4uaW5kZXhPZihsaXN0KTtcbiAgICByZXR1cm4gaSA+PSAwICYmIGkgPCB0aGlzLmNoaWxkcmVuLmxlbmd0aCA/IHRoaXMuY2hpbGRyZW5baSArIDFdIDogbnVsbDtcbiAgfVxuXG4gIGlzRW1wdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuY2hpbGRyZW4ubGVuZ3RoID09PSAwO1xuICB9XG5cbiAgcHJpbnQoKSB7XG4gICAgbGV0IHJlcyA9IFwiXCI7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlcyArPVxuICAgICAgICBpID09PSAwXG4gICAgICAgICAgPyB0aGlzLmluZGVudCArIHRoaXMuYnVsbGV0ICsgdGhpcy5zcGFjZUFmdGVyQnVsbGV0XG4gICAgICAgICAgOiB0aGlzLm5vdGVzSW5kZW50O1xuICAgICAgcmVzICs9IHRoaXMubGluZXNbaV07XG4gICAgICByZXMgKz0gXCJcXG5cIjtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIHRoaXMuY2hpbGRyZW4pIHtcbiAgICAgIHJlcyArPSBjaGlsZC5wcmludCgpO1xuICAgIH1cblxuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBjbG9uZShuZXdSb290OiBSb290KSB7XG4gICAgY29uc3QgY2xvbmUgPSBuZXcgTGlzdChcbiAgICAgIG5ld1Jvb3QsXG4gICAgICB0aGlzLmluZGVudCxcbiAgICAgIHRoaXMuYnVsbGV0LFxuICAgICAgdGhpcy5vcHRpb25hbENoZWNrYm94LFxuICAgICAgdGhpcy5zcGFjZUFmdGVyQnVsbGV0LFxuICAgICAgXCJcIixcbiAgICAgIHRoaXMuZm9sZFJvb3QsXG4gICAgKTtcbiAgICBjbG9uZS5pZCA9IHRoaXMuaWQ7XG4gICAgY2xvbmUubGluZXMgPSB0aGlzLmxpbmVzLmNvbmNhdCgpO1xuICAgIGNsb25lLm5vdGVzSW5kZW50ID0gdGhpcy5ub3Rlc0luZGVudDtcbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIHRoaXMuY2hpbGRyZW4pIHtcbiAgICAgIGNsb25lLmFkZEFmdGVyQWxsKGNoaWxkLmNsb25lKG5ld1Jvb3QpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY2xvbmU7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFJvb3Qge1xuICBwcml2YXRlIHJvb3RMaXN0ID0gbmV3IExpc3QodGhpcywgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgXCJcIiwgZmFsc2UpO1xuICBwcml2YXRlIHNlbGVjdGlvbnM6IFJhbmdlW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHN0YXJ0OiBQb3NpdGlvbixcbiAgICBwcml2YXRlIGVuZDogUG9zaXRpb24sXG4gICAgc2VsZWN0aW9uczogUmFuZ2VbXSxcbiAgKSB7XG4gICAgdGhpcy5yZXBsYWNlU2VsZWN0aW9ucyhzZWxlY3Rpb25zKTtcbiAgfVxuXG4gIGdldFJvb3RMaXN0KCkge1xuICAgIHJldHVybiB0aGlzLnJvb3RMaXN0O1xuICB9XG5cbiAgZ2V0Q29udGVudFJhbmdlKCk6IFtQb3NpdGlvbiwgUG9zaXRpb25dIHtcbiAgICByZXR1cm4gW3RoaXMuZ2V0Q29udGVudFN0YXJ0KCksIHRoaXMuZ2V0Q29udGVudEVuZCgpXTtcbiAgfVxuXG4gIGdldENvbnRlbnRTdGFydCgpOiBQb3NpdGlvbiB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5zdGFydCB9O1xuICB9XG5cbiAgZ2V0Q29udGVudEVuZCgpOiBQb3NpdGlvbiB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5lbmQgfTtcbiAgfVxuXG4gIGdldFNlbGVjdGlvbnMoKTogUmFuZ2VbXSB7XG4gICAgcmV0dXJuIHRoaXMuc2VsZWN0aW9ucy5tYXAoKHMpID0+ICh7XG4gICAgICBhbmNob3I6IHsgLi4ucy5hbmNob3IgfSxcbiAgICAgIGhlYWQ6IHsgLi4ucy5oZWFkIH0sXG4gICAgfSkpO1xuICB9XG5cbiAgaGFzU2luZ2xlQ3Vyc29yKCkge1xuICAgIGlmICghdGhpcy5oYXNTaW5nbGVTZWxlY3Rpb24oKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuc2VsZWN0aW9uc1swXTtcblxuICAgIHJldHVybiAoXG4gICAgICBzZWxlY3Rpb24uYW5jaG9yLmxpbmUgPT09IHNlbGVjdGlvbi5oZWFkLmxpbmUgJiZcbiAgICAgIHNlbGVjdGlvbi5hbmNob3IuY2ggPT09IHNlbGVjdGlvbi5oZWFkLmNoXG4gICAgKTtcbiAgfVxuXG4gIGhhc1NpbmdsZVNlbGVjdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zZWxlY3Rpb25zLmxlbmd0aCA9PT0gMTtcbiAgfVxuXG4gIGdldFNlbGVjdGlvbigpIHtcbiAgICBjb25zdCBzZWxlY3Rpb24gPSB0aGlzLnNlbGVjdGlvbnNbdGhpcy5zZWxlY3Rpb25zLmxlbmd0aCAtIDFdO1xuXG4gICAgY29uc3QgZnJvbSA9XG4gICAgICBzZWxlY3Rpb24uYW5jaG9yLmNoID4gc2VsZWN0aW9uLmhlYWQuY2hcbiAgICAgICAgPyBzZWxlY3Rpb24uaGVhZC5jaFxuICAgICAgICA6IHNlbGVjdGlvbi5hbmNob3IuY2g7XG4gICAgY29uc3QgdG8gPVxuICAgICAgc2VsZWN0aW9uLmFuY2hvci5jaCA+IHNlbGVjdGlvbi5oZWFkLmNoXG4gICAgICAgID8gc2VsZWN0aW9uLmFuY2hvci5jaFxuICAgICAgICA6IHNlbGVjdGlvbi5oZWFkLmNoO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLnNlbGVjdGlvbixcbiAgICAgIGZyb20sXG4gICAgICB0byxcbiAgICB9O1xuICB9XG5cbiAgZ2V0Q3Vyc29yKCkge1xuICAgIHJldHVybiB7IC4uLnRoaXMuc2VsZWN0aW9uc1t0aGlzLnNlbGVjdGlvbnMubGVuZ3RoIC0gMV0uaGVhZCB9O1xuICB9XG5cbiAgcmVwbGFjZUN1cnNvcihjdXJzb3I6IFBvc2l0aW9uKSB7XG4gICAgdGhpcy5zZWxlY3Rpb25zID0gW3sgYW5jaG9yOiBjdXJzb3IsIGhlYWQ6IGN1cnNvciB9XTtcbiAgfVxuXG4gIHJlcGxhY2VTZWxlY3Rpb25zKHNlbGVjdGlvbnM6IFJhbmdlW10pIHtcbiAgICBpZiAoc2VsZWN0aW9ucy5sZW5ndGggPCAxKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBjcmVhdGUgUm9vdCB3aXRob3V0IHNlbGVjdGlvbnNgKTtcbiAgICB9XG4gICAgdGhpcy5zZWxlY3Rpb25zID0gc2VsZWN0aW9ucztcbiAgfVxuXG4gIGdldExpc3RVbmRlckN1cnNvcigpOiBMaXN0IHtcbiAgICByZXR1cm4gdGhpcy5nZXRMaXN0VW5kZXJMaW5lKHRoaXMuZ2V0Q3Vyc29yKCkubGluZSk7XG4gIH1cblxuICBnZXRMaXN0VW5kZXJMaW5lKGxpbmU6IG51bWJlcikge1xuICAgIGlmIChsaW5lIDwgdGhpcy5zdGFydC5saW5lIHx8IGxpbmUgPiB0aGlzLmVuZC5saW5lKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IHJlc3VsdDogTGlzdCA9IG51bGw7XG4gICAgbGV0IGluZGV4OiBudW1iZXIgPSB0aGlzLnN0YXJ0LmxpbmU7XG5cbiAgICBjb25zdCB2aXNpdEFyciA9IChsbDogTGlzdFtdKSA9PiB7XG4gICAgICBmb3IgKGNvbnN0IGwgb2YgbGwpIHtcbiAgICAgICAgY29uc3QgbGlzdEZyb21MaW5lID0gaW5kZXg7XG4gICAgICAgIGNvbnN0IGxpc3RUaWxsTGluZSA9IGxpc3RGcm9tTGluZSArIGwuZ2V0TGluZUNvdW50KCkgLSAxO1xuXG4gICAgICAgIGlmIChsaW5lID49IGxpc3RGcm9tTGluZSAmJiBsaW5lIDw9IGxpc3RUaWxsTGluZSkge1xuICAgICAgICAgIHJlc3VsdCA9IGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaW5kZXggPSBsaXN0VGlsbExpbmUgKyAxO1xuICAgICAgICAgIHZpc2l0QXJyKGwuZ2V0Q2hpbGRyZW4oKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc3VsdCAhPT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICB2aXNpdEFycih0aGlzLnJvb3RMaXN0LmdldENoaWxkcmVuKCkpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGdldENvbnRlbnRMaW5lc1JhbmdlT2YobGlzdDogTGlzdCk6IFtudW1iZXIsIG51bWJlcl0gfCBudWxsIHtcbiAgICBsZXQgcmVzdWx0OiBbbnVtYmVyLCBudW1iZXJdIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IGxpbmU6IG51bWJlciA9IHRoaXMuc3RhcnQubGluZTtcblxuICAgIGNvbnN0IHZpc2l0QXJyID0gKGxsOiBMaXN0W10pID0+IHtcbiAgICAgIGZvciAoY29uc3QgbCBvZiBsbCkge1xuICAgICAgICBjb25zdCBsaXN0RnJvbUxpbmUgPSBsaW5lO1xuICAgICAgICBjb25zdCBsaXN0VGlsbExpbmUgPSBsaXN0RnJvbUxpbmUgKyBsLmdldExpbmVDb3VudCgpIC0gMTtcblxuICAgICAgICBpZiAobCA9PT0gbGlzdCkge1xuICAgICAgICAgIHJlc3VsdCA9IFtsaXN0RnJvbUxpbmUsIGxpc3RUaWxsTGluZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGluZSA9IGxpc3RUaWxsTGluZSArIDE7XG4gICAgICAgICAgdmlzaXRBcnIobC5nZXRDaGlsZHJlbigpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQgIT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgdmlzaXRBcnIodGhpcy5yb290TGlzdC5nZXRDaGlsZHJlbigpKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBnZXRDaGlsZHJlbigpIHtcbiAgICByZXR1cm4gdGhpcy5yb290TGlzdC5nZXRDaGlsZHJlbigpO1xuICB9XG5cbiAgcHJpbnQoKSB7XG4gICAgbGV0IHJlcyA9IFwiXCI7XG5cbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIHRoaXMucm9vdExpc3QuZ2V0Q2hpbGRyZW4oKSkge1xuICAgICAgcmVzICs9IGNoaWxkLnByaW50KCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcy5yZXBsYWNlKC9cXG4kLywgXCJcIik7XG4gIH1cblxuICBjbG9uZSgpIHtcbiAgICBjb25zdCBjbG9uZSA9IG5ldyBSb290KFxuICAgICAgeyAuLi50aGlzLnN0YXJ0IH0sXG4gICAgICB7IC4uLnRoaXMuZW5kIH0sXG4gICAgICB0aGlzLmdldFNlbGVjdGlvbnMoKSxcbiAgICApO1xuICAgIGNsb25lLnJvb3RMaXN0ID0gdGhpcy5yb290TGlzdC5jbG9uZShjbG9uZSk7XG4gICAgcmV0dXJuIGNsb25lO1xuICB9XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHtcbiAgTGlzdCxcbiAgTGlzdExpbmUsXG4gIFBvc2l0aW9uLFxuICBSb290LFxuICByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzLFxufSBmcm9tIFwiLi4vcm9vdFwiO1xuXG5leHBvcnQgY2xhc3MgRGVsZXRlVGlsbFByZXZpb3VzTGluZUNvbnRlbnRFbmQgaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIHVwZGF0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBjdXJzb3IgPSByb290LmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGxpbmVzID0gbGlzdC5nZXRMaW5lc0luZm8oKTtcblxuICAgIGNvbnN0IGxpbmVObyA9IGxpbmVzLmZpbmRJbmRleChcbiAgICAgIChsKSA9PiBjdXJzb3IuY2ggPT09IGwuZnJvbS5jaCAmJiBjdXJzb3IubGluZSA9PT0gbC5mcm9tLmxpbmUsXG4gICAgKTtcblxuICAgIGlmIChsaW5lTm8gPT09IDApIHtcbiAgICAgIHRoaXMubWVyZ2VXaXRoUHJldmlvdXNJdGVtKHJvb3QsIGN1cnNvciwgbGlzdCk7XG4gICAgfSBlbHNlIGlmIChsaW5lTm8gPiAwKSB7XG4gICAgICB0aGlzLm1lcmdlTm90ZXMocm9vdCwgY3Vyc29yLCBsaXN0LCBsaW5lcywgbGluZU5vKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG1lcmdlTm90ZXMoXG4gICAgcm9vdDogUm9vdCxcbiAgICBjdXJzb3I6IFBvc2l0aW9uLFxuICAgIGxpc3Q6IExpc3QsXG4gICAgbGluZXM6IExpc3RMaW5lW10sXG4gICAgbGluZU5vOiBudW1iZXIsXG4gICkge1xuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgY29uc3QgcHJldkxpbmVObyA9IGxpbmVObyAtIDE7XG5cbiAgICByb290LnJlcGxhY2VDdXJzb3Ioe1xuICAgICAgbGluZTogY3Vyc29yLmxpbmUgLSAxLFxuICAgICAgY2g6IGxpbmVzW3ByZXZMaW5lTm9dLnRleHQubGVuZ3RoICsgbGluZXNbcHJldkxpbmVOb10uZnJvbS5jaCxcbiAgICB9KTtcblxuICAgIGxpbmVzW3ByZXZMaW5lTm9dLnRleHQgKz0gbGluZXNbbGluZU5vXS50ZXh0O1xuICAgIGxpbmVzLnNwbGljZShsaW5lTm8sIDEpO1xuXG4gICAgbGlzdC5yZXBsYWNlTGluZXMobGluZXMubWFwKChsKSA9PiBsLnRleHQpKTtcbiAgfVxuXG4gIHByaXZhdGUgbWVyZ2VXaXRoUHJldmlvdXNJdGVtKHJvb3Q6IFJvb3QsIGN1cnNvcjogUG9zaXRpb24sIGxpc3Q6IExpc3QpIHtcbiAgICBpZiAocm9vdC5nZXRDaGlsZHJlbigpWzBdID09PSBsaXN0ICYmIGxpc3QuaXNFbXB0eSgpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuXG4gICAgY29uc3QgcHJldiA9IHJvb3QuZ2V0TGlzdFVuZGVyTGluZShjdXJzb3IubGluZSAtIDEpO1xuXG4gICAgaWYgKCFwcmV2KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYm90aEFyZUVtcHR5ID0gcHJldi5pc0VtcHR5KCkgJiYgbGlzdC5pc0VtcHR5KCk7XG4gICAgY29uc3QgcHJldklzRW1wdHlBbmRTYW1lTGV2ZWwgPVxuICAgICAgcHJldi5pc0VtcHR5KCkgJiYgIWxpc3QuaXNFbXB0eSgpICYmIHByZXYuZ2V0TGV2ZWwoKSA9PT0gbGlzdC5nZXRMZXZlbCgpO1xuICAgIGNvbnN0IGxpc3RJc0VtcHR5QW5kUHJldklzUGFyZW50ID1cbiAgICAgIGxpc3QuaXNFbXB0eSgpICYmIHByZXYuZ2V0TGV2ZWwoKSA9PT0gbGlzdC5nZXRMZXZlbCgpIC0gMTtcblxuICAgIGlmIChib3RoQXJlRW1wdHkgfHwgcHJldklzRW1wdHlBbmRTYW1lTGV2ZWwgfHwgbGlzdElzRW1wdHlBbmRQcmV2SXNQYXJlbnQpIHtcbiAgICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG5cbiAgICAgIGNvbnN0IHBhcmVudCA9IGxpc3QuZ2V0UGFyZW50KCk7XG4gICAgICBjb25zdCBwcmV2RW5kID0gcHJldi5nZXRMYXN0TGluZUNvbnRlbnRFbmQoKTtcblxuICAgICAgaWYgKCFwcmV2LmdldE5vdGVzSW5kZW50KCkgJiYgbGlzdC5nZXROb3Rlc0luZGVudCgpKSB7XG4gICAgICAgIHByZXYuc2V0Tm90ZXNJbmRlbnQoXG4gICAgICAgICAgcHJldi5nZXRGaXJzdExpbmVJbmRlbnQoKSArXG4gICAgICAgICAgICBsaXN0LmdldE5vdGVzSW5kZW50KCkuc2xpY2UobGlzdC5nZXRGaXJzdExpbmVJbmRlbnQoKS5sZW5ndGgpLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBvbGRMaW5lcyA9IHByZXYuZ2V0TGluZXMoKTtcbiAgICAgIGNvbnN0IG5ld0xpbmVzID0gbGlzdC5nZXRMaW5lcygpO1xuICAgICAgb2xkTGluZXNbb2xkTGluZXMubGVuZ3RoIC0gMV0gKz0gbmV3TGluZXNbMF07XG4gICAgICBjb25zdCByZXN1bHRMaW5lcyA9IG9sZExpbmVzLmNvbmNhdChuZXdMaW5lcy5zbGljZSgxKSk7XG5cbiAgICAgIHByZXYucmVwbGFjZUxpbmVzKHJlc3VsdExpbmVzKTtcbiAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChsaXN0KTtcblxuICAgICAgZm9yIChjb25zdCBjIG9mIGxpc3QuZ2V0Q2hpbGRyZW4oKSkge1xuICAgICAgICBsaXN0LnJlbW92ZUNoaWxkKGMpO1xuICAgICAgICBwcmV2LmFkZEFmdGVyQWxsKGMpO1xuICAgICAgfVxuXG4gICAgICByb290LnJlcGxhY2VDdXJzb3IocHJldkVuZCk7XG5cbiAgICAgIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMocm9vdCk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsga2V5bWFwIH0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBEZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZCB9IGZyb20gXCIuLi9vcGVyYXRpb25zL0RlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kXCI7XG5pbXBvcnQgeyBJTUVEZXRlY3RvciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9JTUVEZXRlY3RvclwiO1xuaW1wb3J0IHsgT3BlcmF0aW9uUGVyZm9ybWVyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcbmltcG9ydCB7IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrIH0gZnJvbSBcIi4uL3V0aWxzL2NyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrXCI7XG5cbmV4cG9ydCBjbGFzcyBCYWNrc3BhY2VCZWhhdmlvdXJPdmVycmlkZSBpbXBsZW1lbnRzIEZlYXR1cmUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICAgIHByaXZhdGUgaW1lRGV0ZWN0b3I6IElNRURldGVjdG9yLFxuICAgIHByaXZhdGUgb3BlcmF0aW9uUGVyZm9ybWVyOiBPcGVyYXRpb25QZXJmb3JtZXIsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRWRpdG9yRXh0ZW5zaW9uKFxuICAgICAga2V5bWFwLm9mKFtcbiAgICAgICAge1xuICAgICAgICAgIGtleTogXCJCYWNrc3BhY2VcIixcbiAgICAgICAgICBydW46IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKHtcbiAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgcnVuOiB0aGlzLnJ1bixcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIF0pLFxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgY2hlY2sgPSAoKSA9PiB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuc2V0dGluZ3Mua2VlcEN1cnNvcldpdGhpbkNvbnRlbnQgIT09IFwibmV2ZXJcIiAmJlxuICAgICAgIXRoaXMuaW1lRGV0ZWN0b3IuaXNPcGVuZWQoKVxuICAgICk7XG4gIH07XG5cbiAgcHJpdmF0ZSBydW4gPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHJldHVybiB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5wZXJmb3JtKFxuICAgICAgKHJvb3QpID0+IG5ldyBEZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZChyb290KSxcbiAgICAgIGVkaXRvcixcbiAgICApO1xuICB9O1xufVxuIiwiaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgT2JzaWRpYW5TZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PYnNpZGlhblNldHRpbmdzXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1wiO1xuXG5jb25zdCBCRVRURVJfTElTVFNfQk9EWV9DTEFTUyA9IFwib3V0bGluZXItcGx1Z2luLWJldHRlci1saXN0c1wiO1xuXG5leHBvcnQgY2xhc3MgQmV0dGVyTGlzdHNTdHlsZXMgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgcHJpdmF0ZSB1cGRhdGVCb2R5Q2xhc3NJbnRlcnZhbDogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICAgIHByaXZhdGUgb2JzaWRpYW5TZXR0aW5nczogT2JzaWRpYW5TZXR0aW5ncyxcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy51cGRhdGVCb2R5Q2xhc3MoKTtcbiAgICB0aGlzLnVwZGF0ZUJvZHlDbGFzc0ludGVydmFsID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgIHRoaXMudXBkYXRlQm9keUNsYXNzKCk7XG4gICAgfSwgMTAwMCk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7XG4gICAgY2xlYXJJbnRlcnZhbCh0aGlzLnVwZGF0ZUJvZHlDbGFzc0ludGVydmFsKTtcbiAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoQkVUVEVSX0xJU1RTX0JPRFlfQ0xBU1MpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVCb2R5Q2xhc3MgPSAoKSA9PiB7XG4gICAgY29uc3Qgc2hvdWxkRXhpc3RzID1cbiAgICAgIHRoaXMub2JzaWRpYW5TZXR0aW5ncy5pc0RlZmF1bHRUaGVtZUVuYWJsZWQoKSAmJlxuICAgICAgdGhpcy5zZXR0aW5ncy5iZXR0ZXJMaXN0c1N0eWxlcztcbiAgICBjb25zdCBleGlzdHMgPSBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5jb250YWlucyhCRVRURVJfTElTVFNfQk9EWV9DTEFTUyk7XG5cbiAgICBpZiAoc2hvdWxkRXhpc3RzICYmICFleGlzdHMpIHtcbiAgICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZChCRVRURVJfTElTVFNfQk9EWV9DTEFTUyk7XG4gICAgfVxuXG4gICAgaWYgKCFzaG91bGRFeGlzdHMgJiYgZXhpc3RzKSB7XG4gICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoQkVUVEVSX0xJU1RTX0JPRFlfQ0xBU1MpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBSb290LCBtYXhQb3MsIG1pblBvcyB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBTZWxlY3RBbGxDb250ZW50IGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByb290OiBSb290KSB7fVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb247XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgeyByb290IH0gPSB0aGlzO1xuXG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZVNlbGVjdGlvbigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgc2VsZWN0aW9uID0gcm9vdC5nZXRTZWxlY3Rpb25zKClbMF07XG4gICAgY29uc3QgW3Jvb3RTdGFydCwgcm9vdEVuZF0gPSByb290LmdldENvbnRlbnRSYW5nZSgpO1xuXG4gICAgY29uc3Qgc2VsZWN0aW9uRnJvbSA9IG1pblBvcyhzZWxlY3Rpb24uYW5jaG9yLCBzZWxlY3Rpb24uaGVhZCk7XG4gICAgY29uc3Qgc2VsZWN0aW9uVG8gPSBtYXhQb3Moc2VsZWN0aW9uLmFuY2hvciwgc2VsZWN0aW9uLmhlYWQpO1xuXG4gICAgaWYgKFxuICAgICAgc2VsZWN0aW9uRnJvbS5saW5lIDwgcm9vdFN0YXJ0LmxpbmUgfHxcbiAgICAgIHNlbGVjdGlvblRvLmxpbmUgPiByb290RW5kLmxpbmVcbiAgICApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICBzZWxlY3Rpb25Gcm9tLmxpbmUgPT09IHJvb3RTdGFydC5saW5lICYmXG4gICAgICBzZWxlY3Rpb25Gcm9tLmNoID09PSByb290U3RhcnQuY2ggJiZcbiAgICAgIHNlbGVjdGlvblRvLmxpbmUgPT09IHJvb3RFbmQubGluZSAmJlxuICAgICAgc2VsZWN0aW9uVG8uY2ggPT09IHJvb3RFbmQuY2hcbiAgICApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBjb250ZW50U3RhcnQgPSBsaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydEFmdGVyQ2hlY2tib3goKTtcbiAgICBjb25zdCBjb250ZW50RW5kID0gbGlzdC5nZXRMYXN0TGluZUNvbnRlbnRFbmQoKTtcbiAgICBjb25zdCBsaXN0VW5kZXJTZWxlY3Rpb25Gcm9tID0gcm9vdC5nZXRMaXN0VW5kZXJMaW5lKHNlbGVjdGlvbkZyb20ubGluZSk7XG4gICAgY29uc3QgbGlzdFN0YXJ0ID1cbiAgICAgIGxpc3RVbmRlclNlbGVjdGlvbkZyb20uZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0QWZ0ZXJDaGVja2JveCgpO1xuICAgIGNvbnN0IGxpc3RFbmQgPSBsaXN0VW5kZXJTZWxlY3Rpb25Gcm9tLmdldENvbnRlbnRFbmRJbmNsdWRpbmdDaGlsZHJlbigpO1xuXG4gICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG5cbiAgICBpZiAoXG4gICAgICBzZWxlY3Rpb25Gcm9tLmxpbmUgPT09IGNvbnRlbnRTdGFydC5saW5lICYmXG4gICAgICBzZWxlY3Rpb25Gcm9tLmNoID09PSBjb250ZW50U3RhcnQuY2ggJiZcbiAgICAgIHNlbGVjdGlvblRvLmxpbmUgPT09IGNvbnRlbnRFbmQubGluZSAmJlxuICAgICAgc2VsZWN0aW9uVG8uY2ggPT09IGNvbnRlbnRFbmQuY2hcbiAgICApIHtcbiAgICAgIGlmIChsaXN0LmdldENoaWxkcmVuKCkubGVuZ3RoKSB7XG4gICAgICAgIC8vIHNlbGVjdCBzdWIgbGlzdHNcbiAgICAgICAgcm9vdC5yZXBsYWNlU2VsZWN0aW9ucyhbXG4gICAgICAgICAgeyBhbmNob3I6IGNvbnRlbnRTdGFydCwgaGVhZDogbGlzdC5nZXRDb250ZW50RW5kSW5jbHVkaW5nQ2hpbGRyZW4oKSB9LFxuICAgICAgICBdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHNlbGVjdCB3aG9sZSBsaXN0XG4gICAgICAgIHJvb3QucmVwbGFjZVNlbGVjdGlvbnMoW3sgYW5jaG9yOiByb290U3RhcnQsIGhlYWQ6IHJvb3RFbmQgfV0pO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoXG4gICAgICBsaXN0U3RhcnQuY2ggPT0gc2VsZWN0aW9uRnJvbS5jaCAmJlxuICAgICAgbGlzdEVuZC5saW5lID09IHNlbGVjdGlvblRvLmxpbmUgJiZcbiAgICAgIGxpc3RFbmQuY2ggPT0gc2VsZWN0aW9uVG8uY2hcbiAgICApIHtcbiAgICAgIC8vIHNlbGVjdCB3aG9sZSBsaXN0XG4gICAgICByb290LnJlcGxhY2VTZWxlY3Rpb25zKFt7IGFuY2hvcjogcm9vdFN0YXJ0LCBoZWFkOiByb290RW5kIH1dKTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgKHNlbGVjdGlvbkZyb20ubGluZSA+IGNvbnRlbnRTdGFydC5saW5lIHx8XG4gICAgICAgIChzZWxlY3Rpb25Gcm9tLmxpbmUgPT0gY29udGVudFN0YXJ0LmxpbmUgJiZcbiAgICAgICAgICBzZWxlY3Rpb25Gcm9tLmNoID49IGNvbnRlbnRTdGFydC5jaCkpICYmXG4gICAgICAoc2VsZWN0aW9uVG8ubGluZSA8IGNvbnRlbnRFbmQubGluZSB8fFxuICAgICAgICAoc2VsZWN0aW9uVG8ubGluZSA9PSBjb250ZW50RW5kLmxpbmUgJiZcbiAgICAgICAgICBzZWxlY3Rpb25Uby5jaCA8PSBjb250ZW50RW5kLmNoKSlcbiAgICApIHtcbiAgICAgIC8vIHNlbGVjdCB3aG9sZSBsaW5lXG4gICAgICByb290LnJlcGxhY2VTZWxlY3Rpb25zKFt7IGFuY2hvcjogY29udGVudFN0YXJ0LCBoZWFkOiBjb250ZW50RW5kIH1dKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgICAgIHRoaXMudXBkYXRlZCA9IGZhbHNlO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsga2V5bWFwIH0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBTZWxlY3RBbGxDb250ZW50IH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvU2VsZWN0QWxsQ29udGVudFwiO1xuaW1wb3J0IHsgSU1FRGV0ZWN0b3IgfSBmcm9tIFwiLi4vc2VydmljZXMvSU1FRGV0ZWN0b3JcIjtcbmltcG9ydCB7IE9wZXJhdGlvblBlcmZvcm1lciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PcGVyYXRpb25QZXJmb3JtZXJcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzXCI7XG5pbXBvcnQgeyBjcmVhdGVLZXltYXBSdW5DYWxsYmFjayB9IGZyb20gXCIuLi91dGlscy9jcmVhdGVLZXltYXBSdW5DYWxsYmFja1wiO1xuXG5leHBvcnQgY2xhc3MgQ3RybEFBbmRDbWRBQmVoYXZpb3VyT3ZlcnJpZGUgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgICBwcml2YXRlIGltZURldGVjdG9yOiBJTUVEZXRlY3RvcixcbiAgICBwcml2YXRlIG9wZXJhdGlvblBlcmZvcm1lcjogT3BlcmF0aW9uUGVyZm9ybWVyLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihcbiAgICAgIGtleW1hcC5vZihbXG4gICAgICAgIHtcbiAgICAgICAgICBrZXk6IFwiYy1hXCIsXG4gICAgICAgICAgbWFjOiBcIm0tYVwiLFxuICAgICAgICAgIHJ1bjogY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2soe1xuICAgICAgICAgICAgY2hlY2s6IHRoaXMuY2hlY2ssXG4gICAgICAgICAgICBydW46IHRoaXMucnVuLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgXSksXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG5cbiAgcHJpdmF0ZSBjaGVjayA9ICgpID0+IHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5zZXR0aW5ncy5vdmVycmlkZVNlbGVjdEFsbEJlaGF2aW91ciAmJiAhdGhpcy5pbWVEZXRlY3Rvci5pc09wZW5lZCgpXG4gICAgKTtcbiAgfTtcblxuICBwcml2YXRlIHJ1biA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLnBlcmZvcm0oXG4gICAgICAocm9vdCkgPT4gbmV3IFNlbGVjdEFsbENvbnRlbnQocm9vdCksXG4gICAgICBlZGl0b3IsXG4gICAgKTtcbiAgfTtcbn1cbiIsImltcG9ydCB7IERlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kIH0gZnJvbSBcIi4vRGVsZXRlVGlsbFByZXZpb3VzTGluZUNvbnRlbnRFbmRcIjtcbmltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBSb290IH0gZnJvbSBcIi4uL3Jvb3RcIjtcblxuZXhwb3J0IGNsYXNzIERlbGV0ZVRpbGxOZXh0TGluZUNvbnRlbnRTdGFydCBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgZGVsZXRlVGlsbFByZXZpb3VzTGluZUNvbnRlbnRFbmQ6IERlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdDogUm9vdCkge1xuICAgIHRoaXMuZGVsZXRlVGlsbFByZXZpb3VzTGluZUNvbnRlbnRFbmQgPVxuICAgICAgbmV3IERlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kKHJvb3QpO1xuICB9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmRlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kLnNob3VsZFN0b3BQcm9wYWdhdGlvbigpO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLmRlbGV0ZVRpbGxQcmV2aW91c0xpbmVDb250ZW50RW5kLnNob3VsZFVwZGF0ZSgpO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBjdXJzb3IgPSByb290LmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGxpbmVzID0gbGlzdC5nZXRMaW5lc0luZm8oKTtcblxuICAgIGNvbnN0IGxpbmVObyA9IGxpbmVzLmZpbmRJbmRleChcbiAgICAgIChsKSA9PiBjdXJzb3IuY2ggPT09IGwudG8uY2ggJiYgY3Vyc29yLmxpbmUgPT09IGwudG8ubGluZSxcbiAgICApO1xuXG4gICAgaWYgKGxpbmVObyA9PT0gbGluZXMubGVuZ3RoIC0gMSkge1xuICAgICAgY29uc3QgbmV4dExpbmUgPSBsaW5lc1tsaW5lTm9dLnRvLmxpbmUgKyAxO1xuICAgICAgY29uc3QgbmV4dExpc3QgPSByb290LmdldExpc3RVbmRlckxpbmUobmV4dExpbmUpO1xuICAgICAgaWYgKCFuZXh0TGlzdCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByb290LnJlcGxhY2VDdXJzb3IobmV4dExpc3QuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkpO1xuICAgICAgdGhpcy5kZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZC5wZXJmb3JtKCk7XG4gICAgfSBlbHNlIGlmIChsaW5lTm8gPj0gMCkge1xuICAgICAgcm9vdC5yZXBsYWNlQ3Vyc29yKGxpbmVzW2xpbmVObyArIDFdLmZyb20pO1xuICAgICAgdGhpcy5kZWxldGVUaWxsUHJldmlvdXNMaW5lQ29udGVudEVuZC5wZXJmb3JtKCk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsga2V5bWFwIH0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBEZWxldGVUaWxsTmV4dExpbmVDb250ZW50U3RhcnQgfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9EZWxldGVUaWxsTmV4dExpbmVDb250ZW50U3RhcnRcIjtcbmltcG9ydCB7IElNRURldGVjdG9yIH0gZnJvbSBcIi4uL3NlcnZpY2VzL0lNRURldGVjdG9yXCI7XG5pbXBvcnQgeyBPcGVyYXRpb25QZXJmb3JtZXIgfSBmcm9tIFwiLi4vc2VydmljZXMvT3BlcmF0aW9uUGVyZm9ybWVyXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1wiO1xuaW1wb3J0IHsgY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2sgfSBmcm9tIFwiLi4vdXRpbHMvY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2tcIjtcblxuZXhwb3J0IGNsYXNzIERlbGV0ZUJlaGF2aW91ck92ZXJyaWRlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBpbWVEZXRlY3RvcjogSU1FRGV0ZWN0b3IsXG4gICAgcHJpdmF0ZSBvcGVyYXRpb25QZXJmb3JtZXI6IE9wZXJhdGlvblBlcmZvcm1lcixcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oXG4gICAgICBrZXltYXAub2YoW1xuICAgICAgICB7XG4gICAgICAgICAga2V5OiBcIkRlbGV0ZVwiLFxuICAgICAgICAgIHJ1bjogY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2soe1xuICAgICAgICAgICAgY2hlY2s6IHRoaXMuY2hlY2ssXG4gICAgICAgICAgICBydW46IHRoaXMucnVuLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgXSksXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG5cbiAgcHJpdmF0ZSBjaGVjayA9ICgpID0+IHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5zZXR0aW5ncy5rZWVwQ3Vyc29yV2l0aGluQ29udGVudCAhPT0gXCJuZXZlclwiICYmXG4gICAgICAhdGhpcy5pbWVEZXRlY3Rvci5pc09wZW5lZCgpXG4gICAgKTtcbiAgfTtcblxuICBwcml2YXRlIHJ1biA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLnBlcmZvcm0oXG4gICAgICAocm9vdCkgPT4gbmV3IERlbGV0ZVRpbGxOZXh0TGluZUNvbnRlbnRTdGFydChyb290KSxcbiAgICAgIGVkaXRvcixcbiAgICApO1xuICB9O1xufVxuIiwiaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5cbmltcG9ydCB7IExpc3QsIFJvb3QsIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMgfSBmcm9tIFwiLi4vcm9vdFwiO1xuXG5pbnRlcmZhY2UgQ3Vyc29yQW5jaG9yIHtcbiAgY3Vyc29yTGlzdDogTGlzdDtcbiAgbGluZURpZmY6IG51bWJlcjtcbiAgY2hEaWZmOiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBNb3ZlTGlzdFRvRGlmZmVyZW50UG9zaXRpb24gaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIHVwZGF0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJvb3Q6IFJvb3QsXG4gICAgcHJpdmF0ZSBsaXN0VG9Nb3ZlOiBMaXN0LFxuICAgIHByaXZhdGUgcGxhY2VUb01vdmU6IExpc3QsXG4gICAgcHJpdmF0ZSB3aGVyZVRvTW92ZTogXCJiZWZvcmVcIiB8IFwiYWZ0ZXJcIiB8IFwiaW5zaWRlXCIsXG4gICAgcHJpdmF0ZSBkZWZhdWx0SW5kZW50Q2hhcnM6IHN0cmluZyxcbiAgKSB7fVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb247XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgaWYgKHRoaXMubGlzdFRvTW92ZSA9PT0gdGhpcy5wbGFjZVRvTW92ZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgY29uc3QgY3Vyc29yQW5jaG9yID0gdGhpcy5jYWxjdWxhdGVDdXJzb3JBbmNob3IoKTtcbiAgICB0aGlzLm1vdmVMaXN0KCk7XG4gICAgdGhpcy5jaGFuZ2VJbmRlbnQoKTtcbiAgICB0aGlzLnJlc3RvcmVDdXJzb3IoY3Vyc29yQW5jaG9yKTtcbiAgICByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzKHRoaXMucm9vdCk7XG4gIH1cblxuICBwcml2YXRlIGNhbGN1bGF0ZUN1cnNvckFuY2hvcigpOiBDdXJzb3JBbmNob3Ige1xuICAgIGNvbnN0IGN1cnNvckxpbmUgPSB0aGlzLnJvb3QuZ2V0Q3Vyc29yKCkubGluZTtcblxuICAgIGNvbnN0IGxpbmVzID0gW1xuICAgICAgdGhpcy5saXN0VG9Nb3ZlLmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUsXG4gICAgICB0aGlzLmxpc3RUb01vdmUuZ2V0TGFzdExpbmVDb250ZW50RW5kKCkubGluZSxcbiAgICAgIHRoaXMucGxhY2VUb01vdmUuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZSxcbiAgICAgIHRoaXMucGxhY2VUb01vdmUuZ2V0TGFzdExpbmVDb250ZW50RW5kKCkubGluZSxcbiAgICBdO1xuICAgIGNvbnN0IGxpc3RTdGFydExpbmUgPSBNYXRoLm1pbiguLi5saW5lcyk7XG4gICAgY29uc3QgbGlzdEVuZExpbmUgPSBNYXRoLm1heCguLi5saW5lcyk7XG5cbiAgICBpZiAoY3Vyc29yTGluZSA8IGxpc3RTdGFydExpbmUgfHwgY3Vyc29yTGluZSA+IGxpc3RFbmRMaW5lKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBjdXJzb3IgPSB0aGlzLnJvb3QuZ2V0Q3Vyc29yKCk7XG4gICAgY29uc3QgY3Vyc29yTGlzdCA9IHRoaXMucm9vdC5nZXRMaXN0VW5kZXJMaW5lKGN1cnNvci5saW5lKTtcbiAgICBjb25zdCBjdXJzb3JMaXN0U3RhcnQgPSBjdXJzb3JMaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpO1xuICAgIGNvbnN0IGxpbmVEaWZmID0gY3Vyc29yLmxpbmUgLSBjdXJzb3JMaXN0U3RhcnQubGluZTtcbiAgICBjb25zdCBjaERpZmYgPSBjdXJzb3IuY2ggLSBjdXJzb3JMaXN0U3RhcnQuY2g7XG5cbiAgICByZXR1cm4geyBjdXJzb3JMaXN0LCBsaW5lRGlmZiwgY2hEaWZmIH07XG4gIH1cblxuICBwcml2YXRlIG1vdmVMaXN0KCkge1xuICAgIHRoaXMubGlzdFRvTW92ZS5nZXRQYXJlbnQoKS5yZW1vdmVDaGlsZCh0aGlzLmxpc3RUb01vdmUpO1xuXG4gICAgc3dpdGNoICh0aGlzLndoZXJlVG9Nb3ZlKSB7XG4gICAgICBjYXNlIFwiYmVmb3JlXCI6XG4gICAgICAgIHRoaXMucGxhY2VUb01vdmVcbiAgICAgICAgICAuZ2V0UGFyZW50KClcbiAgICAgICAgICAuYWRkQmVmb3JlKHRoaXMucGxhY2VUb01vdmUsIHRoaXMubGlzdFRvTW92ZSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIFwiYWZ0ZXJcIjpcbiAgICAgICAgdGhpcy5wbGFjZVRvTW92ZVxuICAgICAgICAgIC5nZXRQYXJlbnQoKVxuICAgICAgICAgIC5hZGRBZnRlcih0aGlzLnBsYWNlVG9Nb3ZlLCB0aGlzLmxpc3RUb01vdmUpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBcImluc2lkZVwiOlxuICAgICAgICB0aGlzLnBsYWNlVG9Nb3ZlLmFkZEJlZm9yZUFsbCh0aGlzLmxpc3RUb01vdmUpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNoYW5nZUluZGVudCgpIHtcbiAgICBjb25zdCBvbGRJbmRlbnQgPSB0aGlzLmxpc3RUb01vdmUuZ2V0Rmlyc3RMaW5lSW5kZW50KCk7XG4gICAgY29uc3QgbmV3SW5kZW50ID1cbiAgICAgIHRoaXMud2hlcmVUb01vdmUgPT09IFwiaW5zaWRlXCJcbiAgICAgICAgPyB0aGlzLnBsYWNlVG9Nb3ZlLmdldEZpcnN0TGluZUluZGVudCgpICsgdGhpcy5kZWZhdWx0SW5kZW50Q2hhcnNcbiAgICAgICAgOiB0aGlzLnBsYWNlVG9Nb3ZlLmdldEZpcnN0TGluZUluZGVudCgpO1xuICAgIHRoaXMubGlzdFRvTW92ZS51bmluZGVudENvbnRlbnQoMCwgb2xkSW5kZW50Lmxlbmd0aCk7XG4gICAgdGhpcy5saXN0VG9Nb3ZlLmluZGVudENvbnRlbnQoMCwgbmV3SW5kZW50KTtcbiAgfVxuXG4gIHByaXZhdGUgcmVzdG9yZUN1cnNvcihjdXJzb3JBbmNob3I6IEN1cnNvckFuY2hvcikge1xuICAgIGlmIChjdXJzb3JBbmNob3IpIHtcbiAgICAgIGNvbnN0IGN1cnNvckxpc3RTdGFydCA9XG4gICAgICAgIGN1cnNvckFuY2hvci5jdXJzb3JMaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpO1xuXG4gICAgICB0aGlzLnJvb3QucmVwbGFjZUN1cnNvcih7XG4gICAgICAgIGxpbmU6IGN1cnNvckxpc3RTdGFydC5saW5lICsgY3Vyc29yQW5jaG9yLmxpbmVEaWZmLFxuICAgICAgICBjaDogY3Vyc29yTGlzdFN0YXJ0LmNoICsgY3Vyc29yQW5jaG9yLmNoRGlmZixcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBXaGVuIHlvdSBtb3ZlIGEgbGlzdCwgdGhlIHNjcmVlbiBzY3JvbGxzIHRvIHRoZSBjdXJzb3IuXG4gICAgICAvLyBJdCBpcyBiZXR0ZXIgdG8gbW92ZSB0aGUgY3Vyc29yIGludG8gdGhlIHZpZXdwb3J0IHRoYW4gbGV0IHRoZSBzY3JlZW4gc2Nyb2xsLlxuICAgICAgdGhpcy5yb290LnJlcGxhY2VDdXJzb3IodGhpcy5saXN0VG9Nb3ZlLmdldExhc3RMaW5lQ29udGVudEVuZCgpKTtcbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCB7IE5vdGljZSwgUGxhdGZvcm0sIFBsdWdpbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBnZXRJbmRlbnRVbml0LCBpbmRlbnRTdHJpbmcgfSBmcm9tIFwiQGNvZGVtaXJyb3IvbGFuZ3VhZ2VcIjtcbmltcG9ydCB7IFN0YXRlRWZmZWN0LCBTdGF0ZUZpZWxkIH0gZnJvbSBcIkBjb2RlbWlycm9yL3N0YXRlXCI7XG5pbXBvcnQgeyBEZWNvcmF0aW9uLCBEZWNvcmF0aW9uU2V0LCBFZGl0b3JWaWV3IH0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IsIGdldEVkaXRvckZyb21TdGF0ZSB9IGZyb20gXCIuLi9lZGl0b3JcIjtcbmltcG9ydCB7IE1vdmVMaXN0VG9EaWZmZXJlbnRQb3NpdGlvbiB9IGZyb20gXCIuLi9vcGVyYXRpb25zL01vdmVMaXN0VG9EaWZmZXJlbnRQb3NpdGlvblwiO1xuaW1wb3J0IHsgTGlzdCwgUm9vdCwgY21wUG9zIH0gZnJvbSBcIi4uL3Jvb3RcIjtcbmltcG9ydCB7IE9ic2lkaWFuU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvT2JzaWRpYW5TZXR0aW5nc1wiO1xuaW1wb3J0IHsgT3BlcmF0aW9uUGVyZm9ybWVyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lclwiO1xuaW1wb3J0IHsgUGFyc2VyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1BhcnNlclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcblxuY29uc3QgQk9EWV9DTEFTUyA9IFwib3V0bGluZXItcGx1Z2luLWRuZFwiO1xuXG5leHBvcnQgY2xhc3MgRHJhZ0FuZERyb3AgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgcHJpdmF0ZSBkcm9wWm9uZTogSFRNTERpdkVsZW1lbnQ7XG4gIHByaXZhdGUgZHJvcFpvbmVQYWRkaW5nOiBIVE1MRGl2RWxlbWVudDtcbiAgcHJpdmF0ZSBwcmVTdGFydDogRHJhZ0FuZERyb3BQcmVTdGFydFN0YXRlIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgc3RhdGU6IERyYWdBbmREcm9wU3RhdGUgfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICAgIHByaXZhdGUgb2Jpc2lkaWFuOiBPYnNpZGlhblNldHRpbmdzLFxuICAgIHByaXZhdGUgcGFyc2VyOiBQYXJzZXIsXG4gICAgcHJpdmF0ZSBvcGVyYXRpb25QZXJmb3JtZXI6IE9wZXJhdGlvblBlcmZvcm1lcixcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oW1xuICAgICAgZHJhZ2dpbmdMaW5lc1N0YXRlRmllbGQsXG4gICAgICBkcm9wcGluZ0xpbmVzU3RhdGVGaWVsZCxcbiAgICBdKTtcbiAgICB0aGlzLmVuYWJsZUZlYXR1cmVUb2dnbGUoKTtcbiAgICB0aGlzLmNyZWF0ZURyb3Bab25lKCk7XG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVycygpO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge1xuICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lcnMoKTtcbiAgICB0aGlzLnJlbW92ZURyb3Bab25lKCk7XG4gICAgdGhpcy5kaXNhYmxlRmVhdHVyZVRvZ2dsZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBlbmFibGVGZWF0dXJlVG9nZ2xlKCkge1xuICAgIHRoaXMuc2V0dGluZ3Mub25DaGFuZ2UodGhpcy5oYW5kbGVTZXR0aW5nc0NoYW5nZSk7XG4gICAgdGhpcy5oYW5kbGVTZXR0aW5nc0NoYW5nZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBkaXNhYmxlRmVhdHVyZVRvZ2dsZSgpIHtcbiAgICB0aGlzLnNldHRpbmdzLnJlbW92ZUNhbGxiYWNrKHRoaXMuaGFuZGxlU2V0dGluZ3NDaGFuZ2UpO1xuICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LnJlbW92ZShCT0RZX0NMQVNTKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlRHJvcFpvbmUoKSB7XG4gICAgdGhpcy5kcm9wWm9uZVBhZGRpbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHRoaXMuZHJvcFpvbmVQYWRkaW5nLmNsYXNzTGlzdC5hZGQoXCJvdXRsaW5lci1wbHVnaW4tZHJvcC16b25lLXBhZGRpbmdcIik7XG4gICAgdGhpcy5kcm9wWm9uZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgdGhpcy5kcm9wWm9uZS5jbGFzc0xpc3QuYWRkKFwib3V0bGluZXItcGx1Z2luLWRyb3Atem9uZVwiKTtcbiAgICB0aGlzLmRyb3Bab25lLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICB0aGlzLmRyb3Bab25lLmFwcGVuZENoaWxkKHRoaXMuZHJvcFpvbmVQYWRkaW5nKTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMuZHJvcFpvbmUpO1xuICB9XG5cbiAgcHJpdmF0ZSByZW1vdmVEcm9wWm9uZSgpIHtcbiAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKHRoaXMuZHJvcFpvbmUpO1xuICAgIHRoaXMuZHJvcFpvbmVQYWRkaW5nID0gbnVsbDtcbiAgICB0aGlzLmRyb3Bab25lID0gbnVsbDtcbiAgfVxuXG4gIHByaXZhdGUgYWRkRXZlbnRMaXN0ZW5lcnMoKSB7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCB0aGlzLmhhbmRsZU1vdXNlRG93biwge1xuICAgICAgY2FwdHVyZTogdHJ1ZSxcbiAgICB9KTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsIHRoaXMuaGFuZGxlTW91c2VNb3ZlKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLCB0aGlzLmhhbmRsZU1vdXNlVXApO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIHRoaXMuaGFuZGxlS2V5RG93bik7XG4gIH1cblxuICBwcml2YXRlIHJlbW92ZUV2ZW50TGlzdGVuZXJzKCkge1xuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgdGhpcy5oYW5kbGVNb3VzZURvd24sIHtcbiAgICAgIGNhcHR1cmU6IHRydWUsXG4gICAgfSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCB0aGlzLmhhbmRsZU1vdXNlTW92ZSk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNldXBcIiwgdGhpcy5oYW5kbGVNb3VzZVVwKTtcbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCB0aGlzLmhhbmRsZUtleURvd24pO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVTZXR0aW5nc0NoYW5nZSA9ICgpID0+IHtcbiAgICBpZiAoIWlzRmVhdHVyZVN1cHBvcnRlZCgpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc2V0dGluZ3MuZHJhZ0FuZERyb3ApIHtcbiAgICAgIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZChCT0RZX0NMQVNTKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKEJPRFlfQ0xBU1MpO1xuICAgIH1cbiAgfTtcblxuICBwcml2YXRlIGhhbmRsZU1vdXNlRG93biA9IChlOiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgaWYgKFxuICAgICAgIWlzRmVhdHVyZVN1cHBvcnRlZCgpIHx8XG4gICAgICAhdGhpcy5zZXR0aW5ncy5kcmFnQW5kRHJvcCB8fFxuICAgICAgIWlzQ2xpY2tPbkJ1bGxldChlKVxuICAgICkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHZpZXcgPSBnZXRFZGl0b3JWaWV3RnJvbUhUTUxFbGVtZW50KGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KTtcbiAgICBpZiAoIXZpZXcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcblxuICAgIHRoaXMucHJlU3RhcnQgPSB7XG4gICAgICB4OiBlLngsXG4gICAgICB5OiBlLnksXG4gICAgICB2aWV3LFxuICAgIH07XG4gIH07XG5cbiAgcHJpdmF0ZSBoYW5kbGVNb3VzZU1vdmUgPSAoZTogTW91c2VFdmVudCkgPT4ge1xuICAgIGlmICh0aGlzLnByZVN0YXJ0KSB7XG4gICAgICB0aGlzLnN0YXJ0RHJhZ2dpbmcoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuc3RhdGUpIHtcbiAgICAgIHRoaXMuZGV0ZWN0QW5kRHJhd0Ryb3Bab25lKGUueCwgZS55KTtcbiAgICB9XG4gIH07XG5cbiAgcHJpdmF0ZSBoYW5kbGVNb3VzZVVwID0gKCkgPT4ge1xuICAgIGlmICh0aGlzLnByZVN0YXJ0KSB7XG4gICAgICB0aGlzLnByZVN0YXJ0ID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMuc3RhdGUpIHtcbiAgICAgIHRoaXMuc3RvcERyYWdnaW5nKCk7XG4gICAgfVxuICB9O1xuXG4gIHByaXZhdGUgaGFuZGxlS2V5RG93biA9IChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG4gICAgaWYgKHRoaXMuc3RhdGUgJiYgZS5jb2RlID09PSBcIkVzY2FwZVwiKSB7XG4gICAgICB0aGlzLmNhbmNlbERyYWdnaW5nKCk7XG4gICAgfVxuICB9O1xuXG4gIHByaXZhdGUgc3RhcnREcmFnZ2luZygpIHtcbiAgICBjb25zdCB7IHgsIHksIHZpZXcgfSA9IHRoaXMucHJlU3RhcnQ7XG4gICAgdGhpcy5wcmVTdGFydCA9IG51bGw7XG5cbiAgICBjb25zdCBlZGl0b3IgPSBnZXRFZGl0b3JGcm9tU3RhdGUodmlldy5zdGF0ZSk7XG4gICAgY29uc3QgcG9zID0gZWRpdG9yLm9mZnNldFRvUG9zKHZpZXcucG9zQXRDb29yZHMoeyB4LCB5IH0pKTtcbiAgICBjb25zdCByb290ID0gdGhpcy5wYXJzZXIucGFyc2UoZWRpdG9yLCBwb3MpO1xuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckxpbmUocG9zLmxpbmUpO1xuICAgIGNvbnN0IHN0YXRlID0gbmV3IERyYWdBbmREcm9wU3RhdGUodmlldywgZWRpdG9yLCByb290LCBsaXN0KTtcblxuICAgIGlmICghc3RhdGUuaGFzRHJvcFZhcmlhbnRzKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnN0YXRlID0gc3RhdGU7XG4gICAgdGhpcy5oaWdobGlnaHREcmFnZ2luZ0xpbmVzKCk7XG4gIH1cblxuICBwcml2YXRlIGRldGVjdEFuZERyYXdEcm9wWm9uZSh4OiBudW1iZXIsIHk6IG51bWJlcikge1xuICAgIHRoaXMuc3RhdGUuY2FsY3VsYXRlTmVhcmVzdERyb3BWYXJpYW50KHgsIHkpO1xuICAgIHRoaXMuZHJhd0Ryb3Bab25lKCk7XG4gIH1cblxuICBwcml2YXRlIGNhbmNlbERyYWdnaW5nKCkge1xuICAgIHRoaXMuc3RhdGUuZHJvcFZhcmlhbnQgPSBudWxsO1xuICAgIHRoaXMuc3RvcERyYWdnaW5nKCk7XG4gIH1cblxuICBwcml2YXRlIHN0b3BEcmFnZ2luZygpIHtcbiAgICB0aGlzLnVuaGlnaHRsaWdodERyYWdnaW5nTGluZXMoKTtcbiAgICB0aGlzLmhpZGVEcm9wWm9uZSgpO1xuICAgIHRoaXMuYXBwbHlDaGFuZ2VzKCk7XG4gICAgdGhpcy5zdGF0ZSA9IG51bGw7XG4gIH1cblxuICBwcml2YXRlIGFwcGx5Q2hhbmdlcygpIHtcbiAgICBpZiAoIXRoaXMuc3RhdGUuZHJvcFZhcmlhbnQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB7IHN0YXRlIH0gPSB0aGlzO1xuICAgIGNvbnN0IHsgZHJvcFZhcmlhbnQsIGVkaXRvciwgcm9vdCwgbGlzdCB9ID0gc3RhdGU7XG5cbiAgICBjb25zdCBuZXdSb290ID0gdGhpcy5wYXJzZXIucGFyc2UoZWRpdG9yLCByb290LmdldENvbnRlbnRTdGFydCgpKTtcbiAgICBpZiAoIWlzU2FtZVJvb3RzKHJvb3QsIG5ld1Jvb3QpKSB7XG4gICAgICBuZXcgTm90aWNlKFxuICAgICAgICBgVGhlIGl0ZW0gY2Fubm90IGJlIG1vdmVkLiBUaGUgcGFnZSBjb250ZW50IGNoYW5nZWQgZHVyaW5nIHRoZSBtb3ZlLmAsXG4gICAgICAgIDUwMDAsXG4gICAgICApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLmV2YWwoXG4gICAgICByb290LFxuICAgICAgbmV3IE1vdmVMaXN0VG9EaWZmZXJlbnRQb3NpdGlvbihcbiAgICAgICAgcm9vdCxcbiAgICAgICAgbGlzdCxcbiAgICAgICAgZHJvcFZhcmlhbnQucGxhY2VUb01vdmUsXG4gICAgICAgIGRyb3BWYXJpYW50LndoZXJlVG9Nb3ZlLFxuICAgICAgICB0aGlzLm9iaXNpZGlhbi5nZXREZWZhdWx0SW5kZW50Q2hhcnMoKSxcbiAgICAgICksXG4gICAgICBlZGl0b3IsXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgaGlnaGxpZ2h0RHJhZ2dpbmdMaW5lcygpIHtcbiAgICBjb25zdCB7IHN0YXRlIH0gPSB0aGlzO1xuICAgIGNvbnN0IHsgbGlzdCwgZWRpdG9yLCB2aWV3IH0gPSBzdGF0ZTtcblxuICAgIGNvbnN0IGxpbmVzID0gW107XG4gICAgY29uc3QgZnJvbUxpbmUgPSBsaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmU7XG4gICAgY29uc3QgdGlsbExpbmUgPSBsaXN0LmdldENvbnRlbnRFbmRJbmNsdWRpbmdDaGlsZHJlbigpLmxpbmU7XG4gICAgZm9yIChsZXQgaSA9IGZyb21MaW5lOyBpIDw9IHRpbGxMaW5lOyBpKyspIHtcbiAgICAgIGxpbmVzLnB1c2goZWRpdG9yLnBvc1RvT2Zmc2V0KHsgbGluZTogaSwgY2g6IDAgfSkpO1xuICAgIH1cbiAgICB2aWV3LmRpc3BhdGNoKHtcbiAgICAgIGVmZmVjdHM6IFtkbmRTdGFydGVkLm9mKGxpbmVzKV0sXG4gICAgfSk7XG5cbiAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5hZGQoXCJvdXRsaW5lci1wbHVnaW4tZHJhZ2dpbmdcIik7XG4gIH1cblxuICBwcml2YXRlIHVuaGlnaHRsaWdodERyYWdnaW5nTGluZXMoKSB7XG4gICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKFwib3V0bGluZXItcGx1Z2luLWRyYWdnaW5nXCIpO1xuXG4gICAgdGhpcy5zdGF0ZS52aWV3LmRpc3BhdGNoKHtcbiAgICAgIGVmZmVjdHM6IFtkbmRFbmRlZC5vZigpXSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZHJhd0Ryb3Bab25lKCkge1xuICAgIGNvbnN0IHsgc3RhdGUgfSA9IHRoaXM7XG4gICAgY29uc3QgeyB2aWV3LCBlZGl0b3IsIGRyb3BWYXJpYW50IH0gPSBzdGF0ZTtcblxuICAgIGNvbnN0IG5ld1BhcmVudCA9XG4gICAgICBkcm9wVmFyaWFudC53aGVyZVRvTW92ZSA9PT0gXCJpbnNpZGVcIlxuICAgICAgICA/IGRyb3BWYXJpYW50LnBsYWNlVG9Nb3ZlXG4gICAgICAgIDogZHJvcFZhcmlhbnQucGxhY2VUb01vdmUuZ2V0UGFyZW50KCk7XG4gICAgY29uc3QgbmV3UGFyZW50SXNSb290TGlzdCA9ICFuZXdQYXJlbnQuZ2V0UGFyZW50KCk7XG5cbiAgICB7XG4gICAgICBjb25zdCB3aWR0aCA9IE1hdGgucm91bmQoXG4gICAgICAgIHZpZXcuY29udGVudERPTS5vZmZzZXRXaWR0aCAtXG4gICAgICAgICAgKGRyb3BWYXJpYW50LmxlZnQgLSB0aGlzLnN0YXRlLmxlZnRQYWRkaW5nKSxcbiAgICAgICk7XG5cbiAgICAgIHRoaXMuZHJvcFpvbmUuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICAgIHRoaXMuZHJvcFpvbmUuc3R5bGUudG9wID0gZHJvcFZhcmlhbnQudG9wICsgXCJweFwiO1xuICAgICAgdGhpcy5kcm9wWm9uZS5zdHlsZS5sZWZ0ID0gZHJvcFZhcmlhbnQubGVmdCArIFwicHhcIjtcbiAgICAgIHRoaXMuZHJvcFpvbmUuc3R5bGUud2lkdGggPSB3aWR0aCArIFwicHhcIjtcbiAgICB9XG5cbiAgICB7XG4gICAgICBjb25zdCBsZXZlbCA9IG5ld1BhcmVudC5nZXRMZXZlbCgpO1xuICAgICAgY29uc3QgaW5kZW50V2lkdGggPSB0aGlzLnN0YXRlLnRhYldpZHRoO1xuICAgICAgY29uc3Qgd2lkdGggPSBpbmRlbnRXaWR0aCAqIGxldmVsO1xuICAgICAgY29uc3QgZGFzaFBhZGRpbmcgPSAzO1xuICAgICAgY29uc3QgZGFzaFdpZHRoID0gaW5kZW50V2lkdGggLSBkYXNoUGFkZGluZztcbiAgICAgIGNvbnN0IGNvbG9yID0gZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5KS5nZXRQcm9wZXJ0eVZhbHVlKFxuICAgICAgICBcIi0tY29sb3ItYWNjZW50XCIsXG4gICAgICApO1xuXG4gICAgICB0aGlzLmRyb3Bab25lUGFkZGluZy5zdHlsZS53aWR0aCA9IGAke3dpZHRofXB4YDtcbiAgICAgIHRoaXMuZHJvcFpvbmVQYWRkaW5nLnN0eWxlLm1hcmdpbkxlZnQgPSBgLSR7d2lkdGh9cHhgO1xuICAgICAgdGhpcy5kcm9wWm9uZVBhZGRpbmcuc3R5bGUuYmFja2dyb3VuZEltYWdlID0gYHVybCgnZGF0YTppbWFnZS9zdmcreG1sLCUzQ3N2ZyUyMHZpZXdCb3glM0QlMjIwJTIwMCUyMCR7d2lkdGh9JTIwNCUyMiUyMHhtbG5zJTNEJTIyaHR0cCUzQSUyRiUyRnd3dy53My5vcmclMkYyMDAwJTJGc3ZnJTIyJTNFJTNDbGluZSUyMHgxJTNEJTIyMCUyMiUyMHkxJTNEJTIyMCUyMiUyMHgyJTNEJTIyJHt3aWR0aH0lMjIlMjB5MiUzRCUyMjAlMjIlMjBzdHJva2UlM0QlMjIke2NvbG9yfSUyMiUyMHN0cm9rZS13aWR0aCUzRCUyMjglMjIlMjBzdHJva2UtZGFzaGFycmF5JTNEJTIyJHtkYXNoV2lkdGh9JTIwJHtkYXNoUGFkZGluZ30lMjIlMkYlM0UlM0MlMkZzdmclM0UnKWA7XG4gICAgfVxuXG4gICAgdGhpcy5zdGF0ZS52aWV3LmRpc3BhdGNoKHtcbiAgICAgIGVmZmVjdHM6IFtcbiAgICAgICAgZG5kTW92ZWQub2YoXG4gICAgICAgICAgbmV3UGFyZW50SXNSb290TGlzdFxuICAgICAgICAgICAgPyBudWxsXG4gICAgICAgICAgICA6IGVkaXRvci5wb3NUb09mZnNldCh7XG4gICAgICAgICAgICAgICAgbGluZTogbmV3UGFyZW50LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUsXG4gICAgICAgICAgICAgICAgY2g6IDAsXG4gICAgICAgICAgICAgIH0pLFxuICAgICAgICApLFxuICAgICAgXSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgaGlkZURyb3Bab25lKCkge1xuICAgIHRoaXMuZHJvcFpvbmUuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuICB9XG59XG5cbmludGVyZmFjZSBEcm9wVmFyaWFudCB7XG4gIGxpbmU6IG51bWJlcjtcbiAgbGV2ZWw6IG51bWJlcjtcbiAgbGVmdDogbnVtYmVyO1xuICB0b3A6IG51bWJlcjtcbiAgcGxhY2VUb01vdmU6IExpc3Q7XG4gIHdoZXJlVG9Nb3ZlOiBcImFmdGVyXCIgfCBcImJlZm9yZVwiIHwgXCJpbnNpZGVcIjtcbn1cblxuaW50ZXJmYWNlIERyYWdBbmREcm9wUHJlU3RhcnRTdGF0ZSB7XG4gIHg6IG51bWJlcjtcbiAgeTogbnVtYmVyO1xuICB2aWV3OiBFZGl0b3JWaWV3O1xufVxuXG5jbGFzcyBEcmFnQW5kRHJvcFN0YXRlIHtcbiAgcHJpdmF0ZSBkcm9wVmFyaWFudHM6IE1hcDxzdHJpbmcsIERyb3BWYXJpYW50PiA9IG5ldyBNYXAoKTtcbiAgcHVibGljIGRyb3BWYXJpYW50OiBEcm9wVmFyaWFudCA9IG51bGw7XG4gIHB1YmxpYyBsZWZ0UGFkZGluZyA9IDA7XG4gIHB1YmxpYyB0YWJXaWR0aCA9IDA7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIHJlYWRvbmx5IHZpZXc6IEVkaXRvclZpZXcsXG4gICAgcHVibGljIHJlYWRvbmx5IGVkaXRvcjogTXlFZGl0b3IsXG4gICAgcHVibGljIHJlYWRvbmx5IHJvb3Q6IFJvb3QsXG4gICAgcHVibGljIHJlYWRvbmx5IGxpc3Q6IExpc3QsXG4gICkge1xuICAgIHRoaXMuY29sbGVjdERyb3BWYXJpYW50cygpO1xuICAgIHRoaXMuY2FsY3VsYXRlTGVmdFBhZGRpbmcoKTtcbiAgICB0aGlzLmNhbGN1bGF0ZVRhYldpZHRoKCk7XG4gIH1cblxuICBnZXREcm9wVmFyaWFudHMoKSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5kcm9wVmFyaWFudHMudmFsdWVzKCkpO1xuICB9XG5cbiAgaGFzRHJvcFZhcmlhbnRzKCkge1xuICAgIHJldHVybiB0aGlzLmRyb3BWYXJpYW50cy5zaXplID4gMDtcbiAgfVxuXG4gIGNhbGN1bGF0ZU5lYXJlc3REcm9wVmFyaWFudCh4OiBudW1iZXIsIHk6IG51bWJlcikge1xuICAgIGNvbnN0IHsgdmlldywgZWRpdG9yIH0gPSB0aGlzO1xuXG4gICAgY29uc3QgZHJvcFZhcmlhbnRzID0gdGhpcy5nZXREcm9wVmFyaWFudHMoKTtcblxuICAgIGZvciAoY29uc3QgdiBvZiBkcm9wVmFyaWFudHMpIHtcbiAgICAgIGNvbnN0IHsgcGxhY2VUb01vdmUgfSA9IHY7XG5cbiAgICAgIHYubGVmdCA9IHRoaXMubGVmdFBhZGRpbmcgKyAodi5sZXZlbCAtIDEpICogdGhpcy50YWJXaWR0aDtcblxuICAgICAgY29uc3QgcG9zaXRpb25BZnRlckxpc3QgPVxuICAgICAgICB2LndoZXJlVG9Nb3ZlID09PSBcImFmdGVyXCIgfHwgdi53aGVyZVRvTW92ZSA9PT0gXCJpbnNpZGVcIjtcbiAgICAgIGNvbnN0IGxpbmUgPSBwb3NpdGlvbkFmdGVyTGlzdFxuICAgICAgICA/IHBsYWNlVG9Nb3ZlLmdldENvbnRlbnRFbmRJbmNsdWRpbmdDaGlsZHJlbigpLmxpbmVcbiAgICAgICAgOiBwbGFjZVRvTW92ZS5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKS5saW5lO1xuICAgICAgY29uc3QgbGluZVBvcyA9IGVkaXRvci5wb3NUb09mZnNldCh7XG4gICAgICAgIGxpbmUsXG4gICAgICAgIGNoOiAwLFxuICAgICAgfSk7XG5cbiAgICAgIHYudG9wID0gdmlldy5jb29yZHNBdFBvcyhsaW5lUG9zLCAtMSkudG9wO1xuXG4gICAgICBpZiAocG9zaXRpb25BZnRlckxpc3QpIHtcbiAgICAgICAgdi50b3AgKz0gdmlldy5saW5lQmxvY2tBdChsaW5lUG9zKS5oZWlnaHQ7XG4gICAgICB9XG5cbiAgICAgIC8vIEJldHRlciB2ZXJ0aWNhbCBhbGlnbm1lbnRcbiAgICAgIHYudG9wIC09IDg7XG4gICAgfVxuXG4gICAgY29uc3QgbmVhcmVzdExpbmVUb3AgPSBkcm9wVmFyaWFudHNcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBNYXRoLmFicyh5IC0gYS50b3ApIC0gTWF0aC5hYnMoeSAtIGIudG9wKSlcbiAgICAgIC5maXJzdCgpLnRvcDtcblxuICAgIGNvbnN0IHZhcmlhbnNPbk5lYXJlc3RMaW5lID0gZHJvcFZhcmlhbnRzLmZpbHRlcihcbiAgICAgICh2KSA9PiBNYXRoLmFicyh2LnRvcCAtIG5lYXJlc3RMaW5lVG9wKSA8PSA0LFxuICAgICk7XG5cbiAgICB0aGlzLmRyb3BWYXJpYW50ID0gdmFyaWFuc09uTmVhcmVzdExpbmVcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBNYXRoLmFicyh4IC0gYS5sZWZ0KSAtIE1hdGguYWJzKHggLSBiLmxlZnQpKVxuICAgICAgLmZpcnN0KCk7XG4gIH1cblxuICBwcml2YXRlIGFkZERyb3BWYXJpYW50KHY6IERyb3BWYXJpYW50KSB7XG4gICAgdGhpcy5kcm9wVmFyaWFudHMuc2V0KGAke3YubGluZX0gJHt2LmxldmVsfWAsIHYpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb2xsZWN0RHJvcFZhcmlhbnRzKCkge1xuICAgIGNvbnN0IHZpc2l0ID0gKGxpc3RzOiBMaXN0W10pID0+IHtcbiAgICAgIGZvciAoY29uc3QgcGxhY2VUb01vdmUgb2YgbGlzdHMpIHtcbiAgICAgICAgY29uc3QgbGluZUJlZm9yZSA9IHBsYWNlVG9Nb3ZlLmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmU7XG4gICAgICAgIGNvbnN0IGxpbmVBZnRlciA9IHBsYWNlVG9Nb3ZlLmdldENvbnRlbnRFbmRJbmNsdWRpbmdDaGlsZHJlbigpLmxpbmUgKyAxO1xuXG4gICAgICAgIGNvbnN0IGxldmVsID0gcGxhY2VUb01vdmUuZ2V0TGV2ZWwoKTtcblxuICAgICAgICB0aGlzLmFkZERyb3BWYXJpYW50KHtcbiAgICAgICAgICBsaW5lOiBsaW5lQmVmb3JlLFxuICAgICAgICAgIGxldmVsLFxuICAgICAgICAgIGxlZnQ6IDAsXG4gICAgICAgICAgdG9wOiAwLFxuICAgICAgICAgIHBsYWNlVG9Nb3ZlLFxuICAgICAgICAgIHdoZXJlVG9Nb3ZlOiBcImJlZm9yZVwiLFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5hZGREcm9wVmFyaWFudCh7XG4gICAgICAgICAgbGluZTogbGluZUFmdGVyLFxuICAgICAgICAgIGxldmVsLFxuICAgICAgICAgIGxlZnQ6IDAsXG4gICAgICAgICAgdG9wOiAwLFxuICAgICAgICAgIHBsYWNlVG9Nb3ZlLFxuICAgICAgICAgIHdoZXJlVG9Nb3ZlOiBcImFmdGVyXCIsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChwbGFjZVRvTW92ZSA9PT0gdGhpcy5saXN0KSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocGxhY2VUb01vdmUuaXNFbXB0eSgpKSB7XG4gICAgICAgICAgdGhpcy5hZGREcm9wVmFyaWFudCh7XG4gICAgICAgICAgICBsaW5lOiBsaW5lQWZ0ZXIsXG4gICAgICAgICAgICBsZXZlbDogbGV2ZWwgKyAxLFxuICAgICAgICAgICAgbGVmdDogMCxcbiAgICAgICAgICAgIHRvcDogMCxcbiAgICAgICAgICAgIHBsYWNlVG9Nb3ZlLFxuICAgICAgICAgICAgd2hlcmVUb01vdmU6IFwiaW5zaWRlXCIsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmlzaXQocGxhY2VUb01vdmUuZ2V0Q2hpbGRyZW4oKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgdmlzaXQodGhpcy5yb290LmdldENoaWxkcmVuKCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBjYWxjdWxhdGVMZWZ0UGFkZGluZygpIHtcbiAgICB0aGlzLmxlZnRQYWRkaW5nID0gdGhpcy52aWV3LmNvb3Jkc0F0UG9zKDAsIC0xKS5sZWZ0O1xuICB9XG5cbiAgcHJpdmF0ZSBjYWxjdWxhdGVUYWJXaWR0aCgpIHtcbiAgICBjb25zdCB7IHZpZXcgfSA9IHRoaXM7XG5cbiAgICBjb25zdCBzaW5nbGVJbmRlbnQgPSBpbmRlbnRTdHJpbmcodmlldy5zdGF0ZSwgZ2V0SW5kZW50VW5pdCh2aWV3LnN0YXRlKSk7XG5cbiAgICBmb3IgKGxldCBpID0gMTsgaSA8PSB2aWV3LnN0YXRlLmRvYy5saW5lczsgaSsrKSB7XG4gICAgICBjb25zdCBsaW5lID0gdmlldy5zdGF0ZS5kb2MubGluZShpKTtcblxuICAgICAgaWYgKGxpbmUudGV4dC5zdGFydHNXaXRoKHNpbmdsZUluZGVudCkpIHtcbiAgICAgICAgY29uc3QgYSA9IHZpZXcuY29vcmRzQXRQb3MobGluZS5mcm9tLCAtMSk7XG4gICAgICAgIGNvbnN0IGIgPSB2aWV3LmNvb3Jkc0F0UG9zKGxpbmUuZnJvbSArIHNpbmdsZUluZGVudC5sZW5ndGgsIC0xKTtcbiAgICAgICAgdGhpcy50YWJXaWR0aCA9IGIubGVmdCAtIGEubGVmdDtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMudGFiV2lkdGggPSB2aWV3LmRlZmF1bHRDaGFyYWN0ZXJXaWR0aCAqIGdldEluZGVudFVuaXQodmlldy5zdGF0ZSk7XG4gIH1cbn1cblxuY29uc3QgZG5kU3RhcnRlZCA9IFN0YXRlRWZmZWN0LmRlZmluZTxudW1iZXJbXT4oe1xuICBtYXA6IChsaW5lcywgY2hhbmdlKSA9PiBsaW5lcy5tYXAoKGwpID0+IGNoYW5nZS5tYXBQb3MobCkpLFxufSk7XG5cbmNvbnN0IGRuZE1vdmVkID0gU3RhdGVFZmZlY3QuZGVmaW5lPG51bWJlciB8IG51bGw+KHtcbiAgbWFwOiAobGluZSwgY2hhbmdlKSA9PiAobGluZSAhPT0gbnVsbCA/IGNoYW5nZS5tYXBQb3MobGluZSkgOiBsaW5lKSxcbn0pO1xuXG5jb25zdCBkbmRFbmRlZCA9IFN0YXRlRWZmZWN0LmRlZmluZTx2b2lkPigpO1xuXG5jb25zdCBkcmFnZ2luZ0xpbmVEZWNvcmF0aW9uID0gRGVjb3JhdGlvbi5saW5lKHtcbiAgY2xhc3M6IFwib3V0bGluZXItcGx1Z2luLWRyYWdnaW5nLWxpbmVcIixcbn0pO1xuXG5jb25zdCBkcm9wcGluZ0xpbmVEZWNvcmF0aW9uID0gRGVjb3JhdGlvbi5saW5lKHtcbiAgY2xhc3M6IFwib3V0bGluZXItcGx1Z2luLWRyb3BwaW5nLWxpbmVcIixcbn0pO1xuXG5jb25zdCBkcmFnZ2luZ0xpbmVzU3RhdGVGaWVsZCA9IFN0YXRlRmllbGQuZGVmaW5lPERlY29yYXRpb25TZXQ+KHtcbiAgY3JlYXRlOiAoKSA9PiBEZWNvcmF0aW9uLm5vbmUsXG5cbiAgdXBkYXRlOiAoZG5kU3RhdGUsIHRyKSA9PiB7XG4gICAgZG5kU3RhdGUgPSBkbmRTdGF0ZS5tYXAodHIuY2hhbmdlcyk7XG5cbiAgICBmb3IgKGNvbnN0IGUgb2YgdHIuZWZmZWN0cykge1xuICAgICAgaWYgKGUuaXMoZG5kU3RhcnRlZCkpIHtcbiAgICAgICAgZG5kU3RhdGUgPSBkbmRTdGF0ZS51cGRhdGUoe1xuICAgICAgICAgIGFkZDogZS52YWx1ZS5tYXAoKGwpID0+IGRyYWdnaW5nTGluZURlY29yYXRpb24ucmFuZ2UobCwgbCkpLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgaWYgKGUuaXMoZG5kRW5kZWQpKSB7XG4gICAgICAgIGRuZFN0YXRlID0gRGVjb3JhdGlvbi5ub25lO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBkbmRTdGF0ZTtcbiAgfSxcblxuICBwcm92aWRlOiAoZikgPT4gRWRpdG9yVmlldy5kZWNvcmF0aW9ucy5mcm9tKGYpLFxufSk7XG5cbmNvbnN0IGRyb3BwaW5nTGluZXNTdGF0ZUZpZWxkID0gU3RhdGVGaWVsZC5kZWZpbmU8RGVjb3JhdGlvblNldD4oe1xuICBjcmVhdGU6ICgpID0+IERlY29yYXRpb24ubm9uZSxcblxuICB1cGRhdGU6IChkbmREcm9wcGluZ1N0YXRlLCB0cikgPT4ge1xuICAgIGRuZERyb3BwaW5nU3RhdGUgPSBkbmREcm9wcGluZ1N0YXRlLm1hcCh0ci5jaGFuZ2VzKTtcblxuICAgIGZvciAoY29uc3QgZSBvZiB0ci5lZmZlY3RzKSB7XG4gICAgICBpZiAoZS5pcyhkbmRNb3ZlZCkpIHtcbiAgICAgICAgZG5kRHJvcHBpbmdTdGF0ZSA9XG4gICAgICAgICAgZS52YWx1ZSA9PT0gbnVsbFxuICAgICAgICAgICAgPyBEZWNvcmF0aW9uLm5vbmVcbiAgICAgICAgICAgIDogRGVjb3JhdGlvbi5zZXQoZHJvcHBpbmdMaW5lRGVjb3JhdGlvbi5yYW5nZShlLnZhbHVlLCBlLnZhbHVlKSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChlLmlzKGRuZEVuZGVkKSkge1xuICAgICAgICBkbmREcm9wcGluZ1N0YXRlID0gRGVjb3JhdGlvbi5ub25lO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBkbmREcm9wcGluZ1N0YXRlO1xuICB9LFxuXG4gIHByb3ZpZGU6IChmKSA9PiBFZGl0b3JWaWV3LmRlY29yYXRpb25zLmZyb20oZiksXG59KTtcblxuZnVuY3Rpb24gZ2V0RWRpdG9yVmlld0Zyb21IVE1MRWxlbWVudChlOiBIVE1MRWxlbWVudCkge1xuICB3aGlsZSAoZSAmJiAhZS5jbGFzc0xpc3QuY29udGFpbnMoXCJjbS1lZGl0b3JcIikpIHtcbiAgICBlID0gZS5wYXJlbnRFbGVtZW50O1xuICB9XG5cbiAgaWYgKCFlKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gRWRpdG9yVmlldy5maW5kRnJvbURPTShlKTtcbn1cblxuZnVuY3Rpb24gaXNDbGlja09uQnVsbGV0KGU6IE1vdXNlRXZlbnQpIHtcbiAgbGV0IGVsID0gZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgd2hpbGUgKGVsKSB7XG4gICAgaWYgKFxuICAgICAgZWwuY2xhc3NMaXN0LmNvbnRhaW5zKFwiY20tZm9ybWF0dGluZy1saXN0XCIpIHx8XG4gICAgICBlbC5jbGFzc0xpc3QuY29udGFpbnMoXCJjbS1mb2xkLWluZGljYXRvclwiKSB8fFxuICAgICAgZWwuY2xhc3NMaXN0LmNvbnRhaW5zKFwidGFzay1saXN0LWl0ZW0tY2hlY2tib3hcIilcbiAgICApIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGVsID0gZWwucGFyZW50RWxlbWVudDtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gaXNTYW1lUm9vdHMoYTogUm9vdCwgYjogUm9vdCkge1xuICBjb25zdCBbYVN0YXJ0LCBhRW5kXSA9IGEuZ2V0Q29udGVudFJhbmdlKCk7XG4gIGNvbnN0IFtiU3RhcnQsIGJFbmRdID0gYi5nZXRDb250ZW50UmFuZ2UoKTtcblxuICBpZiAoY21wUG9zKGFTdGFydCwgYlN0YXJ0KSAhPT0gMCB8fCBjbXBQb3MoYUVuZCwgYkVuZCkgIT09IDApIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gYS5wcmludCgpID09PSBiLnByaW50KCk7XG59XG5cbmZ1bmN0aW9uIGlzRmVhdHVyZVN1cHBvcnRlZCgpIHtcbiAgcmV0dXJuIFBsYXRmb3JtLmlzRGVza3RvcDtcbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBSb290IH0gZnJvbSBcIi4uL3Jvb3RcIjtcblxuZXhwb3J0IGNsYXNzIEtlZXBDdXJzb3JPdXRzaWRlRm9sZGVkTGluZXMgaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIHVwZGF0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjdXJzb3IgPSByb290LmdldEN1cnNvcigpO1xuXG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgaWYgKCFsaXN0LmlzRm9sZGVkKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBmb2xkUm9vdCA9IGxpc3QuZ2V0VG9wRm9sZFJvb3QoKTtcbiAgICBjb25zdCBmaXJzdExpbmVFbmQgPSBmb2xkUm9vdC5nZXRMaW5lc0luZm8oKVswXS50bztcblxuICAgIGlmIChjdXJzb3IubGluZSA+IGZpcnN0TGluZUVuZC5saW5lKSB7XG4gICAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuICAgICAgcm9vdC5yZXBsYWNlQ3Vyc29yKGZpcnN0TGluZUVuZCk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgUm9vdCB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBLZWVwQ3Vyc29yV2l0aGluTGlzdENvbnRlbnQgaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIHVwZGF0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjdXJzb3IgPSByb290LmdldEN1cnNvcigpO1xuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGNvbnN0IGNvbnRlbnRTdGFydCA9IGxpc3QuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0QWZ0ZXJDaGVja2JveCgpO1xuICAgIGNvbnN0IGxpbmVQcmVmaXggPVxuICAgICAgY29udGVudFN0YXJ0LmxpbmUgPT09IGN1cnNvci5saW5lXG4gICAgICAgID8gY29udGVudFN0YXJ0LmNoXG4gICAgICAgIDogbGlzdC5nZXROb3Rlc0luZGVudCgpLmxlbmd0aDtcblxuICAgIGlmIChjdXJzb3IuY2ggPCBsaW5lUHJlZml4KSB7XG4gICAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuICAgICAgcm9vdC5yZXBsYWNlQ3Vyc29yKHtcbiAgICAgICAgbGluZTogY3Vyc29yLmxpbmUsXG4gICAgICAgIGNoOiBsaW5lUHJlZml4LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgRWRpdG9yU3RhdGUsIFRyYW5zYWN0aW9uIH0gZnJvbSBcIkBjb2RlbWlycm9yL3N0YXRlXCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yLCBnZXRFZGl0b3JGcm9tU3RhdGUgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBLZWVwQ3Vyc29yT3V0c2lkZUZvbGRlZExpbmVzIH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvS2VlcEN1cnNvck91dHNpZGVGb2xkZWRMaW5lc1wiO1xuaW1wb3J0IHsgS2VlcEN1cnNvcldpdGhpbkxpc3RDb250ZW50IH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvS2VlcEN1cnNvcldpdGhpbkxpc3RDb250ZW50XCI7XG5pbXBvcnQgeyBPcGVyYXRpb25QZXJmb3JtZXIgfSBmcm9tIFwiLi4vc2VydmljZXMvT3BlcmF0aW9uUGVyZm9ybWVyXCI7XG5pbXBvcnQgeyBQYXJzZXIgfSBmcm9tIFwiLi4vc2VydmljZXMvUGFyc2VyXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1wiO1xuXG5leHBvcnQgY2xhc3MgRWRpdG9yU2VsZWN0aW9uc0JlaGF2aW91ck92ZXJyaWRlIGltcGxlbWVudHMgRmVhdHVyZSB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBwYXJzZXI6IFBhcnNlcixcbiAgICBwcml2YXRlIG9wZXJhdGlvblBlcmZvcm1lcjogT3BlcmF0aW9uUGVyZm9ybWVyLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihcbiAgICAgIEVkaXRvclN0YXRlLnRyYW5zYWN0aW9uRXh0ZW5kZXIub2YodGhpcy50cmFuc2FjdGlvbkV4dGVuZGVyKSxcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge31cblxuICBwcml2YXRlIHRyYW5zYWN0aW9uRXh0ZW5kZXIgPSAodHI6IFRyYW5zYWN0aW9uKTogbnVsbCA9PiB7XG4gICAgaWYgKHRoaXMuc2V0dGluZ3Mua2VlcEN1cnNvcldpdGhpbkNvbnRlbnQgPT09IFwibmV2ZXJcIiB8fCAhdHIuc2VsZWN0aW9uKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBlZGl0b3IgPSBnZXRFZGl0b3JGcm9tU3RhdGUodHIuc3RhcnRTdGF0ZSk7XG5cbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuaGFuZGxlU2VsZWN0aW9uc0NoYW5nZXMoZWRpdG9yKTtcbiAgICB9LCAwKTtcblxuICAgIHJldHVybiBudWxsO1xuICB9O1xuXG4gIHByaXZhdGUgaGFuZGxlU2VsZWN0aW9uc0NoYW5nZXMgPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIGNvbnN0IHJvb3QgPSB0aGlzLnBhcnNlci5wYXJzZShlZGl0b3IpO1xuXG4gICAgaWYgKCFyb290KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAge1xuICAgICAgY29uc3QgeyBzaG91bGRTdG9wUHJvcGFnYXRpb24gfSA9IHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLmV2YWwoXG4gICAgICAgIHJvb3QsXG4gICAgICAgIG5ldyBLZWVwQ3Vyc29yT3V0c2lkZUZvbGRlZExpbmVzKHJvb3QpLFxuICAgICAgICBlZGl0b3IsXG4gICAgICApO1xuXG4gICAgICBpZiAoc2hvdWxkU3RvcFByb3BhZ2F0aW9uKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5ldmFsKFxuICAgICAgcm9vdCxcbiAgICAgIG5ldyBLZWVwQ3Vyc29yV2l0aGluTGlzdENvbnRlbnQocm9vdCksXG4gICAgICBlZGl0b3IsXG4gICAgKTtcbiAgfTtcbn1cbiIsImV4cG9ydCBjb25zdCBjaGVja2JveFJlID0gYFxcXFxbW15cXFxcW1xcXFxdXVxcXFxdWyBcXHRdYDtcbiIsImV4cG9ydCBmdW5jdGlvbiBpc0VtcHR5TGluZU9yRW1wdHlDaGVja2JveChsaW5lOiBzdHJpbmcpIHtcbiAgcmV0dXJuIGxpbmUgPT09IFwiXCIgfHwgbGluZSA9PT0gXCJbIF0gXCI7XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgTGlzdCwgUG9zaXRpb24sIFJvb3QsIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMgfSBmcm9tIFwiLi4vcm9vdFwiO1xuaW1wb3J0IHsgY2hlY2tib3hSZSB9IGZyb20gXCIuLi91dGlscy9jaGVja2JveFJlXCI7XG5pbXBvcnQgeyBpc0VtcHR5TGluZU9yRW1wdHlDaGVja2JveCB9IGZyb20gXCIuLi91dGlscy9pc0VtcHR5TGluZU9yRW1wdHlDaGVja2JveFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIEdldFpvb21SYW5nZSB7XG4gIGdldFpvb21SYW5nZSgpOiB7IGZyb206IFBvc2l0aW9uOyB0bzogUG9zaXRpb24gfSB8IG51bGw7XG59XG5cbmV4cG9ydCBjbGFzcyBDcmVhdGVOZXdJdGVtIGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByb290OiBSb290LFxuICAgIHByaXZhdGUgZGVmYXVsdEluZGVudENoYXJzOiBzdHJpbmcsXG4gICAgcHJpdmF0ZSBnZXRab29tUmFuZ2U6IEdldFpvb21SYW5nZSxcbiAgKSB7fVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb247XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgeyByb290IH0gPSB0aGlzO1xuXG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZVNlbGVjdGlvbigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgc2VsZWN0aW9uID0gcm9vdC5nZXRTZWxlY3Rpb24oKTtcbiAgICBpZiAoIXNlbGVjdGlvbiB8fCBzZWxlY3Rpb24uYW5jaG9yLmxpbmUgIT09IHNlbGVjdGlvbi5oZWFkLmxpbmUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBsaW5lcyA9IGxpc3QuZ2V0TGluZXNJbmZvKCk7XG5cbiAgICBpZiAobGluZXMubGVuZ3RoID09PSAxICYmIGlzRW1wdHlMaW5lT3JFbXB0eUNoZWNrYm94KGxpbmVzWzBdLnRleHQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcbiAgICBjb25zdCBsaW5lVW5kZXJDdXJzb3IgPSBsaW5lcy5maW5kKChsKSA9PiBsLmZyb20ubGluZSA9PT0gY3Vyc29yLmxpbmUpO1xuXG4gICAgaWYgKGN1cnNvci5jaCA8IGxpbmVVbmRlckN1cnNvci5mcm9tLmNoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgeyBvbGRMaW5lcywgbmV3TGluZXMgfSA9IGxpbmVzLnJlZHVjZShcbiAgICAgIChhY2MsIGxpbmUpID0+IHtcbiAgICAgICAgaWYgKGN1cnNvci5saW5lID4gbGluZS5mcm9tLmxpbmUpIHtcbiAgICAgICAgICBhY2Mub2xkTGluZXMucHVzaChsaW5lLnRleHQpO1xuICAgICAgICB9IGVsc2UgaWYgKGN1cnNvci5saW5lID09PSBsaW5lLmZyb20ubGluZSkge1xuICAgICAgICAgIGNvbnN0IGxlZnQgPSBsaW5lLnRleHQuc2xpY2UoMCwgc2VsZWN0aW9uLmZyb20gLSBsaW5lLmZyb20uY2gpO1xuICAgICAgICAgIGNvbnN0IHJpZ2h0ID0gbGluZS50ZXh0LnNsaWNlKHNlbGVjdGlvbi50byAtIGxpbmUuZnJvbS5jaCk7XG4gICAgICAgICAgYWNjLm9sZExpbmVzLnB1c2gobGVmdCk7XG4gICAgICAgICAgYWNjLm5ld0xpbmVzLnB1c2gocmlnaHQpO1xuICAgICAgICB9IGVsc2UgaWYgKGN1cnNvci5saW5lIDwgbGluZS5mcm9tLmxpbmUpIHtcbiAgICAgICAgICBhY2MubmV3TGluZXMucHVzaChsaW5lLnRleHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG9sZExpbmVzOiBbXSxcbiAgICAgICAgbmV3TGluZXM6IFtdLFxuICAgICAgfSxcbiAgICApO1xuXG4gICAgY29uc3QgY29kZUJsb2NrQmFjdGlja3MgPSBvbGRMaW5lcy5qb2luKFwiXFxuXCIpLnNwbGl0KFwiYGBgXCIpLmxlbmd0aCAtIDE7XG4gICAgY29uc3QgaXNJbnNpZGVDb2RlYmxvY2sgPVxuICAgICAgY29kZUJsb2NrQmFjdGlja3MgPiAwICYmIGNvZGVCbG9ja0JhY3RpY2tzICUgMiAhPT0gMDtcblxuICAgIGlmIChpc0luc2lkZUNvZGVibG9jaykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgY29uc3Qgem9vbVJhbmdlID0gdGhpcy5nZXRab29tUmFuZ2UuZ2V0Wm9vbVJhbmdlKCk7XG4gICAgY29uc3QgbGlzdElzWm9vbWluZ1Jvb3QgPSBCb29sZWFuKFxuICAgICAgem9vbVJhbmdlICYmXG4gICAgICAgIGxpc3QuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZSA+PSB6b29tUmFuZ2UuZnJvbS5saW5lICYmXG4gICAgICAgIGxpc3QuZ2V0TGFzdExpbmVDb250ZW50RW5kKCkubGluZSA8PSB6b29tUmFuZ2UuZnJvbS5saW5lLFxuICAgICk7XG5cbiAgICBjb25zdCBoYXNDaGlsZHJlbiA9ICFsaXN0LmlzRW1wdHkoKTtcbiAgICBjb25zdCBjaGlsZElzRm9sZGVkID0gbGlzdC5pc0ZvbGRSb290KCk7XG4gICAgY29uc3QgZW5kUG9zID0gbGlzdC5nZXRMYXN0TGluZUNvbnRlbnRFbmQoKTtcbiAgICBjb25zdCBlbmRPZkxpbmUgPSBjdXJzb3IubGluZSA9PT0gZW5kUG9zLmxpbmUgJiYgY3Vyc29yLmNoID09PSBlbmRQb3MuY2g7XG5cbiAgICBjb25zdCBvbkNoaWxkTGV2ZWwgPVxuICAgICAgbGlzdElzWm9vbWluZ1Jvb3QgfHwgKGhhc0NoaWxkcmVuICYmICFjaGlsZElzRm9sZGVkICYmIGVuZE9mTGluZSk7XG5cbiAgICBjb25zdCBpbmRlbnQgPSBvbkNoaWxkTGV2ZWxcbiAgICAgID8gaGFzQ2hpbGRyZW5cbiAgICAgICAgPyBsaXN0LmdldENoaWxkcmVuKClbMF0uZ2V0Rmlyc3RMaW5lSW5kZW50KClcbiAgICAgICAgOiBsaXN0LmdldEZpcnN0TGluZUluZGVudCgpICsgdGhpcy5kZWZhdWx0SW5kZW50Q2hhcnNcbiAgICAgIDogbGlzdC5nZXRGaXJzdExpbmVJbmRlbnQoKTtcblxuICAgIGNvbnN0IGJ1bGxldCA9XG4gICAgICBvbkNoaWxkTGV2ZWwgJiYgaGFzQ2hpbGRyZW5cbiAgICAgICAgPyBsaXN0LmdldENoaWxkcmVuKClbMF0uZ2V0QnVsbGV0KClcbiAgICAgICAgOiBsaXN0LmdldEJ1bGxldCgpO1xuXG4gICAgY29uc3Qgc3BhY2VBZnRlckJ1bGxldCA9XG4gICAgICBvbkNoaWxkTGV2ZWwgJiYgaGFzQ2hpbGRyZW5cbiAgICAgICAgPyBsaXN0LmdldENoaWxkcmVuKClbMF0uZ2V0U3BhY2VBZnRlckJ1bGxldCgpXG4gICAgICAgIDogbGlzdC5nZXRTcGFjZUFmdGVyQnVsbGV0KCk7XG5cbiAgICBjb25zdCBwcmVmaXggPSBvbGRMaW5lc1swXS5tYXRjaChjaGVja2JveFJlKSA/IFwiWyBdIFwiIDogXCJcIjtcblxuICAgIGNvbnN0IG5ld0xpc3QgPSBuZXcgTGlzdChcbiAgICAgIGxpc3QuZ2V0Um9vdCgpLFxuICAgICAgaW5kZW50LFxuICAgICAgYnVsbGV0LFxuICAgICAgcHJlZml4LFxuICAgICAgc3BhY2VBZnRlckJ1bGxldCxcbiAgICAgIHByZWZpeCArIG5ld0xpbmVzLnNoaWZ0KCksXG4gICAgICBmYWxzZSxcbiAgICApO1xuXG4gICAgaWYgKG5ld0xpbmVzLmxlbmd0aCA+IDApIHtcbiAgICAgIG5ld0xpc3Quc2V0Tm90ZXNJbmRlbnQobGlzdC5nZXROb3Rlc0luZGVudCgpKTtcbiAgICAgIGZvciAoY29uc3QgbGluZSBvZiBuZXdMaW5lcykge1xuICAgICAgICBuZXdMaXN0LmFkZExpbmUobGluZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG9uQ2hpbGRMZXZlbCkge1xuICAgICAgbGlzdC5hZGRCZWZvcmVBbGwobmV3TGlzdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghY2hpbGRJc0ZvbGRlZCB8fCAhZW5kT2ZMaW5lKSB7XG4gICAgICAgIGNvbnN0IGNoaWxkcmVuID0gbGlzdC5nZXRDaGlsZHJlbigpO1xuICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG4gICAgICAgICAgbGlzdC5yZW1vdmVDaGlsZChjaGlsZCk7XG4gICAgICAgICAgbmV3TGlzdC5hZGRBZnRlckFsbChjaGlsZCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbGlzdC5nZXRQYXJlbnQoKS5hZGRBZnRlcihsaXN0LCBuZXdMaXN0KTtcbiAgICB9XG5cbiAgICBsaXN0LnJlcGxhY2VMaW5lcyhvbGRMaW5lcyk7XG5cbiAgICBjb25zdCBuZXdMaXN0U3RhcnQgPSBuZXdMaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpO1xuICAgIHJvb3QucmVwbGFjZUN1cnNvcih7XG4gICAgICBsaW5lOiBuZXdMaXN0U3RhcnQubGluZSxcbiAgICAgIGNoOiBuZXdMaXN0U3RhcnQuY2ggKyBwcmVmaXgubGVuZ3RoLFxuICAgIH0pO1xuXG4gICAgcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyhyb290KTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5cbmltcG9ydCB7IFJvb3QsIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMgfSBmcm9tIFwiLi4vcm9vdFwiO1xuXG5leHBvcnQgY2xhc3MgT3V0ZGVudExpc3QgaW1wbGVtZW50cyBPcGVyYXRpb24ge1xuICBwcml2YXRlIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICBwcml2YXRlIHVwZGF0ZWQgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJvb3Q6IFJvb3QpIHt9XG5cbiAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLnN0b3BQcm9wYWdhdGlvbjtcbiAgfVxuXG4gIHNob3VsZFVwZGF0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy51cGRhdGVkO1xuICB9XG5cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCB7IHJvb3QgfSA9IHRoaXM7XG5cbiAgICBpZiAoIXJvb3QuaGFzU2luZ2xlQ3Vyc29yKCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnN0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG5cbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBwYXJlbnQgPSBsaXN0LmdldFBhcmVudCgpO1xuICAgIGNvbnN0IGdyYW5kUGFyZW50ID0gcGFyZW50LmdldFBhcmVudCgpO1xuXG4gICAgaWYgKCFncmFuZFBhcmVudCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG5cbiAgICBjb25zdCBsaXN0U3RhcnRMaW5lQmVmb3JlID0gcm9vdC5nZXRDb250ZW50TGluZXNSYW5nZU9mKGxpc3QpWzBdO1xuICAgIGNvbnN0IGluZGVudFJtRnJvbSA9IHBhcmVudC5nZXRGaXJzdExpbmVJbmRlbnQoKS5sZW5ndGg7XG4gICAgY29uc3QgaW5kZW50Um1UaWxsID0gbGlzdC5nZXRGaXJzdExpbmVJbmRlbnQoKS5sZW5ndGg7XG5cbiAgICBwYXJlbnQucmVtb3ZlQ2hpbGQobGlzdCk7XG4gICAgZ3JhbmRQYXJlbnQuYWRkQWZ0ZXIocGFyZW50LCBsaXN0KTtcbiAgICBsaXN0LnVuaW5kZW50Q29udGVudChpbmRlbnRSbUZyb20sIGluZGVudFJtVGlsbCk7XG5cbiAgICBjb25zdCBsaXN0U3RhcnRMaW5lQWZ0ZXIgPSByb290LmdldENvbnRlbnRMaW5lc1JhbmdlT2YobGlzdClbMF07XG4gICAgY29uc3QgbGluZURpZmYgPSBsaXN0U3RhcnRMaW5lQWZ0ZXIgLSBsaXN0U3RhcnRMaW5lQmVmb3JlO1xuICAgIGNvbnN0IGNoRGlmZiA9IGluZGVudFJtVGlsbCAtIGluZGVudFJtRnJvbTtcblxuICAgIGNvbnN0IGN1cnNvciA9IHJvb3QuZ2V0Q3Vyc29yKCk7XG4gICAgcm9vdC5yZXBsYWNlQ3Vyc29yKHtcbiAgICAgIGxpbmU6IGN1cnNvci5saW5lICsgbGluZURpZmYsXG4gICAgICBjaDogY3Vyc29yLmNoIC0gY2hEaWZmLFxuICAgIH0pO1xuXG4gICAgcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyhyb290KTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4vT3BlcmF0aW9uXCI7XG5pbXBvcnQgeyBPdXRkZW50TGlzdCB9IGZyb20gXCIuL091dGRlbnRMaXN0XCI7XG5cbmltcG9ydCB7IFJvb3QgfSBmcm9tIFwiLi4vcm9vdFwiO1xuaW1wb3J0IHsgaXNFbXB0eUxpbmVPckVtcHR5Q2hlY2tib3ggfSBmcm9tIFwiLi4vdXRpbHMvaXNFbXB0eUxpbmVPckVtcHR5Q2hlY2tib3hcIjtcblxuZXhwb3J0IGNsYXNzIE91dGRlbnRMaXN0SWZJdHNFbXB0eSBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgb3V0ZGVudExpc3Q6IE91dGRlbnRMaXN0O1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdDogUm9vdCkge1xuICAgIHRoaXMub3V0ZGVudExpc3QgPSBuZXcgT3V0ZGVudExpc3Qocm9vdCk7XG4gIH1cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMub3V0ZGVudExpc3Quc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCk7XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMub3V0ZGVudExpc3Quc2hvdWxkVXBkYXRlKCk7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcblxuICAgIGlmICghcm9vdC5oYXNTaW5nbGVDdXJzb3IoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGNvbnN0IGxpbmVzID0gbGlzdC5nZXRMaW5lcygpO1xuXG4gICAgaWYgKFxuICAgICAgbGluZXMubGVuZ3RoID4gMSB8fFxuICAgICAgIWlzRW1wdHlMaW5lT3JFbXB0eUNoZWNrYm94KGxpbmVzWzBdKSB8fFxuICAgICAgbGlzdC5nZXRMZXZlbCgpID09PSAxXG4gICAgKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5vdXRkZW50TGlzdC5wZXJmb3JtKCk7XG4gIH1cbn1cbiIsImltcG9ydCB7IFBsdWdpbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBQcmVjIH0gZnJvbSBcIkBjb2RlbWlycm9yL3N0YXRlXCI7XG5pbXBvcnQgeyBrZXltYXAgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivdmlld1wiO1xuXG5pbXBvcnQgeyBGZWF0dXJlIH0gZnJvbSBcIi4vRmVhdHVyZVwiO1xuXG5pbXBvcnQgeyBNeUVkaXRvciB9IGZyb20gXCIuLi9lZGl0b3JcIjtcbmltcG9ydCB7IENyZWF0ZU5ld0l0ZW0gfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9DcmVhdGVOZXdJdGVtXCI7XG5pbXBvcnQgeyBPdXRkZW50TGlzdElmSXRzRW1wdHkgfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9PdXRkZW50TGlzdElmSXRzRW1wdHlcIjtcbmltcG9ydCB7IElNRURldGVjdG9yIH0gZnJvbSBcIi4uL3NlcnZpY2VzL0lNRURldGVjdG9yXCI7XG5pbXBvcnQgeyBPYnNpZGlhblNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09ic2lkaWFuU2V0dGluZ3NcIjtcbmltcG9ydCB7IE9wZXJhdGlvblBlcmZvcm1lciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PcGVyYXRpb25QZXJmb3JtZXJcIjtcbmltcG9ydCB7IFBhcnNlciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9QYXJzZXJcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzXCI7XG5pbXBvcnQgeyBjcmVhdGVLZXltYXBSdW5DYWxsYmFjayB9IGZyb20gXCIuLi91dGlscy9jcmVhdGVLZXltYXBSdW5DYWxsYmFja1wiO1xuXG5leHBvcnQgY2xhc3MgRW50ZXJCZWhhdmlvdXJPdmVycmlkZSBpbXBsZW1lbnRzIEZlYXR1cmUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICAgIHByaXZhdGUgaW1lRGV0ZWN0b3I6IElNRURldGVjdG9yLFxuICAgIHByaXZhdGUgb2JzaWRpYW5TZXR0aW5nczogT2JzaWRpYW5TZXR0aW5ncyxcbiAgICBwcml2YXRlIHBhcnNlcjogUGFyc2VyLFxuICAgIHByaXZhdGUgb3BlcmF0aW9uUGVyZm9ybWVyOiBPcGVyYXRpb25QZXJmb3JtZXIsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRWRpdG9yRXh0ZW5zaW9uKFxuICAgICAgUHJlYy5oaWdoZXN0KFxuICAgICAgICBrZXltYXAub2YoW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGtleTogXCJFbnRlclwiLFxuICAgICAgICAgICAgcnVuOiBjcmVhdGVLZXltYXBSdW5DYWxsYmFjayh7XG4gICAgICAgICAgICAgIGNoZWNrOiB0aGlzLmNoZWNrLFxuICAgICAgICAgICAgICBydW46IHRoaXMucnVuLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgfSxcbiAgICAgICAgXSksXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgY2hlY2sgPSAoKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMuc2V0dGluZ3Mub3ZlcnJpZGVFbnRlckJlaGF2aW91ciAmJiAhdGhpcy5pbWVEZXRlY3Rvci5pc09wZW5lZCgpO1xuICB9O1xuXG4gIHByaXZhdGUgcnVuID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICBjb25zdCByb290ID0gdGhpcy5wYXJzZXIucGFyc2UoZWRpdG9yKTtcblxuICAgIGlmICghcm9vdCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc2hvdWxkVXBkYXRlOiBmYWxzZSxcbiAgICAgICAgc2hvdWxkU3RvcFByb3BhZ2F0aW9uOiBmYWxzZSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAge1xuICAgICAgY29uc3QgcmVzID0gdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIuZXZhbChcbiAgICAgICAgcm9vdCxcbiAgICAgICAgbmV3IE91dGRlbnRMaXN0SWZJdHNFbXB0eShyb290KSxcbiAgICAgICAgZWRpdG9yLFxuICAgICAgKTtcblxuICAgICAgaWYgKHJlcy5zaG91bGRTdG9wUHJvcGFnYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICAgIH1cbiAgICB9XG5cbiAgICB7XG4gICAgICBjb25zdCBkZWZhdWx0SW5kZW50Q2hhcnMgPSB0aGlzLm9ic2lkaWFuU2V0dGluZ3MuZ2V0RGVmYXVsdEluZGVudENoYXJzKCk7XG4gICAgICBjb25zdCB6b29tUmFuZ2UgPSBlZGl0b3IuZ2V0Wm9vbVJhbmdlKCk7XG4gICAgICBjb25zdCBnZXRab29tUmFuZ2UgPSB7XG4gICAgICAgIGdldFpvb21SYW5nZTogKCkgPT4gem9vbVJhbmdlLFxuICAgICAgfTtcblxuICAgICAgY29uc3QgcmVzID0gdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIuZXZhbChcbiAgICAgICAgcm9vdCxcbiAgICAgICAgbmV3IENyZWF0ZU5ld0l0ZW0ocm9vdCwgZGVmYXVsdEluZGVudENoYXJzLCBnZXRab29tUmFuZ2UpLFxuICAgICAgICBlZGl0b3IsXG4gICAgICApO1xuXG4gICAgICBpZiAocmVzLnNob3VsZFVwZGF0ZSAmJiB6b29tUmFuZ2UpIHtcbiAgICAgICAgZWRpdG9yLnRyeVJlZnJlc2hab29tKHpvb21SYW5nZS5mcm9tLmxpbmUpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IEVkaXRvciB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBNeUVkaXRvciB9IGZyb20gXCIuLi9lZGl0b3JcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUVkaXRvckNhbGxiYWNrKGNiOiAoZWRpdG9yOiBNeUVkaXRvcikgPT4gYm9vbGVhbikge1xuICByZXR1cm4gKGVkaXRvcjogRWRpdG9yKSA9PiB7XG4gICAgY29uc3QgbXlFZGl0b3IgPSBuZXcgTXlFZGl0b3IoZWRpdG9yKTtcbiAgICBjb25zdCBzaG91bGRTdG9wUHJvcGFnYXRpb24gPSBjYihteUVkaXRvcik7XG5cbiAgICBpZiAoXG4gICAgICAhc2hvdWxkU3RvcFByb3BhZ2F0aW9uICYmXG4gICAgICB3aW5kb3cuZXZlbnQgJiZcbiAgICAgIHdpbmRvdy5ldmVudC50eXBlID09PSBcImtleWRvd25cIlxuICAgICkge1xuICAgICAgbXlFZGl0b3IudHJpZ2dlck9uS2V5RG93bih3aW5kb3cuZXZlbnQgYXMgS2V5Ym9hcmRFdmVudCk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgTm90aWNlLCBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBPYnNpZGlhblNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09ic2lkaWFuU2V0dGluZ3NcIjtcbmltcG9ydCB7IGNyZWF0ZUVkaXRvckNhbGxiYWNrIH0gZnJvbSBcIi4uL3V0aWxzL2NyZWF0ZUVkaXRvckNhbGxiYWNrXCI7XG5cbmV4cG9ydCBjbGFzcyBMaXN0c0ZvbGRpbmdDb21tYW5kcyBpbXBsZW1lbnRzIEZlYXR1cmUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgb2JzaWRpYW5TZXR0aW5nczogT2JzaWRpYW5TZXR0aW5ncyxcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4uYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJmb2xkXCIsXG4gICAgICBpY29uOiBcImNoZXZyb25zLWRvd24tdXBcIixcbiAgICAgIG5hbWU6IFwiRm9sZCB0aGUgbGlzdFwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IGNyZWF0ZUVkaXRvckNhbGxiYWNrKHRoaXMuZm9sZCksXG4gICAgICBob3RrZXlzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBtb2RpZmllcnM6IFtcIk1vZFwiXSxcbiAgICAgICAgICBrZXk6IFwiQXJyb3dVcFwiLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIHRoaXMucGx1Z2luLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwidW5mb2xkXCIsXG4gICAgICBpY29uOiBcImNoZXZyb25zLXVwLWRvd25cIixcbiAgICAgIG5hbWU6IFwiVW5mb2xkIHRoZSBsaXN0XCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogY3JlYXRlRWRpdG9yQ2FsbGJhY2sodGhpcy51bmZvbGQpLFxuICAgICAgaG90a2V5czogW1xuICAgICAgICB7XG4gICAgICAgICAgbW9kaWZpZXJzOiBbXCJNb2RcIl0sXG4gICAgICAgICAga2V5OiBcIkFycm93RG93blwiLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG5cbiAgcHJpdmF0ZSBzZXRGb2xkKGVkaXRvcjogTXlFZGl0b3IsIHR5cGU6IFwiZm9sZFwiIHwgXCJ1bmZvbGRcIikge1xuICAgIGlmICghdGhpcy5vYnNpZGlhblNldHRpbmdzLmdldEZvbGRTZXR0aW5ncygpLmZvbGRJbmRlbnQpIHtcbiAgICAgIG5ldyBOb3RpY2UoXG4gICAgICAgIGBVbmFibGUgdG8gJHt0eXBlfSBiZWNhdXNlIGZvbGRpbmcgaXMgZGlzYWJsZWQuIFBsZWFzZSBlbmFibGUgXCJGb2xkIGluZGVudFwiIGluIE9ic2lkaWFuIHNldHRpbmdzLmAsXG4gICAgICAgIDUwMDAsXG4gICAgICApO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgY29uc3QgY3Vyc29yID0gZWRpdG9yLmdldEN1cnNvcigpO1xuXG4gICAgaWYgKHR5cGUgPT09IFwiZm9sZFwiKSB7XG4gICAgICBlZGl0b3IuZm9sZChjdXJzb3IubGluZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVkaXRvci51bmZvbGQoY3Vyc29yLmxpbmUpO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcHJpdmF0ZSBmb2xkID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICByZXR1cm4gdGhpcy5zZXRGb2xkKGVkaXRvciwgXCJmb2xkXCIpO1xuICB9O1xuXG4gIHByaXZhdGUgdW5mb2xkID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICByZXR1cm4gdGhpcy5zZXRGb2xkKGVkaXRvciwgXCJ1bmZvbGRcIik7XG4gIH07XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgUm9vdCwgcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBJbmRlbnRMaXN0IGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByb290OiBSb290LFxuICAgIHByaXZhdGUgZGVmYXVsdEluZGVudENoYXJzOiBzdHJpbmcsXG4gICkge31cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcFByb3BhZ2F0aW9uO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZWQ7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcblxuICAgIGlmICghcm9vdC5oYXNTaW5nbGVDdXJzb3IoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcblxuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGNvbnN0IHBhcmVudCA9IGxpc3QuZ2V0UGFyZW50KCk7XG4gICAgY29uc3QgcHJldiA9IHBhcmVudC5nZXRQcmV2U2libGluZ09mKGxpc3QpO1xuXG4gICAgaWYgKCFwcmV2KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcblxuICAgIGNvbnN0IGxpc3RTdGFydExpbmVCZWZvcmUgPSByb290LmdldENvbnRlbnRMaW5lc1JhbmdlT2YobGlzdClbMF07XG5cbiAgICBjb25zdCBpbmRlbnRQb3MgPSBsaXN0LmdldEZpcnN0TGluZUluZGVudCgpLmxlbmd0aDtcbiAgICBsZXQgaW5kZW50Q2hhcnMgPSBcIlwiO1xuXG4gICAgaWYgKGluZGVudENoYXJzID09PSBcIlwiICYmICFwcmV2LmlzRW1wdHkoKSkge1xuICAgICAgaW5kZW50Q2hhcnMgPSBwcmV2XG4gICAgICAgIC5nZXRDaGlsZHJlbigpWzBdXG4gICAgICAgIC5nZXRGaXJzdExpbmVJbmRlbnQoKVxuICAgICAgICAuc2xpY2UocHJldi5nZXRGaXJzdExpbmVJbmRlbnQoKS5sZW5ndGgpO1xuICAgIH1cblxuICAgIGlmIChpbmRlbnRDaGFycyA9PT0gXCJcIikge1xuICAgICAgaW5kZW50Q2hhcnMgPSBsaXN0XG4gICAgICAgIC5nZXRGaXJzdExpbmVJbmRlbnQoKVxuICAgICAgICAuc2xpY2UocGFyZW50LmdldEZpcnN0TGluZUluZGVudCgpLmxlbmd0aCk7XG4gICAgfVxuXG4gICAgaWYgKGluZGVudENoYXJzID09PSBcIlwiICYmICFsaXN0LmlzRW1wdHkoKSkge1xuICAgICAgaW5kZW50Q2hhcnMgPSBsaXN0LmdldENoaWxkcmVuKClbMF0uZ2V0Rmlyc3RMaW5lSW5kZW50KCk7XG4gICAgfVxuXG4gICAgaWYgKGluZGVudENoYXJzID09PSBcIlwiKSB7XG4gICAgICBpbmRlbnRDaGFycyA9IHRoaXMuZGVmYXVsdEluZGVudENoYXJzO1xuICAgIH1cblxuICAgIHBhcmVudC5yZW1vdmVDaGlsZChsaXN0KTtcbiAgICBwcmV2LmFkZEFmdGVyQWxsKGxpc3QpO1xuICAgIGxpc3QuaW5kZW50Q29udGVudChpbmRlbnRQb3MsIGluZGVudENoYXJzKTtcblxuICAgIGNvbnN0IGxpc3RTdGFydExpbmVBZnRlciA9IHJvb3QuZ2V0Q29udGVudExpbmVzUmFuZ2VPZihsaXN0KVswXTtcbiAgICBjb25zdCBsaW5lRGlmZiA9IGxpc3RTdGFydExpbmVBZnRlciAtIGxpc3RTdGFydExpbmVCZWZvcmU7XG5cbiAgICBjb25zdCBjdXJzb3IgPSByb290LmdldEN1cnNvcigpO1xuICAgIHJvb3QucmVwbGFjZUN1cnNvcih7XG4gICAgICBsaW5lOiBjdXJzb3IubGluZSArIGxpbmVEaWZmLFxuICAgICAgY2g6IGN1cnNvci5jaCArIGluZGVudENoYXJzLmxlbmd0aCxcbiAgICB9KTtcblxuICAgIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMocm9vdCk7XG4gIH1cbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBSb290LCByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzIH0gZnJvbSBcIi4uL3Jvb3RcIjtcblxuZXhwb3J0IGNsYXNzIE1vdmVMaXN0RG93biBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdDogUm9vdCkge31cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcFByb3BhZ2F0aW9uO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZWQ7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcblxuICAgIGlmICghcm9vdC5oYXNTaW5nbGVDdXJzb3IoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcblxuICAgIGNvbnN0IGxpc3QgPSByb290LmdldExpc3RVbmRlckN1cnNvcigpO1xuICAgIGNvbnN0IHBhcmVudCA9IGxpc3QuZ2V0UGFyZW50KCk7XG4gICAgY29uc3QgZ3JhbmRQYXJlbnQgPSBwYXJlbnQuZ2V0UGFyZW50KCk7XG4gICAgY29uc3QgbmV4dCA9IHBhcmVudC5nZXROZXh0U2libGluZ09mKGxpc3QpO1xuXG4gICAgY29uc3QgbGlzdFN0YXJ0TGluZUJlZm9yZSA9IHJvb3QuZ2V0Q29udGVudExpbmVzUmFuZ2VPZihsaXN0KVswXTtcblxuICAgIGlmICghbmV4dCAmJiBncmFuZFBhcmVudCkge1xuICAgICAgY29uc3QgbmV3UGFyZW50ID0gZ3JhbmRQYXJlbnQuZ2V0TmV4dFNpYmxpbmdPZihwYXJlbnQpO1xuXG4gICAgICBpZiAobmV3UGFyZW50KSB7XG4gICAgICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG4gICAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChsaXN0KTtcbiAgICAgICAgbmV3UGFyZW50LmFkZEJlZm9yZUFsbChsaXN0KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG5leHQpIHtcbiAgICAgIHRoaXMudXBkYXRlZCA9IHRydWU7XG4gICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQobGlzdCk7XG4gICAgICBwYXJlbnQuYWRkQWZ0ZXIobmV4dCwgbGlzdCk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnVwZGF0ZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsaXN0U3RhcnRMaW5lQWZ0ZXIgPSByb290LmdldENvbnRlbnRMaW5lc1JhbmdlT2YobGlzdClbMF07XG4gICAgY29uc3QgbGluZURpZmYgPSBsaXN0U3RhcnRMaW5lQWZ0ZXIgLSBsaXN0U3RhcnRMaW5lQmVmb3JlO1xuXG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcbiAgICByb290LnJlcGxhY2VDdXJzb3Ioe1xuICAgICAgbGluZTogY3Vyc29yLmxpbmUgKyBsaW5lRGlmZixcbiAgICAgIGNoOiBjdXJzb3IuY2gsXG4gICAgfSk7XG5cbiAgICByZWNhbGN1bGF0ZU51bWVyaWNCdWxsZXRzKHJvb3QpO1xuICB9XG59XG4iLCJpbXBvcnQgeyBPcGVyYXRpb24gfSBmcm9tIFwiLi9PcGVyYXRpb25cIjtcblxuaW1wb3J0IHsgUm9vdCwgcmVjYWxjdWxhdGVOdW1lcmljQnVsbGV0cyB9IGZyb20gXCIuLi9yb290XCI7XG5cbmV4cG9ydCBjbGFzcyBNb3ZlTGlzdFVwIGltcGxlbWVudHMgT3BlcmF0aW9uIHtcbiAgcHJpdmF0ZSBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgcHJpdmF0ZSB1cGRhdGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByb290OiBSb290KSB7fVxuXG4gIHNob3VsZFN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5zdG9wUHJvcGFnYXRpb247XG4gIH1cblxuICBzaG91bGRVcGRhdGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlZDtcbiAgfVxuXG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgeyByb290IH0gPSB0aGlzO1xuXG4gICAgaWYgKCFyb290Lmhhc1NpbmdsZUN1cnNvcigpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuXG4gICAgY29uc3QgbGlzdCA9IHJvb3QuZ2V0TGlzdFVuZGVyQ3Vyc29yKCk7XG4gICAgY29uc3QgcGFyZW50ID0gbGlzdC5nZXRQYXJlbnQoKTtcbiAgICBjb25zdCBncmFuZFBhcmVudCA9IHBhcmVudC5nZXRQYXJlbnQoKTtcbiAgICBjb25zdCBwcmV2ID0gcGFyZW50LmdldFByZXZTaWJsaW5nT2YobGlzdCk7XG5cbiAgICBjb25zdCBsaXN0U3RhcnRMaW5lQmVmb3JlID0gcm9vdC5nZXRDb250ZW50TGluZXNSYW5nZU9mKGxpc3QpWzBdO1xuXG4gICAgaWYgKCFwcmV2ICYmIGdyYW5kUGFyZW50KSB7XG4gICAgICBjb25zdCBuZXdQYXJlbnQgPSBncmFuZFBhcmVudC5nZXRQcmV2U2libGluZ09mKHBhcmVudCk7XG5cbiAgICAgIGlmIChuZXdQYXJlbnQpIHtcbiAgICAgICAgdGhpcy51cGRhdGVkID0gdHJ1ZTtcbiAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKGxpc3QpO1xuICAgICAgICBuZXdQYXJlbnQuYWRkQWZ0ZXJBbGwobGlzdCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChwcmV2KSB7XG4gICAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKGxpc3QpO1xuICAgICAgcGFyZW50LmFkZEJlZm9yZShwcmV2LCBsaXN0KTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMudXBkYXRlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGxpc3RTdGFydExpbmVBZnRlciA9IHJvb3QuZ2V0Q29udGVudExpbmVzUmFuZ2VPZihsaXN0KVswXTtcbiAgICBjb25zdCBsaW5lRGlmZiA9IGxpc3RTdGFydExpbmVBZnRlciAtIGxpc3RTdGFydExpbmVCZWZvcmU7XG5cbiAgICBjb25zdCBjdXJzb3IgPSByb290LmdldEN1cnNvcigpO1xuICAgIHJvb3QucmVwbGFjZUN1cnNvcih7XG4gICAgICBsaW5lOiBjdXJzb3IubGluZSArIGxpbmVEaWZmLFxuICAgICAgY2g6IGN1cnNvci5jaCxcbiAgICB9KTtcblxuICAgIHJlY2FsY3VsYXRlTnVtZXJpY0J1bGxldHMocm9vdCk7XG4gIH1cbn1cbiIsImltcG9ydCB7IFBsdWdpbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBGZWF0dXJlIH0gZnJvbSBcIi4vRmVhdHVyZVwiO1xuXG5pbXBvcnQgeyBNeUVkaXRvciB9IGZyb20gXCIuLi9lZGl0b3JcIjtcbmltcG9ydCB7IEluZGVudExpc3QgfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9JbmRlbnRMaXN0XCI7XG5pbXBvcnQgeyBNb3ZlTGlzdERvd24gfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9Nb3ZlTGlzdERvd25cIjtcbmltcG9ydCB7IE1vdmVMaXN0VXAgfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9Nb3ZlTGlzdFVwXCI7XG5pbXBvcnQgeyBPdXRkZW50TGlzdCB9IGZyb20gXCIuLi9vcGVyYXRpb25zL091dGRlbnRMaXN0XCI7XG5pbXBvcnQgeyBPYnNpZGlhblNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09ic2lkaWFuU2V0dGluZ3NcIjtcbmltcG9ydCB7IE9wZXJhdGlvblBlcmZvcm1lciB9IGZyb20gXCIuLi9zZXJ2aWNlcy9PcGVyYXRpb25QZXJmb3JtZXJcIjtcbmltcG9ydCB7IGNyZWF0ZUVkaXRvckNhbGxiYWNrIH0gZnJvbSBcIi4uL3V0aWxzL2NyZWF0ZUVkaXRvckNhbGxiYWNrXCI7XG5cbmV4cG9ydCBjbGFzcyBMaXN0c01vdmVtZW50Q29tbWFuZHMgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIG9ic2lkaWFuU2V0dGluZ3M6IE9ic2lkaWFuU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBvcGVyYXRpb25QZXJmb3JtZXI6IE9wZXJhdGlvblBlcmZvcm1lcixcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy5wbHVnaW4uYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJtb3ZlLWxpc3QtaXRlbS11cFwiLFxuICAgICAgaWNvbjogXCJhcnJvdy11cFwiLFxuICAgICAgbmFtZTogXCJNb3ZlIGxpc3QgYW5kIHN1Ymxpc3RzIHVwXCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogY3JlYXRlRWRpdG9yQ2FsbGJhY2sodGhpcy5tb3ZlTGlzdFVwKSxcbiAgICAgIGhvdGtleXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG1vZGlmaWVyczogW1wiTW9kXCIsIFwiU2hpZnRcIl0sXG4gICAgICAgICAga2V5OiBcIkFycm93VXBcIixcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICB0aGlzLnBsdWdpbi5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm1vdmUtbGlzdC1pdGVtLWRvd25cIixcbiAgICAgIGljb246IFwiYXJyb3ctZG93blwiLFxuICAgICAgbmFtZTogXCJNb3ZlIGxpc3QgYW5kIHN1Ymxpc3RzIGRvd25cIixcbiAgICAgIGVkaXRvckNhbGxiYWNrOiBjcmVhdGVFZGl0b3JDYWxsYmFjayh0aGlzLm1vdmVMaXN0RG93biksXG4gICAgICBob3RrZXlzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBtb2RpZmllcnM6IFtcIk1vZFwiLCBcIlNoaWZ0XCJdLFxuICAgICAgICAgIGtleTogXCJBcnJvd0Rvd25cIixcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICB0aGlzLnBsdWdpbi5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcImluZGVudC1saXN0XCIsXG4gICAgICBpY29uOiBcImluZGVudFwiLFxuICAgICAgbmFtZTogXCJJbmRlbnQgdGhlIGxpc3QgYW5kIHN1Ymxpc3RzXCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogY3JlYXRlRWRpdG9yQ2FsbGJhY2sodGhpcy5pbmRlbnRMaXN0KSxcbiAgICAgIGhvdGtleXM6IFtdLFxuICAgIH0pO1xuXG4gICAgdGhpcy5wbHVnaW4uYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJvdXRkZW50LWxpc3RcIixcbiAgICAgIGljb246IFwib3V0ZGVudFwiLFxuICAgICAgbmFtZTogXCJPdXRkZW50IHRoZSBsaXN0IGFuZCBzdWJsaXN0c1wiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IGNyZWF0ZUVkaXRvckNhbGxiYWNrKHRoaXMub3V0ZGVudExpc3QpLFxuICAgICAgaG90a2V5czogW10sXG4gICAgfSk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7fVxuXG4gIHByaXZhdGUgbW92ZUxpc3REb3duID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICBjb25zdCB7IHNob3VsZFN0b3BQcm9wYWdhdGlvbiB9ID0gdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIucGVyZm9ybShcbiAgICAgIChyb290KSA9PiBuZXcgTW92ZUxpc3REb3duKHJvb3QpLFxuICAgICAgZWRpdG9yLFxuICAgICk7XG5cbiAgICByZXR1cm4gc2hvdWxkU3RvcFByb3BhZ2F0aW9uO1xuICB9O1xuXG4gIHByaXZhdGUgbW92ZUxpc3RVcCA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgY29uc3QgeyBzaG91bGRTdG9wUHJvcGFnYXRpb24gfSA9IHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLnBlcmZvcm0oXG4gICAgICAocm9vdCkgPT4gbmV3IE1vdmVMaXN0VXAocm9vdCksXG4gICAgICBlZGl0b3IsXG4gICAgKTtcblxuICAgIHJldHVybiBzaG91bGRTdG9wUHJvcGFnYXRpb247XG4gIH07XG5cbiAgcHJpdmF0ZSBpbmRlbnRMaXN0ID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICBjb25zdCB7IHNob3VsZFN0b3BQcm9wYWdhdGlvbiB9ID0gdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIucGVyZm9ybShcbiAgICAgIChyb290KSA9PlxuICAgICAgICBuZXcgSW5kZW50TGlzdChyb290LCB0aGlzLm9ic2lkaWFuU2V0dGluZ3MuZ2V0RGVmYXVsdEluZGVudENoYXJzKCkpLFxuICAgICAgZWRpdG9yLFxuICAgICk7XG5cbiAgICByZXR1cm4gc2hvdWxkU3RvcFByb3BhZ2F0aW9uO1xuICB9O1xuXG4gIHByaXZhdGUgb3V0ZGVudExpc3QgPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIGNvbnN0IHsgc2hvdWxkU3RvcFByb3BhZ2F0aW9uIH0gPSB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5wZXJmb3JtKFxuICAgICAgKHJvb3QpID0+IG5ldyBPdXRkZW50TGlzdChyb290KSxcbiAgICAgIGVkaXRvcixcbiAgICApO1xuXG4gICAgcmV0dXJuIHNob3VsZFN0b3BQcm9wYWdhdGlvbjtcbiAgfTtcbn1cbiIsImltcG9ydCB7IE9wZXJhdGlvbiB9IGZyb20gXCIuL09wZXJhdGlvblwiO1xuXG5pbXBvcnQgeyBSb290IH0gZnJvbSBcIi4uL3Jvb3RcIjtcblxuZXhwb3J0IGNsYXNzIERlbGV0ZVRpbGxDdXJyZW50TGluZUNvbnRlbnRTdGFydCBpbXBsZW1lbnRzIE9wZXJhdGlvbiB7XG4gIHByaXZhdGUgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlZCA9IGZhbHNlO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdDogUm9vdCkge31cblxuICBzaG91bGRTdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcFByb3BhZ2F0aW9uO1xuICB9XG5cbiAgc2hvdWxkVXBkYXRlKCkge1xuICAgIHJldHVybiB0aGlzLnVwZGF0ZWQ7XG4gIH1cblxuICBwZXJmb3JtKCkge1xuICAgIGNvbnN0IHsgcm9vdCB9ID0gdGhpcztcblxuICAgIGlmICghcm9vdC5oYXNTaW5nbGVDdXJzb3IoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcbiAgICB0aGlzLnVwZGF0ZWQgPSB0cnVlO1xuXG4gICAgY29uc3QgY3Vyc29yID0gcm9vdC5nZXRDdXJzb3IoKTtcbiAgICBjb25zdCBsaXN0ID0gcm9vdC5nZXRMaXN0VW5kZXJDdXJzb3IoKTtcbiAgICBjb25zdCBsaW5lcyA9IGxpc3QuZ2V0TGluZXNJbmZvKCk7XG4gICAgY29uc3QgbGluZU5vID0gbGluZXMuZmluZEluZGV4KChsKSA9PiBsLmZyb20ubGluZSA9PT0gY3Vyc29yLmxpbmUpO1xuXG4gICAgbGluZXNbbGluZU5vXS50ZXh0ID0gbGluZXNbbGluZU5vXS50ZXh0LnNsaWNlKFxuICAgICAgY3Vyc29yLmNoIC0gbGluZXNbbGluZU5vXS5mcm9tLmNoLFxuICAgICk7XG5cbiAgICBsaXN0LnJlcGxhY2VMaW5lcyhsaW5lcy5tYXAoKGwpID0+IGwudGV4dCkpO1xuICAgIHJvb3QucmVwbGFjZUN1cnNvcihsaW5lc1tsaW5lTm9dLmZyb20pO1xuICB9XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsga2V5bWFwIH0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBEZWxldGVUaWxsQ3VycmVudExpbmVDb250ZW50U3RhcnQgfSBmcm9tIFwiLi4vb3BlcmF0aW9ucy9EZWxldGVUaWxsQ3VycmVudExpbmVDb250ZW50U3RhcnRcIjtcbmltcG9ydCB7IElNRURldGVjdG9yIH0gZnJvbSBcIi4uL3NlcnZpY2VzL0lNRURldGVjdG9yXCI7XG5pbXBvcnQgeyBPcGVyYXRpb25QZXJmb3JtZXIgfSBmcm9tIFwiLi4vc2VydmljZXMvT3BlcmF0aW9uUGVyZm9ybWVyXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1wiO1xuaW1wb3J0IHsgY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2sgfSBmcm9tIFwiLi4vdXRpbHMvY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2tcIjtcblxuZXhwb3J0IGNsYXNzIE1ldGFCYWNrc3BhY2VCZWhhdmlvdXJPdmVycmlkZSBpbXBsZW1lbnRzIEZlYXR1cmUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICAgIHByaXZhdGUgaW1lRGV0ZWN0b3I6IElNRURldGVjdG9yLFxuICAgIHByaXZhdGUgb3BlcmF0aW9uUGVyZm9ybWVyOiBPcGVyYXRpb25QZXJmb3JtZXIsXG4gICkge31cblxuICBhc3luYyBsb2FkKCkge1xuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRWRpdG9yRXh0ZW5zaW9uKFxuICAgICAga2V5bWFwLm9mKFtcbiAgICAgICAge1xuICAgICAgICAgIG1hYzogXCJtLUJhY2tzcGFjZVwiLFxuICAgICAgICAgIHJ1bjogY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2soe1xuICAgICAgICAgICAgY2hlY2s6IHRoaXMuY2hlY2ssXG4gICAgICAgICAgICBydW46IHRoaXMucnVuLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgXSksXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG5cbiAgcHJpdmF0ZSBjaGVjayA9ICgpID0+IHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5zZXR0aW5ncy5rZWVwQ3Vyc29yV2l0aGluQ29udGVudCAhPT0gXCJuZXZlclwiICYmXG4gICAgICAhdGhpcy5pbWVEZXRlY3Rvci5pc09wZW5lZCgpXG4gICAgKTtcbiAgfTtcblxuICBwcml2YXRlIHJ1biA9IChlZGl0b3I6IE15RWRpdG9yKSA9PiB7XG4gICAgcmV0dXJuIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLnBlcmZvcm0oXG4gICAgICAocm9vdCkgPT4gbmV3IERlbGV0ZVRpbGxDdXJyZW50TGluZUNvbnRlbnRTdGFydChyb290KSxcbiAgICAgIGVkaXRvcixcbiAgICApO1xuICB9O1xufVxuIiwiaW1wb3J0IHsgQXBwLCBQbHVnaW4sIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHtcbiAgS2VlcEN1cnNvcldpdGhpbkNvbnRlbnQsXG4gIFNldHRpbmdzLFxuICBWZXJ0aWNhbExpbmVzQWN0aW9uLFxufSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcblxuY2xhc3MgT2JzaWRpYW5PdXRsaW5lclBsdWdpblNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcGx1Z2luOiBQbHVnaW4sXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICkge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcblxuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiU3RpY2sgdGhlIGN1cnNvciB0byB0aGUgY29udGVudFwiKVxuICAgICAgLnNldERlc2MoXCJEb24ndCBsZXQgdGhlIGN1cnNvciBtb3ZlIHRvIHRoZSBidWxsZXQgcG9zaXRpb24uXCIpXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XG4gICAgICAgIGRyb3Bkb3duXG4gICAgICAgICAgLmFkZE9wdGlvbnMoe1xuICAgICAgICAgICAgbmV2ZXI6IFwiTmV2ZXJcIixcbiAgICAgICAgICAgIFwiYnVsbGV0LW9ubHlcIjogXCJTdGljayBjdXJzb3Igb3V0IG9mIGJ1bGxldHNcIixcbiAgICAgICAgICAgIFwiYnVsbGV0LWFuZC1jaGVja2JveFwiOiBcIlN0aWNrIGN1cnNvciBvdXQgb2YgYnVsbGV0cyBhbmQgY2hlY2tib3hlc1wiLFxuICAgICAgICAgIH0gYXMgeyBba2V5IGluIEtlZXBDdXJzb3JXaXRoaW5Db250ZW50XTogc3RyaW5nIH0pXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMuc2V0dGluZ3Mua2VlcEN1cnNvcldpdGhpbkNvbnRlbnQpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZTogS2VlcEN1cnNvcldpdGhpbkNvbnRlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3Mua2VlcEN1cnNvcldpdGhpbkNvbnRlbnQgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiRW5oYW5jZSB0aGUgVGFiIGtleVwiKVxuICAgICAgLnNldERlc2MoXCJNYWtlIFRhYiBhbmQgU2hpZnQtVGFiIGJlaGF2ZSB0aGUgc2FtZSBhcyBvdGhlciBvdXRsaW5lcnMuXCIpXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHtcbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMuc2V0dGluZ3Mub3ZlcnJpZGVUYWJCZWhhdmlvdXIpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy5vdmVycmlkZVRhYkJlaGF2aW91ciA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy5zYXZlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJFbmhhbmNlIHRoZSBFbnRlciBrZXlcIilcbiAgICAgIC5zZXREZXNjKFwiTWFrZSB0aGUgRW50ZXIga2V5IGJlaGF2ZSB0aGUgc2FtZSBhcyBvdGhlciBvdXRsaW5lcnMuXCIpXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+IHtcbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMuc2V0dGluZ3Mub3ZlcnJpZGVFbnRlckJlaGF2aW91cilcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLm92ZXJyaWRlRW50ZXJCZWhhdmlvdXIgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiRW5oYW5jZSB0aGUgQ3RybCtBIG9yIENtZCtBIGJlaGF2aW9yXCIpXG4gICAgICAuc2V0RGVzYyhcbiAgICAgICAgXCJQcmVzcyB0aGUgaG90a2V5IG9uY2UgdG8gc2VsZWN0IHRoZSBjdXJyZW50IGxpc3QgaXRlbS4gUHJlc3MgdGhlIGhvdGtleSB0d2ljZSB0byBzZWxlY3QgdGhlIGVudGlyZSBsaXN0LlwiLFxuICAgICAgKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB7XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLm92ZXJyaWRlU2VsZWN0QWxsQmVoYXZpb3VyKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3Mub3ZlcnJpZGVTZWxlY3RBbGxCZWhhdmlvdXIgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiSW1wcm92ZSB0aGUgc3R5bGUgb2YgeW91ciBsaXN0c1wiKVxuICAgICAgLnNldERlc2MoXG4gICAgICAgIFwiU3R5bGVzIGFyZSBvbmx5IGNvbXBhdGlibGUgd2l0aCBidWlsdC1pbiBPYnNpZGlhbiB0aGVtZXMgYW5kIG1heSBub3QgYmUgY29tcGF0aWJsZSB3aXRoIG90aGVyIHRoZW1lcy5cIixcbiAgICAgIClcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4ge1xuICAgICAgICB0b2dnbGVcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5zZXR0aW5ncy5iZXR0ZXJMaXN0c1N0eWxlcylcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLmJldHRlckxpc3RzU3R5bGVzID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnNhdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkRyYXcgdmVydGljYWwgaW5kZW50YXRpb24gbGluZXNcIilcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4ge1xuICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5zZXR0aW5ncy52ZXJ0aWNhbExpbmVzKS5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICB0aGlzLnNldHRpbmdzLnZlcnRpY2FsTGluZXMgPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnNhdmUoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJWZXJ0aWNhbCBpbmRlbnRhdGlvbiBsaW5lIGNsaWNrIGFjdGlvblwiKVxuICAgICAgLmFkZERyb3Bkb3duKChkcm9wZG93bikgPT4ge1xuICAgICAgICBkcm9wZG93blxuICAgICAgICAgIC5hZGRPcHRpb25zKHtcbiAgICAgICAgICAgIG5vbmU6IFwiTm9uZVwiLFxuICAgICAgICAgICAgXCJ6b29tLWluXCI6IFwiWm9vbSBJblwiLFxuICAgICAgICAgICAgXCJ0b2dnbGUtZm9sZGluZ1wiOiBcIlRvZ2dsZSBGb2xkaW5nXCIsXG4gICAgICAgICAgfSBhcyB7IFtrZXkgaW4gVmVydGljYWxMaW5lc0FjdGlvbl06IHN0cmluZyB9KVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnNldHRpbmdzLnZlcnRpY2FsTGluZXNBY3Rpb24pXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZTogVmVydGljYWxMaW5lc0FjdGlvbikgPT4ge1xuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy52ZXJ0aWNhbExpbmVzQWN0aW9uID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnNhdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJEcmFnLWFuZC1Ecm9wXCIpLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PiB7XG4gICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5zZXR0aW5ncy5kcmFnQW5kRHJvcCkub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgIHRoaXMuc2V0dGluZ3MuZHJhZ0FuZERyb3AgPSB2YWx1ZTtcbiAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy5zYXZlKCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJEZWJ1ZyBtb2RlXCIpXG4gICAgICAuc2V0RGVzYyhcbiAgICAgICAgXCJPcGVuIERldlRvb2xzIChDb21tYW5kK09wdGlvbitJIG9yIENvbnRyb2wrU2hpZnQrSSkgdG8gY29weSB0aGUgZGVidWcgbG9ncy5cIixcbiAgICAgIClcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT4ge1xuICAgICAgICB0b2dnbGUuc2V0VmFsdWUodGhpcy5zZXR0aW5ncy5kZWJ1Zykub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgdGhpcy5zZXR0aW5ncy5kZWJ1ZyA9IHZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2F2ZSgpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTZXR0aW5nc1RhYiBpbXBsZW1lbnRzIEZlYXR1cmUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5hZGRTZXR0aW5nVGFiKFxuICAgICAgbmV3IE9ic2lkaWFuT3V0bGluZXJQbHVnaW5TZXR0aW5nVGFiKFxuICAgICAgICB0aGlzLnBsdWdpbi5hcHAsXG4gICAgICAgIHRoaXMucGx1Z2luLFxuICAgICAgICB0aGlzLnNldHRpbmdzLFxuICAgICAgKSxcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge31cbn1cbiIsImltcG9ydCB7IFBsdWdpbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBQcmVjIH0gZnJvbSBcIkBjb2RlbWlycm9yL3N0YXRlXCI7XG5pbXBvcnQgeyBrZXltYXAgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivdmlld1wiO1xuXG5pbXBvcnQgeyBGZWF0dXJlIH0gZnJvbSBcIi4vRmVhdHVyZVwiO1xuXG5pbXBvcnQgeyBNeUVkaXRvciB9IGZyb20gXCIuLi9lZGl0b3JcIjtcbmltcG9ydCB7IE91dGRlbnRMaXN0IH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvT3V0ZGVudExpc3RcIjtcbmltcG9ydCB7IElNRURldGVjdG9yIH0gZnJvbSBcIi4uL3NlcnZpY2VzL0lNRURldGVjdG9yXCI7XG5pbXBvcnQgeyBPcGVyYXRpb25QZXJmb3JtZXIgfSBmcm9tIFwiLi4vc2VydmljZXMvT3BlcmF0aW9uUGVyZm9ybWVyXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuLi9zZXJ2aWNlcy9TZXR0aW5nc1wiO1xuaW1wb3J0IHsgY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2sgfSBmcm9tIFwiLi4vdXRpbHMvY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2tcIjtcblxuZXhwb3J0IGNsYXNzIFNoaWZ0VGFiQmVoYXZpb3VyT3ZlcnJpZGUgaW1wbGVtZW50cyBGZWF0dXJlIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIGltZURldGVjdG9yOiBJTUVEZXRlY3RvcixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgICBwcml2YXRlIG9wZXJhdGlvblBlcmZvcm1lcjogT3BlcmF0aW9uUGVyZm9ybWVyLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihcbiAgICAgIFByZWMuaGlnaGVzdChcbiAgICAgICAga2V5bWFwLm9mKFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBrZXk6IFwicy1UYWJcIixcbiAgICAgICAgICAgIHJ1bjogY3JlYXRlS2V5bWFwUnVuQ2FsbGJhY2soe1xuICAgICAgICAgICAgICBjaGVjazogdGhpcy5jaGVjayxcbiAgICAgICAgICAgICAgcnVuOiB0aGlzLnJ1bixcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0pLFxuICAgICAgKSxcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge31cblxuICBwcml2YXRlIGNoZWNrID0gKCkgPT4ge1xuICAgIHJldHVybiB0aGlzLnNldHRpbmdzLm92ZXJyaWRlVGFiQmVoYXZpb3VyICYmICF0aGlzLmltZURldGVjdG9yLmlzT3BlbmVkKCk7XG4gIH07XG5cbiAgcHJpdmF0ZSBydW4gPSAoZWRpdG9yOiBNeUVkaXRvcikgPT4ge1xuICAgIHJldHVybiB0aGlzLm9wZXJhdGlvblBlcmZvcm1lci5wZXJmb3JtKFxuICAgICAgKHJvb3QpID0+IG5ldyBPdXRkZW50TGlzdChyb290KSxcbiAgICAgIGVkaXRvcixcbiAgICApO1xuICB9O1xufVxuIiwiaW1wb3J0IHsgQXBwLCBNb2RhbCwgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1NldHRpbmdzXCI7XG5cbmludGVyZmFjZSBBcHBIaWRkZW5Qcm9wcyB7XG4gIGludGVybmFsUGx1Z2luczoge1xuICAgIGNvbmZpZzogeyBba2V5OiBzdHJpbmddOiBib29sZWFuIH07XG4gIH07XG4gIGlzTW9iaWxlOiBib29sZWFuO1xuICBwbHVnaW5zOiB7XG4gICAgZW5hYmxlZFBsdWdpbnM6IFNldDxzdHJpbmc+O1xuICAgIG1hbmlmZXN0czogeyBba2V5OiBzdHJpbmddOiB7IHZlcnNpb246IHN0cmluZyB9IH07XG4gIH07XG4gIHZhdWx0OiB7XG4gICAgY29uZmlnOiBvYmplY3Q7XG4gIH07XG59XG5cbmNsYXNzIFN5c3RlbUluZm9Nb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3MsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gIH1cblxuICBhc3luYyBvbk9wZW4oKSB7XG4gICAgdGhpcy50aXRsZUVsLnNldFRleHQoXCJTeXN0ZW0gSW5mb3JtYXRpb25cIik7XG5cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICAgIGNvbnN0IGFwcCA9IHRoaXMuYXBwIGFzIGFueSBhcyBBcHBIaWRkZW5Qcm9wcztcblxuICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICBwcm9jZXNzOiB7XG4gICAgICAgIGFyY2g6IHByb2Nlc3MuYXJjaCxcbiAgICAgICAgcGxhdGZvcm06IHByb2Nlc3MucGxhdGZvcm0sXG4gICAgICB9LFxuICAgICAgYXBwOiB7XG4gICAgICAgIGludGVybmFsUGx1Z2luczoge1xuICAgICAgICAgIGNvbmZpZzogYXBwLmludGVybmFsUGx1Z2lucy5jb25maWcsXG4gICAgICAgIH0sXG4gICAgICAgIGlzTW9iaWxlOiBhcHAuaXNNb2JpbGUsXG4gICAgICAgIHBsdWdpbnM6IHtcbiAgICAgICAgICBlbmFibGVkUGx1Z2luczogQXJyYXkuZnJvbShhcHAucGx1Z2lucy5lbmFibGVkUGx1Z2lucyksXG4gICAgICAgICAgbWFuaWZlc3RzOiBPYmplY3Qua2V5cyhhcHAucGx1Z2lucy5tYW5pZmVzdHMpLnJlZHVjZShcbiAgICAgICAgICAgIChhY2MsIGtleSkgPT4ge1xuICAgICAgICAgICAgICBhY2Nba2V5XSA9IHtcbiAgICAgICAgICAgICAgICB2ZXJzaW9uOiBhcHAucGx1Z2lucy5tYW5pZmVzdHNba2V5XS52ZXJzaW9uLFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHt9IGFzIHsgW2tleTogc3RyaW5nXTogeyB2ZXJzaW9uOiBzdHJpbmcgfSB9LFxuICAgICAgICAgICksXG4gICAgICAgIH0sXG4gICAgICAgIHZhdWx0OiB7XG4gICAgICAgICAgY29uZmlnOiBhcHAudmF1bHQuY29uZmlnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHBsdWdpbjoge1xuICAgICAgICBzZXR0aW5nczogeyB2YWx1ZXM6IHRoaXMuc2V0dGluZ3MuZ2V0VmFsdWVzKCkgfSxcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIGNvbnN0IHRleHQgPSBKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCAyKTtcblxuICAgIGNvbnN0IHByZSA9IHRoaXMuY29udGVudEVsLmNyZWF0ZUVsKFwicHJlXCIpO1xuICAgIHByZS5zZXRUZXh0KHRleHQpO1xuICAgIHByZS5zZXRDc3NTdHlsZXMoe1xuICAgICAgb3ZlcmZsb3c6IFwic2Nyb2xsXCIsXG4gICAgICBtYXhIZWlnaHQ6IFwiMzAwcHhcIixcbiAgICB9KTtcblxuICAgIGNvbnN0IGJ1dHRvbiA9IHRoaXMuY29udGVudEVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIpO1xuICAgIGJ1dHRvbi5zZXRUZXh0KFwiQ29weSBhbmQgQ2xvc2VcIik7XG4gICAgYnV0dG9uLm9uQ2xpY2tFdmVudCgoKSA9PiB7XG4gICAgICBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChcImBgYGpzb25cXG5cIiArIHRleHQgKyBcIlxcbmBgYFwiKTtcbiAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3lzdGVtSW5mbyBpbXBsZW1lbnRzIEZlYXR1cmUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInN5c3RlbS1pbmZvXCIsXG4gICAgICBuYW1lOiBcIlNob3cgU3lzdGVtIEluZm9cIixcbiAgICAgIGNhbGxiYWNrOiB0aGlzLmNhbGxiYWNrLFxuICAgICAgaG90a2V5czogW1xuICAgICAgICB7XG4gICAgICAgICAgbW9kaWZpZXJzOiBbXCJNb2RcIiwgXCJTaGlmdFwiLCBcIkFsdFwiXSxcbiAgICAgICAgICBrZXk6IFwiSVwiLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG5cbiAgcHJpdmF0ZSBjYWxsYmFjayA9ICgpID0+IHtcbiAgICBjb25zdCBtb2RhbCA9IG5ldyBTeXN0ZW1JbmZvTW9kYWwodGhpcy5wbHVnaW4uYXBwLCB0aGlzLnNldHRpbmdzKTtcbiAgICBtb2RhbC5vcGVuKCk7XG4gIH07XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgUHJlYyB9IGZyb20gXCJAY29kZW1pcnJvci9zdGF0ZVwiO1xuaW1wb3J0IHsga2V5bWFwIH0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcblxuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL0ZlYXR1cmVcIjtcblxuaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBJbmRlbnRMaXN0IH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvSW5kZW50TGlzdFwiO1xuaW1wb3J0IHsgSU1FRGV0ZWN0b3IgfSBmcm9tIFwiLi4vc2VydmljZXMvSU1FRGV0ZWN0b3JcIjtcbmltcG9ydCB7IE9ic2lkaWFuU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvT2JzaWRpYW5TZXR0aW5nc1wiO1xuaW1wb3J0IHsgT3BlcmF0aW9uUGVyZm9ybWVyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcbmltcG9ydCB7IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrIH0gZnJvbSBcIi4uL3V0aWxzL2NyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrXCI7XG5cbmV4cG9ydCBjbGFzcyBUYWJCZWhhdmlvdXJPdmVycmlkZSBpbXBsZW1lbnRzIEZlYXR1cmUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHBsdWdpbjogUGx1Z2luLFxuICAgIHByaXZhdGUgaW1lRGV0ZWN0b3I6IElNRURldGVjdG9yLFxuICAgIHByaXZhdGUgb2JzaWRpYW5TZXR0aW5nczogT2JzaWRpYW5TZXR0aW5ncyxcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgICBwcml2YXRlIG9wZXJhdGlvblBlcmZvcm1lcjogT3BlcmF0aW9uUGVyZm9ybWVyLFxuICApIHt9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihcbiAgICAgIFByZWMuaGlnaGVzdChcbiAgICAgICAga2V5bWFwLm9mKFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBrZXk6IFwiVGFiXCIsXG4gICAgICAgICAgICBydW46IGNyZWF0ZUtleW1hcFJ1bkNhbGxiYWNrKHtcbiAgICAgICAgICAgICAgY2hlY2s6IHRoaXMuY2hlY2ssXG4gICAgICAgICAgICAgIHJ1bjogdGhpcy5ydW4sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICB9LFxuICAgICAgICBdKSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHVubG9hZCgpIHt9XG5cbiAgcHJpdmF0ZSBjaGVjayA9ICgpID0+IHtcbiAgICByZXR1cm4gdGhpcy5zZXR0aW5ncy5vdmVycmlkZVRhYkJlaGF2aW91ciAmJiAhdGhpcy5pbWVEZXRlY3Rvci5pc09wZW5lZCgpO1xuICB9O1xuXG4gIHByaXZhdGUgcnVuID0gKGVkaXRvcjogTXlFZGl0b3IpID0+IHtcbiAgICByZXR1cm4gdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIucGVyZm9ybShcbiAgICAgIChyb290KSA9PlxuICAgICAgICBuZXcgSW5kZW50TGlzdChyb290LCB0aGlzLm9ic2lkaWFuU2V0dGluZ3MuZ2V0RGVmYXVsdEluZGVudENoYXJzKCkpLFxuICAgICAgZWRpdG9yLFxuICAgICk7XG4gIH07XG59XG4iLCJpbXBvcnQgeyBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHtcbiAgRWRpdG9yVmlldyxcbiAgUGx1Z2luVmFsdWUsXG4gIFZpZXdQbHVnaW4sXG4gIFZpZXdVcGRhdGUsXG59IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5cbmltcG9ydCB7IEZlYXR1cmUgfSBmcm9tIFwiLi9GZWF0dXJlXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yLCBnZXRFZGl0b3JGcm9tU3RhdGUgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBMaXN0IH0gZnJvbSBcIi4uL3Jvb3RcIjtcbmltcG9ydCB7IE9ic2lkaWFuU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvT2JzaWRpYW5TZXR0aW5nc1wiO1xuaW1wb3J0IHsgUGFyc2VyIH0gZnJvbSBcIi4uL3NlcnZpY2VzL1BhcnNlclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vc2VydmljZXMvU2V0dGluZ3NcIjtcblxuY29uc3QgVkVSVElDQUxfTElORVNfQk9EWV9DTEFTUyA9IFwib3V0bGluZXItcGx1Z2luLXZlcnRpY2FsLWxpbmVzXCI7XG5cbmludGVyZmFjZSBMaW5lRGF0YSB7XG4gIHRvcDogbnVtYmVyO1xuICBsZWZ0OiBudW1iZXI7XG4gIGhlaWdodDogc3RyaW5nO1xuICBsaXN0OiBMaXN0O1xufVxuXG5jbGFzcyBWZXJ0aWNhbExpbmVzUGx1Z2luVmFsdWUgaW1wbGVtZW50cyBQbHVnaW5WYWx1ZSB7XG4gIHByaXZhdGUgc2NoZWR1bGVkOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PjtcbiAgcHJpdmF0ZSBzY3JvbGxlcjogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgY29udGVudENvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG4gIHByaXZhdGUgZWRpdG9yOiBNeUVkaXRvcjtcbiAgcHJpdmF0ZSBsYXN0TGluZTogbnVtYmVyO1xuICBwcml2YXRlIGxpbmVzOiBMaW5lRGF0YVtdO1xuICBwcml2YXRlIGxpbmVFbGVtZW50czogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzLFxuICAgIHByaXZhdGUgb2JzaWRpYW5TZXR0aW5nczogT2JzaWRpYW5TZXR0aW5ncyxcbiAgICBwcml2YXRlIHBhcnNlcjogUGFyc2VyLFxuICAgIHByaXZhdGUgdmlldzogRWRpdG9yVmlldyxcbiAgKSB7XG4gICAgdGhpcy52aWV3LnNjcm9sbERPTS5hZGRFdmVudExpc3RlbmVyKFwic2Nyb2xsXCIsIHRoaXMub25TY3JvbGwpO1xuICAgIHRoaXMuc2V0dGluZ3Mub25DaGFuZ2UodGhpcy5zY2hlZHVsZVJlY2FsY3VsYXRlKTtcblxuICAgIHRoaXMucHJlcGFyZURvbSgpO1xuICAgIHRoaXMud2FpdEZvckVkaXRvcigpO1xuICB9XG5cbiAgcHJpdmF0ZSB3YWl0Rm9yRWRpdG9yID0gKCkgPT4ge1xuICAgIGNvbnN0IGVkaXRvciA9IGdldEVkaXRvckZyb21TdGF0ZSh0aGlzLnZpZXcuc3RhdGUpO1xuICAgIGlmICghZWRpdG9yKSB7XG4gICAgICBzZXRUaW1lb3V0KHRoaXMud2FpdEZvckVkaXRvciwgMCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuZWRpdG9yID0gZWRpdG9yO1xuICAgIHRoaXMuc2NoZWR1bGVSZWNhbGN1bGF0ZSgpO1xuICB9O1xuXG4gIHByaXZhdGUgcHJlcGFyZURvbSgpIHtcbiAgICB0aGlzLmNvbnRlbnRDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHRoaXMuY29udGVudENvbnRhaW5lci5jbGFzc0xpc3QuYWRkKFxuICAgICAgXCJvdXRsaW5lci1wbHVnaW4tbGlzdC1saW5lcy1jb250ZW50LWNvbnRhaW5lclwiLFxuICAgICk7XG5cbiAgICB0aGlzLnNjcm9sbGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICB0aGlzLnNjcm9sbGVyLmNsYXNzTGlzdC5hZGQoXCJvdXRsaW5lci1wbHVnaW4tbGlzdC1saW5lcy1zY3JvbGxlclwiKTtcblxuICAgIHRoaXMuc2Nyb2xsZXIuYXBwZW5kQ2hpbGQodGhpcy5jb250ZW50Q29udGFpbmVyKTtcbiAgICB0aGlzLnZpZXcuZG9tLmFwcGVuZENoaWxkKHRoaXMuc2Nyb2xsZXIpO1xuICB9XG5cbiAgcHJpdmF0ZSBvblNjcm9sbCA9IChlOiBFdmVudCkgPT4ge1xuICAgIGNvbnN0IHsgc2Nyb2xsTGVmdCwgc2Nyb2xsVG9wIH0gPSBlLnRhcmdldCBhcyBIVE1MRWxlbWVudDtcbiAgICB0aGlzLnNjcm9sbGVyLnNjcm9sbFRvKHNjcm9sbExlZnQsIHNjcm9sbFRvcCk7XG4gIH07XG5cbiAgcHJpdmF0ZSBzY2hlZHVsZVJlY2FsY3VsYXRlID0gKCkgPT4ge1xuICAgIGNsZWFyVGltZW91dCh0aGlzLnNjaGVkdWxlZCk7XG4gICAgdGhpcy5zY2hlZHVsZWQgPSBzZXRUaW1lb3V0KHRoaXMuY2FsY3VsYXRlLCAwKTtcbiAgfTtcblxuICB1cGRhdGUodXBkYXRlOiBWaWV3VXBkYXRlKSB7XG4gICAgaWYgKFxuICAgICAgdXBkYXRlLmRvY0NoYW5nZWQgfHxcbiAgICAgIHVwZGF0ZS52aWV3cG9ydENoYW5nZWQgfHxcbiAgICAgIHVwZGF0ZS5nZW9tZXRyeUNoYW5nZWQgfHxcbiAgICAgIHVwZGF0ZS50cmFuc2FjdGlvbnMuc29tZSgodHIpID0+IHRyLnJlY29uZmlndXJlZClcbiAgICApIHtcbiAgICAgIHRoaXMuc2NoZWR1bGVSZWNhbGN1bGF0ZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY2FsY3VsYXRlID0gKCkgPT4ge1xuICAgIHRoaXMubGluZXMgPSBbXTtcblxuICAgIGlmIChcbiAgICAgIHRoaXMuc2V0dGluZ3MudmVydGljYWxMaW5lcyAmJlxuICAgICAgdGhpcy5vYnNpZGlhblNldHRpbmdzLmlzRGVmYXVsdFRoZW1lRW5hYmxlZCgpICYmXG4gICAgICB0aGlzLnZpZXcudmlld3BvcnRMaW5lQmxvY2tzLmxlbmd0aCA+IDAgJiZcbiAgICAgIHRoaXMudmlldy52aXNpYmxlUmFuZ2VzLmxlbmd0aCA+IDBcbiAgICApIHtcbiAgICAgIGNvbnN0IGZyb21MaW5lID0gdGhpcy5lZGl0b3Iub2Zmc2V0VG9Qb3ModGhpcy52aWV3LnZpZXdwb3J0LmZyb20pLmxpbmU7XG4gICAgICBjb25zdCB0b0xpbmUgPSB0aGlzLmVkaXRvci5vZmZzZXRUb1Bvcyh0aGlzLnZpZXcudmlld3BvcnQudG8pLmxpbmU7XG4gICAgICBjb25zdCBsaXN0cyA9IHRoaXMucGFyc2VyLnBhcnNlUmFuZ2UodGhpcy5lZGl0b3IsIGZyb21MaW5lLCB0b0xpbmUpO1xuXG4gICAgICBmb3IgKGNvbnN0IGxpc3Qgb2YgbGlzdHMpIHtcbiAgICAgICAgdGhpcy5sYXN0TGluZSA9IGxpc3QuZ2V0Q29udGVudEVuZCgpLmxpbmU7XG5cbiAgICAgICAgZm9yIChjb25zdCBjIG9mIGxpc3QuZ2V0Q2hpbGRyZW4oKSkge1xuICAgICAgICAgIHRoaXMucmVjdXJzaXZlKGMpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMubGluZXMuc29ydCgoYSwgYikgPT5cbiAgICAgICAgYS50b3AgPT09IGIudG9wID8gYS5sZWZ0IC0gYi5sZWZ0IDogYS50b3AgLSBiLnRvcCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgdGhpcy51cGRhdGVEb20oKTtcbiAgfTtcblxuICBwcml2YXRlIGdldE5leHRTaWJsaW5nKGxpc3Q6IExpc3QpOiBMaXN0IHwgbnVsbCB7XG4gICAgbGV0IGxpc3RUbXAgPSBsaXN0O1xuICAgIGxldCBwID0gbGlzdFRtcC5nZXRQYXJlbnQoKTtcbiAgICB3aGlsZSAocCkge1xuICAgICAgY29uc3QgbmV4dFNpYmxpbmcgPSBwLmdldE5leHRTaWJsaW5nT2YobGlzdFRtcCk7XG4gICAgICBpZiAobmV4dFNpYmxpbmcpIHtcbiAgICAgICAgcmV0dXJuIG5leHRTaWJsaW5nO1xuICAgICAgfVxuICAgICAgbGlzdFRtcCA9IHA7XG4gICAgICBwID0gbGlzdFRtcC5nZXRQYXJlbnQoKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBwcml2YXRlIHJlY3Vyc2l2ZShsaXN0OiBMaXN0LCBwYXJlbnRDdHg6IHsgcm9vdExlZnQ/OiBudW1iZXIgfSA9IHt9KSB7XG4gICAgY29uc3QgY2hpbGRyZW4gPSBsaXN0LmdldENoaWxkcmVuKCk7XG5cbiAgICBpZiAoY2hpbGRyZW4ubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZnJvbU9mZnNldCA9IHRoaXMuZWRpdG9yLnBvc1RvT2Zmc2V0KHtcbiAgICAgIGxpbmU6IGxpc3QuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZSxcbiAgICAgIGNoOiBsaXN0LmdldEZpcnN0TGluZUluZGVudCgpLmxlbmd0aCxcbiAgICB9KTtcbiAgICBjb25zdCBuZXh0U2libGluZyA9IHRoaXMuZ2V0TmV4dFNpYmxpbmcobGlzdCk7XG4gICAgY29uc3QgdGlsbE9mZnNldCA9IHRoaXMuZWRpdG9yLnBvc1RvT2Zmc2V0KHtcbiAgICAgIGxpbmU6IG5leHRTaWJsaW5nXG4gICAgICAgID8gbmV4dFNpYmxpbmcuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZSAtIDFcbiAgICAgICAgOiB0aGlzLmxhc3RMaW5lLFxuICAgICAgY2g6IDAsXG4gICAgfSk7XG5cbiAgICBsZXQgdmlzaWJsZUZyb20gPSB0aGlzLnZpZXcudmlzaWJsZVJhbmdlc1swXS5mcm9tO1xuICAgIGxldCB2aXNpYmxlVG8gPVxuICAgICAgdGhpcy52aWV3LnZpc2libGVSYW5nZXNbdGhpcy52aWV3LnZpc2libGVSYW5nZXMubGVuZ3RoIC0gMV0udG87XG4gICAgY29uc3Qgem9vbVJhbmdlID0gdGhpcy5lZGl0b3IuZ2V0Wm9vbVJhbmdlKCk7XG4gICAgaWYgKHpvb21SYW5nZSkge1xuICAgICAgdmlzaWJsZUZyb20gPSBNYXRoLm1heChcbiAgICAgICAgdmlzaWJsZUZyb20sXG4gICAgICAgIHRoaXMuZWRpdG9yLnBvc1RvT2Zmc2V0KHpvb21SYW5nZS5mcm9tKSxcbiAgICAgICk7XG4gICAgICB2aXNpYmxlVG8gPSBNYXRoLm1pbih2aXNpYmxlVG8sIHRoaXMuZWRpdG9yLnBvc1RvT2Zmc2V0KHpvb21SYW5nZS50bykpO1xuICAgIH1cblxuICAgIGlmIChmcm9tT2Zmc2V0ID4gdmlzaWJsZVRvIHx8IHRpbGxPZmZzZXQgPCB2aXNpYmxlRnJvbSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGNvb3JkcyA9IHRoaXMudmlldy5jb29yZHNBdFBvcyhmcm9tT2Zmc2V0LCAxKTtcbiAgICBpZiAocGFyZW50Q3R4LnJvb3RMZWZ0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhcmVudEN0eC5yb290TGVmdCA9IGNvb3Jkcy5sZWZ0O1xuICAgIH1cbiAgICBjb25zdCBsZWZ0ID0gTWF0aC5mbG9vcihjb29yZHMucmlnaHQgLSBwYXJlbnRDdHgucm9vdExlZnQpO1xuXG4gICAgY29uc3QgdG9wID1cbiAgICAgIHZpc2libGVGcm9tID4gMCAmJiBmcm9tT2Zmc2V0IDwgdmlzaWJsZUZyb21cbiAgICAgICAgPyAtMjBcbiAgICAgICAgOiB0aGlzLnZpZXcubGluZUJsb2NrQXQoZnJvbU9mZnNldCkudG9wO1xuICAgIGNvbnN0IGJvdHRvbSA9XG4gICAgICB0aWxsT2Zmc2V0ID4gdmlzaWJsZVRvXG4gICAgICAgID8gdGhpcy52aWV3LmxpbmVCbG9ja0F0KHZpc2libGVUbyAtIDEpLmJvdHRvbVxuICAgICAgICA6IHRoaXMudmlldy5saW5lQmxvY2tBdCh0aWxsT2Zmc2V0KS5ib3R0b207XG4gICAgY29uc3QgaGVpZ2h0ID0gYm90dG9tIC0gdG9wO1xuXG4gICAgaWYgKGhlaWdodCA+IDAgJiYgIWxpc3QuaXNGb2xkZWQoKSkge1xuICAgICAgY29uc3QgbmV4dFNpYmxpbmcgPSBsaXN0LmdldFBhcmVudCgpLmdldE5leHRTaWJsaW5nT2YobGlzdCk7XG4gICAgICBjb25zdCBoYXNOZXh0U2libGluZyA9XG4gICAgICAgICEhbmV4dFNpYmxpbmcgJiZcbiAgICAgICAgdGhpcy5lZGl0b3IucG9zVG9PZmZzZXQobmV4dFNpYmxpbmcuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkpIDw9XG4gICAgICAgICAgdmlzaWJsZVRvO1xuXG4gICAgICB0aGlzLmxpbmVzLnB1c2goe1xuICAgICAgICB0b3AsXG4gICAgICAgIGxlZnQsXG4gICAgICAgIGhlaWdodDogYGNhbGMoJHtoZWlnaHR9cHggJHtoYXNOZXh0U2libGluZyA/IFwiLSAxLjVlbVwiIDogXCItIDJlbVwifSlgLFxuICAgICAgICBsaXN0LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBjaGlsZCBvZiBjaGlsZHJlbikge1xuICAgICAgaWYgKCFjaGlsZC5pc0VtcHR5KCkpIHtcbiAgICAgICAgdGhpcy5yZWN1cnNpdmUoY2hpbGQsIHBhcmVudEN0eCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBvbkNsaWNrID0gKGU6IE1vdXNlRXZlbnQpID0+IHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICBjb25zdCBsaW5lID0gdGhpcy5saW5lc1tOdW1iZXIoKGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KS5kYXRhc2V0LmluZGV4KV07XG5cbiAgICBzd2l0Y2ggKHRoaXMuc2V0dGluZ3MudmVydGljYWxMaW5lc0FjdGlvbikge1xuICAgICAgY2FzZSBcInpvb20taW5cIjpcbiAgICAgICAgdGhpcy56b29tSW4obGluZSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlIFwidG9nZ2xlLWZvbGRpbmdcIjpcbiAgICAgICAgdGhpcy50b2dnbGVGb2xkaW5nKGxpbmUpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH07XG5cbiAgcHJpdmF0ZSB6b29tSW4obGluZTogTGluZURhdGEpIHtcbiAgICBjb25zdCBlZGl0b3IgPSBnZXRFZGl0b3JGcm9tU3RhdGUodGhpcy52aWV3LnN0YXRlKTtcblxuICAgIGVkaXRvci56b29tSW4obGluZS5saXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUpO1xuICB9XG5cbiAgcHJpdmF0ZSB0b2dnbGVGb2xkaW5nKGxpbmU6IExpbmVEYXRhKSB7XG4gICAgY29uc3QgeyBsaXN0IH0gPSBsaW5lO1xuXG4gICAgaWYgKGxpc3QuaXNFbXB0eSgpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IG5lZWRUb1VuZm9sZCA9IHRydWU7XG4gICAgY29uc3QgbGluZXNUb1RvZ2dsZTogbnVtYmVyW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IGMgb2YgbGlzdC5nZXRDaGlsZHJlbigpKSB7XG4gICAgICBpZiAoYy5pc0VtcHR5KCkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAoIWMuaXNGb2xkZWQoKSkge1xuICAgICAgICBuZWVkVG9VbmZvbGQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGxpbmVzVG9Ub2dnbGUucHVzaChjLmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUpO1xuICAgIH1cblxuICAgIGNvbnN0IGVkaXRvciA9IGdldEVkaXRvckZyb21TdGF0ZSh0aGlzLnZpZXcuc3RhdGUpO1xuXG4gICAgZm9yIChjb25zdCBsIG9mIGxpbmVzVG9Ub2dnbGUpIHtcbiAgICAgIGlmIChuZWVkVG9VbmZvbGQpIHtcbiAgICAgICAgZWRpdG9yLnVuZm9sZChsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVkaXRvci5mb2xkKGwpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlRG9tKCkge1xuICAgIGNvbnN0IGNtU2Nyb2xsID0gdGhpcy52aWV3LnNjcm9sbERPTTtcbiAgICBjb25zdCBjbUNvbnRlbnQgPSB0aGlzLnZpZXcuY29udGVudERPTTtcbiAgICBjb25zdCBjbUNvbnRlbnRDb250YWluZXIgPSBjbUNvbnRlbnQucGFyZW50RWxlbWVudDtcbiAgICBjb25zdCBjbVNpemVyID0gY21Db250ZW50Q29udGFpbmVyLnBhcmVudEVsZW1lbnQ7XG5cbiAgICAvKipcbiAgICAgKiBPYnNpZGlhbiBjYW4gYWRkIGFkZGl0aW9uYWwgZWxlbWVudHMgaW50byBDb250ZW50IE1hbmFnZXIuXG4gICAgICogVGhlIG1vc3Qgb2J2aW91cyBjYXNlIGlzIHRoZSAnZW1iZWRkZWQtYmFja2xpbmtzJyBjb3JlIHBsdWdpbiB0aGF0IGFkZHMgYSBtZW51IGluc2lkZSBhIENvbnRlbnQgTWFuYWdlci5cbiAgICAgKiBXZSBtdXN0IHRha2UgaGVpZ2h0cyBvZiBhbGwgb2YgdGhlc2UgZWxlbWVudHMgaW50byBhY2NvdW50XG4gICAgICogdG8gYmUgYWJsZSB0byBjYWxjdWxhdGUgdGhlIGNvcnJlY3Qgc2l6ZSBvZiBsaW5lcycgY29udGFpbmVyLlxuICAgICAqL1xuICAgIGxldCBjbVNpemVyQ2hpbGRyZW5TdW1IZWlnaHQgPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY21TaXplci5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgY21TaXplckNoaWxkcmVuU3VtSGVpZ2h0ICs9IGNtU2l6ZXIuY2hpbGRyZW5baV0uY2xpZW50SGVpZ2h0O1xuICAgIH1cblxuICAgIHRoaXMuc2Nyb2xsZXIuc3R5bGUudG9wID0gY21TY3JvbGwub2Zmc2V0VG9wICsgXCJweFwiO1xuICAgIHRoaXMuY29udGVudENvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBjbVNpemVyQ2hpbGRyZW5TdW1IZWlnaHQgKyBcInB4XCI7XG4gICAgdGhpcy5jb250ZW50Q29udGFpbmVyLnN0eWxlLm1hcmdpbkxlZnQgPVxuICAgICAgY21Db250ZW50Q29udGFpbmVyLm9mZnNldExlZnQgKyBcInB4XCI7XG4gICAgdGhpcy5jb250ZW50Q29udGFpbmVyLnN0eWxlLm1hcmdpblRvcCA9XG4gICAgICAoY21Db250ZW50LmZpcnN0RWxlbWVudENoaWxkIGFzIEhUTUxFbGVtZW50KS5vZmZzZXRUb3AgLSAyNCArIFwicHhcIjtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5saW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHRoaXMubGluZUVsZW1lbnRzLmxlbmd0aCA9PT0gaSkge1xuICAgICAgICBjb25zdCBlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgICAgZS5jbGFzc0xpc3QuYWRkKFwib3V0bGluZXItcGx1Z2luLWxpc3QtbGluZVwiKTtcbiAgICAgICAgZS5kYXRhc2V0LmluZGV4ID0gU3RyaW5nKGkpO1xuICAgICAgICBlLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIiwgdGhpcy5vbkNsaWNrKTtcbiAgICAgICAgdGhpcy5jb250ZW50Q29udGFpbmVyLmFwcGVuZENoaWxkKGUpO1xuICAgICAgICB0aGlzLmxpbmVFbGVtZW50cy5wdXNoKGUpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBsID0gdGhpcy5saW5lc1tpXTtcbiAgICAgIGNvbnN0IGUgPSB0aGlzLmxpbmVFbGVtZW50c1tpXTtcbiAgICAgIGUuc3R5bGUudG9wID0gbC50b3AgKyBcInB4XCI7XG4gICAgICBlLnN0eWxlLmxlZnQgPSBsLmxlZnQgKyBcInB4XCI7XG4gICAgICBlLnN0eWxlLmhlaWdodCA9IGwuaGVpZ2h0O1xuICAgICAgZS5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSB0aGlzLmxpbmVzLmxlbmd0aDsgaSA8IHRoaXMubGluZUVsZW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBlID0gdGhpcy5saW5lRWxlbWVudHNbaV07XG4gICAgICBlLnN0eWxlLnRvcCA9IFwiMHB4XCI7XG4gICAgICBlLnN0eWxlLmxlZnQgPSBcIjBweFwiO1xuICAgICAgZS5zdHlsZS5oZWlnaHQgPSBcIjBweFwiO1xuICAgICAgZS5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnNldHRpbmdzLnJlbW92ZUNhbGxiYWNrKHRoaXMuc2NoZWR1bGVSZWNhbGN1bGF0ZSk7XG4gICAgdGhpcy52aWV3LnNjcm9sbERPTS5yZW1vdmVFdmVudExpc3RlbmVyKFwic2Nyb2xsXCIsIHRoaXMub25TY3JvbGwpO1xuICAgIHRoaXMudmlldy5kb20ucmVtb3ZlQ2hpbGQodGhpcy5zY3JvbGxlcik7XG4gICAgY2xlYXJUaW1lb3V0KHRoaXMuc2NoZWR1bGVkKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVmVydGljYWxMaW5lcyBpbXBsZW1lbnRzIEZlYXR1cmUge1xuICBwcml2YXRlIHVwZGF0ZUJvZHlDbGFzc0ludGVydmFsOiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBwbHVnaW46IFBsdWdpbixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgICBwcml2YXRlIG9ic2lkaWFuU2V0dGluZ3M6IE9ic2lkaWFuU2V0dGluZ3MsXG4gICAgcHJpdmF0ZSBwYXJzZXI6IFBhcnNlcixcbiAgKSB7fVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgdGhpcy51cGRhdGVCb2R5Q2xhc3MoKTtcbiAgICB0aGlzLnVwZGF0ZUJvZHlDbGFzc0ludGVydmFsID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgIHRoaXMudXBkYXRlQm9keUNsYXNzKCk7XG4gICAgfSwgMTAwMCk7XG5cbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihcbiAgICAgIFZpZXdQbHVnaW4uZGVmaW5lKFxuICAgICAgICAodmlldykgPT5cbiAgICAgICAgICBuZXcgVmVydGljYWxMaW5lc1BsdWdpblZhbHVlKFxuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgICAgIHRoaXMub2JzaWRpYW5TZXR0aW5ncyxcbiAgICAgICAgICAgIHRoaXMucGFyc2VyLFxuICAgICAgICAgICAgdmlldyxcbiAgICAgICAgICApLFxuICAgICAgKSxcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgdW5sb2FkKCkge1xuICAgIGNsZWFySW50ZXJ2YWwodGhpcy51cGRhdGVCb2R5Q2xhc3NJbnRlcnZhbCk7XG4gICAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKFZFUlRJQ0FMX0xJTkVTX0JPRFlfQ0xBU1MpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVCb2R5Q2xhc3MgPSAoKSA9PiB7XG4gICAgY29uc3Qgc2hvdWxkRXhpc3RzID1cbiAgICAgIHRoaXMub2JzaWRpYW5TZXR0aW5ncy5pc0RlZmF1bHRUaGVtZUVuYWJsZWQoKSAmJlxuICAgICAgdGhpcy5zZXR0aW5ncy52ZXJ0aWNhbExpbmVzO1xuICAgIGNvbnN0IGV4aXN0cyA9IGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmNvbnRhaW5zKFZFUlRJQ0FMX0xJTkVTX0JPRFlfQ0xBU1MpO1xuXG4gICAgaWYgKHNob3VsZEV4aXN0cyAmJiAhZXhpc3RzKSB7XG4gICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5hZGQoVkVSVElDQUxfTElORVNfQk9EWV9DTEFTUyk7XG4gICAgfVxuXG4gICAgaWYgKCFzaG91bGRFeGlzdHMgJiYgZXhpc3RzKSB7XG4gICAgICBkb2N1bWVudC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoVkVSVElDQUxfTElORVNfQk9EWV9DTEFTUyk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgTXlFZGl0b3IgfSBmcm9tIFwiLi4vZWRpdG9yXCI7XG5pbXBvcnQgeyBMaXN0LCBQb3NpdGlvbiwgUm9vdCwgaXNSYW5nZXNJbnRlcnNlY3RzIH0gZnJvbSBcIi4uL3Jvb3RcIjtcblxuZXhwb3J0IGNsYXNzIENoYW5nZXNBcHBsaWNhdG9yIHtcbiAgYXBwbHkoZWRpdG9yOiBNeUVkaXRvciwgcHJldlJvb3Q6IFJvb3QsIG5ld1Jvb3Q6IFJvb3QpIHtcbiAgICBjb25zdCBjaGFuZ2VzID0gdGhpcy5jYWxjdWxhdGVDaGFuZ2VzKGVkaXRvciwgcHJldlJvb3QsIG5ld1Jvb3QpO1xuICAgIGlmIChjaGFuZ2VzKSB7XG4gICAgICBjb25zdCB7IHJlcGxhY2VtZW50LCBjaGFuZ2VGcm9tLCBjaGFuZ2VUbyB9ID0gY2hhbmdlcztcblxuICAgICAgY29uc3QgeyB1bmZvbGQsIGZvbGQgfSA9IHRoaXMuY2FsY3VsYXRlRm9sZGluZ09wcmF0aW9ucyhcbiAgICAgICAgcHJldlJvb3QsXG4gICAgICAgIG5ld1Jvb3QsXG4gICAgICAgIGNoYW5nZUZyb20sXG4gICAgICAgIGNoYW5nZVRvLFxuICAgICAgKTtcblxuICAgICAgZm9yIChjb25zdCBsaW5lIG9mIHVuZm9sZCkge1xuICAgICAgICBlZGl0b3IudW5mb2xkKGxpbmUpO1xuICAgICAgfVxuXG4gICAgICBlZGl0b3IucmVwbGFjZVJhbmdlKHJlcGxhY2VtZW50LCBjaGFuZ2VGcm9tLCBjaGFuZ2VUbyk7XG5cbiAgICAgIGZvciAoY29uc3QgbGluZSBvZiBmb2xkKSB7XG4gICAgICAgIGVkaXRvci5mb2xkKGxpbmUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGVkaXRvci5zZXRTZWxlY3Rpb25zKG5ld1Jvb3QuZ2V0U2VsZWN0aW9ucygpKTtcbiAgfVxuXG4gIHByaXZhdGUgY2FsY3VsYXRlQ2hhbmdlcyhlZGl0b3I6IE15RWRpdG9yLCBwcmV2Um9vdDogUm9vdCwgbmV3Um9vdDogUm9vdCkge1xuICAgIGNvbnN0IHJvb3RSYW5nZSA9IHByZXZSb290LmdldENvbnRlbnRSYW5nZSgpO1xuICAgIGNvbnN0IG9sZFN0cmluZyA9IGVkaXRvci5nZXRSYW5nZShyb290UmFuZ2VbMF0sIHJvb3RSYW5nZVsxXSk7XG4gICAgY29uc3QgbmV3U3RyaW5nID0gbmV3Um9vdC5wcmludCgpO1xuXG4gICAgY29uc3QgY2hhbmdlRnJvbSA9IHsgLi4ucm9vdFJhbmdlWzBdIH07XG4gICAgY29uc3QgY2hhbmdlVG8gPSB7IC4uLnJvb3RSYW5nZVsxXSB9O1xuICAgIGxldCBvbGRUbXAgPSBvbGRTdHJpbmc7XG4gICAgbGV0IG5ld1RtcCA9IG5ld1N0cmluZztcblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBjb25zdCBubEluZGV4ID0gb2xkVG1wLmxhc3RJbmRleE9mKFwiXFxuXCIpO1xuXG4gICAgICBpZiAobmxJbmRleCA8IDApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG9sZExpbmUgPSBvbGRUbXAuc2xpY2UobmxJbmRleCk7XG4gICAgICBjb25zdCBuZXdMaW5lID0gbmV3VG1wLnNsaWNlKC1vbGRMaW5lLmxlbmd0aCk7XG5cbiAgICAgIGlmIChvbGRMaW5lICE9PSBuZXdMaW5lKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBvbGRUbXAgPSBvbGRUbXAuc2xpY2UoMCwgLW9sZExpbmUubGVuZ3RoKTtcbiAgICAgIG5ld1RtcCA9IG5ld1RtcC5zbGljZSgwLCAtb2xkTGluZS5sZW5ndGgpO1xuICAgICAgY29uc3QgbmxJbmRleDIgPSBvbGRUbXAubGFzdEluZGV4T2YoXCJcXG5cIik7XG4gICAgICBjaGFuZ2VUby5jaCA9XG4gICAgICAgIG5sSW5kZXgyID49IDAgPyBvbGRUbXAubGVuZ3RoIC0gbmxJbmRleDIgLSAxIDogb2xkVG1wLmxlbmd0aDtcbiAgICAgIGNoYW5nZVRvLmxpbmUtLTtcbiAgICB9XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3QgbmxJbmRleCA9IG9sZFRtcC5pbmRleE9mKFwiXFxuXCIpO1xuXG4gICAgICBpZiAobmxJbmRleCA8IDApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG9sZExpbmUgPSBvbGRUbXAuc2xpY2UoMCwgbmxJbmRleCArIDEpO1xuICAgICAgY29uc3QgbmV3TGluZSA9IG5ld1RtcC5zbGljZSgwLCBvbGRMaW5lLmxlbmd0aCk7XG5cbiAgICAgIGlmIChvbGRMaW5lICE9PSBuZXdMaW5lKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjaGFuZ2VGcm9tLmxpbmUrKztcbiAgICAgIG9sZFRtcCA9IG9sZFRtcC5zbGljZShvbGRMaW5lLmxlbmd0aCk7XG4gICAgICBuZXdUbXAgPSBuZXdUbXAuc2xpY2Uob2xkTGluZS5sZW5ndGgpO1xuICAgIH1cblxuICAgIGlmIChvbGRUbXAgPT09IG5ld1RtcCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHJlcGxhY2VtZW50OiBuZXdUbXAsXG4gICAgICBjaGFuZ2VGcm9tLFxuICAgICAgY2hhbmdlVG8sXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgY2FsY3VsYXRlRm9sZGluZ09wcmF0aW9ucyhcbiAgICBwcmV2Um9vdDogUm9vdCxcbiAgICBuZXdSb290OiBSb290LFxuICAgIGNoYW5nZUZyb206IFBvc2l0aW9uLFxuICAgIGNoYW5nZVRvOiBQb3NpdGlvbixcbiAgKSB7XG4gICAgY29uc3QgY2hhbmdlZFJhbmdlOiBbUG9zaXRpb24sIFBvc2l0aW9uXSA9IFtjaGFuZ2VGcm9tLCBjaGFuZ2VUb107XG5cbiAgICBjb25zdCBwcmV2TGlzdHMgPSBnZXRBbGxDaGlsZHJlbihwcmV2Um9vdCk7XG4gICAgY29uc3QgbmV3TGlzdHMgPSBnZXRBbGxDaGlsZHJlbihuZXdSb290KTtcblxuICAgIGNvbnN0IHVuZm9sZDogbnVtYmVyW10gPSBbXTtcbiAgICBjb25zdCBmb2xkOiBudW1iZXJbXSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBwcmV2TGlzdCBvZiBwcmV2TGlzdHMudmFsdWVzKCkpIHtcbiAgICAgIGlmICghcHJldkxpc3QuaXNGb2xkUm9vdCgpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBuZXdMaXN0ID0gbmV3TGlzdHMuZ2V0KHByZXZMaXN0LmdldElEKCkpO1xuXG4gICAgICBpZiAoIW5ld0xpc3QpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHByZXZMaXN0UmFuZ2U6IFtQb3NpdGlvbiwgUG9zaXRpb25dID0gW1xuICAgICAgICBwcmV2TGlzdC5nZXRGaXJzdExpbmVDb250ZW50U3RhcnQoKSxcbiAgICAgICAgcHJldkxpc3QuZ2V0Q29udGVudEVuZEluY2x1ZGluZ0NoaWxkcmVuKCksXG4gICAgICBdO1xuXG4gICAgICBpZiAoaXNSYW5nZXNJbnRlcnNlY3RzKHByZXZMaXN0UmFuZ2UsIGNoYW5nZWRSYW5nZSkpIHtcbiAgICAgICAgdW5mb2xkLnB1c2gocHJldkxpc3QuZ2V0Rmlyc3RMaW5lQ29udGVudFN0YXJ0KCkubGluZSk7XG4gICAgICAgIGZvbGQucHVzaChuZXdMaXN0LmdldEZpcnN0TGluZUNvbnRlbnRTdGFydCgpLmxpbmUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHVuZm9sZC5zb3J0KChhLCBiKSA9PiBiIC0gYSk7XG4gICAgZm9sZC5zb3J0KChhLCBiKSA9PiBiIC0gYSk7XG5cbiAgICByZXR1cm4geyB1bmZvbGQsIGZvbGQgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRBbGxDaGlsZHJlblJlZHVjZUZuKGFjYzogTWFwPG51bWJlciwgTGlzdD4sIGNoaWxkOiBMaXN0KSB7XG4gIGFjYy5zZXQoY2hpbGQuZ2V0SUQoKSwgY2hpbGQpO1xuICBjaGlsZC5nZXRDaGlsZHJlbigpLnJlZHVjZShnZXRBbGxDaGlsZHJlblJlZHVjZUZuLCBhY2MpO1xuXG4gIHJldHVybiBhY2M7XG59XG5cbmZ1bmN0aW9uIGdldEFsbENoaWxkcmVuKHJvb3Q6IFJvb3QpOiBNYXA8bnVtYmVyLCBMaXN0PiB7XG4gIHJldHVybiByb290LmdldENoaWxkcmVuKCkucmVkdWNlKGdldEFsbENoaWxkcmVuUmVkdWNlRm4sIG5ldyBNYXAoKSk7XG59XG4iLCJpbXBvcnQgeyBQbGF0Zm9ybSB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5leHBvcnQgY2xhc3MgSU1FRGV0ZWN0b3Ige1xuICBwcml2YXRlIGNvbXBvc2l0aW9uID0gZmFsc2U7XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiY29tcG9zaXRpb25zdGFydFwiLCB0aGlzLm9uQ29tcG9zaXRpb25TdGFydCk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImNvbXBvc2l0aW9uZW5kXCIsIHRoaXMub25Db21wb3NpdGlvbkVuZCk7XG4gIH1cblxuICBhc3luYyB1bmxvYWQoKSB7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImNvbXBvc2l0aW9uZW5kXCIsIHRoaXMub25Db21wb3NpdGlvbkVuZCk7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImNvbXBvc2l0aW9uc3RhcnRcIiwgdGhpcy5vbkNvbXBvc2l0aW9uU3RhcnQpO1xuICB9XG5cbiAgaXNPcGVuZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29tcG9zaXRpb24gJiYgUGxhdGZvcm0uaXNEZXNrdG9wO1xuICB9XG5cbiAgcHJpdmF0ZSBvbkNvbXBvc2l0aW9uU3RhcnQgPSAoKSA9PiB7XG4gICAgdGhpcy5jb21wb3NpdGlvbiA9IHRydWU7XG4gIH07XG5cbiAgcHJpdmF0ZSBvbkNvbXBvc2l0aW9uRW5kID0gKCkgPT4ge1xuICAgIHRoaXMuY29tcG9zaXRpb24gPSBmYWxzZTtcbiAgfTtcbn1cbiIsIi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnkgKi9cbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4vU2V0dGluZ3NcIjtcblxuZXhwb3J0IGNsYXNzIExvZ2dlciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzKSB7fVxuXG4gIGxvZyhtZXRob2Q6IHN0cmluZywgLi4uYXJnczogYW55W10pIHtcbiAgICBpZiAoIXRoaXMuc2V0dGluZ3MuZGVidWcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zb2xlLmluZm8obWV0aG9kLCAuLi5hcmdzKTtcbiAgfVxuXG4gIGJpbmQobWV0aG9kOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gKC4uLmFyZ3M6IGFueVtdKSA9PiB0aGlzLmxvZyhtZXRob2QsIC4uLmFyZ3MpO1xuICB9XG59XG4iLCJpbXBvcnQgeyBBcHAgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuZXhwb3J0IGludGVyZmFjZSBPYnNpZGlhblRhYnNTZXR0aW5ncyB7XG4gIHVzZVRhYjogYm9vbGVhbjtcbiAgdGFiU2l6ZTogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE9ic2lkaWFuRm9sZFNldHRpbmdzIHtcbiAgZm9sZEluZGVudDogYm9vbGVhbjtcbn1cblxuZnVuY3Rpb24gZ2V0SGlkZGVuT2JzaWRpYW5Db25maWcoYXBwOiBBcHApIHtcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgcmV0dXJuIChhcHAudmF1bHQgYXMgYW55KS5jb25maWc7XG59XG5cbmV4cG9ydCBjbGFzcyBPYnNpZGlhblNldHRpbmdzIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBhcHA6IEFwcCkge31cblxuICBpc0xlZ2FjeUVkaXRvckVuYWJsZWQoKSB7XG4gICAgY29uc3QgY29uZmlnOiB7IGxlZ2FjeUVkaXRvcjogYm9vbGVhbiB9ID0ge1xuICAgICAgbGVnYWN5RWRpdG9yOiBmYWxzZSxcbiAgICAgIC4uLmdldEhpZGRlbk9ic2lkaWFuQ29uZmlnKHRoaXMuYXBwKSxcbiAgICB9O1xuXG4gICAgcmV0dXJuIGNvbmZpZy5sZWdhY3lFZGl0b3I7XG4gIH1cblxuICBpc0RlZmF1bHRUaGVtZUVuYWJsZWQoKSB7XG4gICAgY29uc3QgY29uZmlnOiB7IGNzc1RoZW1lOiBzdHJpbmcgfSA9IHtcbiAgICAgIGNzc1RoZW1lOiBcIlwiLFxuICAgICAgLi4uZ2V0SGlkZGVuT2JzaWRpYW5Db25maWcodGhpcy5hcHApLFxuICAgIH07XG5cbiAgICByZXR1cm4gY29uZmlnLmNzc1RoZW1lID09PSBcIlwiO1xuICB9XG5cbiAgZ2V0VGFic1NldHRpbmdzKCk6IE9ic2lkaWFuVGFic1NldHRpbmdzIHtcbiAgICByZXR1cm4ge1xuICAgICAgdXNlVGFiOiB0cnVlLFxuICAgICAgdGFiU2l6ZTogNCxcbiAgICAgIC4uLmdldEhpZGRlbk9ic2lkaWFuQ29uZmlnKHRoaXMuYXBwKSxcbiAgICB9O1xuICB9XG5cbiAgZ2V0Rm9sZFNldHRpbmdzKCk6IE9ic2lkaWFuRm9sZFNldHRpbmdzIHtcbiAgICByZXR1cm4ge1xuICAgICAgZm9sZEluZGVudDogdHJ1ZSxcbiAgICAgIC4uLmdldEhpZGRlbk9ic2lkaWFuQ29uZmlnKHRoaXMuYXBwKSxcbiAgICB9O1xuICB9XG5cbiAgZ2V0RGVmYXVsdEluZGVudENoYXJzKCkge1xuICAgIGNvbnN0IHsgdXNlVGFiLCB0YWJTaXplIH0gPSB0aGlzLmdldFRhYnNTZXR0aW5ncygpO1xuXG4gICAgcmV0dXJuIHVzZVRhYiA/IFwiXFx0XCIgOiBuZXcgQXJyYXkodGFiU2l6ZSkuZmlsbChcIiBcIikuam9pbihcIlwiKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgQ2hhbmdlc0FwcGxpY2F0b3IgfSBmcm9tIFwiLi9DaGFuZ2VzQXBwbGljYXRvclwiO1xuaW1wb3J0IHsgUGFyc2VyIH0gZnJvbSBcIi4vUGFyc2VyXCI7XG5cbmltcG9ydCB7IE15RWRpdG9yIH0gZnJvbSBcIi4uL2VkaXRvclwiO1xuaW1wb3J0IHsgT3BlcmF0aW9uIH0gZnJvbSBcIi4uL29wZXJhdGlvbnMvT3BlcmF0aW9uXCI7XG5pbXBvcnQgeyBSb290IH0gZnJvbSBcIi4uL3Jvb3RcIjtcblxuZXhwb3J0IGNsYXNzIE9wZXJhdGlvblBlcmZvcm1lciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcGFyc2VyOiBQYXJzZXIsXG4gICAgcHJpdmF0ZSBjaGFuZ2VzQXBwbGljYXRvcjogQ2hhbmdlc0FwcGxpY2F0b3IsXG4gICkge31cblxuICBldmFsKHJvb3Q6IFJvb3QsIG9wOiBPcGVyYXRpb24sIGVkaXRvcjogTXlFZGl0b3IpIHtcbiAgICBjb25zdCBwcmV2Um9vdCA9IHJvb3QuY2xvbmUoKTtcblxuICAgIG9wLnBlcmZvcm0oKTtcblxuICAgIGlmIChvcC5zaG91bGRVcGRhdGUoKSkge1xuICAgICAgdGhpcy5jaGFuZ2VzQXBwbGljYXRvci5hcHBseShlZGl0b3IsIHByZXZSb290LCByb290KTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgc2hvdWxkVXBkYXRlOiBvcC5zaG91bGRVcGRhdGUoKSxcbiAgICAgIHNob3VsZFN0b3BQcm9wYWdhdGlvbjogb3Auc2hvdWxkU3RvcFByb3BhZ2F0aW9uKCksXG4gICAgfTtcbiAgfVxuXG4gIHBlcmZvcm0oXG4gICAgY2I6IChyb290OiBSb290KSA9PiBPcGVyYXRpb24sXG4gICAgZWRpdG9yOiBNeUVkaXRvcixcbiAgICBjdXJzb3IgPSBlZGl0b3IuZ2V0Q3Vyc29yKCksXG4gICkge1xuICAgIGNvbnN0IHJvb3QgPSB0aGlzLnBhcnNlci5wYXJzZShlZGl0b3IsIGN1cnNvcik7XG5cbiAgICBpZiAoIXJvb3QpIHtcbiAgICAgIHJldHVybiB7IHNob3VsZFVwZGF0ZTogZmFsc2UsIHNob3VsZFN0b3BQcm9wYWdhdGlvbjogZmFsc2UgfTtcbiAgICB9XG5cbiAgICBjb25zdCBvcCA9IGNiKHJvb3QpO1xuXG4gICAgcmV0dXJuIHRoaXMuZXZhbChyb290LCBvcCwgZWRpdG9yKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSBcIi4vTG9nZ2VyXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuL1NldHRpbmdzXCI7XG5cbmltcG9ydCB7IExpc3QsIFJvb3QgfSBmcm9tIFwiLi4vcm9vdFwiO1xuaW1wb3J0IHsgY2hlY2tib3hSZSB9IGZyb20gXCIuLi91dGlscy9jaGVja2JveFJlXCI7XG5cbmNvbnN0IGJ1bGxldFNpZ25SZSA9IGAoPzpbLSorXXxcXFxcZCtcXFxcLilgO1xuY29uc3Qgb3B0aW9uYWxDaGVja2JveFJlID0gYCg/OiR7Y2hlY2tib3hSZX0pP2A7XG5cbmNvbnN0IGxpc3RJdGVtV2l0aG91dFNwYWNlc1JlID0gbmV3IFJlZ0V4cChgXiR7YnVsbGV0U2lnblJlfSggfFxcdClgKTtcbmNvbnN0IGxpc3RJdGVtUmUgPSBuZXcgUmVnRXhwKGBeWyBcXHRdKiR7YnVsbGV0U2lnblJlfSggfFxcdClgKTtcbmNvbnN0IHN0cmluZ1dpdGhTcGFjZXNSZSA9IG5ldyBSZWdFeHAoYF5bIFxcdF0rYCk7XG5jb25zdCBwYXJzZUxpc3RJdGVtUmUgPSBuZXcgUmVnRXhwKFxuICBgXihbIFxcdF0qKSgke2J1bGxldFNpZ25SZX0pKCB8XFx0KSgke29wdGlvbmFsQ2hlY2tib3hSZX0pKC4qKSRgLFxuKTtcblxuZXhwb3J0IGludGVyZmFjZSBSZWFkZXJQb3NpdGlvbiB7XG4gIGxpbmU6IG51bWJlcjtcbiAgY2g6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZWFkZXJTZWxlY3Rpb24ge1xuICBhbmNob3I6IFJlYWRlclBvc2l0aW9uO1xuICBoZWFkOiBSZWFkZXJQb3NpdGlvbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZWFkZXIge1xuICBnZXRDdXJzb3IoKTogUmVhZGVyUG9zaXRpb247XG4gIGdldExpbmUobjogbnVtYmVyKTogc3RyaW5nO1xuICBsYXN0TGluZSgpOiBudW1iZXI7XG4gIGxpc3RTZWxlY3Rpb25zKCk6IFJlYWRlclNlbGVjdGlvbltdO1xuICBnZXRBbGxGb2xkZWRMaW5lcygpOiBudW1iZXJbXTtcbn1cblxuaW50ZXJmYWNlIFBhcnNlTGlzdExpc3Qge1xuICBnZXRGaXJzdExpbmVJbmRlbnQoKTogc3RyaW5nO1xuICBzZXROb3Rlc0luZGVudChub3Rlc0luZGVudDogc3RyaW5nKTogdm9pZDtcbiAgZ2V0Tm90ZXNJbmRlbnQoKTogc3RyaW5nIHwgbnVsbDtcbiAgYWRkTGluZSh0ZXh0OiBzdHJpbmcpOiB2b2lkO1xuICBnZXRQYXJlbnQoKTogUGFyc2VMaXN0TGlzdCB8IG51bGw7XG4gIGFkZEFmdGVyQWxsKGxpc3Q6IFBhcnNlTGlzdExpc3QpOiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgUGFyc2VyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBsb2dnZXI6IExvZ2dlcixcbiAgICBwcml2YXRlIHNldHRpbmdzOiBTZXR0aW5ncyxcbiAgKSB7fVxuXG4gIHBhcnNlUmFuZ2UoZWRpdG9yOiBSZWFkZXIsIGZyb21MaW5lID0gMCwgdG9MaW5lID0gZWRpdG9yLmxhc3RMaW5lKCkpOiBSb290W10ge1xuICAgIGNvbnN0IGxpc3RzOiBSb290W10gPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSBmcm9tTGluZTsgaSA8PSB0b0xpbmU7IGkrKykge1xuICAgICAgY29uc3QgbGluZSA9IGVkaXRvci5nZXRMaW5lKGkpO1xuXG4gICAgICBpZiAoaSA9PT0gZnJvbUxpbmUgfHwgdGhpcy5pc0xpc3RJdGVtKGxpbmUpKSB7XG4gICAgICAgIGNvbnN0IGxpc3QgPSB0aGlzLnBhcnNlV2l0aExpbWl0cyhlZGl0b3IsIGksIGZyb21MaW5lLCB0b0xpbmUpO1xuXG4gICAgICAgIGlmIChsaXN0KSB7XG4gICAgICAgICAgbGlzdHMucHVzaChsaXN0KTtcbiAgICAgICAgICBpID0gbGlzdC5nZXRDb250ZW50RW5kKCkubGluZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBsaXN0cztcbiAgfVxuXG4gIHBhcnNlKGVkaXRvcjogUmVhZGVyLCBjdXJzb3IgPSBlZGl0b3IuZ2V0Q3Vyc29yKCkpOiBSb290IHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMucGFyc2VXaXRoTGltaXRzKGVkaXRvciwgY3Vyc29yLmxpbmUsIDAsIGVkaXRvci5sYXN0TGluZSgpKTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VXaXRoTGltaXRzKFxuICAgIGVkaXRvcjogUmVhZGVyLFxuICAgIHBhcnNpbmdTdGFydExpbmU6IG51bWJlcixcbiAgICBsaW1pdEZyb206IG51bWJlcixcbiAgICBsaW1pdFRvOiBudW1iZXIsXG4gICk6IFJvb3QgfCBudWxsIHtcbiAgICBjb25zdCBkID0gdGhpcy5sb2dnZXIuYmluZChcInBhcnNlTGlzdFwiKTtcbiAgICBjb25zdCBlcnJvciA9IChtc2c6IHN0cmluZyk6IG51bGwgPT4ge1xuICAgICAgZChtc2cpO1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfTtcblxuICAgIGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0TGluZShwYXJzaW5nU3RhcnRMaW5lKTtcblxuICAgIGxldCBsaXN0TG9va2luZ1BvczogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgICBpZiAodGhpcy5pc0xpc3RJdGVtKGxpbmUpKSB7XG4gICAgICBsaXN0TG9va2luZ1BvcyA9IHBhcnNpbmdTdGFydExpbmU7XG4gICAgfSBlbHNlIGlmICh0aGlzLmlzTGluZVdpdGhJbmRlbnQobGluZSkpIHtcbiAgICAgIGxldCBsaXN0TG9va2luZ1Bvc1NlYXJjaCA9IHBhcnNpbmdTdGFydExpbmUgLSAxO1xuICAgICAgd2hpbGUgKGxpc3RMb29raW5nUG9zU2VhcmNoID49IDApIHtcbiAgICAgICAgY29uc3QgbGluZSA9IGVkaXRvci5nZXRMaW5lKGxpc3RMb29raW5nUG9zU2VhcmNoKTtcbiAgICAgICAgaWYgKHRoaXMuaXNMaXN0SXRlbShsaW5lKSkge1xuICAgICAgICAgIGxpc3RMb29raW5nUG9zID0gbGlzdExvb2tpbmdQb3NTZWFyY2g7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5pc0xpbmVXaXRoSW5kZW50KGxpbmUpKSB7XG4gICAgICAgICAgbGlzdExvb2tpbmdQb3NTZWFyY2gtLTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChsaXN0TG9va2luZ1BvcyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgbGV0IGxpc3RTdGFydExpbmU6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICAgIGxldCBsaXN0U3RhcnRMaW5lTG9va3VwID0gbGlzdExvb2tpbmdQb3M7XG4gICAgd2hpbGUgKGxpc3RTdGFydExpbmVMb29rdXAgPj0gMCkge1xuICAgICAgY29uc3QgbGluZSA9IGVkaXRvci5nZXRMaW5lKGxpc3RTdGFydExpbmVMb29rdXApO1xuICAgICAgaWYgKCF0aGlzLmlzTGlzdEl0ZW0obGluZSkgJiYgIXRoaXMuaXNMaW5lV2l0aEluZGVudChsaW5lKSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmlzTGlzdEl0ZW1XaXRob3V0U3BhY2VzKGxpbmUpKSB7XG4gICAgICAgIGxpc3RTdGFydExpbmUgPSBsaXN0U3RhcnRMaW5lTG9va3VwO1xuICAgICAgICBpZiAobGlzdFN0YXJ0TGluZUxvb2t1cCA8PSBsaW1pdEZyb20pIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGlzdFN0YXJ0TGluZUxvb2t1cC0tO1xuICAgIH1cblxuICAgIGlmIChsaXN0U3RhcnRMaW5lID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBsZXQgbGlzdEVuZExpbmUgPSBsaXN0TG9va2luZ1BvcztcbiAgICBsZXQgbGlzdEVuZExpbmVMb29rdXAgPSBsaXN0TG9va2luZ1BvcztcbiAgICB3aGlsZSAobGlzdEVuZExpbmVMb29rdXAgPD0gZWRpdG9yLmxhc3RMaW5lKCkpIHtcbiAgICAgIGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0TGluZShsaXN0RW5kTGluZUxvb2t1cCk7XG4gICAgICBpZiAoIXRoaXMuaXNMaXN0SXRlbShsaW5lKSAmJiAhdGhpcy5pc0xpbmVXaXRoSW5kZW50KGxpbmUpKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLmlzRW1wdHlMaW5lKGxpbmUpKSB7XG4gICAgICAgIGxpc3RFbmRMaW5lID0gbGlzdEVuZExpbmVMb29rdXA7XG4gICAgICB9XG4gICAgICBpZiAobGlzdEVuZExpbmVMb29rdXAgPj0gbGltaXRUbykge1xuICAgICAgICBsaXN0RW5kTGluZSA9IGxpbWl0VG87XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgbGlzdEVuZExpbmVMb29rdXArKztcbiAgICB9XG5cbiAgICBpZiAobGlzdFN0YXJ0TGluZSA+IHBhcnNpbmdTdGFydExpbmUgfHwgbGlzdEVuZExpbmUgPCBwYXJzaW5nU3RhcnRMaW5lKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBpZiB0aGUgbGFzdCBsaW5lIGNvbnRhaW5zIG9ubHkgc3BhY2VzIGFuZCB0aGF0J3MgaW5jb3JyZWN0IGluZGVudCwgdGhlbiBpZ25vcmUgdGhlIGxhc3QgbGluZVxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS92c2xpbmtvL29ic2lkaWFuLW91dGxpbmVyL2lzc3Vlcy8zNjhcbiAgICBpZiAobGlzdEVuZExpbmUgPiBsaXN0U3RhcnRMaW5lKSB7XG4gICAgICBjb25zdCBsYXN0TGluZSA9IGVkaXRvci5nZXRMaW5lKGxpc3RFbmRMaW5lKTtcbiAgICAgIGlmIChsYXN0TGluZS50cmltKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnN0IHByZXZMaW5lID0gZWRpdG9yLmdldExpbmUobGlzdEVuZExpbmUgLSAxKTtcbiAgICAgICAgY29uc3QgWywgcHJldkxpbmVJbmRlbnRdID0gL14oXFxzKikvLmV4ZWMocHJldkxpbmUpO1xuICAgICAgICBpZiAoIWxhc3RMaW5lLnN0YXJ0c1dpdGgocHJldkxpbmVJbmRlbnQpKSB7XG4gICAgICAgICAgbGlzdEVuZExpbmUtLTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHJvb3QgPSBuZXcgUm9vdChcbiAgICAgIHsgbGluZTogbGlzdFN0YXJ0TGluZSwgY2g6IDAgfSxcbiAgICAgIHsgbGluZTogbGlzdEVuZExpbmUsIGNoOiBlZGl0b3IuZ2V0TGluZShsaXN0RW5kTGluZSkubGVuZ3RoIH0sXG4gICAgICBlZGl0b3IubGlzdFNlbGVjdGlvbnMoKS5tYXAoKHIpID0+ICh7XG4gICAgICAgIGFuY2hvcjogeyBsaW5lOiByLmFuY2hvci5saW5lLCBjaDogci5hbmNob3IuY2ggfSxcbiAgICAgICAgaGVhZDogeyBsaW5lOiByLmhlYWQubGluZSwgY2g6IHIuaGVhZC5jaCB9LFxuICAgICAgfSkpLFxuICAgICk7XG5cbiAgICBsZXQgY3VycmVudFBhcmVudDogUGFyc2VMaXN0TGlzdCA9IHJvb3QuZ2V0Um9vdExpc3QoKTtcbiAgICBsZXQgY3VycmVudExpc3Q6IFBhcnNlTGlzdExpc3QgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgY3VycmVudEluZGVudCA9IFwiXCI7XG5cbiAgICBjb25zdCBmb2xkZWRMaW5lcyA9IGVkaXRvci5nZXRBbGxGb2xkZWRMaW5lcygpO1xuXG4gICAgZm9yIChsZXQgbCA9IGxpc3RTdGFydExpbmU7IGwgPD0gbGlzdEVuZExpbmU7IGwrKykge1xuICAgICAgY29uc3QgbGluZSA9IGVkaXRvci5nZXRMaW5lKGwpO1xuICAgICAgY29uc3QgbWF0Y2hlcyA9IHBhcnNlTGlzdEl0ZW1SZS5leGVjKGxpbmUpO1xuXG4gICAgICBpZiAobWF0Y2hlcykge1xuICAgICAgICBjb25zdCBbLCBpbmRlbnQsIGJ1bGxldCwgc3BhY2VBZnRlckJ1bGxldF0gPSBtYXRjaGVzO1xuICAgICAgICBsZXQgWywgLCAsICwgb3B0aW9uYWxDaGVja2JveCwgY29udGVudF0gPSBtYXRjaGVzO1xuXG4gICAgICAgIGNvbnRlbnQgPSBvcHRpb25hbENoZWNrYm94ICsgY29udGVudDtcbiAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3Mua2VlcEN1cnNvcldpdGhpbkNvbnRlbnQgIT09IFwiYnVsbGV0LWFuZC1jaGVja2JveFwiKSB7XG4gICAgICAgICAgb3B0aW9uYWxDaGVja2JveCA9IFwiXCI7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb21wYXJlTGVuZ3RoID0gTWF0aC5taW4oY3VycmVudEluZGVudC5sZW5ndGgsIGluZGVudC5sZW5ndGgpO1xuICAgICAgICBjb25zdCBpbmRlbnRTbGljZSA9IGluZGVudC5zbGljZSgwLCBjb21wYXJlTGVuZ3RoKTtcbiAgICAgICAgY29uc3QgY3VycmVudEluZGVudFNsaWNlID0gY3VycmVudEluZGVudC5zbGljZSgwLCBjb21wYXJlTGVuZ3RoKTtcblxuICAgICAgICBpZiAoaW5kZW50U2xpY2UgIT09IGN1cnJlbnRJbmRlbnRTbGljZSkge1xuICAgICAgICAgIGNvbnN0IGV4cGVjdGVkID0gY3VycmVudEluZGVudFNsaWNlXG4gICAgICAgICAgICAucmVwbGFjZSgvIC9nLCBcIlNcIilcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHQvZywgXCJUXCIpO1xuICAgICAgICAgIGNvbnN0IGdvdCA9IGluZGVudFNsaWNlLnJlcGxhY2UoLyAvZywgXCJTXCIpLnJlcGxhY2UoL1xcdC9nLCBcIlRcIik7XG5cbiAgICAgICAgICByZXR1cm4gZXJyb3IoXG4gICAgICAgICAgICBgVW5hYmxlIHRvIHBhcnNlIGxpc3Q6IGV4cGVjdGVkIGluZGVudCBcIiR7ZXhwZWN0ZWR9XCIsIGdvdCBcIiR7Z290fVwiYCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluZGVudC5sZW5ndGggPiBjdXJyZW50SW5kZW50Lmxlbmd0aCkge1xuICAgICAgICAgIGN1cnJlbnRQYXJlbnQgPSBjdXJyZW50TGlzdDtcbiAgICAgICAgICBjdXJyZW50SW5kZW50ID0gaW5kZW50O1xuICAgICAgICB9IGVsc2UgaWYgKGluZGVudC5sZW5ndGggPCBjdXJyZW50SW5kZW50Lmxlbmd0aCkge1xuICAgICAgICAgIHdoaWxlIChcbiAgICAgICAgICAgIGN1cnJlbnRQYXJlbnQuZ2V0Rmlyc3RMaW5lSW5kZW50KCkubGVuZ3RoID49IGluZGVudC5sZW5ndGggJiZcbiAgICAgICAgICAgIGN1cnJlbnRQYXJlbnQuZ2V0UGFyZW50KClcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIGN1cnJlbnRQYXJlbnQgPSBjdXJyZW50UGFyZW50LmdldFBhcmVudCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjdXJyZW50SW5kZW50ID0gaW5kZW50O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZm9sZFJvb3QgPSBmb2xkZWRMaW5lcy5pbmNsdWRlcyhsKTtcblxuICAgICAgICBjdXJyZW50TGlzdCA9IG5ldyBMaXN0KFxuICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgaW5kZW50LFxuICAgICAgICAgIGJ1bGxldCxcbiAgICAgICAgICBvcHRpb25hbENoZWNrYm94LFxuICAgICAgICAgIHNwYWNlQWZ0ZXJCdWxsZXQsXG4gICAgICAgICAgY29udGVudCxcbiAgICAgICAgICBmb2xkUm9vdCxcbiAgICAgICAgKTtcbiAgICAgICAgY3VycmVudFBhcmVudC5hZGRBZnRlckFsbChjdXJyZW50TGlzdCk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaXNMaW5lV2l0aEluZGVudChsaW5lKSkge1xuICAgICAgICBpZiAoIWN1cnJlbnRMaXN0KSB7XG4gICAgICAgICAgcmV0dXJuIGVycm9yKFxuICAgICAgICAgICAgYFVuYWJsZSB0byBwYXJzZSBsaXN0OiBleHBlY3RlZCBsaXN0IGl0ZW0sIGdvdCBlbXB0eSBsaW5lYCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW5kZW50VG9DaGVjayA9IGN1cnJlbnRMaXN0LmdldE5vdGVzSW5kZW50KCkgfHwgY3VycmVudEluZGVudDtcblxuICAgICAgICBpZiAobGluZS5pbmRleE9mKGluZGVudFRvQ2hlY2spICE9PSAwKSB7XG4gICAgICAgICAgY29uc3QgZXhwZWN0ZWQgPSBpbmRlbnRUb0NoZWNrLnJlcGxhY2UoLyAvZywgXCJTXCIpLnJlcGxhY2UoL1xcdC9nLCBcIlRcIik7XG4gICAgICAgICAgY29uc3QgZ290ID0gbGluZVxuICAgICAgICAgICAgLm1hdGNoKC9eWyBcXHRdKi8pWzBdXG4gICAgICAgICAgICAucmVwbGFjZSgvIC9nLCBcIlNcIilcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHQvZywgXCJUXCIpO1xuXG4gICAgICAgICAgcmV0dXJuIGVycm9yKFxuICAgICAgICAgICAgYFVuYWJsZSB0byBwYXJzZSBsaXN0OiBleHBlY3RlZCBpbmRlbnQgXCIke2V4cGVjdGVkfVwiLCBnb3QgXCIke2dvdH1cImAsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghY3VycmVudExpc3QuZ2V0Tm90ZXNJbmRlbnQoKSkge1xuICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSBsaW5lLm1hdGNoKC9eWyBcXHRdKy8pO1xuXG4gICAgICAgICAgaWYgKCFtYXRjaGVzIHx8IG1hdGNoZXNbMF0ubGVuZ3RoIDw9IGN1cnJlbnRJbmRlbnQubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAoL15cXHMrJC8udGVzdChsaW5lKSkge1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGVycm9yKFxuICAgICAgICAgICAgICBgVW5hYmxlIHRvIHBhcnNlIGxpc3Q6IGV4cGVjdGVkIHNvbWUgaW5kZW50LCBnb3Qgbm8gaW5kZW50YCxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY3VycmVudExpc3Quc2V0Tm90ZXNJbmRlbnQobWF0Y2hlc1swXSk7XG4gICAgICAgIH1cblxuICAgICAgICBjdXJyZW50TGlzdC5hZGRMaW5lKGxpbmUuc2xpY2UoY3VycmVudExpc3QuZ2V0Tm90ZXNJbmRlbnQoKS5sZW5ndGgpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBlcnJvcihcbiAgICAgICAgICBgVW5hYmxlIHRvIHBhcnNlIGxpc3Q6IGV4cGVjdGVkIGxpc3QgaXRlbSBvciBub3RlLCBnb3QgXCIke2xpbmV9XCJgLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByb290O1xuICB9XG5cbiAgcHJpdmF0ZSBpc0VtcHR5TGluZShsaW5lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbGluZS5sZW5ndGggPT09IDA7XG4gIH1cblxuICBwcml2YXRlIGlzTGluZVdpdGhJbmRlbnQobGluZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZ1dpdGhTcGFjZXNSZS50ZXN0KGxpbmUpO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0xpc3RJdGVtKGxpbmU6IHN0cmluZykge1xuICAgIHJldHVybiBsaXN0SXRlbVJlLnRlc3QobGluZSk7XG4gIH1cblxuICBwcml2YXRlIGlzTGlzdEl0ZW1XaXRob3V0U3BhY2VzKGxpbmU6IHN0cmluZykge1xuICAgIHJldHVybiBsaXN0SXRlbVdpdGhvdXRTcGFjZXNSZS50ZXN0KGxpbmUpO1xuICB9XG59XG4iLCJleHBvcnQgdHlwZSBWZXJ0aWNhbExpbmVzQWN0aW9uID0gXCJub25lXCIgfCBcInpvb20taW5cIiB8IFwidG9nZ2xlLWZvbGRpbmdcIjtcbmV4cG9ydCB0eXBlIEtlZXBDdXJzb3JXaXRoaW5Db250ZW50ID1cbiAgfCBcIm5ldmVyXCJcbiAgfCBcImJ1bGxldC1vbmx5XCJcbiAgfCBcImJ1bGxldC1hbmQtY2hlY2tib3hcIjtcblxuaW50ZXJmYWNlIFNldHRpbmdzT2JqZWN0IHtcbiAgc3R5bGVMaXN0czogYm9vbGVhbjtcbiAgZGVidWc6IGJvb2xlYW47XG4gIHN0aWNrQ3Vyc29yOiBLZWVwQ3Vyc29yV2l0aGluQ29udGVudCB8IGJvb2xlYW47XG4gIGJldHRlckVudGVyOiBib29sZWFuO1xuICBiZXR0ZXJUYWI6IGJvb2xlYW47XG4gIHNlbGVjdEFsbDogYm9vbGVhbjtcbiAgbGlzdExpbmVzOiBib29sZWFuO1xuICBsaXN0TGluZUFjdGlvbjogVmVydGljYWxMaW5lc0FjdGlvbjtcbiAgZG5kOiBib29sZWFuO1xuICBwcmV2aW91c1JlbGVhc2U6IHN0cmluZyB8IG51bGw7XG59XG5cbmNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFNldHRpbmdzT2JqZWN0ID0ge1xuICBzdHlsZUxpc3RzOiB0cnVlLFxuICBkZWJ1ZzogZmFsc2UsXG4gIHN0aWNrQ3Vyc29yOiBcImJ1bGxldC1hbmQtY2hlY2tib3hcIixcbiAgYmV0dGVyRW50ZXI6IHRydWUsXG4gIGJldHRlclRhYjogdHJ1ZSxcbiAgc2VsZWN0QWxsOiB0cnVlLFxuICBsaXN0TGluZXM6IGZhbHNlLFxuICBsaXN0TGluZUFjdGlvbjogXCJ0b2dnbGUtZm9sZGluZ1wiLFxuICBkbmQ6IHRydWUsXG4gIHByZXZpb3VzUmVsZWFzZTogbnVsbCxcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3RvcmFnZSB7XG4gIGxvYWREYXRhKCk6IFByb21pc2U8U2V0dGluZ3NPYmplY3Q+O1xuICBzYXZlRGF0YShzZXR0aW5nczogU2V0dGluZ3NPYmplY3QpOiBQcm9taXNlPHZvaWQ+O1xufVxuXG50eXBlIENhbGxiYWNrID0gKCkgPT4gdm9pZDtcblxuZXhwb3J0IGNsYXNzIFNldHRpbmdzIHtcbiAgcHJpdmF0ZSBzdG9yYWdlOiBTdG9yYWdlO1xuICBwcml2YXRlIHZhbHVlczogU2V0dGluZ3NPYmplY3Q7XG4gIHByaXZhdGUgY2FsbGJhY2tzOiBTZXQ8Q2FsbGJhY2s+O1xuXG4gIGNvbnN0cnVjdG9yKHN0b3JhZ2U6IFN0b3JhZ2UpIHtcbiAgICB0aGlzLnN0b3JhZ2UgPSBzdG9yYWdlO1xuICAgIHRoaXMuY2FsbGJhY2tzID0gbmV3IFNldCgpO1xuICB9XG5cbiAgZ2V0IGtlZXBDdXJzb3JXaXRoaW5Db250ZW50KCkge1xuICAgIC8vIEFkYXB0b3IgZm9yIHVzZXJzIG1pZ3JhdGluZyBmcm9tIG9sZGVyIHZlcnNpb24gb2YgdGhlIHBsdWdpbi5cbiAgICBpZiAodGhpcy52YWx1ZXMuc3RpY2tDdXJzb3IgPT09IHRydWUpIHtcbiAgICAgIHJldHVybiBcImJ1bGxldC1hbmQtY2hlY2tib3hcIjtcbiAgICB9IGVsc2UgaWYgKHRoaXMudmFsdWVzLnN0aWNrQ3Vyc29yID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuIFwibmV2ZXJcIjtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy52YWx1ZXMuc3RpY2tDdXJzb3I7XG4gIH1cblxuICBzZXQga2VlcEN1cnNvcldpdGhpbkNvbnRlbnQodmFsdWU6IEtlZXBDdXJzb3JXaXRoaW5Db250ZW50KSB7XG4gICAgdGhpcy5zZXQoXCJzdGlja0N1cnNvclwiLCB2YWx1ZSk7XG4gIH1cblxuICBnZXQgb3ZlcnJpZGVUYWJCZWhhdmlvdXIoKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVzLmJldHRlclRhYjtcbiAgfVxuXG4gIHNldCBvdmVycmlkZVRhYkJlaGF2aW91cih2YWx1ZTogYm9vbGVhbikge1xuICAgIHRoaXMuc2V0KFwiYmV0dGVyVGFiXCIsIHZhbHVlKTtcbiAgfVxuXG4gIGdldCBvdmVycmlkZUVudGVyQmVoYXZpb3VyKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcy5iZXR0ZXJFbnRlcjtcbiAgfVxuXG4gIHNldCBvdmVycmlkZUVudGVyQmVoYXZpb3VyKHZhbHVlOiBib29sZWFuKSB7XG4gICAgdGhpcy5zZXQoXCJiZXR0ZXJFbnRlclwiLCB2YWx1ZSk7XG4gIH1cblxuICBnZXQgb3ZlcnJpZGVTZWxlY3RBbGxCZWhhdmlvdXIoKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVzLnNlbGVjdEFsbDtcbiAgfVxuXG4gIHNldCBvdmVycmlkZVNlbGVjdEFsbEJlaGF2aW91cih2YWx1ZTogYm9vbGVhbikge1xuICAgIHRoaXMuc2V0KFwic2VsZWN0QWxsXCIsIHZhbHVlKTtcbiAgfVxuXG4gIGdldCBiZXR0ZXJMaXN0c1N0eWxlcygpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMuc3R5bGVMaXN0cztcbiAgfVxuXG4gIHNldCBiZXR0ZXJMaXN0c1N0eWxlcyh2YWx1ZTogYm9vbGVhbikge1xuICAgIHRoaXMuc2V0KFwic3R5bGVMaXN0c1wiLCB2YWx1ZSk7XG4gIH1cblxuICBnZXQgdmVydGljYWxMaW5lcygpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMubGlzdExpbmVzO1xuICB9XG5cbiAgc2V0IHZlcnRpY2FsTGluZXModmFsdWU6IGJvb2xlYW4pIHtcbiAgICB0aGlzLnNldChcImxpc3RMaW5lc1wiLCB2YWx1ZSk7XG4gIH1cblxuICBnZXQgdmVydGljYWxMaW5lc0FjdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZXMubGlzdExpbmVBY3Rpb247XG4gIH1cblxuICBzZXQgdmVydGljYWxMaW5lc0FjdGlvbih2YWx1ZTogVmVydGljYWxMaW5lc0FjdGlvbikge1xuICAgIHRoaXMuc2V0KFwibGlzdExpbmVBY3Rpb25cIiwgdmFsdWUpO1xuICB9XG5cbiAgZ2V0IGRyYWdBbmREcm9wKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcy5kbmQ7XG4gIH1cblxuICBzZXQgZHJhZ0FuZERyb3AodmFsdWU6IGJvb2xlYW4pIHtcbiAgICB0aGlzLnNldChcImRuZFwiLCB2YWx1ZSk7XG4gIH1cblxuICBnZXQgZGVidWcoKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVzLmRlYnVnO1xuICB9XG5cbiAgc2V0IGRlYnVnKHZhbHVlOiBib29sZWFuKSB7XG4gICAgdGhpcy5zZXQoXCJkZWJ1Z1wiLCB2YWx1ZSk7XG4gIH1cblxuICBnZXQgcHJldmlvdXNSZWxlYXNlKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlcy5wcmV2aW91c1JlbGVhc2U7XG4gIH1cblxuICBzZXQgcHJldmlvdXNSZWxlYXNlKHZhbHVlOiBzdHJpbmcgfCBudWxsKSB7XG4gICAgdGhpcy5zZXQoXCJwcmV2aW91c1JlbGVhc2VcIiwgdmFsdWUpO1xuICB9XG5cbiAgb25DaGFuZ2UoY2I6IENhbGxiYWNrKSB7XG4gICAgdGhpcy5jYWxsYmFja3MuYWRkKGNiKTtcbiAgfVxuXG4gIHJlbW92ZUNhbGxiYWNrKGNiOiBDYWxsYmFjayk6IHZvaWQge1xuICAgIHRoaXMuY2FsbGJhY2tzLmRlbGV0ZShjYik7XG4gIH1cblxuICByZXNldCgpIHtcbiAgICBmb3IgKGNvbnN0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyhERUZBVUxUX1NFVFRJTkdTKSkge1xuICAgICAgdGhpcy5zZXQoayBhcyBrZXlvZiBTZXR0aW5nc09iamVjdCwgdik7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0aGlzLnZhbHVlcyA9IE9iamVjdC5hc3NpZ24oXG4gICAgICB7fSxcbiAgICAgIERFRkFVTFRfU0VUVElOR1MsXG4gICAgICBhd2FpdCB0aGlzLnN0b3JhZ2UubG9hZERhdGEoKSxcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgc2F2ZSgpIHtcbiAgICBhd2FpdCB0aGlzLnN0b3JhZ2Uuc2F2ZURhdGEodGhpcy52YWx1ZXMpO1xuICB9XG5cbiAgZ2V0VmFsdWVzKCk6IFNldHRpbmdzT2JqZWN0IHtcbiAgICByZXR1cm4geyAuLi50aGlzLnZhbHVlcyB9O1xuICB9XG5cbiAgcHJpdmF0ZSBzZXQ8VCBleHRlbmRzIGtleW9mIFNldHRpbmdzT2JqZWN0PihcbiAgICBrZXk6IFQsXG4gICAgdmFsdWU6IFNldHRpbmdzT2JqZWN0W1RdLFxuICApOiB2b2lkIHtcbiAgICB0aGlzLnZhbHVlc1trZXldID0gdmFsdWU7XG5cbiAgICBmb3IgKGNvbnN0IGNiIG9mIHRoaXMuY2FsbGJhY2tzKSB7XG4gICAgICBjYigpO1xuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHsgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IEFycm93TGVmdEFuZEN0cmxBcnJvd0xlZnRCZWhhdmlvdXJPdmVycmlkZSB9IGZyb20gXCIuL2ZlYXR1cmVzL0Fycm93TGVmdEFuZEN0cmxBcnJvd0xlZnRCZWhhdmlvdXJPdmVycmlkZVwiO1xuaW1wb3J0IHsgQmFja3NwYWNlQmVoYXZpb3VyT3ZlcnJpZGUgfSBmcm9tIFwiLi9mZWF0dXJlcy9CYWNrc3BhY2VCZWhhdmlvdXJPdmVycmlkZVwiO1xuaW1wb3J0IHsgQmV0dGVyTGlzdHNTdHlsZXMgfSBmcm9tIFwiLi9mZWF0dXJlcy9CZXR0ZXJMaXN0c1N0eWxlc1wiO1xuaW1wb3J0IHsgQ3RybEFBbmRDbWRBQmVoYXZpb3VyT3ZlcnJpZGUgfSBmcm9tIFwiLi9mZWF0dXJlcy9DdHJsQUFuZENtZEFCZWhhdmlvdXJPdmVycmlkZVwiO1xuaW1wb3J0IHsgRGVsZXRlQmVoYXZpb3VyT3ZlcnJpZGUgfSBmcm9tIFwiLi9mZWF0dXJlcy9EZWxldGVCZWhhdmlvdXJPdmVycmlkZVwiO1xuaW1wb3J0IHsgRHJhZ0FuZERyb3AgfSBmcm9tIFwiLi9mZWF0dXJlcy9EcmFnQW5kRHJvcFwiO1xuaW1wb3J0IHsgRWRpdG9yU2VsZWN0aW9uc0JlaGF2aW91ck92ZXJyaWRlIH0gZnJvbSBcIi4vZmVhdHVyZXMvRWRpdG9yU2VsZWN0aW9uc0JlaGF2aW91ck92ZXJyaWRlXCI7XG5pbXBvcnQgeyBFbnRlckJlaGF2aW91ck92ZXJyaWRlIH0gZnJvbSBcIi4vZmVhdHVyZXMvRW50ZXJCZWhhdmlvdXJPdmVycmlkZVwiO1xuaW1wb3J0IHsgRmVhdHVyZSB9IGZyb20gXCIuL2ZlYXR1cmVzL0ZlYXR1cmVcIjtcbmltcG9ydCB7IExpc3RzRm9sZGluZ0NvbW1hbmRzIH0gZnJvbSBcIi4vZmVhdHVyZXMvTGlzdHNGb2xkaW5nQ29tbWFuZHNcIjtcbmltcG9ydCB7IExpc3RzTW92ZW1lbnRDb21tYW5kcyB9IGZyb20gXCIuL2ZlYXR1cmVzL0xpc3RzTW92ZW1lbnRDb21tYW5kc1wiO1xuaW1wb3J0IHsgTWV0YUJhY2tzcGFjZUJlaGF2aW91ck92ZXJyaWRlIH0gZnJvbSBcIi4vZmVhdHVyZXMvTWV0YUJhY2tzcGFjZUJlaGF2aW91ck92ZXJyaWRlXCI7XG4vLyBpbXBvcnQgeyBSZWxlYXNlTm90ZXNBbm5vdW5jZW1lbnQgfSBmcm9tIFwiLi9mZWF0dXJlcy9SZWxlYXNlTm90ZXNBbm5vdW5jZW1lbnRcIjtcbmltcG9ydCB7IFNldHRpbmdzVGFiIH0gZnJvbSBcIi4vZmVhdHVyZXMvU2V0dGluZ3NUYWJcIjtcbmltcG9ydCB7IFNoaWZ0VGFiQmVoYXZpb3VyT3ZlcnJpZGUgfSBmcm9tIFwiLi9mZWF0dXJlcy9TaGlmdFRhYkJlaGF2aW91ck92ZXJyaWRlXCI7XG5pbXBvcnQgeyBTeXN0ZW1JbmZvIH0gZnJvbSBcIi4vZmVhdHVyZXMvU3lzdGVtSW5mb1wiO1xuaW1wb3J0IHsgVGFiQmVoYXZpb3VyT3ZlcnJpZGUgfSBmcm9tIFwiLi9mZWF0dXJlcy9UYWJCZWhhdmlvdXJPdmVycmlkZVwiO1xuaW1wb3J0IHsgVmVydGljYWxMaW5lcyB9IGZyb20gXCIuL2ZlYXR1cmVzL1ZlcnRpY2FsTGluZXNcIjtcbmltcG9ydCB7IENoYW5nZXNBcHBsaWNhdG9yIH0gZnJvbSBcIi4vc2VydmljZXMvQ2hhbmdlc0FwcGxpY2F0b3JcIjtcbmltcG9ydCB7IElNRURldGVjdG9yIH0gZnJvbSBcIi4vc2VydmljZXMvSU1FRGV0ZWN0b3JcIjtcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gXCIuL3NlcnZpY2VzL0xvZ2dlclwiO1xuaW1wb3J0IHsgT2JzaWRpYW5TZXR0aW5ncyB9IGZyb20gXCIuL3NlcnZpY2VzL09ic2lkaWFuU2V0dGluZ3NcIjtcbmltcG9ydCB7IE9wZXJhdGlvblBlcmZvcm1lciB9IGZyb20gXCIuL3NlcnZpY2VzL09wZXJhdGlvblBlcmZvcm1lclwiO1xuaW1wb3J0IHsgUGFyc2VyIH0gZnJvbSBcIi4vc2VydmljZXMvUGFyc2VyXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuL3NlcnZpY2VzL1NldHRpbmdzXCI7XG5cbmRlY2xhcmUgZ2xvYmFsIHtcbiAgY29uc3QgUExVR0lOX1ZFUlNJT046IHN0cmluZztcbiAgY29uc3QgQ0hBTkdFTE9HX01EOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE9ic2lkaWFuT3V0bGluZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBwcml2YXRlIGZlYXR1cmVzOiBGZWF0dXJlW107XG4gIHByb3RlY3RlZCBzZXR0aW5nczogU2V0dGluZ3M7XG4gIHByaXZhdGUgbG9nZ2VyOiBMb2dnZXI7XG4gIHByaXZhdGUgb2JzaWRpYW5TZXR0aW5nczogT2JzaWRpYW5TZXR0aW5ncztcbiAgcHJpdmF0ZSBwYXJzZXI6IFBhcnNlcjtcbiAgcHJpdmF0ZSBjaGFuZ2VzQXBwbGljYXRvcjogQ2hhbmdlc0FwcGxpY2F0b3I7XG4gIHByaXZhdGUgb3BlcmF0aW9uUGVyZm9ybWVyOiBPcGVyYXRpb25QZXJmb3JtZXI7XG4gIHByaXZhdGUgaW1lRGV0ZWN0b3I6IElNRURldGVjdG9yO1xuXG4gIGFzeW5jIG9ubG9hZCgpIHtcbiAgICBjb25zb2xlLmxvZyhgTG9hZGluZyBvYnNpZGlhbi1vdXRsaW5lcmApO1xuXG4gICAgYXdhaXQgdGhpcy5wcmVwYXJlU2V0dGluZ3MoKTtcblxuICAgIHRoaXMub2JzaWRpYW5TZXR0aW5ncyA9IG5ldyBPYnNpZGlhblNldHRpbmdzKHRoaXMuYXBwKTtcbiAgICB0aGlzLmxvZ2dlciA9IG5ldyBMb2dnZXIodGhpcy5zZXR0aW5ncyk7XG4gICAgdGhpcy5wYXJzZXIgPSBuZXcgUGFyc2VyKHRoaXMubG9nZ2VyLCB0aGlzLnNldHRpbmdzKTtcbiAgICB0aGlzLmNoYW5nZXNBcHBsaWNhdG9yID0gbmV3IENoYW5nZXNBcHBsaWNhdG9yKCk7XG4gICAgdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIgPSBuZXcgT3BlcmF0aW9uUGVyZm9ybWVyKFxuICAgICAgdGhpcy5wYXJzZXIsXG4gICAgICB0aGlzLmNoYW5nZXNBcHBsaWNhdG9yLFxuICAgICk7XG5cbiAgICB0aGlzLmltZURldGVjdG9yID0gbmV3IElNRURldGVjdG9yKCk7XG4gICAgYXdhaXQgdGhpcy5pbWVEZXRlY3Rvci5sb2FkKCk7XG5cbiAgICB0aGlzLmZlYXR1cmVzID0gW1xuICAgICAgLy8gc2VydmljZSBmZWF0dXJlc1xuICAgICAgLy8gbmV3IFJlbGVhc2VOb3Rlc0Fubm91bmNlbWVudCh0aGlzLCB0aGlzLnNldHRpbmdzKSxcbiAgICAgIG5ldyBTZXR0aW5nc1RhYih0aGlzLCB0aGlzLnNldHRpbmdzKSxcbiAgICAgIG5ldyBTeXN0ZW1JbmZvKHRoaXMsIHRoaXMuc2V0dGluZ3MpLFxuXG4gICAgICAvLyBnZW5lcmFsIGZlYXR1cmVzXG4gICAgICBuZXcgTGlzdHNNb3ZlbWVudENvbW1hbmRzKFxuICAgICAgICB0aGlzLFxuICAgICAgICB0aGlzLm9ic2lkaWFuU2V0dGluZ3MsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcbiAgICAgIG5ldyBMaXN0c0ZvbGRpbmdDb21tYW5kcyh0aGlzLCB0aGlzLm9ic2lkaWFuU2V0dGluZ3MpLFxuXG4gICAgICAvLyBmZWF0dXJlcyBiYXNlZCBvbiBzZXR0aW5ncy5rZWVwQ3Vyc29yV2l0aGluQ29udGVudFxuICAgICAgbmV3IEVkaXRvclNlbGVjdGlvbnNCZWhhdmlvdXJPdmVycmlkZShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5wYXJzZXIsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcbiAgICAgIG5ldyBBcnJvd0xlZnRBbmRDdHJsQXJyb3dMZWZ0QmVoYXZpb3VyT3ZlcnJpZGUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMuaW1lRGV0ZWN0b3IsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcbiAgICAgIG5ldyBCYWNrc3BhY2VCZWhhdmlvdXJPdmVycmlkZShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5pbWVEZXRlY3RvcixcbiAgICAgICAgdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIsXG4gICAgICApLFxuICAgICAgbmV3IE1ldGFCYWNrc3BhY2VCZWhhdmlvdXJPdmVycmlkZShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5pbWVEZXRlY3RvcixcbiAgICAgICAgdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIsXG4gICAgICApLFxuICAgICAgbmV3IERlbGV0ZUJlaGF2aW91ck92ZXJyaWRlKFxuICAgICAgICB0aGlzLFxuICAgICAgICB0aGlzLnNldHRpbmdzLFxuICAgICAgICB0aGlzLmltZURldGVjdG9yLFxuICAgICAgICB0aGlzLm9wZXJhdGlvblBlcmZvcm1lcixcbiAgICAgICksXG5cbiAgICAgIC8vIGZlYXR1cmVzIGJhc2VkIG9uIHNldHRpbmdzLm92ZXJyaWRlVGFiQmVoYXZpb3VyXG4gICAgICBuZXcgVGFiQmVoYXZpb3VyT3ZlcnJpZGUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuaW1lRGV0ZWN0b3IsXG4gICAgICAgIHRoaXMub2JzaWRpYW5TZXR0aW5ncyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIsXG4gICAgICApLFxuICAgICAgbmV3IFNoaWZ0VGFiQmVoYXZpb3VyT3ZlcnJpZGUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuaW1lRGV0ZWN0b3IsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcblxuICAgICAgLy8gZmVhdHVyZXMgYmFzZWQgb24gc2V0dGluZ3Mub3ZlcnJpZGVFbnRlckJlaGF2aW91clxuICAgICAgbmV3IEVudGVyQmVoYXZpb3VyT3ZlcnJpZGUoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIHRoaXMuc2V0dGluZ3MsXG4gICAgICAgIHRoaXMuaW1lRGV0ZWN0b3IsXG4gICAgICAgIHRoaXMub2JzaWRpYW5TZXR0aW5ncyxcbiAgICAgICAgdGhpcy5wYXJzZXIsXG4gICAgICAgIHRoaXMub3BlcmF0aW9uUGVyZm9ybWVyLFxuICAgICAgKSxcblxuICAgICAgLy8gZmVhdHVyZXMgYmFzZWQgb24gc2V0dGluZ3Mub3ZlcnJpZGVTZWxlY3RBbGxCZWhhdmlvdXJcbiAgICAgIG5ldyBDdHJsQUFuZENtZEFCZWhhdmlvdXJPdmVycmlkZShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5pbWVEZXRlY3RvcixcbiAgICAgICAgdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIsXG4gICAgICApLFxuXG4gICAgICAvLyBmZWF0dXJlcyBiYXNlZCBvbiBzZXR0aW5ncy5iZXR0ZXJMaXN0c1N0eWxlc1xuICAgICAgbmV3IEJldHRlckxpc3RzU3R5bGVzKHRoaXMuc2V0dGluZ3MsIHRoaXMub2JzaWRpYW5TZXR0aW5ncyksXG5cbiAgICAgIC8vIGZlYXR1cmVzIGJhc2VkIG9uIHNldHRpbmdzLnZlcnRpY2FsTGluZXNcbiAgICAgIG5ldyBWZXJ0aWNhbExpbmVzKFxuICAgICAgICB0aGlzLFxuICAgICAgICB0aGlzLnNldHRpbmdzLFxuICAgICAgICB0aGlzLm9ic2lkaWFuU2V0dGluZ3MsXG4gICAgICAgIHRoaXMucGFyc2VyLFxuICAgICAgKSxcblxuICAgICAgLy8gZmVhdHVyZXMgYmFzZWQgb24gc2V0dGluZ3MuZHJhZ0FuZERyb3BcbiAgICAgIG5ldyBEcmFnQW5kRHJvcChcbiAgICAgICAgdGhpcyxcbiAgICAgICAgdGhpcy5zZXR0aW5ncyxcbiAgICAgICAgdGhpcy5vYnNpZGlhblNldHRpbmdzLFxuICAgICAgICB0aGlzLnBhcnNlcixcbiAgICAgICAgdGhpcy5vcGVyYXRpb25QZXJmb3JtZXIsXG4gICAgICApLFxuICAgIF07XG5cbiAgICBmb3IgKGNvbnN0IGZlYXR1cmUgb2YgdGhpcy5mZWF0dXJlcykge1xuICAgICAgYXdhaXQgZmVhdHVyZS5sb2FkKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgb251bmxvYWQoKSB7XG4gICAgY29uc29sZS5sb2coYFVubG9hZGluZyBvYnNpZGlhbi1vdXRsaW5lcmApO1xuXG4gICAgYXdhaXQgdGhpcy5pbWVEZXRlY3Rvci51bmxvYWQoKTtcblxuICAgIGZvciAoY29uc3QgZmVhdHVyZSBvZiB0aGlzLmZlYXR1cmVzKSB7XG4gICAgICBhd2FpdCBmZWF0dXJlLnVubG9hZCgpO1xuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBwcmVwYXJlU2V0dGluZ3MoKSB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IG5ldyBTZXR0aW5ncyh0aGlzKTtcbiAgICBhd2FpdCB0aGlzLnNldHRpbmdzLmxvYWQoKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbImVkaXRvckluZm9GaWVsZCIsImZvbGRlZFJhbmdlcyIsImZvbGRhYmxlIiwiZm9sZEVmZmVjdCIsInVuZm9sZEVmZmVjdCIsInJ1blNjb3BlSGFuZGxlcnMiLCJrZXltYXAiLCJOb3RpY2UiLCJpbmRlbnRTdHJpbmciLCJnZXRJbmRlbnRVbml0IiwiU3RhdGVFZmZlY3QiLCJEZWNvcmF0aW9uIiwiU3RhdGVGaWVsZCIsIkVkaXRvclZpZXciLCJQbGF0Zm9ybSIsIkVkaXRvclN0YXRlIiwiUHJlYyIsIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIiwiTW9kYWwiLCJWaWV3UGx1Z2luIiwiUGx1Z2luIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFrR0E7QUFDTyxTQUFTLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUU7QUFDN0QsSUFBSSxTQUFTLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxPQUFPLEtBQUssWUFBWSxDQUFDLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLFVBQVUsT0FBTyxFQUFFLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUU7QUFDaEgsSUFBSSxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUMsRUFBRSxVQUFVLE9BQU8sRUFBRSxNQUFNLEVBQUU7QUFDL0QsUUFBUSxTQUFTLFNBQVMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVB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
