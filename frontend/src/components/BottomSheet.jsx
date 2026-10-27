import { useEffect, useId, useRef } from 'react'
import Icon from './Icon.jsx'

export default function BottomSheet({ title, description, className = '', onClose, children }) {
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
  return <dialog ref={dialog} className={'renewal-filter-dialog modal-bottom-sheet ' + className} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="row between bottom-sheet-heading"><h2 id={titleId}>{title}</h2><button type="button" className="iconbtn" onClick={onClose} aria-label="Close filters"><Icon name="xmark" /></button></div>
    {description && <p id={descriptionId} className="bottom-sheet-description">{description}</p>}
    {children}
  </dialog>
}
