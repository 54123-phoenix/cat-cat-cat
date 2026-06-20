import { Component } from 'react'
import MascotCat from './MascotCat'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-warm-50 p-6">
          <div className="card clay-card max-w-sm w-full text-center space-y-5 animate-scale-in">
            <div className="flex justify-center">
              <MascotCat mood="sad" size={88} />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-text">喵呜～页面出了点小状况</h2>
              <p className="text-sm text-text-secondary">
                这只猫猫不小心打翻了什么，刷新一下试试看？
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="clay-btn w-full"
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
