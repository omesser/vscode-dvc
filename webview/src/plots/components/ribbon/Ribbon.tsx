import cx from 'classnames'
import { MessageFromWebviewType } from 'dvc/src/webview/contract'
import React, { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useInView } from 'react-intersection-observer'
import styles from './styles.module.scss'
import { RibbonBlock } from './RibbonBlock'
import { update } from './ribbonSlice'
import { sendMessage } from '../../../shared/vscode'
import { IconButton } from '../../../shared/components/button/IconButton'
import { PlotsState } from '../../store'
import { Lines, Refresh } from '../../../shared/components/icons'

const MAX_NB_EXP = 7

export const Ribbon: React.FC = () => {
  const [ref, needsShadow] = useInView({
    root: document.querySelector('#webview-wrapper'),
    rootMargin: '-5px',
    threshold: 0.95
  })
  const measurementsRef = useRef<HTMLUListElement>()
  const dispatch = useDispatch()

  const revisions = useSelector(
    (state: PlotsState) => state.webview.selectedRevisions
  )

  const changeRibbonHeight = useCallback(
    () =>
      measurementsRef.current &&
      dispatch(update(measurementsRef.current.getBoundingClientRect().height)),
    [dispatch]
  )

  useEffect(() => {
    changeRibbonHeight()
  }, [revisions, changeRibbonHeight])

  useEffect(() => {
    window.addEventListener('resize', changeRibbonHeight)

    return () => {
      window.removeEventListener('resize', changeRibbonHeight)
    }
  }, [changeRibbonHeight])

  const removeRevision = (revision: string) => {
    sendMessage({
      payload: revision,
      type: MessageFromWebviewType.TOGGLE_EXPERIMENT
    })
  }

  const refreshRevisions = () =>
    sendMessage({
      payload: revisions.map(({ revision }) => revision),
      type: MessageFromWebviewType.REFRESH_REVISIONS
    })

  const selectRevisions = () => {
    sendMessage({
      type: MessageFromWebviewType.SELECT_EXPERIMENTS
    })
  }

  return (
    <ul
      ref={node => {
        if (node) {
          measurementsRef.current = node
        }
        ref(node)
      }}
      data-testid="ribbon"
      className={cx(styles.list, needsShadow && styles.withShadow)}
    >
      <li className={styles.buttonWrapper}>
        <IconButton
          onClick={selectRevisions}
          icon={Lines}
          text={`${revisions.length} of ${MAX_NB_EXP}`}
        />
      </li>
      <li className={styles.buttonWrapper}>
        <IconButton
          onClick={refreshRevisions}
          icon={Refresh}
          text="Refresh All"
          appearance="secondary"
        />
      </li>
      {revisions.map(revision => (
        <RibbonBlock
          revision={revision}
          key={revision.revision}
          onClear={() => removeRevision(revision.id || '')}
        />
      ))}
    </ul>
  )
}
