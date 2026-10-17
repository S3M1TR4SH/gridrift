export function buildManifest(brand) {
  if (!brand?.name || !brand?.shortName) {
    throw new Error('brand name and shortName are required');
  }
  if (!Array.isArray(brand.icons) || brand.icons.length < 2) {
    throw new Error('at least two icons are required');
  }
  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.description ?? '',
    start_url: brand.startUrl ?? './',
    scope: brand.scope ?? './',
    display: 'standalone',
    background_color: brand.backgroundColor ?? '#12141c',
    theme_color: brand.themeColor ?? '#12141c',
    icons: brand.icons.map((icon) => ({
      src: icon.src,
      sizes: icon.sizes,
      type: icon.type ?? 'image/png',
      purpose: icon.purpose ?? 'any'
    }))
  };
}
