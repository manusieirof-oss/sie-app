// imagetracerjs no trae tipos. Solo se usa imagedataToSVG (ver lib/vectorizar).
declare module 'imagetracerjs' {
  const ImageTracer: { imagedataToSVG: (img: ImageData, opciones?: Record<string, any>) => string }
  export default ImageTracer
}
