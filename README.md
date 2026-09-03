# Monarca

**Monarca** es un organizador personal de tareas y proyectos pensado para Erika. Funciona como aplicación web adaptable, PWA instalable y aplicación Android.

> Transforma tus planes en logros.

## Funciones incluidas

- Tableros para materias, proyectos y actividades personales.
- Columnas **Pendiente**, **En curso** y **Completado**.
- Arrastrar tarjetas entre columnas desde la computadora.
- Cambio de estado táctil desde la ficha de cada tarea.
- Título, notas, fecha, prioridad, color e icono.
- Vista de agenda ordenada por fecha.
- Búsqueda de tareas.
- Paletas Monarca, Cantera rosa, Cenote y Jacaranda.
- Modos claro y oscuro.
- Diseño responsive para computadora, tableta y celular.
- Guardado local automático.
- Sincronización opcional entre dispositivos mediante Firebase.
- Sincronización web/PWA con Google Calendar.
- Publicación automática en GitHub Pages.
- Generación de una APK de prueba mediante GitHub Actions.

## Probarla en tu computadora

Necesitas instalar [Node.js 22 o posterior](https://nodejs.org/).

```bash
npm install
npm run dev
```

Abre la dirección que aparezca en la terminal. Sin configurar servicios externos, Monarca guarda todo dentro del navegador de ese dispositivo.

## Subirla manualmente a GitHub

### 1. Crear el repositorio

En GitHub selecciona **New repository** y usa:

- Nombre: `monarca-organizador`
- Visibilidad: pública, si usarás GitHub Pages con una cuenta gratuita.
- No agregues README, `.gitignore` ni licencia porque el proyecto ya los contiene.

### 2. Subir los archivos con Git Bash

Abre Git Bash dentro de la carpeta del proyecto y ejecuta:

```bash
git init
git add .
git commit -m "Primera versión de Monarca"
git branch -M main
git remote add origin https://github.com/eri2905/monarca-organizador.git
git push -u origin main
```

GitHub ya no acepta la contraseña normal de la cuenta en la terminal. Si la solicita, usa un token personal o inicia sesión con GitHub Credential Manager.

## Activar GitHub Pages

1. Abre el repositorio en GitHub.
2. Entra en **Settings → Pages**.
3. En **Build and deployment**, selecciona **GitHub Actions**.
4. Abre la pestaña **Actions** y espera a que termine el flujo **Publicar Monarca en GitHub Pages**.

La dirección esperada será:

```text
https://eri2905.github.io/monarca-organizador/
```

Después de publicarla puedes abrirla desde Chrome en Android y seleccionar **Agregar a pantalla de inicio** para instalarla como PWA.

## Sincronizar entre dispositivos con Firebase

Esta configuración es opcional. Sin ella, los datos permanecen únicamente en el navegador actual.

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Agrega una aplicación web llamada **Monarca**.
3. Activa **Authentication → Sign-in method → Google**.
4. Crea una base de datos en **Firestore Database**.
5. En Authentication, agrega `eri2905.github.io` como dominio autorizado.
6. En GitHub abre **Settings → Secrets and variables → Actions**.
7. Crea estos secretos con los valores de la configuración web de Firebase:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Para uso personal, puedes comenzar con estas reglas de Firestore, que limitan cada espacio al usuario autenticado:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Haz clic en el perfil **Erika → Conectar dispositivos** dentro de Monarca para iniciar sesión. La primera conexión conserva los datos locales si todavía no existe información en la nube.

## Conectar Google Calendar

1. Abre [Google Cloud Console](https://console.cloud.google.com/).
2. Crea o selecciona el proyecto de Monarca.
3. Activa **Google Calendar API**.
4. Configura la pantalla de consentimiento OAuth.
5. Crea un **OAuth Client ID** de tipo **Web application**.
6. Agrega este origen autorizado:

```text
https://eri2905.github.io
```

7. Guarda el Client ID como secreto de GitHub llamado:

```text
VITE_GOOGLE_CLIENT_ID
```

Cuando Calendar esté configurado, el botón de una tarea creará o actualizará su evento. Si todavía no está configurado, Monarca abrirá el formulario de Google Calendar con la información preparada para que la guardes.

## Generar la APK

1. Abre **Actions** en GitHub.
2. Selecciona **Generar APK de Monarca**.
3. Pulsa **Run workflow**.
4. Cuando termine, abre la ejecución y descarga el archivo **monarca-apk** en la sección **Artifacts**.
5. Descomprime el archivo e instala `app-debug.apk` en Android.

Esta es una APK de prueba. Para publicarla en Google Play se necesita generar una versión firmada con una clave privada que nunca debe subirse al repositorio.

## Estructura principal

```text
src/                     Aplicación y estilos
components/ui/           Componentes de interfaz
public/                   Icono, manifiesto y modo sin conexión
.github/workflows/        Publicación web y generación de APK
capacitor.config.ts       Configuración de Android
.env.example              Variables opcionales de Google y Firebase
```

## Privacidad

- Los tokens de Google Calendar se conservan solo durante la sesión del navegador.
- Las claves configuradas como secretos de GitHub no se guardan en el repositorio.
- Las variables de Firebase para aplicaciones web identifican el proyecto; la protección real de los datos depende de Authentication y de las reglas de Firestore.
