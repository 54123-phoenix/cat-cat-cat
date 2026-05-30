import { useRef } from 'react'
import { CameraIcon } from '@heroicons/react/24/outline'

export default function CameraButton({ onCapture, disabled = false }) {
  const inputRef = useRef(null)

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click()
    }
  }

  const handleChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      onCapture(file)
    }
    // Reset so the same file can be picked again
    e.target.value = ''
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />
      <button
        onClick={handleClick}
        disabled={disabled}
        className="camera-btn"
        aria-label="拍照识猫"
      >
        <CameraIcon className="w-16 h-16 text-white drop-shadow-md" />
      </button>
    </>
  )
}
