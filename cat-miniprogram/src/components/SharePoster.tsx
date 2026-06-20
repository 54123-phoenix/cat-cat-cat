import { View, Canvas, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'

interface SharePosterProps {
  cat: any
  visible: boolean
  onClose: () => void
}

function qrEncode(text: string): number[][] {
  const len = text.length
  const size = 25
  const modules: number[][] = Array.from({ length: size }, () => Array(size).fill(0))
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
    const v = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) ? 1 : 0
    modules[r][c] = v; modules[r][size - 1 - c] = v; modules[size - 1 - r][c] = v
  }
  for (let i = 8; i < size - 8; i++) { modules[6][i] = i % 2 === 0 ? 1 : 0; modules[i][6] = i % 2 === 0 ? 1 : 0 }
  let bitIdx = 0
  const bits: number[] = []
  for (let i = 0; i < len; i++) { const code = text.charCodeAt(i); for (let b = 7; b >= 0; b--) bits.push((code >> b) & 1) }
  for (let i = 0; i < 8; i++) bits.push(0)
  for (let row = size - 1; row >= 0; row -= 2) {
    if (row === 6) row = 5
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const c = vert % 2 === 0 ? (size - 1 - j) : j
        const r = row
        if (r < 0 || r >= size || c < 0 || c >= size) continue
        if ((r < 9 && c < 9) || (r < 9 && c >= size - 8) || (r >= size - 8 && c < 9) || r === 6 || c === 6) continue
        if (bitIdx < bits.length) { modules[r][c] = bits[bitIdx]; bitIdx++ }
      }
    }
  }
  return modules
}

export default function SharePoster({ cat, visible, onClose }: SharePosterProps) {
  const [qrData, setQrData] = useState<number[][] | null>(null)

  useEffect(() => {
    if (!visible || !cat) return
    const path = `/pages/cat-detail/index?id=${cat.id}`
    setQrData(qrEncode(path))
    drawPoster()
  }, [visible, cat])

  const drawPoster = () => {
    const ctx = Taro.createCanvasContext('shareCanvas')
    ctx.setFillStyle('#FFF7ED')
    ctx.fillRect(0, 0, 300, 450)
    ctx.setFillStyle('#FFFFFF')
    ctx.beginPath()
    ctx.arc(150, 80, 50, 0, Math.PI * 2)
    ctx.fill()
    ctx.setFillStyle('#1C1917')
    ctx.setFontSize(22)
    ctx.setTextAlign('center')
    ctx.fillText(cat?.name || '校园猫猫', 150, 160)
    if (cat?.location) {
      ctx.setFillStyle('#78716C')
      ctx.setFontSize(14)
      ctx.fillText(`常出没：${cat.location}`, 150, 185)
    }
    if (cat?.color) {
      ctx.setFillStyle('#F97316')
      ctx.setFontSize(12)
      ctx.fillText(cat.color, 150, 210)
    }
    ctx.setStrokeStyle('#E7E5E4')
    ctx.setLineWidth(1)
    ctx.moveTo(40, 240); ctx.lineTo(260, 240)
    ctx.stroke()

    if (qrData) {
      const qrSize = qrData.length
      const cellSize = 80 / qrSize
      const offsetX = 150 - (qrSize * cellSize) / 2
      const offsetY = 260
      ctx.setFillStyle('#1C1917')
      for (let r = 0; r < qrSize; r++) {
        for (let c = 0; c < qrSize; c++) {
          if (qrData[r][c]) {
            ctx.fillRect(offsetX + c * cellSize, offsetY + r * cellSize, cellSize, cellSize)
          }
        }
      }
    }

    ctx.setFillStyle('#A8A29E')
    ctx.setFontSize(11)
    ctx.setTextAlign('center')
    ctx.fillText('扫码查看猫猫完整档案', 150, 360)
    ctx.fillText('猫猫社区 · 校园猫咪数字档案', 150, 380)
    ctx.draw()
  }

  const handleSave = () => {
    Taro.canvasToTempFilePath({
      canvasId: 'shareCanvas',
      success: (res) => {
        Taro.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => Taro.showToast({ title: '已保存到相册', icon: 'success' }),
          fail: () => Taro.showToast({ title: '保存失败', icon: 'none' }),
        })
      }
    })
  }

  return (
    <View className='share-poster-mask' style={{ display: visible ? 'flex' : 'none' }} onClick={onClose}>
      <View className='share-poster-card' onClick={e => e.stopPropagation()}>
        <Canvas canvasId='shareCanvas' style={{ width: '300px', height: '450px' }} />
        <Button className='share-save-btn' onClick={handleSave}>保存到相册</Button>
        <Button className='share-close-btn' onClick={onClose}>关闭</Button>
      </View>
    </View>
  )
}
