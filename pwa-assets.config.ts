import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const background = '#7A3B5C';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { fit: 'contain', background },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { fit: 'contain', background },
    },
  },
  images: ['public/icon.svg'],
});
