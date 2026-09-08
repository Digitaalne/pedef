/**
 * Font registry. Every face is a single static TTF bundled with the app:
 *  - rendered in the UI via the FontFace API (loaded lazily on demand)
 *  - embedded into exported PDFs via pdf-lib + fontkit (bytes fetched from the
 *    same URL, cached after first use)
 */
import alluraUrl from '../assets/fonts/Allura-Regular.ttf?url'
import architectsDaughterUrl from '../assets/fonts/ArchitectsDaughter-Regular.ttf?url'
import cookieUrl from '../assets/fonts/Cookie-Regular.ttf?url'
import courgetteUrl from '../assets/fonts/Courgette-Regular.ttf?url'
import greatVibesUrl from '../assets/fonts/GreatVibes-Regular.ttf?url'
import indieFlowerUrl from '../assets/fonts/IndieFlower-Regular.ttf?url'
import kalamBoldUrl from '../assets/fonts/Kalam-Bold.ttf?url'
import kalamUrl from '../assets/fonts/Kalam-Regular.ttf?url'
import laBelleAuroreUrl from '../assets/fonts/LaBelleAurore.ttf?url'
import lobsterUrl from '../assets/fonts/Lobster-Regular.ttf?url'
import nothingYouCouldDoUrl from '../assets/fonts/NothingYouCouldDo.ttf?url'
import notoSansBoldUrl from '../assets/fonts/NotoSans-Bold.ttf?url'
import notoSansItalicUrl from '../assets/fonts/NotoSans-Italic.ttf?url'
import notoSansMonoUrl from '../assets/fonts/NotoSansMono-Regular.ttf?url'
import notoSansUrl from '../assets/fonts/NotoSans-Regular.ttf?url'
import notoSerifUrl from '../assets/fonts/NotoSerif-Regular.ttf?url'
import pacificoUrl from '../assets/fonts/Pacifico-Regular.ttf?url'
import sacramentoUrl from '../assets/fonts/Sacramento-Regular.ttf?url'
import shadowsIntoLightUrl from '../assets/fonts/ShadowsIntoLight.ttf?url'
import zeyadaUrl from '../assets/fonts/Zeyada.ttf?url'

export type FontCategory = 'text' | 'signature'

export type FontFace = {
  id: string
  label: string
  cssFamily: string
  url: string
  weight: number
  style: 'normal' | 'italic'
  category: FontCategory
}

export const FONTS: FontFace[] = [
  { id: 'noto-sans', label: 'Noto Sans', cssFamily: 'Noto Sans', url: notoSansUrl, weight: 400, style: 'normal', category: 'text' },
  { id: 'noto-sans-bold', label: 'Noto Sans Bold', cssFamily: 'Noto Sans', url: notoSansBoldUrl, weight: 700, style: 'normal', category: 'text' },
  { id: 'noto-sans-italic', label: 'Noto Sans Italic', cssFamily: 'Noto Sans', url: notoSansItalicUrl, weight: 400, style: 'italic', category: 'text' },
  { id: 'noto-serif', label: 'Noto Serif', cssFamily: 'Noto Serif', url: notoSerifUrl, weight: 400, style: 'normal', category: 'text' },
  { id: 'noto-mono', label: 'Noto Sans Mono', cssFamily: 'Noto Sans Mono', url: notoSansMonoUrl, weight: 400, style: 'normal', category: 'text' },
  { id: 'great-vibes', label: 'Great Vibes', cssFamily: 'Great Vibes', url: greatVibesUrl, weight: 400, style: 'normal', category: 'signature' },
  { id: 'sacramento', label: 'Sacramento', cssFamily: 'Sacramento', url: sacramentoUrl, weight: 400, style: 'normal', category: 'signature' },
  { id: 'allura', label: 'Allura', cssFamily: 'Allura', url: alluraUrl, weight: 400, style: 'normal', category: 'signature' },
  { id: 'cookie', label: 'Cookie', cssFamily: 'Cookie', url: cookieUrl, weight: 400, style: 'normal', category: 'signature' },
  { id: 'pacifico', label: 'Pacifico', cssFamily: 'Pacifico', url: pacificoUrl, weight: 400, style: 'normal', category: 'signature' },
  { id: 'lobster', label: 'Lobster', cssFamily: 'Lobster', url: lobsterUrl, weight: 400, style: 'normal', category: 'signature' },
  { id: 'courgette', label: 'Courgette', cssFamily: 'Courgette', url: courgetteUrl, weight: 400, style: 'normal', category: 'signature' },
  { id: 'kalam', label: 'Kalam', cssFamily: 'Kalam', url: kalamUrl, weight: 400, style: 'normal', category: 'signature' },
  { id: 'kalam-bold', label: 'Kalam Bold', cssFamily: 'Kalam', url: kalamBoldUrl, weight: 700, style: 'normal', category: 'signature' },
  { id: 'shadows-into-light', label: 'Shadows Into Light', cssFamily: 'Shadows Into Light', url: shadowsIntoLightUrl, weight: 400, style: 'normal', category: 'signature' },
  { id: 'indie-flower', label: 'Indie Flower', cssFamily: 'Indie Flower', url: indieFlowerUrl, weight: 400, style: 'normal', category: 'signature' },
  { id: 'architects-daughter', label: 'Architects Daughter', cssFamily: 'Architects Daughter', url: architectsDaughterUrl, weight: 400, style: 'normal', category: 'signature' },
  { id: 'la-belle-aurore', label: 'La Belle Aurore', cssFamily: 'La Belle Aurore', url: laBelleAuroreUrl, weight: 400, style: 'normal', category: 'signature' },
  { id: 'nothing-you-could-do', label: 'Nothing You Could Do', cssFamily: 'Nothing You Could Do', url: nothingYouCouldDoUrl, weight: 400, style: 'normal', category: 'signature' },
  { id: 'zeyada', label: 'Zeyada', cssFamily: 'Zeyada', url: zeyadaUrl, weight: 400, style: 'normal', category: 'signature' },
]

const byId = new Map(FONTS.map((f) => [f.id, f]))

export function getFont(id: string): FontFace {
  return byId.get(id) ?? FONTS[0]
}

/** Signature faces with an optional "last used" face moved to the front. */
export function signatureFontsOrdered(lastUsedId?: string | null): FontFace[] {
  const list = FONTS.filter((f) => f.category === 'signature')
  const lastUsed = lastUsedId ? list.find((f) => f.id === lastUsedId) : undefined
  if (!lastUsed) return list
  return [lastUsed, ...list.filter((f) => f.id !== lastUsed.id)]
}

export function fontCss(face: FontFace, sizePx: number): string {
  return `${face.style} ${face.weight} ${sizePx}px "${face.cssFamily}"`
}

const bufferCache = new Map<string, Promise<Uint8Array>>()

/** Fetch (and cache) the raw TTF bytes for embedding into a PDF. */
export function loadFontBytes(url: string): Promise<Uint8Array> {
  let p = bufferCache.get(url)
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Failed to load font ${url}: ${r.status}`)
      return r.arrayBuffer()
    }).then((b) => new Uint8Array(b))
    bufferCache.set(url, p)
  }
  return p
}
