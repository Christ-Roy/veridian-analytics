import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    files: [
      'app/test-pwa/page.tsx',
      'components/gsc/performance-dashboard.tsx',
    ],
    rules: {
      // Legacy effects intentionally mirror browser and query state.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['components/gsc/performance-dashboard.tsx'],
    rules: {
      // The GSC date range is intentionally evaluated when filters change.
      'react-hooks/purity': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'playwright-report/**',
    'test-results/**',
  ]),
]);
