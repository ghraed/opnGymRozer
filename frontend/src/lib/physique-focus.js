// Product physique goals, not biological requirements or guaranteed body shapes.
// The training principles and load selection are shared across sexes.
const BALANCED = { id: 'balanced', label: 'Balanced muscle development', muscles: [], description: 'Balanced training across all major muscle groups.' }
const FEMININE = {
  id: 'feminine', label: 'Feminine physique · glutes and lower body',
  muscles: ['glutes', 'hamstrings', 'quads'],
  description: 'Prioritizes glutes and legs while maintaining upper-body and core training.',
}
const V_SHAPE = {
  id: 'v_shape', label: 'Muscular V-shape · back and shoulders',
  muscles: ['back', 'shoulders'],
  description: 'Prioritizes back width and shoulder development while maintaining chest, legs, and core training.',
}
export const physiqueFocusFor = profile => profile?.sex === 'female' ? FEMININE : profile?.sex === 'male' ? V_SHAPE : BALANCED
