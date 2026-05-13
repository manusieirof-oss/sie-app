# SIE · Aplicación de Gestión Clínica

## Pasos para poner en marcha el programa

### PASO 1 · Crear las tablas en Supabase
1. Abre https://supabase.com y entra en tu proyecto
2. En el menú izquierdo haz clic en "SQL Editor"
3. Copia TODO el contenido del archivo `supabase-schema.sql`
4. Pégalo en el editor y pulsa "Run"
5. Verás los mensajes de éxito para cada tabla

### PASO 2 · Crear tus usuarios en Supabase
1. En el menú izquierdo de Supabase ve a "Authentication"
2. Haz clic en "Users" → "Add user" → "Create new user"
3. Crea el usuario 1: tu email + contraseña segura
4. Crea el usuario 2: el email de tu compañera + contraseña

### PASO 3 · Subir el código a GitHub
1. Abre la app Terminal en tu Mac (Spotlight → Terminal)
2. Escribe estos comandos uno a uno:
   cd ~/Desktop/sie-app
   git init
   git add .
   git commit -m "SIE primera versión"
3. Ve a https://github.com → "New repository"
4. Nombre: "sie-app" → Create repository
5. Copia los comandos que te da GitHub y ejecútalos en Terminal

### PASO 4 · Publicar en Vercel
1. Abre https://vercel.com y entra con Google
2. Haz clic en "Add New Project"
3. Importa el repositorio "sie-app" de GitHub
4. Antes de publicar, añade las variables de entorno:
   - NEXT_PUBLIC_SUPABASE_URL = https://zlqoylbdgipbwnpsnsgr.supabase.co
   - NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
5. Pulsa "Deploy"
6. En 2 minutos tendrás tu URL: sie-app.vercel.app

### PASO 5 · Acceder desde el iPad
1. Abre Safari en el iPad
2. Ve a la URL de Vercel (ej. sie-app.vercel.app)
3. Entra con tu email y contraseña
4. Para añadir a pantalla de inicio: pulsa el botón compartir → "Añadir a pantalla de inicio"

## Estructura del programa
- /agenda → Agenda del día con las dos salas
- /pacientes → Listado completo de pacientes
- /pacientes/[id] → Ficha individual (datos, salud, entrenamientos)
- /entrenamiento → Biblioteca de ejercicios y sesiones
- /valoracion → Valoración inicial en 7 pasos
- /resultados → Evolución y gráficas por paciente
- /estadisticas → Datos globales de la clínica
# sie-app
# sie-app
