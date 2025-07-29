// Utility to crop an image using react-easy-crop's pixel area
// Returns a data URL of the cropped image
export async function getCroppedImg(imageSrc, crop) {
  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new window.Image()
      image.addEventListener('load', () => resolve(image))
      image.addEventListener('error', (error) => reject(error))
      image.setAttribute('crossOrigin', 'anonymous') // needed to avoid cross-origin issues on CodeSandbox
      image.src = url
    })

  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  const diameter = Math.min(crop.width, crop.height)
  canvas.width = diameter
  canvas.height = diameter

  // Draw the cropped image as a circle
  ctx.save()
  ctx.beginPath()
  ctx.arc(diameter / 2, diameter / 2, diameter / 2, 0, 2 * Math.PI)
  ctx.closePath()
  ctx.clip()

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    diameter,
    diameter,
    0,
    0,
    diameter,
    diameter
  )
  ctx.restore()

  return canvas.toDataURL('image/jpeg')
} 