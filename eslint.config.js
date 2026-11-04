import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  ignores: [
    'worker-configuration.d.ts',
    'src/components.d.ts',
    'docs/**',
  ],
})
