import type { PageIntegrations } from '../hooks/usePages'

// Gera os <script> de análise de campanha (Facebook, GA, GTM, Clarity, códigos customizados)
// a partir do estado salvo em `page.integrations`. Usado tanto na publicação pelo editor
// quanto ao salvar a aba Integrações, para que o HTML publicado sempre reflita a config atual.
export function buildIntegrationScripts(integrations: PageIntegrations): { headScripts: string; bodyScripts: string } {
  let headScripts = ''
  let bodyScripts = ''

  // Facebook Pixel
  if (integrations.facebook?.enabled && integrations.facebook.pixelId) {
    const pixelId = integrations.facebook.pixelId
    const fbEvent = integrations.facebook.trackingEvent === 'Personalizado'
      ? (integrations.facebook.customTrackingEvent || 'PageView')
      : (integrations.facebook.trackingEvent || 'PageView')
    const testCode = integrations.facebook.testEventCode
      ? `fbq('set', 'agent', 'tmgoogletagmanager', '${integrations.facebook.pixelId}'); fbq('set', 'testEvent', '${integrations.facebook.testEventCode}');`
      : ''
    headScripts += `
<!-- Meta Pixel -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
${testCode}
fbq('track', '${fbEvent}');
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=${fbEvent}&noscript=1"/></noscript>
`
  }

  // Google Analytics
  if (integrations.googleAnalytics?.enabled && integrations.googleAnalytics.measurementId) {
    const gaId = integrations.googleAnalytics.measurementId
    headScripts += `
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');</script>
`
  }

  // Google Tag Manager
  if (integrations.googleTagManager?.enabled && integrations.googleTagManager.containerId) {
    const gtmId = integrations.googleTagManager.containerId
    headScripts += `
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');</script>
`
    bodyScripts += `
<!-- GTM noscript -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
`
  }

  // Microsoft Clarity
  if (integrations.clarity?.enabled && integrations.clarity.code) {
    headScripts += `
<!-- Microsoft Clarity -->
${integrations.clarity.code}
`
  }

  // Códigos customizados (Javascript e CSS)
  if (integrations.customCodes) {
    integrations.customCodes
      .filter((c) => c.enabled)
      .forEach((c) => { headScripts += '\n' + c.code })
  }

  // Dispara o evento de conversão configurado quando um formulário de lead é enviado com sucesso.
  // Chamado pelo bloco de formulário (kvSubmitLead) via window.kvTrackConversion() — sem isso,
  // o pixel/GA/GTM só registrava PageView e nunca o evento de conversão do formulário.
  const fbFormEvent = integrations.facebook?.enabled && integrations.facebook.pixelId
    ? (integrations.facebook.formConversionEvent || 'CompleteRegistration')
    : null
  const gaEnabled = !!(integrations.googleAnalytics?.enabled && integrations.googleAnalytics.measurementId)
  const gtmEnabled = !!(integrations.googleTagManager?.enabled && integrations.googleTagManager.containerId)

  if (fbFormEvent || gaEnabled || gtmEnabled) {
    headScripts += `
<!-- Conversão de formulário -->
<script>
window.kvTrackConversion = function(){
  try{
    ${fbFormEvent ? `if(window.fbq) fbq('track','${fbFormEvent}');` : ''}
    ${gaEnabled ? `if(window.gtag) gtag('event','generate_lead');` : ''}
    ${gtmEnabled ? `window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'kv_conversion'});` : ''}
  }catch(e){}
};
</script>
`
  }

  return { headScripts, bodyScripts }
}

// Injeta os scripts de integração num HTML de página já renderizado a partir dos blocos.
export function injectIntegrationScripts(html: string, integrations: PageIntegrations): string {
  const { headScripts, bodyScripts } = buildIntegrationScripts(integrations)

  let finalHtml = html
  if (!finalHtml.includes('<head>')) {
    finalHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><script src="https://cdn.tailwindcss.com"></script></head><body style="margin:0;padding:0;">\n${finalHtml}\n</body></html>`
  }

  if (headScripts) {
    if (finalHtml.includes('</head>')) {
      finalHtml = finalHtml.replace('</head>', headScripts + '</head>')
    }
    if (bodyScripts && finalHtml.includes('<body')) {
      finalHtml = finalHtml.replace(/<body[^>]*>/, match => match + bodyScripts)
    }
  }

  return finalHtml
}
