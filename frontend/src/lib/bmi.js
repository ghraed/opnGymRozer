const KG_PER_LB = 0.45359237
const GRAPH_MIN = 15
const GRAPH_MAX = 40

// Adult BMI: weight in kilograms divided by height in metres squared.
export function bmiFor(weight, heightCm, unit = 'kg') {
  const w = Number(weight)
  const h = Number(heightCm) / 100
  if (!(w > 0) || !(h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) return null
  const kg = unit === 'lb' ? w * KG_PER_LB : w
  return Math.round((kg / (h * h)) * 10) / 10
}

export function bmiBand(value) {
  if (!(value >= 0)) return null
  if (value < 18.5) return 'underweight'
  if (value < 25) return 'healthy'
  if (value < 30) return 'overweight'
  return 'obesity'
}

// The visual scale focuses on the useful 15–40 interval; values outside it pin
// to an edge while their real value remains visible in the headline.
export function bmiPosition(value) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, ((value - GRAPH_MIN) / (GRAPH_MAX - GRAPH_MIN)) * 100))
}
