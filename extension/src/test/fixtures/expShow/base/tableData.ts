import { TableData } from '../../../../experiments/webview/contract'
import rowsFixture from './rows'
import columnsFixture from './columns'

const tableDataFixture: TableData = {
  filteredCounts: { experiments: 0, checkpoints: 0 },
  rows: rowsFixture,
  columns: columnsFixture,
  filters: [],
  hasCheckpoints: true,
  hasConfig: true,
  hasRunningExperiment: true,
  hasValidDvcYaml: true,
  hasColumns: true,
  sorts: [],
  changes: [],
  columnOrder: [],
  columnWidths: {}
}

export default tableDataFixture
