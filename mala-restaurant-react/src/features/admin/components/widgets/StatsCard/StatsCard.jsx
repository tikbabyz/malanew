import React from 'react'
import styles from './StatsCard.module.css'

export default function StatsCard({ 
  icon: Icon, 
  title, 
  value, 
  change, 
  color, 
  onClick,
  className = '',
  ...props 
}) {
  return (
    <div 
      className={`${styles.statCard} ${className} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
      {...props}
    >
      <div className={styles.statIcon} style={{ backgroundColor: color }}>
        <Icon />
      </div>
      <div className={styles.statContent}>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statLabel}>{title}</div>
        {change && (
          <div className={styles.statChange}>{change}</div>
        )}
      </div>
    </div>
  )
}