import { useId, useState } from 'react'
import { Button } from './ui.jsx'
import BottomSheet from './BottomSheet.jsx'

export default function FilterPanel({ title, legend, value, options, resetValue = 'all', applyLabel = 'Show results', onApply, onClose }) {
  const groupId = useId()
  const [draft, setDraft] = useState(value)
  return <BottomSheet title={title} onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); onApply(draft) }}>
      <fieldset><legend>{legend}</legend>{options.map(option => <label className="renewal-filter-option" key={option.value}>
        <input type="radio" name={groupId} value={option.value} checked={draft === option.value} onChange={() => setDraft(option.value)} />
        <span>{option.label}</span>{option.count != null && <span className="renewal-filter-count">{option.count}</span>}
      </label>)}</fieldset>
      <div className="renewal-filter-actions"><Button type="button" onClick={() => setDraft(resetValue)}>Reset</Button><Button type="submit" variant="primary">{applyLabel}</Button></div>
    </form>
  </BottomSheet>
}
