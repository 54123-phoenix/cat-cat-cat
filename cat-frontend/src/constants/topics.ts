export const TOPICS = [
  { id: 'all', label: '广场' },
  { id: 'find', label: '寻猫' },
  { id: 'daily', label: '日常' },
  { id: 'health', label: '健康' },
  { id: 'suggest', label: '建议' },
]

export const TOPIC_LABEL = {
  find: '寻猫问猫',
  daily: '铲屎日常',
  health: '健康互助',
  suggest: '建议反馈',
}

export const TOPIC_COLORS = {
  find: { bg: 'bg-primary-light', text: 'text-primary' },
  daily: { bg: 'bg-mint-light', text: 'text-mint' },
  health: { bg: 'bg-info/10', text: 'text-info' },
  suggest: { bg: 'bg-warning/10', text: 'text-warning' },
}

export const TAG_TOPIC_MAP = {
  '#橘总': 'daily',
  '#小黑': 'daily',
  '#奶糖': 'daily',
  '#花花': 'daily',
  '#图书馆': 'find',
  '#南区食堂': 'find',
  '#文科楼': 'find',
  '#东区草坪': 'find',
  '#求助': 'health',
  '#治愈瞬间': 'daily',
  '#今日份猫猫': 'daily',
  '#喂食': 'daily',
  '#建议': 'suggest',
}

export const PRESET_TAGS = [
  '#橘总', '#小黑', '#奶糖', '#花花',
  '#图书馆', '#南区食堂', '#文科楼', '#东区草坪',
  '#求助', '#治愈瞬间', '#今日份猫猫', '#喂食', '#建议',
]
