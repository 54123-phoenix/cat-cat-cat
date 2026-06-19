import { View, Text } from '@tarojs/components'

interface ScanAnimationProps {
  message?: string
}

export default function ScanAnimation({ message = 'AI 正在识别中…' }: ScanAnimationProps) {
  return (
    <View style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60rpx 24rpx', position: 'relative',
    }}>
      <View style={{ position: 'relative', width: '200rpx', height: '200rpx', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <View className='scan-ring' style={{ width: '40rpx', height: '40rpx' }} />
        <View className='scan-ring' style={{ width: '40rpx', height: '40rpx', animationDelay: '0.5s' }} />
        <View className='scan-ring' style={{ width: '40rpx', height: '40rpx', animationDelay: '1s' }} />

        <View style={{ fontSize: '96rpx', lineHeight: 1, position: 'relative' }}>
          <Text style={{ fontSize: '96rpx' }}>😺</Text>
        </View>

        <View style={{
          position: 'absolute', top: '78rpx', left: '0', right: '0',
          display: 'flex', justifyContent: 'center', gap: '28rpx',
        }}>
          <View className='scan-cat-blink' style={{
            width: '18rpx', height: '22rpx', borderRadius: '50%',
            backgroundColor: '#F97316', boxShadow: '0 0 12rpx 4rpx rgba(249,115,22,0.7)',
          }} />
          <View className='scan-cat-blink' style={{
            width: '18rpx', height: '22rpx', borderRadius: '50%',
            backgroundColor: '#F97316', boxShadow: '0 0 12rpx 4rpx rgba(249,115,22,0.7)',
            animationDelay: '0.15s',
          }} />
        </View>
      </View>

      <Text style={{ fontSize: '28rpx', color: '#78716C', marginTop: '32rpx', display: 'block' }}>{message}</Text>
      <Text style={{ fontSize: '22rpx', color: '#A8A29E', marginTop: '8rpx', display: 'block' }}>正在比对猫咪特征…</Text>
    </View>
  )
}
