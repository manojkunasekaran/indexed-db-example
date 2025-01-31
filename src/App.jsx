import { useEffect, useState } from 'react'
import './App.css'
import { userPreferenceStoreKeys, useUserPreferences } from './hooks/useUserPreferences'

const defaultButtonCount = 0;

function App() {
  const [count, setCount] = useState(defaultButtonCount)

  const { isPreferenceDBInitialized, getPreference, setPreference } = useUserPreferences()

  useEffect(() => {
    if(isPreferenceDBInitialized){
      getPreference(userPreferenceStoreKeys.buttonClickCount).then(existingCount => 
        existingCount && setCount(existingCount)
      )
    }

  },[getPreference])

  const handleButtonClick = () => {
    setPreference(userPreferenceStoreKeys.buttonClickCount, count+1)
    setCount((count) => count + 1)
  }

  const handleResetCount = () => {
    setPreference(userPreferenceStoreKeys.buttonClickCount, defaultButtonCount)
    setCount(defaultButtonCount)
  }
  
  return (
    <>
      <h1>Indexed-db-example</h1>
      <p>click on count button to increament, increamented count value will be present even after refresh.</p>
      <div className="card">
        <button onClick={handleButtonClick}>
          count is {count}
        </button>
        <button onClick={handleResetCount}>
          Reset
        </button>
      </div>
    </>
  )
}

export default App
