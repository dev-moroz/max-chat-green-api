import type { PollerStatus } from '../../services/notificationPoller'
import styles from './ConnectionStatus.module.css'

const LABELS: Record<PollerStatus, string> = {
  connecting: 'Подключение…',
  online: 'В сети',
  offline: 'Нет связи, переподключаемся…',
  standby: 'Сообщения принимает другая вкладка',
}

export function ConnectionStatus({ status }: { status: PollerStatus }) {
  return (
    <span className={styles.status} data-status={status} role="status">
      <span className={styles.dot} aria-hidden="true" />
      {LABELS[status]}
    </span>
  )
}
