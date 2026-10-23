import type { PageBlock } from './blocks/types'

const TAILWIND_CDN_RE = /<script[^>]*src=["']https:\/\/cdn\.tailwindcss\.com[^"']*["'][^>]*>\s*<\/script>/gi
const TAILWIND_CONFIG_RE = /<script[^>]*>[^<]*tailwind\.config\s*=[\s\S]*?<\/script>/gi
const TAILWIND_STYLE_RE = /<style[^>]*type=["']text\/tailwindcss["'][^>]*>[\s\S]*?<\/style>/gi
const DATA_IMAGE_RE = /data:image\/([a-zA-Z0-9.+-]+);base64,[A-Za-z0-9+/=]{2000,}/g

// Imagens coladas como base64 (editor de código personalizado) deixam o HTML
// pesado — o navegador não mostra nada antes de baixar o arquivo inteiro.
// Sobe cada uma pro Blob e troca pela URL, direto nos dados dos blocos (assim
// a próxima publicação não reenvia a mesma imagem).
export async function uploadInlineImages(blocks: PageBlock[]): Promise<PageBlock[]> {
  let json = JSON.stringify(blocks)
  const uris = [...new Set(json.match(DATA_IMAGE_RE) || [])]
  if (!uris.length) return blocks
  for (const uri of uris) {
    try {
      const ext = (uri.match(/^data:image\/([a-zA-Z0-9]+)/)?.[1] || 'png').replace('jpeg', 'jpg')
      const file = await (await fetch(uri)).blob()
      const res = await fetch(`/api/upload/image?filename=imagem.${ext}`, { method: 'POST', body: file })
      if (!res.ok) continue
      const { url } = await res.json()
      json = json.split(uri).join(url)
    } catch {
      // mantém a imagem embutida — a página continua funcionando, só mais pesada
    }
  }
  return JSON.parse(json)
}

// Roda DENTRO do iframe: espera o CDN gerar o CSS e manda pro painel.
const REPORT_SCRIPT = `<script>(function(){var s=Date.now();function r(){return [].map.call(document.head.querySelectorAll('style:not([type])'),function(e){return e.textContent||''}).filter(function(t){return t.indexOf('tailwindcss v')>-1})[0]}(function p(){if(r())return setTimeout(function(){parent.postMessage({kvTailwindCss:r()},'*')},300);if(Date.now()-s<9500)setTimeout(p,100)})()})()</script>`

// O <script src="cdn.tailwindcss.com"> gera o CSS no navegador de cada visitante
// (126 KB de JS + compilação; lento principalmente no Safari do iPhone). Aqui o
// mesmo script roda UMA vez, num iframe escondido do painel, e o CSS resultante
// entra pronto na página publicada. Se algo falhar, devolve o HTML intacto.
export async function precompileTailwind(html: string, timeoutMs = 10000): Promise<string> {
  const cdnSrc = html.match(TAILWIND_CDN_RE)?.[0].match(/src=["'](https:\/\/cdn\.tailwindcss\.com[^"'<>\s]*)["']/)?.[1]
  if (!cdnSrc) return html

  // Todo token "com cara de classe" do HTML — inclusive os que só aparecem em
  // <script> (ex.: classList.add('hidden')) — vai num div de amostra, igual ao
  // scan de conteúdo do Tailwind. Tokens que não são classes não geram nada.
  const tokens = [...new Set(html.match(/[^\s"'`<>=]+/g) || [])].join(' ').replace(/&/g, '&amp;')
  const probe = `<!doctype html><html><head><script src="${cdnSrc}"></script>${(html.match(TAILWIND_CONFIG_RE) || []).join('')}${(html.match(TAILWIND_STYLE_RE) || []).join('')}</head><body><div class="${tokens}"></div>${REPORT_SCRIPT}</body></html>`

  // sandbox sem allow-same-origin: o iframe ganha origem própria, então os
  // scripts copiados da página (tailwind.config) não alcançam o painel nem a
  // sessão de quem está publicando. O CSS volta só por postMessage.
  const iframe = document.createElement('iframe')
  iframe.setAttribute('sandbox', 'allow-scripts')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:800px;visibility:hidden'
  let onMessage: ((e: MessageEvent) => void) | undefined
  try {
    const css = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), timeoutMs)
      onMessage = (e: MessageEvent) => {
        if (e.source !== iframe.contentWindow || typeof e.data?.kvTailwindCss !== 'string') return
        clearTimeout(timer)
        resolve(e.data.kvTailwindCss)
      }
      window.addEventListener('message', onMessage)
      iframe.srcdoc = probe
      document.body.appendChild(iframe)
    })
    if (!css || /<\/style/i.test(css)) return html

    // O CDN anexa o CSS no FIM do <head> — mesma posição aqui, pra cascata
    // (quem vence quem) ficar idêntica à de hoje.
    const out = html.replace(TAILWIND_CDN_RE, '').replace(TAILWIND_CONFIG_RE, '')
    return out.includes('</head>') ? out.replace('</head>', () => `<style>${css}</style></head>`) : `<style>${css}</style>${out}`
  } catch {
    return html
  } finally {
    if (onMessage) window.removeEventListener('message', onMessage)
    iframe.remove()
  }
}
