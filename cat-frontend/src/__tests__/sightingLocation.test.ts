import { expect, it } from 'vitest'
import { resolveSightingLocation, campusLocations } from '../campusLocations'

it('keeps the selected campus coordinates', () => {
  expect(resolveSightingLocation(campusLocations[1].name, new URLSearchParams())).toEqual(campusLocations[1])
})
it('accepts a matching route point, including zero coordinates', () => {
  expect(resolveSightingLocation('新点', new URLSearchParams('point=新点&lat=0&lng=120'))).toEqual({ name: '新点', latitude: 0, longitude: 120 })
})
it('does not attach a stale/default/invalid location to free text', () => {
  expect(resolveSightingLocation('自填地点', new URLSearchParams('point=其他&lat=31&lng=121'))).toBeUndefined()
  expect(resolveSightingLocation('新点', new URLSearchParams('point=新点&lat=91&lng=121'))).toBeUndefined()
})
