import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'
import { t } from '../lib/i18n.js'

export default function ExerciseActionsMenu({ name, actions }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef(null)
  const menu = useRef(null)
  const id = useId()
  const close = () => { setOpen(false); trigger.current?.focus() }

  useLayoutEffect(() => {
    if (!open) return
    const anchor = trigger.current.getBoundingClientRect()
    const panel = menu.current
    const bounds = panel.getBoundingClientRect()
    panel.style.left = `${Math.max(8, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 8))}px`
    panel.style.top = `${Math.max(8, Math.min(anchor.bottom + 4, window.innerHeight - bounds.height - 8))}px`
    panel.querySelector('button')?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const dismiss = event => {
      if (!menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false)
    }
    const reposition = event => {
      if (!menu.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('focusin', dismiss)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('focusin', dismiss)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  return <>
    <button ref={trigger} type="button" className="iconbtn"
      aria-label={t('Exercise actions for {0}', name)} aria-haspopup="menu" aria-expanded={open}
      aria-controls={open ? id : undefined}
      onClick={event => { event.stopPropagation(); setOpen(!open) }}>
      <Icon name="ellipsisVertical" />
    </button>
    {open && createPortal(<div ref={menu} id={id} className="exercise-actions-menu" role="menu"
      aria-label={t('Exercise actions for {0}', name)} onClick={event => event.stopPropagation()}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
        const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
        if (!keys.includes(event.key)) return
        event.preventDefault()
        const items = [...menu.current.querySelectorAll('button')]
        const current = items.indexOf(document.activeElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next]?.focus()
      }}>
      {actions.map(action => <button key={action.label} type="button"
        role={action.checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={action.checked}
        className={action.danger ? 'danger' : ''}
        onClick={() => { close(); action.onClick() }}>
        <Icon name={action.icon} /><span>{action.label}</span>
        {action.checked && <Icon name="check" className="exercise-action-check" />}
      </button>)}
    </div>, document.body)}
  </>
}
