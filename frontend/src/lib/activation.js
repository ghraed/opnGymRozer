// A signed-in client needs an explicit server approval. Guests and trainers
// retain their existing access; activation is separate from account suspension.
export const needsActivation = user => !!user && !user.admin && user.activated !== true
