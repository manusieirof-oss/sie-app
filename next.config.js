/** @type {import('next').NextConfig} */
// Antes habia aqui `typescript.ignoreBuildErrors: true`: Vercel publicaba aunque el
// codigo tuviera errores que el comprobador de tipos detecta, asi que un cambio roto
// llegaba a la web del centro. Sin esa opcion, si hay un error la publicacion falla y la
// web se queda con la version anterior, que es lo que se quiere. Si un dia hace falta
// publicar con urgencia pese a un error, se vuelve a poner esa linea.
const nextConfig = {}
module.exports = nextConfig
