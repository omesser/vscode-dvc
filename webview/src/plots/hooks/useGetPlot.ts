import {
  CheckpointPlotData,
  CustomPlotData,
  PlotsSection,
  TemplatePlotEntry
} from 'dvc/src/plots/webview/contract'
import { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { PlainObject, VisualizationSpec } from 'react-vega'
import { plotDataStore } from '../components/plotDataStore'
import { PlotsState } from '../store'

const getStoreSection = (section: PlotsSection) => {
  switch (section) {
    case PlotsSection.CHECKPOINT_PLOTS:
      return 'checkpoint'
    case PlotsSection.TEMPLATE_PLOTS:
      return 'template'
    default:
      return 'custom'
  }
}

export const useGetPlot = (
  section: PlotsSection,
  id: string,
  spec?: VisualizationSpec
) => {
  const isPlotWithSpec =
    section === PlotsSection.CHECKPOINT_PLOTS ||
    section === PlotsSection.CUSTOM_PLOTS
  const storeSection = getStoreSection(section)
  const snapshot = useSelector(
    (state: PlotsState) => state[storeSection].plotsSnapshots
  )
  const [data, setData] = useState<PlainObject | undefined>(undefined)
  const [content, setContent] = useState<VisualizationSpec | undefined>(spec)

  const setPlotData = useCallback(() => {
    const plot = plotDataStore[section][id]
    if (!plot) {
      return
    }

    if (isPlotWithSpec) {
      setData({ values: (plot as CheckpointPlotData | CustomPlotData).values })
      setContent(spec)
      return
    }

    setData(undefined)
    setContent({
      ...(plot as TemplatePlotEntry).content,
      height: 'container',
      width: 'container'
    } as VisualizationSpec)
  }, [id, isPlotWithSpec, setData, setContent, section, spec])

  useEffect(() => {
    setPlotData()
  }, [snapshot, setPlotData])

  return { content, data }
}
