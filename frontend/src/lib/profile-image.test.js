import { describe, it, expect } from 'vitest'
import { isProfileImage, prepareProfileImage } from './profile-image.js'

describe('profile image input', () => {
  it('rejects unsupported formats and oversized uploads before decoding', async () => {
    await expect(prepareProfileImage({ type: 'image/svg+xml', size: 10 })).rejects.toThrow('JPG, PNG, or WebP')
    await expect(prepareProfileImage({ type: 'image/png', size: 11 * 1024 * 1024 })).rejects.toThrow('10 MB')
  })
  it('only displays bounded embedded JPEGs, with a fallback for absent or invalid photos', () => {
    expect(isProfileImage('data:image/jpeg;base64,/9j/2Q==')).toBe(true)
    for (const value of [null, '', 'https://example.com/photo.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,' + 'A'.repeat(300001)]) expect(isProfileImage(value)).toBe(false)
  })
})
