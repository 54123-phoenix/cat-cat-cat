import { useLaunch } from '@tarojs/taro'
import { PropsWithChildren } from 'react'
import { initStorage } from './utils/storage'
import './app.scss'

function App({ children }: PropsWithChildren<object>) {
  useLaunch(() => {
    initStorage()
    console.log('猫猫社区小程序启动')
  })

  return children
}

export default App
