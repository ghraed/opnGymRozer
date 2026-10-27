import { useState } from 'react'
import BottomSheet from './BottomSheet.jsx'
import { Button, Segmented } from './ui.jsx'

const dateText = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export default function AccountingFilters({ kind, value, onApply, onClose }) {
  const report = kind === 'report'
  const title = report ? 'Filter profit & loss' : kind === 'revenue' ? 'Filter revenue' : 'Filter expenses'
  const [draft, setDraft] = useState(value)
  const now = new Date()
  const periods = [
    { label: 'This month', from: dateText(new Date(now.getFullYear(), now.getMonth(), 1)), to: dateText(now) },
    { label: 'Last month', from: dateText(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: dateText(new Date(now.getFullYear(), now.getMonth(), 0)) },
    { label: 'This year', from: dateText(new Date(now.getFullYear(), 0, 1)), to: dateText(now) },
  ]
  const field = key => ({ value: draft[key], onChange: event => setDraft(current => ({ ...current, [key]: event.target.value })) })
  const valid = draft.from && draft.to && draft.from >= '2000-01-01' && draft.from <= draft.to
  return <BottomSheet title={title} description={report ? 'Choose a date range and currency for your report.' : 'Choose a date range, currency and entry status.'} className="revenue-filter-sheet" onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); if (valid) onApply(draft) }}>
      <fieldset className="revenue-period-field"><legend>Date range</legend>
        <div className="revenue-period-shortcuts">{periods.map(period => <button key={period.label} type="button" aria-pressed={draft.from === period.from && draft.to === period.to} onClick={() => setDraft(current => ({ ...current, from: period.from, to: period.to }))}>{period.label}</button>)}</div>
        <div className="revenue-date-fields"><label>From<input className="input" type="date" required min="2000-01-01" max={draft.to || '9999-12-31'} {...field('from')} /></label><label>To<input className="input" type="date" required min={draft.from || '2000-01-01'} max="9999-12-31" {...field('to')} /></label></div>
        {!valid && <p role="alert" className="accounting-error">Choose a start date on or before the end date, starting in 2000 or later.</p>}
      </fieldset>
      <fieldset><legend>Currency</legend><Segmented value={draft.currency} options={[{ value: 'all', label: 'All currencies' }, { value: 'USD', label: 'USD' }, { value: 'LBP', label: 'LBP' }]} onChange={currency => setDraft(current => ({ ...current, currency }))} /><p className="revenue-filter-note">USD and LBP totals are shown separately.</p></fieldset>
      {!report && <fieldset><legend>Entry status</legend><Segmented value={draft.status} options={[{ value: 'posted', label: 'Posted' }, { value: 'voided', label: 'Voided' }, { value: 'all', label: 'All entries' }]} onChange={status => setDraft(current => ({ ...current, status }))} /></fieldset>}
      <div className="renewal-filter-actions revenue-filter-footer"><Button type="button" onClick={() => setDraft({ from: periods[0].from, to: periods[0].to, currency: 'all', status: 'posted' })}>Reset</Button><Button type="submit" variant="primary" icon="check" disabled={!valid}>Apply filters</Button></div>
    </form>
  </BottomSheet>
}
