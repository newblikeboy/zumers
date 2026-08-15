export function isBusinessHost() {
  return window.location.hostname.startsWith('business.')
}

export function businessPath(path = '') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return isBusinessHost() ? normalizedPath : `/business${normalizedPath === '/' ? '' : normalizedPath}`
}

export function businessUrl(path = '') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (window.location.hostname === 'zumers.in' || window.location.hostname === 'www.zumers.in') {
    return `${window.location.protocol}//business.zumers.in${normalizedPath === '/' ? '' : normalizedPath}`
  }

  return businessPath(normalizedPath)
}
