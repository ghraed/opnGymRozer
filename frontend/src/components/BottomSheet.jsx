import { useEffect, useId, useRef } from 'react'
import Icon from './Icon.jsx'

export default function BottomSheet({ title, description, className = '', dismissible = true, closeLabel = 'Close filters', onClose, children }) {
  const dialog = useRef(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const trigger = document.activeElement
    const previousOverflow = document.body.style.overflow
    dialog.current.showModal()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow; trigger?.focus() }
  }, [])
  return <dialog ref={dialog} className={'renewal-filter-dialog modal-bottom-sheet ' + className} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onCancel={event => { event.preventDefault(); if (dismissible) onClose() }}>
    <div className="row between bottom-sheet-heading"><h2 id={titleId}>{title}</h2><button type="button" className="iconbtn" disabled={!dismissible} onClick={onClose} aria-label={closeLabel}><Icon name="xmark" /></button></div>
    {description && <p id={descriptionId} className="bottom-sheet-description">{description}</p>}
    {children}
  </dialog>
}
