import { View, Canvas, Image, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'

interface SharePosterProps {
  cat: any
  visible: boolean
  onClose: () => void
}

export default function SharePoster({ cat, visible, onClose }: SharePosterProps) {
  const [qrCode, setQrCode] = useState('')

  useEffect(() => {
    if (!visible || !cat) return
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
    ctx.setFillStyle('#A8A29E')
    ctx.setFontSize(11)
    ctx.fillText('扫码查看猫猫完整档案', 150, 280)
    ctx.fillText('猫猫社区 · 校园猫咪数字档案', 150, 300)
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
