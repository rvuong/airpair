import QRCode from 'qrcode'

/**
 * Draws a QR code encoding `text` onto the given canvas element.
 * The canvas is sized automatically by qrcode.toCanvas.
 */
export async function drawQR(
  canvas: HTMLCanvasElement,
  text: string
): Promise<void> {
  await QRCode.toCanvas(canvas, text, {
    margin: 2,
    width: 256,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })
}
