import { useEffect, useState } from 'react'
import { accountingMoney } from '../lib/accounting.js'
import { interpolateAmount } from '../lib/profit-loss.js'

export default function AnimatedMoney({ amount, currency }) {
  const [progress, setProgress] = useState(() => typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0)
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame, start
    const finish = () => { if (motion.matches) { cancelAnimationFrame(frame); setProgress(1) } }
    motion.addEventListener('change', finish)
    if (!motion.matches && Number(amount) !== 0) {
      setProgress(0)
      const tick = timestamp => {
        start ??= timestamp
        const elapsed = Math.min(1, (timestamp - start) / 850)
        setProgress(1 - (1 - elapsed) ** 3)
        if (elapsed < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    } else setProgress(1)
    return () => { cancelAnimationFrame(frame); motion.removeEventListener('change', finish) }
  }, [amount, currency])
  const final = accountingMoney(amount, currency)
  return <span className="animated-money"><span className="pnl-sr-only">{final}</span><span className="animated-money-reserve" aria-hidden="true">{final}</span><span className="animated-money-value" aria-hidden="true">{accountingMoney(interpolateAmount(amount, progress), currency)}</span></span>
}
