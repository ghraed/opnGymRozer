import { useState } from 'react'
import { gifSrc, imgSrc } from '../lib/exercises.js'
import Icon from './Icon.jsx'

// Receives the client's exercise explicitly; never reads the trainer's custom library.
export default function ExercisePreview({ exercise }) {
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [gifFailed, setGifFailed] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const canPlay = !!exercise.gif && !gifFailed
  const animated = playing && canPlay
  const source = animated ? gifSrc(exercise) : exercise.img && !imageFailed ? imgSrc(exercise) : null
  return <figure className="trainer-exercise-preview">
    {source ? <img src={source} alt={`${exercise.n} demonstration`} loading="lazy" decoding="async"
      onError={() => animated ? setGifFailed(true) : setImageFailed(true)} />
      : <div className="trainer-preview-empty"><Icon name="dumbbell" /><span>{canPlay ? 'Animation paused' : 'No demo available'}</span></div>}
    {canPlay && <button type="button" className="trainer-preview-toggle" aria-label={`${animated ? 'Pause' : 'Play'} ${exercise.n} demonstration`} aria-pressed={animated} onClick={() => setPlaying(value => !value)}>
      <Icon name={animated ? 'pause' : 'play'} />{animated ? 'Pause GIF' : 'Play GIF'}
    </button>}
  </figure>
}
