import { configureStore } from '@reduxjs/toolkit'
import checkpointPlotsReducer from './components/checkpointPlots/checkpointPlotsSlice'
import comparisonTableReducer from './components/comparisonTable/comparisonTableSlice'
import templatePlotsReducer from './components/templatePlots/templatePlotsSlice'
import customPlotsReducer from './components/customPlots/customPlotsSlice'
import webviewReducer from './components/webviewSlice'
import ribbonReducer from './components/ribbon/ribbonSlice'
import dragAndDropReducer from '../shared/components/dragDrop/dragDropSlice'

export const plotsReducers = {
  checkpoint: checkpointPlotsReducer,
  comparison: comparisonTableReducer,
  custom: customPlotsReducer,
  dragAndDrop: dragAndDropReducer,
  ribbon: ribbonReducer,
  template: templatePlotsReducer,
  webview: webviewReducer
}

export const plotsStore = configureStore({
  reducer: plotsReducers
})

export type PlotsState = ReturnType<typeof plotsStore.getState>
export type PlotsDispatch = typeof plotsStore.dispatch
