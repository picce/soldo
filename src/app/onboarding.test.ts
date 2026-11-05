import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/database'
import { getMeta } from '@/db/repositories/meta'
import { seedDefaults } from '@/db/seed'
import { forgetOnboarding, isOnboarded, markOnboarded } from './onboarding'

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()))
  forgetOnboarding()
})

describe('onboarding state', () => {
  it('is not done on an empty database, and done once marked', async () => {
    expect(await isOnboarded()).toBe(false)
    await markOnboarded()
    expect(await getMeta('onboardedAt')).toEqual(expect.any(String))
    forgetOnboarding()
    expect(await isOnboarded()).toBe(true)
  })

  it('counts as done when there is data from before the onboarding', async () => {
    await seedDefaults()
    expect(await getMeta('onboardedAt')).toBeUndefined()
    expect(await isOnboarded()).toBe(true)
    expect(await getMeta('onboardedAt')).toEqual(expect.any(String))
  })
})
