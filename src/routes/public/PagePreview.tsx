import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { getBlockByType } from '../../lib/blocks/registry'
import type { PageBlock } from '../../lib/blocks/types'

export default function PagePreview() {
  const { slug } = useParams()
  const [html, setHtml] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/pages/public?slug=${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true)
          setLoading(false)
          return
        }
        const data = await res.json()
        const blocks: PageBlock[] = data.page_data?.blocks || []
        const renderedHtml = blocks
          .filter((b: PageBlock) => !b.hidden)
          .map((b: PageBlock) => {
            const def = getBlockByType(b.type)
            if (!def) return ''
            return def.render(b.data, b.sectionStyles).replace(/\{\{PAGE_ID\}\}/g, data.id)
          })
          .join('\n')
        setHtml(renderedHtml)
        setLoading(false)
        document.title = data.nome || 'Página'
      })
      .catch(() => {
        setNotFound(true)
        setLoading(false)
      })
  }, [slug])

  // Blocos publicam <script> dentro do HTML (ex: captura de lead). Scripts
  // inseridos via dangerouslySetInnerHTML não são executados pelo navegador,
  // então precisamos recriar cada <script> manualmente pra rodar de verdade.
  useEffect(() => {
    if (!html || !containerRef.current) return
    const scripts = Array.from(containerRef.current.querySelectorAll('script'))
    for (const oldScript of scripts) {
      const newScript = document.createElement('script')
      for (const attr of Array.from(oldScript.attributes)) {
        newScript.setAttribute(attr.name, attr.value)
      }
      newScript.textContent = oldScript.textContent
      oldScript.replaceWith(newScript)
    }
  }, [html])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#64748b', fontSize: 16 }}>
        Carregando...
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#64748b', gap: 12 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Esta página não está disponível</p>
        <p style={{ fontSize: 14, margin: 0 }}>A página pode não existir ou ainda não foi publicada.</p>
      </div>
    )
  }

  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html || '' }} />
}
