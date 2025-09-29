import React from 'react'
import { FaCloud, FaWater, FaWind } from 'react-icons/fa'
import styles from './WeatherWidget.module.css'

export default function WeatherWidget() {
  const [weather, setWeather] = React.useState({
    temp: 32,
    condition: 'sunny',
    humidity: 65,
    windSpeed: 8,
    location: 'กรุงเทพฯ'
  })

  React.useEffect(() => {
    const timer = setInterval(() => {
      setWeather(prev => ({
        ...prev,
        temp: Math.floor(Math.random() * 10) + 28,
        humidity: Math.floor(Math.random() * 30) + 50,
        windSpeed: Math.floor(Math.random() * 15) + 5
      }))
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className={styles.weatherWidget}>
      <div className={styles.widgetIcon}>
        <FaCloud />
      </div>
      <div className={styles.weatherInfo}>
        <div className={styles.tempDisplay}>
          {weather.temp}°C
        </div>
        <div className={styles.locationDisplay}>
          {weather.location}
        </div>
        <div className={styles.weatherDetails}>
          <span><FaWater /> {weather.humidity}%</span>
          <span><FaWind /> {weather.windSpeed} km/h</span>
        </div>
      </div>
    </div>
  )
}