const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function apiWithResponse(response = { statusCode: 200, data: {} }) {
  const calls = []
  const source = fs.readFileSync(path.join(__dirname, '../src/services/api.ts'), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  } }).outputText
  const context = { exports: {}, console, require: name => {
    if (name === '@tarojs/taro') return {
      request: async options => { calls.push(options); return response },
      uploadFile: async options => { calls.push(options); return { ...response, data: JSON.stringify(response.data) } },
    }
    if (name === '../config') return { CONFIG: { apiBase: 'http://test/api', demoMode: false } }
    if (name === '../utils/storage') return { getToken: () => 'test-user', clearToken: () => {} }
    if (name === './demo') return {}
    throw new Error(name)
  } }
  vm.runInNewContext(compiled, context)
  return { api: context.exports, calls }
}

test('ordinary requests work without a browser FormData global', async () => {
  const { api, calls } = apiWithResponse({ statusCode: 200, data: { items: [], total: 0, has_more: false } })
  await api.getCats()
  assert.equal(calls[0].header.Authorization, 'Bearer test-user')
})

test('text posts send URL-encoded fields accepted by the API', async () => {
  const { api, calls } = apiWithResponse()
  await api.createPost({ topic: 'daily', content: '猫 & cat=1' })
  assert.equal(calls[0].header['Content-Type'], 'application/x-www-form-urlencoded')
  assert.equal(new URLSearchParams(calls[0].data).get('content'), '猫 & cat=1')
})

test('HTTP upload failures reject instead of returning success-shaped JSON', async () => {
  const { api } = apiWithResponse({ statusCode: 401, data: { detail: 'expired' } })
  await assert.rejects(api.recognize('local-image.png'), /expired/)
})

test('list clients receive items and paginated clients retain total/has_more', async () => {
  const { api, calls } = apiWithResponse({ statusCode: 200, data: { items: [{ id: 8 }], total: 50, has_more: true } })
  assert.equal((await api.getCats())[0].id, 8)
  const page = await api.getPostsPage({ page: 2, limit: 20 })
  assert.equal(page.total, 50)
  assert.equal(page.has_more, true)
  assert.match(calls[1].url, /skip=20/)
  await api.getSightings({ catId: 3 })
  assert.match(calls[2].url, /cat_id=3/)
})

test('sightings with and without images preserve API form fields', async () => {
  const { api, calls } = apiWithResponse({ statusCode: 200, data: { id: 4 } })
  const fields = { catId: 3, confidence: 0.8, latitude: 0, longitude: 12, note: '猫 & 草坪' }
  assert.equal((await api.createSighting(fields)).id, 4)
  const form = new URLSearchParams(calls[0].data)
  assert.equal(form.get('cat_id'), '3')
  assert.equal(form.get('latitude'), '0')
  assert.equal(form.get('note'), fields.note)
  assert.equal(form.has('catId'), false)
  await api.createSighting({ ...fields, file: 'local-image.png' })
  assert.equal(calls[1].formData.cat_id, '3')
  assert.equal(calls[1].formData.note, fields.note)
})
