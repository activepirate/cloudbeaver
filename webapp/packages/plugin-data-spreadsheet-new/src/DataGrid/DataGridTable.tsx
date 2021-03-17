/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2021 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DataGrid from 'react-data-grid';
import type { DataGridHandle } from 'react-data-grid';
import type { Position } from 'react-data-grid/lib/types';
import styled from 'reshadow';

import { Executor } from '@cloudbeaver/core-executor';
import { useStyles } from '@cloudbeaver/core-theming';
import { IDatabaseDataEditorActionsData, IDatabaseDataModel, IDatabaseResultSet, ResultSetSelectAction } from '@cloudbeaver/plugin-data-viewer';

import { EditingContext } from '../Editing/EditingContext';
import { useEditing } from '../Editing/useEditing';
import baseStyles from '../styles/base.scss';
import { reactGridStyles } from '../styles/styles';
import { DataGridContext, IColumnResizeInfo, IDataGridContext } from './DataGridContext';
import { DataGridSelectionContext } from './DataGridSelection/DataGridSelectionContext';
import { useGridSelectionContext } from './DataGridSelection/useGridSelectionContext';
import { DataGridSortingContext } from './DataGridSorting/DataGridSortingContext';
import { useGridSortingContext } from './DataGridSorting/useGridSortingContext';
import { CellFormatter } from './Formatters/CellFormatter';
import { RowRenderer } from './RowRenderer/RowRenderer';
import { TableDataContext } from './TableDataContext';
import { useGridDragging } from './useGridDragging';
import { useGridSelectedCellsCopy } from './useGridSelectedCellsCopy';
import { useTableData } from './useTableData';

interface Props {
  model: IDatabaseDataModel<any, IDatabaseResultSet>;
  resultIndex: number;
  className?: string;
}

function isAtBottom(event: React.UIEvent<HTMLDivElement>): boolean {
  const target = event.target as HTMLDivElement;
  return target.clientHeight + target.scrollTop + 100 > target.scrollHeight;
}

export const DataGridTable: React.FC<Props> = observer(function DataGridTable({ model, resultIndex, className }) {
  const dataGridRef = useRef<DataGridHandle>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const styles = useStyles(reactGridStyles, baseStyles);
  const [columnResize] = useState(() => new Executor<IColumnResizeInfo>());

  const selectionAction = model.source.getAction(resultIndex, ResultSetSelectAction);
  const modelResultData = model.getResult(resultIndex);

  const tableData = useTableData(model, resultIndex);

  const gridSortingContext = useGridSortingContext(model);
  const gridSelectionContext = useGridSelectionContext(tableData, selectionAction);
  const editingContext = useEditing({
    readonly: model.isReadonly(),
    onEdit: (position, key) => {
      const editor = model.source.getEditor(resultIndex);

      // TODO: not works yet
      switch (key) {
        case 'Delete':
        case 'Backspace':
          editor.setCell(position.rowIdx, position.idx, '');
          break;
        default:
          if (key) {
            editor.setCell(position.rowIdx, position.idx, key);
          }
      }

      return true;
    },
  });

  const { onKeydownHandler } = useGridSelectedCellsCopy(modelResultData, gridSelectionContext);
  const { onMouseDownHandler, onMouseMoveHandler } = useGridDragging({
    onDragStart: startPosition => {
      dataGridRef.current?.selectCell({ idx: startPosition.colIdx, rowIdx: startPosition.rowIdx });
    },
    onDragOver: (startPosition, currentPosition, event) => {
      gridSelectionContext.selectRange(startPosition, currentPosition, event.ctrlKey || event.metaKey, true);
    },
    onDragEnd: (startPosition, currentPosition, event) => {
      gridSelectionContext.selectRange(startPosition, currentPosition, event.ctrlKey || event.metaKey, false);
    },
  });

  useEffect(() => {
    function listener(data: IDatabaseDataEditorActionsData) {
      const editor = model.source.getEditor(resultIndex);
      if (data.resultId !== editor.result.id || data.type === 'edit') {
        return;
      }

      const idx = tableData.getColumnIndexFromKey(data.column);

      if (idx === null) {
        return;
      }

      editingContext.closeEditor({
        rowIdx: data.row,
        idx,
      });
    }

    model.source.editor?.actions.addHandler(listener);

    return () => model.source.editor?.actions.removeHandler(listener);
  }, [model.source, resultIndex]);

  const handleFocusChange = (position: Position) => {
    const key = tableData.getColumnKeyFromColumnIndex(position.idx);
    const column = tableData.getColumnInfo(key);

    if (column) {
      selectionAction.focus({
        row: position.rowIdx,
        column: key,
      });
    } else {
      selectionAction.focus(null);
    }

    if (!editingContext.isEditing(position)) {
      editingContext.close();
    }
  };

  const handleScroll = useCallback(
    async (event: React.UIEvent<HTMLDivElement>) => {
      if (!isAtBottom(event)) {
        return;
      }

      const result = model?.getResult(resultIndex);
      if (result?.loadedFully) {
        return;
      }

      await model.requestDataPortion(0, model.countGain + model.source.count);
    },
    [model, resultIndex]
  );

  useEffect(() => {
    if (!modelResultData) {
      model
        .setSlice(0, model.countGain + model.source.count)
        .requestData();
    }
  }, [model, modelResultData]);

  const gridContext = useMemo<IDataGridContext>(() => ({
    model,
    columnResize,
    resultIndex,
    getEditorPortal: () => editorRef.current,
    getDataGridApi: () => dataGridRef.current,
  }), [model, resultIndex, editorRef, dataGridRef]);

  return styled(styles)(
    <DataGridContext.Provider value={gridContext}>
      <DataGridSortingContext.Provider value={gridSortingContext}>
        <DataGridSelectionContext.Provider value={gridSelectionContext}>
          <EditingContext.Provider value={editingContext}>
            <TableDataContext.Provider value={tableData}>
              <grid-container
                as='div'
                className="cb-react-grid-container"
                tabIndex={-1}
                onKeyDown={onKeydownHandler}
                onMouseDown={onMouseDownHandler}
                onMouseMove={onMouseMoveHandler}
              >
                <DataGrid
                  ref={dataGridRef}
                  className={`cb-react-grid-theme ${className}`}
                  columns={tableData.columns}
                  defaultColumnOptions={{
                    minWidth: 40,
                    resizable: true,
                    formatter: CellFormatter,
                  }}
                  rows={tableData.rows}
                  headerRowHeight={28}
                  rowHeight={24}
                  rowRenderer={RowRenderer}
                  onSelectedCellChange={handleFocusChange}
                  onColumnResize={(idx, width) => columnResize.execute({ column: idx, width })}
                  onScroll={handleScroll}
                />
                <div ref={editorRef} />
              </grid-container>
            </TableDataContext.Provider>
          </EditingContext.Provider>
        </DataGridSelectionContext.Provider>
      </DataGridSortingContext.Provider>
    </DataGridContext.Provider>
  );
});
