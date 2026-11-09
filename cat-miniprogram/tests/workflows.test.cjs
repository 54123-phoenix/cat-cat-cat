const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, '../src', relative)
  if (cache.has(filename)) return cache.get(filename)
  const source = fs.readFileSync(filename, 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText
  const exports = {}
  cache.set(filename, exports)
  vm.runInNewContext(compiled, { exports, console, require(name) {
    if (name in mocks) return mocks[name]
    if (name.startsWith('.')) {
      const imported = path.resolve(path.dirname(filename), name)
      const resolved = ['.ts', '.tsx'].map(extension => imported + extension).find(candidate => fs.existsSync(candidate))
      if (resolved) return load(path.relative(path.resolve(__dirname, '../src'), resolved), mocks, cache)
    }
    throw new Error(`Unexpected dependency: ${name}`)
  } }, { filename })
  return exports
}

const { createSightingSubmission } = load('services/sightingSubmission.ts')
const { createMapLoader } = load('services/mapData.ts')
const draft = { catId: 7, file: '/chosen-cat.jpg', location: '图书馆', latitude: 31.3, longitude: 121.5, confidence: 0.8, note: '在树下' }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('one sighting submission carries the photo and actual coordinates and coalesces repeated clicks', async () => {
  const response = deferred()
  const calls = []
  const controller = createSightingSubmission(fields => { calls.push(fields); return response.promise })
  const first = controller.submit(draft)
  const repeated = controller.submit(draft)
  assert.equal(first, repeated)
  await Promise.resolve()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].file, draft.file)
  assert.equal(calls[0].latitude, draft.latitude)
  assert.equal(calls[0].note, draft.note)
  assert.match(calls[0].client_request_id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  response.resolve({ id: 12, status: 'pending' })
  await first
  assert.equal((await controller.submit({ ...draft, note: 'again' })).id, 12)
  assert.equal(calls.length, 1, 'a completed photo cannot create a second record')
})

test('a lost response retries with the same request identity; editing the draft creates a new identity', async () => {
  const calls = []
  let next = 0
  const controller = createSightingSubmission(async fields => { calls.push(fields); throw new Error('connection lost') }, () => `id-${++next}`)
  await assert.rejects(controller.submit(draft), /connection lost/)
  await assert.rejects(controller.submit({ ...draft }), /connection lost/)
  assert.equal(calls[0].client_request_id, calls[1].client_request_id)
  for (const change of [{ note: '其他备注' }, { catId: 9 }, { file: '/other.jpg' }, { longitude: 121.6 }, { location: '光华楼' }]) {
    await assert.rejects(controller.submit({ ...draft, ...change }), /connection lost/)
    assert.notEqual(calls.at(-1).client_request_id, calls.at(-2).client_request_id)
  }
})

test('a malformed receipt remains retryable, and missing coordinates never create a sighting', async () => {
  const calls = []
  const controller = createSightingSubmission(async fields => { calls.push(fields); return calls.length === 1 ? {} : { id: 13 } })
  await assert.rejects(controller.submit({ ...draft, latitude: undefined }), /位置/)
  assert.equal(calls.length, 0)
  await assert.rejects(controller.submit(draft), /回执/)
  assert.equal((await controller.submit(draft)).id, 13)
  assert.equal(calls[0].client_request_id, calls[1].client_request_id)
})

test('map empty and failed sources never produce example cats', async () => {
  let state
  const empty = createMapLoader(async () => [], async () => [], value => { state = value })
  await empty.load()
  assert.equal(state.markers.length, 0)
  assert.equal(state.errors.length, 0)
  const failed = createMapLoader(async () => { throw new Error('offline') }, async () => { throw new Error('offline') }, value => { state = value })
  await failed.load()
  assert.equal(state.markers.length, 0)
  assert.equal(state.errors.length, 2)
})

test('map keeps successful source data and labels the failed source, including zero coordinates', async () => {
  let state
  const loader = createMapLoader(async () => [null, { name: '真实偶遇点', latitude: 0, longitude: 12 }, { name: 'bad', latitude: NaN, longitude: 12 }], async () => { throw new Error('offline') }, value => { state = value })
  await loader.load()
  assert.equal(state.markers.length, 1)
  assert.equal(state.markers[0].title, '真实偶遇点')
  assert.equal(state.markers[0].detail.id, undefined, 'an aggregated heatmap point must not invent a cat identity')
  assert.equal(state.errors[0], '猫咪档案加载失败')
})

test('late map responses cannot replace a refresh or publish after leaving the page', async () => {
  let state, count = 0
  const first = deferred()
  const loader = createMapLoader(() => ++count === 1 ? first.promise : Promise.resolve([{ name: '新点位', latitude: 31, longitude: 121 }]), async () => [], value => { state = value })
  const old = loader.load()
  await Promise.resolve()
  await loader.load()
  first.resolve([{ name: '旧点位', latitude: 32, longitude: 122 }])
  await old
  assert.equal(state.markers[0].title, '新点位')
  const pending = deferred()
  const hidden = createMapLoader(() => pending.promise, async () => [], value => { state = value })
  const task = hidden.load()
  hidden.cancel()
  const before = state
  pending.resolve([])
  await task
  assert.equal(state, before)
})

// Native surfaces are mocked; these tests exercise the actual page's event handlers.
function scanPage(recognition, send) {
  let cursor = 0
  const hooks = []
  const calls = []
  const jsx = (type, props) => ({ type, props })
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial
      return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value }]
    },
    useRef(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = { current: initial }; return hooks[index] },
    useEffect() {},
  }
  const taro = {
    chooseMedia: async () => ({ tempFiles: [{ tempFilePath: draft.file }] }),
    getLocation: async () => ({ latitude: draft.latitude, longitude: draft.longitude }),
    navigateTo: () => {}, showToast: () => {},
  }
  const page = load('pages/scan/index.tsx', {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@tarojs/components': Object.fromEntries(['View', 'Text', 'Image', 'Input', 'Textarea', 'Picker', 'Button'].map(name => [name, name])),
    '@tarojs/taro': taro,
    '../../components/ScanAnimation': { default: () => null },
    '../../services/api': {
      identifyCat: async () => recognition,
      createSighting: async fields => { calls.push(fields); return send ? send(fields) : { id: 41, status: 'pending' } },
      createDiscovery: async () => ({}),
    },
  }).default
  let tree
  function render() { cursor = 0; tree = page(); return tree }
  function nodes(node) {
    if (!node || typeof node !== 'object') return []
    if (Array.isArray(node)) return node.flatMap(nodes)
    return [node, ...nodes(node.props?.children)]
  }
  function text(node) {
    if (node === undefined || node === null || typeof node === 'boolean') return ''
    if (Array.isArray(node)) return node.map(text).join('')
    return typeof node === 'object' ? text(node.props?.children) : String(node)
  }
  function action(label) { return nodes(tree).find(node => node.props?.onClick && text(node).trim() === label) }
  return { render, nodes: () => nodes(tree), text: () => text(tree), calls, action }
}

test('recognition alone does not save; the explicit form submits once with photo, coordinates and visible receipt', async () => {
  const page = scanPage({ status: 'confirmed', cat_id: 7, cat_name: '皮球', confidence: 0.8 })
  page.render()
  const choose = page.nodes().find(node => node.props?.onClick && page.text().includes('拍照或上传图片'))
  await choose.props.onClick()
  page.render()
  await page.action('✨ 开始识别').props.onClick()
  page.render()
  assert.equal(page.calls.length, 0)
  assert.match(page.text(), /相似度不代表正确概率/)
  page.action('📍 确认身份并记录偶遇').props.onClick()
  page.render()
  await page.action('使用当前位置').props.onClick()
  page.render()
  const submit = page.action('提交这次偶遇')
  await Promise.all([submit.props.onClick(), submit.props.onClick()])
  page.render()
  assert.equal(page.calls.length, 1)
  assert.equal(page.calls[0].file, draft.file)
  assert.equal(page.calls[0].latitude, draft.latitude)
  assert.match(page.text(), /偶遇记录 #41 已提交/)
  assert.equal(page.action('📍 确认身份并记录偶遇'), undefined)
})

test('selecting an uncertain candidate opens the same form without creating a sighting', async () => {
  const page = scanPage({ status: 'uncertain', candidates: [{ cat_id: 7, cat_name: '皮球', confidence: 0.7 }] })
  page.render()
  await page.nodes().find(node => node.props?.onClick).props.onClick()
  page.render()
  await page.action('✨ 开始识别').props.onClick()
  page.render()
  const candidate = page.nodes().find(node => node.props?.className === 'card' && node.props?.onClick)
  candidate.props.onClick()
  page.render()
  assert.equal(page.calls.length, 0)
  assert.match(page.text(), /记录与 皮球 的偶遇/)
  assert.ok(page.action('提交这次偶遇'))
})

test('a failed form submission preserves the photo, location and note for a retry using the same request identity', async () => {
  let attempts = 0
  const page = scanPage({ status: 'confirmed', cat_id: 7, cat_name: '皮球', confidence: 0.8 }, async () => {
    if (++attempts === 1) throw new Error('网络中断，请重试确认')
    return { id: 55, status: 'pending' }
  })
  page.render()
  await page.nodes().find(node => node.props?.onClick).props.onClick()
  page.render()
  await page.action('✨ 开始识别').props.onClick()
  page.render()
  page.action('📍 确认身份并记录偶遇').props.onClick()
  page.render()
  page.nodes().find(node => node.type === 'Input').props.onInput({ detail: { value: '图书馆门口' } })
  page.render()
  await page.action('使用当前位置').props.onClick()
  page.render()
  page.nodes().find(node => node.type === 'Textarea').props.onInput({ detail: { value: '在树下休息' } })
  page.render()
  await page.action('提交这次偶遇').props.onClick()
  page.render()
  assert.match(page.text(), /网络中断，请重试确认/)
  assert.equal(page.nodes().find(node => node.type === 'Input').props.value, '图书馆门口')
  assert.equal(page.nodes().find(node => node.type === 'Textarea').props.value, '在树下休息')
  await page.action('重试提交偶遇').props.onClick()
  page.render()
  assert.equal(page.calls[0].client_request_id, page.calls[1].client_request_id)
  assert.equal(page.calls[1].file, draft.file)
  assert.equal(page.calls[1].note, '在树下休息')
  assert.match(page.text(), /偶遇记录 #55 已提交/)
})
