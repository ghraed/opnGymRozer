export const ROLES = ['client', 'trainer', 'admin']
export const isStaff = user => ['trainer', 'admin'].includes(user?.role)
export const canViewUser = (actor, target) => actor?.role === 'admin' || (actor?.role === 'trainer' && target?.role === 'client')
export const publicUser = user => ({ id: user.id, name: user.name, role: user.role,
  // Kept for older clients: this flag grants access to the staff dashboard, not admin privileges.
  admin: isStaff(user), activated: isStaff(user) || !!user.activated })
