import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../lib/i18n.js'
import { isProfileImage, prepareProfileImage } from '../lib/profile-image.js'
import { Button } from './ui.jsx'
import Icon from './Icon.jsx'

export function ProfileAvatar({ value, name = '', className = '', viewable = false }) {
  const [failed, setFailed] = useState(null)
  const [viewer, setViewer] = useState(null)
  const [shown, setShown] = useState(false)
  const button = useRef(null)
  const closeButton = useRef(null)
  const photo = useRef(null)
  const valid = isProfileImage(value) && failed !== value

  useEffect(() => {
    if (!viewer) return
    const frame = requestAnimationFrame(() => setShown(true))
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); setShown(false) }
      if (event.key === 'Tab') { event.preventDefault(); closeButton.current?.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      button.current?.focus()
    }
  }, [viewer?.value])

  useEffect(() => {
    if (!viewer || shown) return
    const timeout = setTimeout(() => setViewer(null), 320)
    return () => clearTimeout(timeout)
  }, [viewer, shown])

  useEffect(() => { if (viewer && value !== viewer.value) { setShown(false); setViewer(null) } }, [value, viewer])

  const avatar = <span className={'profile-avatar ' + className} aria-hidden="true">
    {valid ? <img ref={photo} src={value} alt="" onError={() => setFailed(value)} /> : name.trim().slice(0, 1).toUpperCase() || <Icon name="person" />}
  </span>
  if (!viewable || !valid) return avatar

  const open = () => {
    const rect = button.current.getBoundingClientRect()
    const ratio = (photo.current?.naturalWidth || 1) / (photo.current?.naturalHeight || 1)
    const maxWidth = Math.min(window.innerWidth * .86, 620)
    const maxHeight = window.innerHeight * .72
    const width = Math.min(maxWidth, maxHeight * ratio)
    const height = width / ratio
    setViewer({ value, style: {
      width, height,
      '--photo-x': `${rect.left + rect.width / 2 - window.innerWidth / 2}px`,
      '--photo-y': `${rect.top + rect.height / 2 - window.innerHeight / 2}px`,
      '--photo-scale-x': rect.width / width,
      '--photo-scale-y': rect.height / height,
    } })
  }
  return <>
    <button ref={button} type="button" className="profile-avatar-button" aria-label={t('View profile photo')} onClick={open}>{avatar}</button>
    {viewer && createPortal(<div className={'profile-photo-viewer' + (shown ? ' is-open' : '')} role="dialog" aria-modal="true" aria-label={t('Profile photo')}>
      <button className="profile-photo-backdrop" type="button" aria-label={t('Close profile photo')} onClick={() => setShown(false)} />
      <img className="profile-photo-full" src={viewer.value} alt={t('{0} profile photo', name || t('User'))} style={viewer.style} />
      <button ref={closeButton} className="profile-photo-close" type="button" aria-label={t('Close profile photo')} onClick={() => setShown(false)}><Icon name="xmark" /></button>
    </div>, document.body)}
  </>
}

export default function ProfilePhoto({ value, name, onChange, onBusyChange, disabled = false }) {
  const input = useRef(null)
  const mounted = useRef(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const pick = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true); onBusyChange?.(true); setError('')
    try {
      const image = await prepareProfileImage(file)
      if (mounted.current) onChange(image)
    } catch (e) { if (mounted.current) setError(t(e.message)) }
    finally { if (mounted.current) { setBusy(false); onBusyChange?.(false) } }
  }
  return <div className="profile-photo-picker">
    <div className="profile-photo-row">
      <ProfileAvatar value={value} name={name} viewable />
      <div className="profile-photo-controls"><p className="profile-photo-title">{t('Profile photo')} <span className="small muted">{t('Optional')}</span></p>
        <p className="small muted">{t('JPG, PNG, or WebP · Up to 10 MB')}</p>
        <div className="profile-photo-actions">
          <Button type="button" size="sm" disabled={disabled || busy} onClick={() => input.current?.click()}>{busy ? t('Preparing photo…') : value ? t('Change photo') : t('Upload profile photo')}</Button>
          {value && <Button type="button" size="sm" disabled={disabled || busy} onClick={() => { onChange(null); setError('') }}>{t('Remove photo')}</Button>}
        </div>
      </div>
    </div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} disabled={disabled || busy} aria-label={t('Choose profile photo')} hidden />
    {error && <p className="setup-error" role="alert">{error}</p>}
  </div>
}
