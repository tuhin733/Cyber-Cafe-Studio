import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { AlignCenter, AlignLeft, AlignRight, Columns2, Copy, Plus, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { DOCUMENT_MAKER_EXTENSIONS } from "../lib/documentMakerExtensions";
import {
  getActiveRomanWord,
  getDocumentMakerBlockStartPosition,
  getDocumentMakerContentInsets,
  getDocumentMakerSuggestions,
  splitDocumentMakerContentAtPageBreak,
  splitDocumentMakerTableAtRow,
  type DocumentMakerLayout,
  type DocumentMakerLanguage,
  type DocumentMakerPage,
  getDocumentMakerPageDimensions,
} from "../lib/documentMaker";

interface Props {
  page: DocumentMakerPage;
  pageNumber: number;
  active: boolean;
  autoFocusAtEnd: boolean;
  layout: DocumentMakerLayout;
  language: DocumentMakerLanguage;
  spellCheck: boolean;
  autoCorrect: boolean;
  onContentChange: (pageId: string, page: DocumentMakerPage["content"]) => void;
  onAutoPage: (pageId: string, content: DocumentMakerPage["content"], activateNextPage?: boolean) => void;
  onActivate: (pageId: string) => void;
  onSelectionUpdate: (pageId: string) => void;
  onEditorReady: (pageId: string, editor: Editor | null) => void;
  onAutoPageFocused: (pageId: string) => void;
}

interface SuggestionState {
  candidates: string[];
  from: number;
  to: number;
  left: number;
  top: number;
}

interface TableContextMenu {
  left: number;
  top: number;
}

interface ImageContextMenu {
  left: number;
  top: number;
  position: number;
}

interface RowResizeState {
  row: HTMLTableRowElement;
  position: number;
  startY: number;
  startHeight: number;
  pointerId: number;
}

interface TableDragState {
  position: number;
  node: ProseMirrorNode;
  pointerId: number;
}

export default function DocumentMakerPageEditor({
  page,
  pageNumber,
  active,
  autoFocusAtEnd,
  layout,
  language,
  spellCheck,
  autoCorrect,
  onContentChange,
  onAutoPage,
  onActivate,
  onSelectionUpdate,
  onEditorReady,
  onAutoPageFocused,
}: Props) {
  const [suggestion, setSuggestion] = useState<SuggestionState | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [tableContextMenu, setTableContextMenu] = useState<TableContextMenu | null>(null);
  const [imageContextMenu, setImageContextMenu] = useState<ImageContextMenu | null>(null);
  const [isDraggingTable, setIsDraggingTable] = useState(false);
  const tableContextMenuRef = useRef<HTMLDivElement | null>(null);
  const imageContextMenuRef = useRef<HTMLDivElement | null>(null);
  const suggestionRef = useRef(suggestion);
  const selectedSuggestionRef = useRef(selectedSuggestion);
  const rowResizeRef = useRef<RowResizeState | null>(null);
  const tableDragRef = useRef<TableDragState | null>(null);
  const acceptSuggestionRef = useRef<((appendSpace: boolean) => boolean) | null>(null);
  const isAutoPaging = useRef(false);
  suggestionRef.current = suggestion;
  selectedSuggestionRef.current = selectedSuggestion;

  const refreshSuggestions = useCallback(
    (editor: Editor) => {
      const { selection } = editor.state;
      if (!active || language === "english" || !selection.empty) {
        setSuggestion(null);
        return;
      }

      const text = selection.$from.parent.textBetween(
        0,
        selection.$from.parent.content.size,
      );
      const activeWord = getActiveRomanWord(
        text,
        selection.$from.parentOffset,
        selection.$from.start(),
      );
      if (!activeWord || activeWord.word.length < 2) {
        setSuggestion(null);
        return;
      }

      const candidates = getDocumentMakerSuggestions(activeWord.word, language);
      if (candidates.length === 0) {
        setSuggestion(null);
        return;
      }

      const cursor = editor.view.coordsAtPos(selection.$from.pos);
      setSelectedSuggestion(0);
      setSuggestion({
        candidates,
        from: activeWord.from,
        to: activeWord.to,
        left: Math.max(12, Math.min(cursor.left, window.innerWidth - 220)),
        top: Math.min(cursor.bottom + 5, window.innerHeight - 190),
      });
    },
    [active, language],
  );

  const splitOverflowToNextPage = useCallback(
    (editor: Editor) => {
      if (isAutoPaging.current) return;

      const dom = editor.view.dom;
      if (dom.scrollHeight <= dom.clientHeight + 1) return;

      dom.scrollTop = 0;
      const availableBottom =
        dom.getBoundingClientRect().bottom -
        Number.parseFloat(window.getComputedStyle(dom).paddingBottom || "0");
      const overflowingBlock = Array.from(dom.children).findIndex(
        (child) => child.getBoundingClientRect().bottom > availableBottom,
      );
      if (overflowingBlock < 0) return;

      const overflowingNode = editor.state.doc.child(overflowingBlock);
      if (overflowingNode.type.name === "table") {
        const rows = Array.from(dom.children[overflowingBlock].querySelectorAll("tr"));
        const overflowingRow = rows.findIndex(
          (row) => row.getBoundingClientRect().bottom > availableBottom,
        );
        if (overflowingRow > 0) {
          const split = splitDocumentMakerTableAtRow(
            editor.state.doc,
            overflowingBlock,
            overflowingRow,
          );
          if (split) {
            isAutoPaging.current = true;
            try {
              editor.commands.setContent(split.currentPage);
              onAutoPage(page.id, split.nextPage, active);
            } finally {
              isAutoPaging.current = false;
            }
            return;
          }
        }
      }

      let splitPosition =
        getDocumentMakerBlockStartPosition(editor.state.doc, overflowingBlock) ?? -1;

      if (overflowingBlock === 0) {
        const editorRect = dom.getBoundingClientRect();
        const point = editor.view.posAtCoords({
          left: editorRect.left + Math.min(120, editorRect.width / 2),
          top: Math.max(editorRect.top + 1, availableBottom - 8),
        });
        if (!point) return;

        const $point = editor.state.doc.resolve(point.pos);
        const textBefore = $point.parent.textBetween(0, $point.parentOffset);
        const lastSpace = textBefore.lastIndexOf(" ");
        const splitOffset =
          lastSpace > 0 ? lastSpace + 1 : $point.parentOffset;
        if (splitOffset <= 0 || splitOffset >= $point.parent.content.size) return;
        splitPosition = $point.start() + splitOffset;
      }

      const endPosition = editor.state.doc.content.size;
      if (splitPosition <= 0 || splitPosition >= endPosition) return;

      const overflow = editor.state.doc.slice(splitPosition, endPosition);
      const content = overflow.content.toJSON();
      if (!content?.length) return;

      isAutoPaging.current = true;
      try {
        editor.chain().deleteRange({ from: splitPosition, to: endPosition }).run();
        onAutoPage(page.id, { type: "doc", content }, active);
      } finally {
        isAutoPaging.current = false;
      }
    },
    [active, onAutoPage, page.id],
  );

  const splitAtPageBreak = useCallback(
    (editor: Editor) => {
      if (isAutoPaging.current) return false;
      const split = splitDocumentMakerContentAtPageBreak(editor.state.doc);
      if (!split) return false;

      isAutoPaging.current = true;
      try {
        editor.commands.setContent(
          split.currentPage.content?.length
            ? split.currentPage
            : { type: "doc", content: [{ type: "paragraph" }] },
        );
        onAutoPage(page.id, split.nextPage, active);
      } finally {
        isAutoPaging.current = false;
      }
      return true;
    },
    [active, onAutoPage, page.id],
  );

  const editor = useEditor({
    extensions: DOCUMENT_MAKER_EXTENSIONS,
    content: page.content,
    editorProps: {
      attributes: {
        class:
          "document-maker-editor min-h-full px-6 py-6 text-base leading-7 text-ink-primary outline-none sm:px-10 sm:py-8",
        "aria-label": `Document text, page ${pageNumber}`,
      },
      handleDOMEvents: {
        focus: () => {
          onActivate(page.id);
          return false;
        },
      },
      handleKeyDown: (_view, event) => {
        const current = suggestionRef.current;
        if (!active || !current || event.isComposing) return false;

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const direction = event.key === "ArrowDown" ? 1 : -1;
          setSelectedSuggestion((index) =>
            (index + direction + current.candidates.length) % current.candidates.length,
          );
          return true;
        }

        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          return acceptSuggestionRef.current?.(false) ?? false;
        }

        if (event.key === " ") {
          event.preventDefault();
          return acceptSuggestionRef.current?.(true) ?? false;
        }

        if (event.key === "Escape") {
          setSuggestion(null);
          return true;
        }

        return false;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onContentChange(page.id, currentEditor.getJSON());
      if (splitAtPageBreak(currentEditor)) return;
      refreshSuggestions(currentEditor);
      splitOverflowToNextPage(currentEditor);
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      refreshSuggestions(currentEditor);
      onSelectionUpdate(page.id);
    },
    immediatelyRender: false,
  });

  const replaceWithSuggestion = useCallback(
    (appendSpace: boolean, candidate?: string) => {
      const current = suggestionRef.current;
      if (!editor || !current) return false;

      const selected =
        candidate ??
        current.candidates[selectedSuggestionRef.current] ??
        current.candidates[0];
      editor
        .chain()
        .focus()
        .insertContentAt(
          { from: current.from, to: current.to },
          `${selected}${appendSpace ? " " : ""}`,
        )
        .run();
      setSuggestion(null);
      return true;
    },
    [editor],
  );
  acceptSuggestionRef.current = replaceWithSuggestion;

  useEffect(() => {
    if (!tableContextMenu && !imageContextMenu) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        tableContextMenuRef.current?.contains(target) ||
        imageContextMenuRef.current?.contains(target)
      ) {
        return;
      }
      setTableContextMenu(null);
      setImageContextMenu(null);
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [imageContextMenu, tableContextMenu]);

  const handleTableContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const image = target.closest("img.document-maker-image");
    if (image && editor) {
      event.preventDefault();
      const imageNodes: number[] = [];
      editor.state.doc.descendants((node, position) => {
        const imageNode = editor.view.nodeDOM(position);
        if (
          node.type.name === "image" &&
          imageNode instanceof HTMLElement &&
          (imageNode === image || imageNode.contains(image))
        ) {
          imageNodes.push(position);
          return false;
        }
        return true;
      });
      const imagePosition = imageNodes[0];
      if (imagePosition === undefined) return;
      editor.commands.setNodeSelection(imagePosition);
      editor.view.focus();
      setTableContextMenu(null);
      setImageContextMenu({
        left: Math.max(8, Math.min(event.clientX, window.innerWidth - 220)),
        top: Math.max(8, Math.min(event.clientY, window.innerHeight - 360)),
        position: imagePosition,
      });
      return;
    }
    setImageContextMenu(null);
    const cell = target.closest("td, th");
    if (!cell || !editor) {
      setTableContextMenu(null);
      return;
    }

    event.preventDefault();
    const domPosition = editor.view.posAtDOM(cell, 0);
    const $position = editor.state.doc.resolve(domPosition);
    let cellDepth = $position.depth;
    while (
      cellDepth > 0 &&
      !["tableCell", "tableHeader"].includes($position.node(cellDepth).type.name)
    ) {
      cellDepth -= 1;
    }
    if (cellDepth === 0) return;

    editor.commands.setCellSelection({ anchorCell: $position.before(cellDepth) });
    editor.view.focus();
    setTableContextMenu({
      left: Math.max(8, Math.min(event.clientX, window.innerWidth - 260)),
      top: Math.max(8, Math.min(event.clientY, window.innerHeight - 320)),
    });
  };

  const handleRowResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editor || event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest("tr");
    if (!(row instanceof HTMLTableRowElement)) return;

    const rect = row.getBoundingClientRect();
    if (event.clientY < rect.bottom - 6) return;
    const domPosition = editor.view.posAtDOM(row, 0);
    const $position = editor.state.doc.resolve(domPosition);
    let rowDepth = $position.depth;
    while (rowDepth > 0 && $position.node(rowDepth).type.name !== "tableRow") {
      rowDepth -= 1;
    }
    if (rowDepth === 0) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    rowResizeRef.current = {
      row,
      position: $position.before(rowDepth),
      startY: event.clientY,
      startHeight: rect.height,
      pointerId: event.pointerId,
    };
  };

  const handleTableDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editor || event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element) || !target.closest("[data-table-drag-handle]")) return;
    const wrapper = target.closest(".tableWrapper");
    if (!wrapper) return;

    let draggedTable: TableDragState | null = null;
    editor.state.doc.forEach((node, position) => {
      if (node.type.name === "table" && editor.view.nodeDOM(position) === wrapper) {
        draggedTable = { position, node, pointerId: event.pointerId };
      }
    });
    if (!draggedTable) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    tableDragRef.current = draggedTable;
    setIsDraggingTable(true);
  };

  const finishTableDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = tableDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !editor) return;
    tableDragRef.current = null;
    setIsDraggingTable(false);

    const blocks: Array<{ position: number; element: HTMLElement }> = [];
    editor.state.doc.forEach((_node, position) => {
      const element = editor.view.nodeDOM(position);
      if (element instanceof HTMLElement) blocks.push({ position, element });
    });
    const destination =
      blocks.find(({ element }) => {
        const rect = element.getBoundingClientRect();
        return rect.height > 0 && event.clientY < rect.top + rect.height / 2;
      })?.position ?? editor.state.doc.content.size;
    if (destination === drag.position || destination === drag.position + drag.node.nodeSize) {
      return;
    }

    const transaction = editor.state.tr.delete(
      drag.position,
      drag.position + drag.node.nodeSize,
    );
    transaction.insert(transaction.mapping.map(destination), drag.node);
    editor.view.dispatch(transaction);
  };

  const handleRowResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = rowResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const height = Math.max(24, resize.startHeight + event.clientY - resize.startY);
    resize.row.style.height = `${height}px`;
  };

  const finishRowResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = rowResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId || !editor) return;
    const height = Math.max(24, resize.startHeight + event.clientY - resize.startY);
    rowResizeRef.current = null;
    const rowNode = editor.state.doc.nodeAt(resize.position);
    if (!rowNode || rowNode.type.name !== "tableRow") return;
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(resize.position, undefined, {
        ...rowNode.attrs,
        rowHeight: Math.round(height),
      }),
    );
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const runTableContextAction = (
    action: "row-above" | "row-below" | "column-left" | "column-right" | "delete-row" | "delete-column" | "delete-table",
  ) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    switch (action) {
      case "row-above":
        chain.addRowBefore().run();
        break;
      case "row-below":
        chain.addRowAfter().run();
        break;
      case "column-left":
        chain.addColumnBefore().run();
        break;
      case "column-right":
        chain.addColumnAfter().run();
        break;
      case "delete-row":
        chain.deleteRow().run();
        break;
      case "delete-column":
        chain.deleteColumn().run();
        break;
      case "delete-table":
        chain.deleteTable().run();
        break;
    }
    setTableContextMenu(null);
  };

  const runImageContextAction = (
    action: "left" | "center" | "right" | "rotate-left" | "rotate-right" | "duplicate" | "delete",
  ) => {
    if (!editor || !imageContextMenu) return;
    const { position } = imageContextMenu;
    const image = editor.state.doc.nodeAt(position);
    if (!image || image.type.name !== "image") {
      setImageContextMenu(null);
      return;
    }
    if (action === "delete") {
      editor.view.dispatch(editor.state.tr.delete(position, position + image.nodeSize));
    } else if (action === "duplicate") {
      editor.view.dispatch(editor.state.tr.insert(position + image.nodeSize, image.copy()));
    } else {
      const isAlignment = action === "left" || action === "center" || action === "right";
      const align = isAlignment ? action : image.attrs.align;
      const rotation = action === "rotate-left"
        ? (Number(image.attrs.rotation || 0) + 270) % 360
        : action === "rotate-right"
          ? (Number(image.attrs.rotation || 0) + 90) % 360
          : image.attrs.rotation;
      const pageDimensions = getDocumentMakerPageDimensions(layout);
      const imageWidth = Number(image.attrs.width) || 240;
      const marginLeft = layout.margins.left * 96 / 25.4;
      const marginRight = layout.margins.right * 96 / 25.4;
      const alignedWidth = Math.min(
        imageWidth,
        Math.max(0, pageDimensions.widthPx - marginLeft - marginRight),
      );
      const x = isAlignment
        ? action === "left"
          ? marginLeft
          : action === "center"
            ? (pageDimensions.widthPx - alignedWidth) / 2
            : pageDimensions.widthPx - marginRight - alignedWidth
        : Number(image.attrs.x) || marginLeft;
      const y = typeof image.attrs.y === "number"
        ? image.attrs.y
        : layout.margins.top * 96 / 25.4;
      editor.view.dispatch(editor.state.tr.setNodeMarkup(position, undefined, {
        ...image.attrs,
        align,
        rotation,
        x,
        y,
      }));
    }
    setImageContextMenu(null);
  };

  useEffect(() => {
    onEditorReady(page.id, editor);
    return () => onEditorReady(page.id, null);
  }, [editor, onEditorReady, page.id]);

  useEffect(() => {
    if (!active || !editor || !autoFocusAtEnd) return;
    editor.commands.focus("end");
    onAutoPageFocused(page.id);
  }, [active, autoFocusAtEnd, editor, onAutoPageFocused, page.id]);

  useEffect(() => {
    if (!editor) return;
    if (active) refreshSuggestions(editor);
    else setSuggestion(null);
    if (!splitAtPageBreak(editor)) splitOverflowToNextPage(editor);
  }, [active, editor, language, layout, refreshSuggestions, splitAtPageBreak, splitOverflowToNextPage]);

  useEffect(() => {
    const handleResize = () => {
      if (editor) splitOverflowToNextPage(editor);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [editor, splitOverflowToNextPage]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dom.setAttribute(
      "spellcheck",
      String(language === "english" && spellCheck),
    );
    editor.view.dom.setAttribute(
      "autocorrect",
      language === "english" && autoCorrect ? "on" : "off",
    );
  }, [autoCorrect, editor, language, spellCheck]);

  const dimensions = getDocumentMakerPageDimensions(layout);
  const contentInsets = getDocumentMakerContentInsets(layout);
  const margins = {
    "--page-margin-top": `${layout.margins.top * 96 / 25.4 + contentInsets.topPx}px`,
    "--page-margin-right": `${layout.margins.right * 96 / 25.4}px`,
    "--page-margin-bottom": `${layout.margins.bottom * 96 / 25.4 + contentInsets.bottomPx}px`,
    "--page-margin-left": `${layout.margins.left * 96 / 25.4}px`,
  } as React.CSSProperties;

  return (
    <div
      id={`document-maker-page-${page.id}`}
      role="region"
      aria-label={`Page ${pageNumber}`}
      onContextMenu={handleTableContextMenu}
      onPointerDown={(event) => {
        handleTableDragStart(event);
        if (!tableDragRef.current) handleRowResizeStart(event);
      }}
      onPointerMove={handleRowResizeMove}
      onPointerUp={finishRowResize}
      onPointerCancel={finishRowResize}
      onPointerUpCapture={finishTableDrag}
      onPointerCancelCapture={finishTableDrag}
      style={{ ...margins, width: `${dimensions.widthPx}px`, maxWidth: "100%", aspectRatio: `${dimensions.widthPx} / ${dimensions.heightPx}` }}
      className={`document-maker-page mx-auto w-full max-w-[800px] bg-surface shadow-sm ${
        active ? "document-maker-page-active ring-1 ring-action-accent" : "ring-1 ring-ui"
      } ${isDraggingTable ? "document-maker-table-dragging" : ""}`}
    >
      {layout.header && (
        <div className="document-maker-page-header">{layout.header}</div>
      )}
      <EditorContent editor={editor} />
      {(layout.footer || layout.pageNumbers) && (
        <div className="document-maker-page-footer">
          <span>{layout.footer}</span>
          {layout.pageNumbers && (
            <span className="document-maker-page-number">{pageNumber}</span>
          )}
          {layout.pageNumbers && <span aria-hidden="true" />}
        </div>
      )}
      {tableContextMenu && active && (
        <div
          ref={tableContextMenuRef}
          role="menu"
          aria-label="Table options"
          onMouseDown={(event) => event.preventDefault()}
          className="fixed z-50 min-w-52 rounded-xl border border-ui bg-surface p-1.5 shadow-xl"
          style={{ left: tableContextMenu.left, top: tableContextMenu.top }}
        >
          {([
            ["row-above", "Insert Row Above"],
            ["row-below", "Insert Row Below"],
            ["column-left", "Insert Column Left"],
            ["column-right", "Insert Column Right"],
          ] as const).map(([action, label]) => (
            <button
              key={action}
              type="button"
              role="menuitem"
              onClick={() => runTableContextAction(action)}
              className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-ink-primary hover:bg-surface-muted"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </button>
          ))}
          <div className="my-1 border-t border-ui" />
          {([
            ["delete-row", "Delete Row"],
            ["delete-column", "Delete Column"],
            ["delete-table", "Delete Table"],
          ] as const).map(([action, label]) => (
            <button
              key={action}
              type="button"
              role="menuitem"
              onClick={() => runTableContextAction(action)}
              className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-danger hover:bg-surface-muted"
            >
              {action === "delete-table" ? (
                <Columns2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              {label}
            </button>
          ))}
        </div>
      )}
      {imageContextMenu && active && (
        <div
          ref={imageContextMenuRef}
          role="menu"
          aria-label="Image options"
          onMouseDown={(event) => event.preventDefault()}
          className="fixed z-50 min-w-48 rounded-xl border border-ui bg-surface p-1.5 shadow-xl"
          style={{ left: imageContextMenu.left, top: imageContextMenu.top }}
        >
          {([
            ["left", "Image left", <AlignLeft className="h-4 w-4" aria-hidden="true" />],
            ["center", "Image center", <AlignCenter className="h-4 w-4" aria-hidden="true" />],
            ["right", "Image right", <AlignRight className="h-4 w-4" aria-hidden="true" />],
          ] as const).map(([action, label, icon]) => (
            <button
              key={action}
              type="button"
              role="menuitem"
              onClick={() => runImageContextAction(action)}
              className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-ink-primary hover:bg-surface-muted"
            >
              {icon}
              {label}
            </button>
          ))}
          <div className="my-1 border-t border-ui" />
          {([
            ["rotate-left", "Rotate left", <RotateCcw className="h-4 w-4" aria-hidden="true" />],
            ["rotate-right", "Rotate right", <RotateCw className="h-4 w-4" aria-hidden="true" />],
            ["duplicate", "Duplicate image", <Copy className="h-4 w-4" aria-hidden="true" />],
            ["delete", "Delete image", <Trash2 className="h-4 w-4" aria-hidden="true" />],
          ] as const).map(([action, label, icon]) => (
            <button
              key={action}
              type="button"
              role="menuitem"
              onClick={() => runImageContextAction(action)}
              className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-muted ${
                action === "delete" ? "text-danger" : "text-ink-primary"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      )}
      {active && suggestion && (
        <div
          className="document-maker-suggestions fixed z-50 min-w-44 overflow-hidden rounded-xl border border-ui bg-surface py-1 shadow-xl"
          role="listbox"
          aria-label="Transliteration suggestions"
          style={{ left: suggestion.left, top: suggestion.top }}
        >
          {suggestion.candidates.map((candidate, index) => (
            <button
              key={`${candidate}-${index}`}
              type="button"
              role="option"
              aria-selected={selectedSuggestion === index}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => replaceWithSuggestion(false, candidate)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${
                selectedSuggestion === index
                  ? "bg-action-subtle text-action"
                  : "text-ink-primary hover:bg-surface-muted"
              }`}
            >
              <span className="w-4 text-xs text-ink-faint">{index + 1}.</span>
              <span>{candidate}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
