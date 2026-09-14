import { useEffect, useRef, useState } from 'react'
import { t } from '../lib/i18n.js'
import { isProfileImage, prepareProfileImage } from '../lib/profile-image.js'
import { Button } from './ui.jsx'
import Icon from './Icon.jsx'

export function ProfileAvatar({ value, name = '', className = '' }) {
  const [failed, setFailed] = useState(null)
  return <span className={'profile-avatar ' + className} aria-hidden="true">
    {isProfileImage(value) && failed !== value ? <img src={value} alt="" onError={() => setFailed(value)} /> : name.trim().slice(0, 1).toUpperCase() || <Icon name="person" />}
  </span>
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
      <ProfileAvatar value={value} name={name} />
      <div className="profile-photo-controls"><p className="profile-photo-title">{t('Profile photo')} <span className="small muted">{t('Optional')}</span></p>
        <p className="small muted">{t('JPG, PNG, or WebP · Up to 10 MB')}</p>
        <div className="profile-photo-actions">
          <Button type="button" size="sm" disabled={disabled || busy} onClick={() => input.current?.click()}>{busy ? t('Preparing photo…') : value ? t('Change photo') : t('Add photo')}</Button>
          {value && <Button type="button" size="sm" disabled={disabled || busy} onClick={() => { onChange(null); setError('') }}>{t('Remove photo')}</Button>}
        </div>
      </div>
    </div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} disabled={disabled || busy} aria-label={t('Choose profile photo')} hidden />
    {error && <p className="setup-error" role="alert">{error}</p>}
  </div>
}
