import React from 'react'
import { FaClock } from 'react-icons/fa'
import dayjs from 'dayjs'
import 'dayjs/locale/th'
import styles from './ClockWidget.module.css'

dayjs.locale('th')

export default function ClockWidget() {
  const [currentTime, setCurrentTime] = React.useState(dayjs())
  
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className={styles.clockWidget}>
      <div className={styles.widgetIcon}>
        <FaClock />
      </div>
      <div className={styles.clockDisplay}>
        <div className={styles.timeDisplay}>
          {currentTime.format("HH:mm:ss")}
        </div>
        <div className={styles.dateDisplay}>
          {currentTime.format("DD/MM/YYYY")}
        </div>
      </div>
    </div>
  )
}