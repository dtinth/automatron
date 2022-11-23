import { useEffect, useState } from 'react'

function App() {
  return <Clock />
}

const getTime = () => {
  return new Date().toString().split(' ')[4].split(':').slice(0, 2).join(':')
}
function Clock() {
  const [time, setTime] = useState(getTime)
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [])
  return (
    <div className="come-up flex h-screen items-center justify-center text-transparent [font:bold_37.5vw_Arimo] [-webkit-text-stroke:0.5px_#d7fc70]">
      {time}
    </div>
  )
}

export default App
