import type { Category } from '@/db/schema'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { testPlugins } from '@/test/plugins'
import CategoryGrid from './CategoryGrid.vue'

function category(id: string, overrides: Partial<Category> = {}): Category {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    kind: 'expense',
    icon: 'house',
    color: 2,
    order: 0,
    archived: false,
    ...overrides,
  }
}

const categories = [
  category('groceries', { preset: 'groceries', icon: 'shopping-cart', color: 1 }),
  category('custom', { name: 'Caffè' }),
]

function mountGrid(props: Partial<InstanceType<typeof CategoryGrid>['$props']> = {}) {
  return mount(CategoryGrid, {
    props: { categories, ...props },
    global: {
      plugins: testPlugins(),
    },
  })
}

describe('categoryGrid', () => {
  it('shows translated preset names and custom names, in the category color', () => {
    const wrapper = mountGrid()
    const items = wrapper.findAll('button')
    expect(items.map(item => item.text())).toEqual(['Spesa', 'Caffè'])
    expect(items[0]!.attributes('style')).toContain('var(--color-category-1)')
  })

  it('emits the tapped category', async () => {
    const wrapper = mountGrid()
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([
      [categories[1]],
    ])
  })

  it('marks the selection only when the grid is a choice', () => {
    expect(mountGrid().get('button').attributes('aria-pressed')).toBeUndefined()
    const selectable = mountGrid({ selectable: true, selectedId: 'custom' })
    expect(selectable.findAll('button').map(item => item.attributes('aria-pressed'))).toEqual(['false', 'true'])
  })
})
