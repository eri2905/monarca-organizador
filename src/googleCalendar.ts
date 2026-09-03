type CalendarTask = {
  title: string;
  description: string;
  dueDate: string | null;
  calendarEventId?: string | null;
};

type TokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type TokenClient = {
  callback: (response: TokenResponse) => void;
  requestAccessToken: (options?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (options: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type?: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "");

export function calendarIsConfigured() {
  return Boolean(clientId) && !window.Capacitor?.isNativePlatform?.();
}

function waitForGoogleIdentity(timeoutMs = 8000) {
  return new Promise<void>((resolve, reject) => {
    if (window.google?.accounts.oauth2) {
      resolve();
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (window.google?.accounts.oauth2) {
        window.clearInterval(timer);
        resolve();
      } else if (Date.now() - startedAt > timeoutMs) {
        window.clearInterval(timer);
        reject(new Error("No se pudo cargar el acceso de Google. Revisa tu conexión e inténtalo otra vez."));
      }
    }, 120);
  });
}

export async function authorizeCalendar() {
  if (!clientId) throw new Error("Falta configurar VITE_GOOGLE_CLIENT_ID.");
  await waitForGoogleIdentity();

  return new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/calendar.events",
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || "Google no autorizó el acceso al calendario."));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: () => reject(new Error("Se cerró o bloqueó la ventana de autorización de Google.")),
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

function nextDay(date: string) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export async function syncCalendarEvent(task: CalendarTask, accessToken: string) {
  if (!task.dueDate) throw new Error("La tarea necesita una fecha.");
  const event = {
    summary: task.title,
    description: `${task.description || "Tarea de Monarca"}\n\nSincronizado desde Monarca.`,
    start: { date: task.dueDate },
    end: { date: nextDay(task.dueDate) },
  };
  const eventId = task.calendarEventId;
  const endpoint = eventId
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`
    : "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const response = await fetch(endpoint, {
    method: eventId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
  const data = (await response.json()) as { id?: string; error?: { message?: string } };
  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || "Google Calendar rechazó la sincronización.");
  }
  return data.id;
}
