import { api } from './api'
import type { CloudinarySignature, PostMediaInput } from './types'

export type UploadProgress = {
  loaded: number
  total: number
  percent: number
}

export async function uploadToCloudinary(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<PostMediaInput> {
  const signature = await api.signUpload()
  validateFile(file, signature)

  if (file.type.startsWith('video/')) {
    await validateVideoDuration(file, signature.max_video_seconds)
  }

  const resourceType = file.type.startsWith('video/') ? 'video' : 'image'
  const data = await uploadWithProgress(file, signature, resourceType, onProgress)

  return {
    media_type: resourceType,
    cloudinary_public_id: data.public_id,
    secure_url:
      resourceType === 'image'
        ? optimizeImageUrl(data.secure_url)
        : optimizeVideoUrl(data.secure_url),
    thumbnail_url:
      data.thumbnail_url ??
      (resourceType === 'video' ? videoPosterUrl(data.secure_url) : undefined),
    width: data.width,
    height: data.height,
    duration_seconds:
      typeof data.duration === 'number' ? Math.round(data.duration) : undefined,
    display_order: 0,
  }
}

export function cloudinaryDeliveryUrl(
  mediaType: 'image' | 'video',
  url: string,
) {
  return mediaType === 'video' ? optimizeVideoUrl(url) : optimizeImageUrl(url)
}

function validateFile(file: File, signature: CloudinarySignature) {
  const allowed = signature.allowed_mime_prefixes.some((prefix) =>
    file.type.startsWith(prefix),
  )
  if (!allowed) {
    throw new Error('Only image and video uploads are allowed')
  }

  const maxBytes = file.type.startsWith('video/')
    ? signature.max_video_bytes
    : signature.max_image_bytes
  if (file.size > maxBytes) {
    throw new Error(`File is too large. Maximum size is ${formatBytes(maxBytes)}.`)
  }
}

function validateVideoDuration(file: File, maxSeconds: number) {
  return new Promise<void>((resolve, reject) => {
    const video = document.createElement('video')
    const objectUrl = URL.createObjectURL(file)

    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl)
      if (video.duration > maxSeconds) {
        reject(
          new Error(
            `Video is too long. Maximum duration is ${Math.floor(
              maxSeconds / 60,
            )} minutes.`,
          ),
        )
        return
      }
      resolve()
    }
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read video metadata'))
    }
    video.src = objectUrl
  })
}

function uploadWithProgress(
  file: File,
  signature: CloudinarySignature,
  resourceType: 'image' | 'video',
  onProgress?: (progress: UploadProgress) => void,
) {
  return new Promise<any>((resolve, reject) => {
    const form = new FormData()
    form.set('file', file)
    form.set('api_key', signature.api_key)
    form.set('timestamp', signature.timestamp)
    form.set('signature', signature.signature)
    form.set('folder', signature.folder)

    const xhr = new XMLHttpRequest()
    xhr.open(
      'POST',
      `https://api.cloudinary.com/v1_1/${signature.cloud_name}/${resourceType}/upload`,
    )

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress?.({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100),
      })
    }

    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || '{}')
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(data?.error?.message ?? 'Upload failed'))
        return
      }
      resolve(data)
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(form)
  })
}

function optimizeImageUrl(url: string) {
  if (url.includes('/f_auto,q_auto,c_limit,w_1600/')) {
    return url
  }
  return insertCloudinaryTransform(url, 'f_auto,q_auto,c_limit,w_1600')
}

function optimizeVideoUrl(url: string) {
  if (url.includes('/c_limit,w_1280/q_auto/f_auto/')) {
    return url
  }
  return insertCloudinaryTransform(url, 'c_limit,w_1280/q_auto/f_auto')
}

function videoPosterUrl(url: string) {
  const poster = url.replace(/\.[a-z0-9]+$/i, '.jpg')
  return insertCloudinaryTransform(poster, 'so_0,f_jpg,q_auto,w_900')
}

function insertCloudinaryTransform(url: string, transform: string) {
  if (!url.includes('/upload/')) {
    return url
  }
  return url.replace('/upload/', `/upload/${transform}/`)
}

function formatBytes(bytes: number) {
  const mb = bytes / 1024 / 1024
  return `${Math.round(mb)} MB`
}
