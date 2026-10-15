import styles from './Avatar.module.css'

const GRADIENTS = [
  ['#3d8bff', '#7a4dff'],
  ['#ff8a3d', '#ff4d6d'],
  ['#2ec4a6', '#2e8bc4'],
  ['#a64dff', '#ff4dc4'],
  ['#ffb23d', '#ff6a3d'],
  ['#4dc4ff', '#4d6bff'],
]

interface AvatarProps {
  name: string
  /** Стабильный ключ для цвета — chatId */
  seed: string
  size?: number
}

export function Avatar({ name, seed, size = 48 }: AvatarProps) {
  const [from, to] = GRADIENTS[hash(seed) % GRADIENTS.length]
  return (
    <span
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, ${from}, ${to})`,
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}

function initials(name: string): string {
  if (name.startsWith('+') || name.startsWith('ID')) return '#'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase()
}

function hash(value: string): number {
  let h = 0
  for (const char of value) h = (h * 31 + char.charCodeAt(0)) | 0
  return Math.abs(h)
}
