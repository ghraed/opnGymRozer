// Preserve bookmarked hash routes when the web app moves to browser history.
export function legacyWebPath(hash) {
  if (!hash.startsWith('#/') || hash.startsWith('#//')) return null
  const route = new URL(hash.slice(1), 'https://local.invalid')
  if (route.origin !== 'https://local.invalid') return null
  return route.pathname + route.search + route.hash
}

const withQuery = (path, params) => path + (params.size ? '?' + params.toString() : '')

export function legacyAdminPath(search, isAdmin = true) {
  const params = new URLSearchParams(search)
  const section = params.get('section')
  if (!params.has('section') && !params.has('q')) return null
  params.delete('section')
  const path = section === 'membership' ? (isAdmin ? '/admin/renewals' : '/admin/members')
    : ['members', 'invites', 'activity'].includes(section) ? '/admin/' + section
    : params.has('q') ? '/admin/members' : '/admin'
  return withQuery(path, params)
}

export function legacyRenewalPath(search) {
  const params = new URLSearchParams(search)
  if (!params.has('member')) return null
  const memberId = params.get('member')
  params.delete('member')
  return withQuery('/admin/renewals' + (memberId ? '/' + encodeURIComponent(memberId) : ''), params)
}
