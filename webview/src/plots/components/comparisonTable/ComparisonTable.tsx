import { ComparisonPlots, Revision } from 'dvc/src/plots/webview/contract'
import { reorderObjectList } from 'dvc/src/util/array'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { MessageFromWebviewType } from 'dvc/src/webview/contract'
import {
  ComparisonTableColumn,
  ComparisonTableHead
} from './ComparisonTableHead'
import { ComparisionTableRows } from './ComparisonTableRows'
import plotsStyles from '../styles.module.scss'
import { withScale, withVariant } from '../../../util/styles'
import { sendMessage } from '../../../shared/vscode'
import { PlotsState } from '../../store'
import { EmptyState } from '../../../shared/components/emptyState/EmptyState'

export const ComparisonTable: React.FC = () => {
  const { revisions, plots, width } = useSelector(
    (state: PlotsState) => state.comparison
  )

  const pinnedColumn = useRef('')
  const [columns, setColumns] = useState<ComparisonTableColumn[]>([])
  const [comparisonPlots, setComparisonPlots] = useState<ComparisonPlots>([])

  const isPinned = (column: ComparisonTableColumn): boolean =>
    column.revision === pinnedColumn.current

  const getPinnedColumnRevision = useCallback(
    () => revisions?.find(isPinned) || null,
    [revisions]
  )

  useEffect(
    // eslint-disable-next-line sonarjs/cognitive-complexity
    () =>
      setColumns(() => {
        const acc: Revision[] = []

        for (const column of revisions || []) {
          if (isPinned(column)) {
            continue
          }
          acc.push(column)
        }

        return [getPinnedColumnRevision(), ...acc].filter(
          Boolean
        ) as ComparisonTableColumn[]
      }),
    [revisions, getPinnedColumnRevision]
  )

  useEffect(() => {
    setComparisonPlots(plots)
  }, [plots])

  if (!plots || plots.length === 0) {
    return <EmptyState isFullScreen={false}>No Images to Compare</EmptyState>
  }

  const setColumnsOrder = (order: string[]) => {
    const newOrder = reorderObjectList<Revision>(order, columns, 'revision')
    setColumns(newOrder)
    sendMessage({
      payload: newOrder.map(({ revision }) => revision),
      type: MessageFromWebviewType.REORDER_PLOTS_COMPARISON
    })
  }

  const changePinnedColumn = (column: string) => {
    pinnedColumn.current = pinnedColumn.current === column ? '' : column

    setColumnsOrder(
      (
        [
          getPinnedColumnRevision(),
          ...columns.filter(column => !isPinned(column))
        ].filter(Boolean) as ComparisonTableColumn[]
      ).map(({ revision }) => revision)
    )
  }

  return (
    <table
      className={plotsStyles.comparisonTable}
      style={{ ...withScale(columns.length), ...withVariant(width) }}
    >
      <ComparisonTableHead
        columns={columns}
        pinnedColumn={pinnedColumn.current}
        setColumnsOrder={setColumnsOrder}
        setPinnedColumn={changePinnedColumn}
      />
      <ComparisionTableRows
        plots={comparisonPlots}
        columns={columns}
        pinnedColumn={pinnedColumn.current}
      />
    </table>
  )
}
