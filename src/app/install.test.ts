import { describe, expect, it } from 'vitest'
import { isIos } from './install'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'

describe('isIos', () => {
  it('recognizes iPhone, and iPad that presents itself as a Mac with touch', () => {
    expect(isIos(IPHONE, 5)).toBe(true)
    expect(isIos(IPAD, 5)).toBe(true)
  })

  it('leaves out Android and a real Mac', () => {
    expect(isIos(ANDROID, 5)).toBe(false)
    expect(isIos(IPAD, 0)).toBe(false)
  })
})
