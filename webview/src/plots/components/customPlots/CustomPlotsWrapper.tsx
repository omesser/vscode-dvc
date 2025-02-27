import { PlotsSection } from 'dvc/src/plots/webview/contract'
import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { MessageFromWebviewType } from 'dvc/src/webview/contract'
import { CustomPlots } from './CustomPlots'
import { changeSize } from './customPlotsSlice'
import { PlotsContainer } from '../PlotsContainer'
import { PlotsState } from '../../store'
import { sendMessage } from '../../../shared/vscode'

export const CustomPlotsWrapper: React.FC = () => {
  const { plotsIds, nbItemsPerRow, isCollapsed, height } = useSelector(
    (state: PlotsState) => state.custom
  )
  const [selectedPlots, setSelectedPlots] = useState<string[]>([])
  useEffect(() => {
    setSelectedPlots(plotsIds)
  }, [plotsIds, setSelectedPlots])
  const addCustomPlot = () => {
    sendMessage({ type: MessageFromWebviewType.ADD_CUSTOM_PLOT })
  }

  const removeCustomPlots = () => {
    sendMessage({ type: MessageFromWebviewType.REMOVE_CUSTOM_PLOTS })
  }

  const hasItems = plotsIds.length > 0

  return (
    <PlotsContainer
      title="Custom"
      sectionKey={PlotsSection.CUSTOM_PLOTS}
      nbItemsPerRowOrWidth={nbItemsPerRow}
      sectionCollapsed={isCollapsed}
      addPlotsButton={{ onClick: addCustomPlot }}
      removePlotsButton={hasItems ? { onClick: removeCustomPlots } : undefined}
      changeSize={changeSize}
      hasItems={hasItems}
      height={height}
    >
      <CustomPlots plotsIds={selectedPlots} />
    </PlotsContainer>
  )
}
