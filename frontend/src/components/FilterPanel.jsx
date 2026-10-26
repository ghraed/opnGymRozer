import { useEffect, useId, useRef, useState } from 'react'
import { Button } from './ui.jsx'
import Icon from './Icon.jsx'

export default function FilterPanel({ title, legend, value, options, resetValue = 'all', applyLabel = 'Show results', onApply, onClose }) {
  const dialog = useRef(null)
  const titleId = useId()
  const groupId = useId()
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    const trigger = document.activeElement
    dialog.current.showModal()
    return () => { trigger?.focus() }
  }, [])
  return <dialog ref={dialog} className="renewal-filter-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="row between"><h2 id={titleId}>{title}</h2><button type="button" className="iconbtn" onClick={onClose} aria-label="Close filters"><Icon name="xmark" /></button></div>
    <form onSubmit={event => { event.preventDefault(); onApply(draft) }}>
      <fieldset><legend>{legend}</legend>{options.map(option => <label className="renewal-filter-option" key={option.value}>
        <input type="radio" name={groupId} value={option.value} checked={draft === option.value} onChange={() => setDraft(option.value)} />
        <span>{option.label}</span>{option.count != null && <span className="renewal-filter-count">{option.count}</span>}
      </label>)}</fieldset>
      <div className="renewal-filter-actions"><Button type="button" onClick={() => setDraft(resetValue)}>Reset</Button><Button type="submit" variant="primary">{applyLabel}</Button></div>
    </form>
  </dialog>
}
