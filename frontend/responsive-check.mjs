import { chromium } from 'playwright'

const baseUrl = 'http://localhost:5173'
const apiBase = 'http://localhost:8080/api/v1'
const password = 'Password123!'
const stamp = Date.now()
const account = {
  email: `responsive.${stamp}@example.com`,
  password,
  date_of_birth: '1995-01-01',
  display_name: 'Responsive Tester',
  username: `responsive${stamp}`,
}

const routes = [
  { path: '/', name: 'feed' },
  { path: '/reels', name: 'reels' },
  { path: '/friends', name: 'friends' },
  { path: '/chat', name: 'chat' },
  { path: '/profile', name: 'profile' },
  { path: '/notifications', name: 'notifications' },
]

const viewports = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-414', width: 414, height: 896 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
]

async function main() {
  const auth = await signup()
  await createVideoPost(auth.access_token)
  const browser = await chromium.launch()
  const results = []

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    await context.addInitScript(
      ({ accessToken, refreshToken }) => {
        localStorage.setItem('zumers.accessToken', accessToken)
        localStorage.setItem('zumers.refreshToken', refreshToken)
      },
      {
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
      },
    )
    const page = await context.newPage()

    for (const route of routes) {
      await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle' })
      await page.screenshot({
        path: `responsive-${viewport.name}-${route.name}.png`,
        fullPage: true,
      })
      const metrics = await page.evaluate(() => {
        const doc = document.documentElement
        const body = document.body
        const horizontalOverflow =
          Math.max(doc.scrollWidth, body.scrollWidth) - window.innerWidth
        const clippedButtons = [...document.querySelectorAll('button')].filter(
          (button) => button.scrollWidth > button.clientWidth + 1,
        ).length
        const clippedInputs = [
          ...document.querySelectorAll('input, textarea, select'),
        ].filter((input) => input.scrollWidth > input.clientWidth + 1).length
        const visibleFixed = [...document.querySelectorAll('*')]
          .filter((node) => {
            const style = getComputedStyle(node)
            return style.position === 'fixed' || style.position === 'sticky'
          })
          .map((node) => {
            const rect = node.getBoundingClientRect()
            return {
              tag: node.tagName,
              className: node.className?.toString() ?? '',
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
            }
          })
        return {
          url: location.pathname,
          horizontalOverflow,
          clippedButtons,
          clippedInputs,
          visibleFixed,
        }
      })

      results.push({
        viewport: viewport.name,
        route: route.name,
        ...metrics,
      })
    }

    await context.close()
  }

  await browser.close()
  console.log(JSON.stringify(results, null, 2))
}

async function createVideoPost(accessToken) {
  const response = await fetch(`${apiBase}/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: 'Responsive reels verification video',
      visibility: 'public',
      media: [
        {
          media_type: 'video',
          cloudinary_public_id: `responsive-reel-${stamp}`,
          secure_url: 'https://res.cloudinary.com/demo/video/upload/dog.mp4',
          thumbnail_url: 'https://res.cloudinary.com/demo/video/upload/so_0,f_jpg/dog.jpg',
          width: 1280,
          height: 720,
          duration_seconds: 12,
          display_order: 0,
        },
      ],
    }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error ?? 'video post setup failed')
  }
}

async function signup() {
  const response = await fetch(`${apiBase}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error ?? 'signup failed')
  }
  return data
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
