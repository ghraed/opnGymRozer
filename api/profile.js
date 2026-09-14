const positive = value => ['number', 'string'].includes(typeof value) && Number.isFinite(Number(value)) && Number(value) > 0

export function profileStepError(profile = {}, step = 0) {
  if (step === 0) {
    if (!['muscle', 'strength', 'lose_weight', 'fitness'].includes(profile.goal)) return 'Choose your main goal'
    if (!positive(profile.currentWeight)) return 'Enter a valid weight'
    if (!positive(profile.height)) return 'Enter a valid height'
    if (profile.goal === 'lose_weight' && (!positive(profile.targetWeight) || Number(profile.targetWeight) >= Number(profile.currentWeight))) return 'Enter a target weight below your current weight'
  }
  if (step === 1) {
    if (!positive(profile.days) || !Number.isInteger(Number(profile.days)) || Number(profile.days) < 2 || Number(profile.days) > 6) return 'Choose how many days you can train'
    if (!['beginner', 'intermediate', 'advanced'].includes(profile.experience)) return 'Choose your training experience'
    if (!['full_gym', 'dumbbells', 'bodyweight'].includes(profile.equipment)) return 'Choose your available equipment'
    if (!['male', 'female', 'none'].includes(profile.body)) return 'Choose your body diagram preference'
  }
  return ''
}

export const profileComplete = profile => !!profile && positive(profile.completedAt) && !profileStepError(profile, 0) && !profileStepError(profile, 1)
