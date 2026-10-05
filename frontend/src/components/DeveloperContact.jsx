import Icon from './Icon.jsx'
import { t } from '../lib/i18n.js'
import { confirmSheet } from '../sheets.jsx'
import { contactDeveloper } from '../lib/developer-contact.js'
import { useStore } from '../store/useStore.js'

export default function DeveloperContact() {
  const user = useStore(s => s.user)
  const label = `${t('Contact developer')}: +96171251044`
  const confirm = () => confirmSheet({
    className: user ? '' : 'auth-gold',
    message: t('do you want to contact the developer for any help'),
    confirmText: t('Contact developer'),
    onConfirm: contactDeveloper,
  })
  return <button type="button" className="iconbtn developer-contact" onClick={confirm} aria-label={label} title={label}>
    <Icon name="code" />
  </button>
}
