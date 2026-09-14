export const isProfileImage = value => typeof value === 'string' && value.length <= 300000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)

export async function prepareProfileImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    try { await img.decode() } catch { throw new Error('This image could not be opened. Please choose another photo.') }
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 384
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This image could not be processed. Please try again.')
    const size = Math.min(img.naturalWidth, img.naturalHeight)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 384, 384)
    ctx.drawImage(img, (img.naturalWidth - size) / 2, (img.naturalHeight - size) / 2, size, size, 0, 0, 384, 384)
    const result = canvas.toDataURL('image/jpeg', 0.8)
    if (!isProfileImage(result)) throw new Error('This image could not be processed. Please choose another photo.')
    return result
  } finally { URL.revokeObjectURL(url) }
}
