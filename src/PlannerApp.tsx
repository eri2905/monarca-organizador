"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  BrainCircuit,
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  Code2,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Moon,
  MoreHorizontal,
  Palette,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { cloudIsConfigured, connectCloud, saveCloudWorkspace } from "./cloudSync";
import { authorizeCalendar, calendarIsConfigured, syncCalendarEvent } from "./googleCalendar";

type Status = "todo" | "doing" | "done";
type Mode = "light" | "dark";
type PaletteName = "monarca" | "cantera" | "cenote" | "jacaranda";

type Board = {
  id: string;
  name: string;
  icon: string;
  accent: string;
  position: number;
};

type Task = {
  id: string;
  boardId: string;
  title: string;
  description: string;
  status: Status;
  dueDate: string | null;
  icon: string;
  accent: string;
  priority: string;
  subtasks: string;
  position: number;
  calendarEventId?: string | null;
};

type TaskDraft = Pick<
  Task,
  "title" | "description" | "status" | "dueDate" | "icon" | "accent" | "priority"
>;

const statuses: { id: Status; label: string; short: string }[] = [
  { id: "todo", label: "Pendiente", short: "Por hacer" },
  { id: "doing", label: "En curso", short: "En curso" },
  { id: "done", label: "Completado", short: "Listo" },
];

const iconOptions = [
  { id: "book-open", label: "Estudio", icon: BookOpen },
  { id: "chart-no-axes-column", label: "Datos", icon: ChartNoAxesColumn },
  { id: "code-2", label: "Código", icon: Code2 },
  { id: "flask-conical", label: "Ciencia", icon: FlaskConical },
  { id: "brain-circuit", label: "Idea", icon: BrainCircuit },
  { id: "sparkles", label: "Personal", icon: Sparkles },
  { id: "calendar-days", label: "Evento", icon: CalendarDays },
  { id: "graduation-cap", label: "Universidad", icon: GraduationCap },
  { id: "folder-kanban", label: "Proyecto", icon: FolderKanban },
];

const palettes: { id: PaletteName; name: string; colors: string[] }[] = [
  { id: "monarca", name: "Monarca", colors: ["#c85d28", "#f0a45d", "#171311"] },
  { id: "cantera", name: "Cantera rosa", colors: ["#b45573", "#e7a6b8", "#8c3d53"] },
  { id: "cenote", name: "Cenote", colors: ["#087f8c", "#5ec3c9", "#163e4c"] },
  { id: "jacaranda", name: "Jacaranda", colors: ["#6c4fa1", "#a98ccd", "#d77c3b"] },
];

const accentOptions = ["violet", "cyan", "coral", "green", "amber"];

function IconFor({ name, className = "" }: { name: string; className?: string }) {
  const match = iconOptions.find((item) => item.id === name);
  const Icon = match?.icon ?? Circle;
  return <Icon className={className} aria-hidden="true" />;
}

function formatDate(date: string | null, compact = false) {
  if (!date) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: compact ? "short" : "long",
    ...(compact ? {} : { year: "numeric" }),
  }).format(new Date(`${date}T12:00:00`));
}

function calendarLink(task: Task | TaskDraft) {
  if (!task.dueDate) return null;
  const start = task.dueDate.replaceAll("-", "");
  const endDate = new Date(`${task.dueDate}T12:00:00`);
  endDate.setDate(endDate.getDate() + 1);
  const end = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, "0")}${String(endDate.getDate()).padStart(2, "0")}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: task.title,
    dates: `${start}/${end}`,
    details: task.description || "Creado desde Monarca",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const STORAGE_KEY = "monarca-workspace-v1";

const starterBoards: Board[] = [
  { id: "tablero-unam", name: "UNAM 2026-2", icon: "graduation-cap", accent: "amber", position: 0 },
  { id: "tablero-personal", name: "Proyectos personales", icon: "sparkles", accent: "coral", position: 1 },
];

const starterTasks: Task[] = [
  {
    id: "tarea-bioestadistica",
    boardId: "tablero-unam",
    title: "Notas y estudio de Bioestadística",
    description: "Organizar apuntes, conceptos clave y ejercicios de la semana.",
    status: "doing",
    dueDate: "2026-09-05",
    icon: "book-open",
    accent: "amber",
    priority: "alta",
    subtasks: "[]",
    position: 0,
  },
  {
    id: "tarea-reporte",
    boardId: "tablero-unam",
    title: "Tarea de Bioestadística",
    description: "Resolver la práctica y revisar los resultados antes de entregar.",
    status: "todo",
    dueDate: "2026-09-07",
    icon: "chart-no-axes-column",
    accent: "coral",
    priority: "alta",
    subtasks: "[]",
    position: 1,
  },
  {
    id: "tarea-python",
    boardId: "tablero-unam",
    title: "Material para clase de Python",
    description: "Preparar ejemplos breves y ejercicios para la siguiente clase.",
    status: "todo",
    dueDate: "2026-09-10",
    icon: "code-2",
    accent: "cyan",
    priority: "media",
    subtasks: "[]",
    position: 2,
  },
];

function loadWorkspace() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { boards: starterBoards, tasks: starterTasks };
    const parsed = JSON.parse(stored) as { boards?: Board[]; tasks?: Task[] };
    if (!Array.isArray(parsed.boards) || !Array.isArray(parsed.tasks)) throw new Error("Formato inválido");
    return { boards: parsed.boards, tasks: parsed.tasks };
  } catch {
    return { boards: starterBoards, tasks: starterTasks };
  }
}

export default function PlannerApp() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeBoardId, setActiveBoardId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("board");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<Status>("todo");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [palette, setPalette] = useState<PaletteName>("monarca");
  const [mode, setMode] = useState<Mode>("dark");
  const [calendarToken, setCalendarToken] = useState<string | null>(() => sessionStorage.getItem("monarca-calendar-token"));
  const [cloudProfile, setCloudProfile] = useState<{ name: string; email: string } | null>(null);
  const cloudDisconnect = useRef<(() => void) | null>(null);

  useEffect(() => {
    const savedPalette = localStorage.getItem("monarca-palette") as PaletteName | null;
    const savedMode = localStorage.getItem("monarca-mode") as Mode | null;
    if (savedPalette && palettes.some((item) => item.id === savedPalette)) setPalette(savedPalette);
    if (savedMode === "light" || savedMode === "dark") setMode(savedMode);
    const workspace = loadWorkspace();
    setBoards(workspace.boards);
    setTasks(workspace.tasks);
    setActiveBoardId(workspace.boards[0]?.id ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    const workspace = { boards, tasks };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    void saveCloudWorkspace(workspace).catch(() => toast.error("No se pudo guardar el último cambio en la nube."));
  }, [boards, loading, tasks]);

  useEffect(() => () => cloudDisconnect.current?.(), []);

  useEffect(() => {
    document.documentElement.dataset.palette = palette;
    document.documentElement.dataset.mode = mode;
    document.documentElement.classList.toggle("dark", mode === "dark");
    localStorage.setItem("monarca-palette", palette);
    localStorage.setItem("monarca-mode", mode);
  }, [palette, mode]);

  const activeBoard = boards.find((board) => board.id === activeBoardId) ?? boards[0];
  const visibleTasks = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return tasks.filter(
      (task) =>
        task.boardId === activeBoard?.id &&
        (!normalized || `${task.title} ${task.description}`.toLocaleLowerCase("es").includes(normalized)),
    );
  }, [activeBoard?.id, query, tasks]);

  const selectedTask = tasks.find((task) => task.id === selectedId) ?? null;

  function chooseBoard(id: string) {
    setActiveBoardId(id);
    setSidebarOpen(false);
  }

  function openTask(task: Task) {
    setSelectedId(task.id);
    setDraft({
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.dueDate,
      icon: task.icon,
      accent: task.accent,
      priority: task.priority,
    });
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeBoard) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (!title) return;
    const task: Task = {
        id: crypto.randomUUID(),
        boardId: activeBoard.id,
        title,
        description: "",
        dueDate: String(form.get("dueDate") || "") || null,
        status: defaultStatus,
        icon: String(form.get("icon") || "book-open"),
        accent: String(form.get("accent") || "amber"),
        priority: String(form.get("priority") || "media"),
        subtasks: "[]",
        position: visibleTasks.length,
      };
    setTasks((current) => [...current, task]);
    setNewTaskOpen(false);
    event.currentTarget.reset();
    toast.success("Tarea creada");
  }

  async function createBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    const board: Board = {
        id: crypto.randomUUID(),
        name,
        icon: String(form.get("icon") || "folder-kanban"),
        accent: String(form.get("accent") || "amber"),
        position: boards.length,
      };
    setBoards((current) => [...current, board]);
    setActiveBoardId(board.id);
    setNewBoardOpen(false);
    event.currentTarget.reset();
    toast.success("Tablero creado");
  }

  async function updateTask(id: string, patch: Partial<Task>) {
    const original = tasks.find((task) => task.id === id);
    if (!original) throw new Error("Tarea no encontrada.");
    const updated = { ...original, ...patch };
    setTasks((current) => current.map((task) => (task.id === id ? updated : task)));
    return updated;
  }

  async function saveDraft() {
    if (!selectedTask || !draft || !draft.title.trim()) return;
    try {
      const saved = await updateTask(selectedTask.id, draft);
      setDraft({
        title: saved.title,
        description: saved.description,
        status: saved.status,
        dueDate: saved.dueDate,
        icon: saved.icon,
        accent: saved.accent,
        priority: saved.priority,
      });
      toast.success("Cambios guardados");
    } catch {
      // updateTask restores the previous state and reports the error.
    }
  }

  async function deleteTask() {
    if (!selectedTask) return;
    setTasks((current) => current.filter((task) => task.id !== selectedTask.id));
    setSelectedId(null);
    setDraft(null);
    toast.success("Tarea eliminada");
  }

  function openNewTask(status: Status = "todo") {
    setDefaultStatus(status);
    setNewTaskOpen(true);
  }

  function addToCalendar(task: Task | TaskDraft) {
    const link = calendarLink(task);
    if (!link) {
      toast.info("Agrega una fecha para llevar esta tarea al calendario.");
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
  }

  async function connectCalendar() {
    if (!calendarIsConfigured()) {
      toast.info("Agrega tu Client ID de Google en el archivo .env para activar la sincronización.");
      return null;
    }
    try {
      const token = await authorizeCalendar();
      setCalendarToken(token);
      sessionStorage.setItem("monarca-calendar-token", token);
      toast.success("Google Calendar conectado");
      return token;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible conectar Google Calendar.");
      return null;
    }
  }

  async function connectDevices() {
    if (!cloudIsConfigured()) {
      toast.info("Agrega los datos de Firebase en el archivo .env para sincronizar dispositivos.");
      return;
    }
    try {
      cloudDisconnect.current?.();
      const session = await connectCloud(
        { boards, tasks },
        (workspace) => {
          const remoteBoards = workspace.boards as Board[];
          const remoteTasks = workspace.tasks as Task[];
          setBoards(remoteBoards);
          setTasks(remoteTasks);
          setActiveBoardId((current) => remoteBoards.some((board) => board.id === current) ? current : remoteBoards[0]?.id || "");
        },
      );
      cloudDisconnect.current = session.disconnect;
      setCloudProfile(session.profile);
      toast.success("Tus tareas ya se sincronizan entre dispositivos");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar la sincronización.");
    }
  }

  async function syncTask(task: Task) {
    if (!task.dueDate) {
      toast.info("Agrega una fecha antes de sincronizar la tarea.");
      return;
    }
    if (!calendarIsConfigured()) {
      addToCalendar(task);
      return;
    }
    const token = calendarToken || (await connectCalendar());
    if (!token) return;
    try {
      const eventId = await syncCalendarEvent(task, token);
      await updateTask(task.id, { calendarEventId: eventId });
      toast.success(task.calendarEventId ? "Evento actualizado en Calendar" : "Tarea sincronizada con Calendar");
    } catch (error) {
      sessionStorage.removeItem("monarca-calendar-token");
      setCalendarToken(null);
      toast.error(error instanceof Error ? error.message : "No fue posible sincronizar la tarea.");
    }
  }

  const boardCounts = statuses.map((status) => ({
    ...status,
    count: visibleTasks.filter((task) => task.status === status.id).length,
  }));

  return (
    <div className="monarca-shell">
      <aside className={`monarca-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">🦋</div>
          <div>
            <strong>Monarca</strong>
            <span>Mi espacio personal</span>
          </div>
          <Button className="sidebar-close" variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú">
            <X />
          </Button>
        </div>

        <nav aria-label="Navegación principal" className="sidebar-nav">
          <button className="nav-item is-active" type="button">
            <LayoutDashboard /> <span>Mis tableros</span>
          </button>
          <button className="nav-item" type="button" onClick={() => setView("agenda")}>
            <CalendarDays /> <span>Agenda</span>
          </button>
        </nav>

        <div className="sidebar-section">
          <div className="sidebar-label">
            <span>Tableros</span>
            <button type="button" onClick={() => setNewBoardOpen(true)} aria-label="Crear tablero"><Plus /></button>
          </div>
          <div className="board-list">
            {boards.map((board) => (
              <button
                key={board.id}
                className={`board-link ${activeBoard?.id === board.id ? "is-current" : ""}`}
                type="button"
                onClick={() => chooseBoard(board.id)}
              >
                <span className={`board-icon accent-${board.accent}`}><IconFor name={board.icon} /></span>
                <span>{board.name}</span>
                {activeBoard?.id === board.id && <ChevronRight />}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="theme-trigger">
                <Palette /> <span>Tema y colores</span>
                <div className="mini-swatches">
                  {palettes.find((item) => item.id === palette)?.colors.map((color) => <i key={color} style={{ background: color }} />)}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="theme-menu">
              <DropdownMenuLabel>Paleta</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={palette} onValueChange={(value) => setPalette(value as PaletteName)}>
                {palettes.map((item) => (
                  <DropdownMenuRadioItem key={item.id} value={item.id}>
                    <span className="palette-name">{item.name}</span>
                    <span className="palette-swatches">
                      {item.colors.map((color) => <i key={color} style={{ background: color }} />)}
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setMode(mode === "dark" ? "light" : "dark")}>
                {mode === "dark" ? <Sun /> : <Moon />}
                Usar modo {mode === "dark" ? "claro" : "oscuro"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button className="profile-chip" type="button" onClick={() => void connectDevices()}>
            <span>EC</span>
            <div><strong>{cloudProfile?.name || "Erika"}</strong><small>{cloudProfile ? "Sincronización activa" : "Conectar dispositivos"}</small></div>
          </button>
        </div>
      </aside>

      {sidebarOpen && <button className="sidebar-scrim" type="button" aria-label="Cerrar menú" onClick={() => setSidebarOpen(false)} />}

      <main className="workspace">
        <header className="topbar">
          <Button variant="ghost" size="icon" className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú">
            <Menu />
          </Button>
          <div className="topbar-title">
            <span>Tablero personal</span>
            <strong>{activeBoard?.name ?? "Mis tareas"}</strong>
          </div>
          <div className="topbar-actions">
            <div className="search-field">
              <Search />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tareas" aria-label="Buscar tareas" />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda"><X /></button>}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Más opciones"><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setNewBoardOpen(true)}><FolderKanban /> Nuevo tablero</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMode(mode === "dark" ? "light" : "dark")}>
                  {mode === "dark" ? <Sun /> : <Moon />} Cambiar apariencia
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button className="primary-action" onClick={() => openNewTask()}><Plus /> Nueva tarea</Button>
          </div>
        </header>

        <section className="board-heading">
          <div>
            <div className={`heading-icon accent-${activeBoard?.accent ?? "amber"}`}><IconFor name={activeBoard?.icon ?? "folder-kanban"} /></div>
            <div>
              <p>{new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
              <h1>{activeBoard?.name ?? "Mis tareas"}</h1>
            </div>
          </div>
          <div className="heading-summary">
            <span><b>{visibleTasks.filter((task) => task.status === "done").length}</b> completadas</span>
            <span><b>{visibleTasks.filter((task) => task.dueDate).length}</b> con fecha</span>
          </div>
        </section>

        <Tabs value={view} onValueChange={setView} className="view-tabs">
          <TabsList variant="line" className="view-tabs-list">
            <TabsTrigger value="board"><FolderKanban /> Tablero</TabsTrigger>
            <TabsTrigger value="agenda"><CalendarDays /> Agenda</TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="board-content">
            {loading ? (
              <div className="kanban-grid" aria-label="Cargando tablero">
                {[0, 1, 2].map((column) => (
                  <div className="kanban-column" key={column}>
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-36 w-full rounded-2xl" />
                    <Skeleton className="h-28 w-full rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="kanban-grid">
                {boardCounts.map((status) => {
                  const columnTasks = visibleTasks.filter((task) => task.status === status.id);
                  return (
                    <section
                      className={`kanban-column status-${status.id}`}
                      key={status.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        const id = event.dataTransfer.getData("text/task-id");
                        if (id) void updateTask(id, { status: status.id });
                      }}
                    >
                      <header className="column-header">
                        <div><span className="status-dot" /><h2>{status.label}</h2><b>{status.count}</b></div>
                        <Button variant="ghost" size="icon-sm" onClick={() => openNewTask(status.id)} aria-label={`Agregar a ${status.label}`}><Plus /></Button>
                      </header>

                      <div className="task-stack">
                        {columnTasks.map((task) => (
                          <article
                            key={task.id}
                            className={`task-card accent-${task.accent}`}
                            draggable
                            tabIndex={0}
                            onDragStart={(event) => event.dataTransfer.setData("text/task-id", task.id)}
                            onClick={() => openTask(task)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") openTask(task);
                            }}
                          >
                            <div className="task-card-top">
                              <span className="task-icon"><IconFor name={task.icon} /></span>
                              <span className={`priority priority-${task.priority}`}>{task.priority}</span>
                            </div>
                            <h3>{task.title}</h3>
                            {task.description && <p>{task.description}</p>}
                            <footer>
                              <span className={task.dueDate ? "has-date" : ""}><Clock3 /> {formatDate(task.dueDate, true)}</span>
                              {task.dueDate && (
                                <button
                                  type="button"
                                onClick={(event) => { event.stopPropagation(); void syncTask(task); }}
                                  aria-label="Sincronizar con Google Calendar"
                                ><CalendarDays /></button>
                              )}
                            </footer>
                          </article>
                        ))}

                        {columnTasks.length === 0 && (
                          <div className="column-empty">
                            <Check />
                            <span>{query ? "Sin coincidencias" : status.id === "done" ? "Aquí aparecerán tus logros" : "Columna despejada"}</span>
                          </div>
                        )}
                      </div>

                      <button type="button" className="add-inline" onClick={() => openNewTask(status.id)}><Plus /> Añadir tarea</button>
                    </section>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="agenda" className="agenda-content">
            <div className="agenda-header">
              <div><h2>Próximas entregas</h2><p>Tus tareas con fecha, ordenadas en una sola vista.</p></div>
              <Button variant="outline" onClick={() => void connectCalendar()}>
                <CalendarDays /> {calendarToken ? "Calendar conectado" : "Conectar Google Calendar"}
              </Button>
            </div>
            <div className="agenda-list">
              {visibleTasks
                .filter((task) => task.dueDate)
                .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
                .map((task) => (
                  <button className="agenda-item" key={task.id} type="button" onClick={() => openTask(task)}>
                    <time dateTime={task.dueDate ?? undefined}>
                      <b>{new Date(`${task.dueDate}T12:00:00`).getDate()}</b>
                      <span>{new Intl.DateTimeFormat("es-MX", { month: "short" }).format(new Date(`${task.dueDate}T12:00:00`))}</span>
                    </time>
                    <span className={`task-icon accent-${task.accent}`}><IconFor name={task.icon} /></span>
                    <span className="agenda-copy"><strong>{task.title}</strong><small>{statuses.find((status) => status.id === task.status)?.short}</small></span>
                    <ChevronRight />
                  </button>
                ))}
              {!visibleTasks.some((task) => task.dueDate) && <div className="agenda-empty"><CalendarDays /><h3>No hay tareas con fecha</h3><p>Agrega una fecha para verla aquí y llevarla a tu calendario.</p></div>}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <div className="mobile-bottom-bar">
        <button className={view === "board" ? "is-active" : ""} type="button" onClick={() => setView("board")}><FolderKanban /><span>Tablero</span></button>
        <button className="mobile-add" type="button" onClick={() => openNewTask()} aria-label="Nueva tarea"><Plus /></button>
        <button className={view === "agenda" ? "is-active" : ""} type="button" onClick={() => setView("agenda")}><CalendarDays /><span>Agenda</span></button>
      </div>

      <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
        <DialogContent className="form-dialog">
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
            <DialogDescription>Añádela a {statuses.find((status) => status.id === defaultStatus)?.label.toLocaleLowerCase("es")}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createTask} className="task-form">
            <label><span>Nombre</span><Input name="title" placeholder="Ej. Terminar reporte de estadística" autoFocus required /></label>
            <div className="form-grid">
              <label><span>Fecha de entrega</span><Input name="dueDate" type="date" /></label>
              <label><span>Prioridad</span>
                <Select name="priority" defaultValue="media">
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="baja">Baja</SelectItem><SelectItem value="media">Media</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent>
                </Select>
              </label>
            </div>
            <div className="form-grid">
              <label><span>Icono</span>
                <Select name="icon" defaultValue="book-open">
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{iconOptions.map((item) => <SelectItem value={item.id} key={item.id}><item.icon /> {item.label}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label><span>Color</span>
                <Select name="accent" defaultValue="amber">
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{accentOptions.map((accent) => <SelectItem value={accent} key={accent}><i className={`select-dot accent-bg-${accent}`} /> {accent === "cyan" ? "Cian" : accent === "coral" ? "Coral" : accent === "green" ? "Verde" : accent === "amber" ? "Ámbar" : "Violeta"}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setNewTaskOpen(false)}>Cancelar</Button>
              <Button type="submit"><Plus /> Crear tarea</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={newBoardOpen} onOpenChange={setNewBoardOpen}>
        <DialogContent className="form-dialog">
          <DialogHeader>
            <DialogTitle>Nuevo tablero</DialogTitle>
            <DialogDescription>Úsalo para una materia, proyecto o área personal.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createBoard} className="task-form">
            <label><span>Nombre</span><Input name="name" placeholder="Ej. Curso de R" autoFocus required /></label>
            <div className="form-grid">
              <label><span>Icono</span>
                <Select name="icon" defaultValue="folder-kanban">
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{iconOptions.map((item) => <SelectItem value={item.id} key={item.id}><item.icon /> {item.label}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label><span>Color</span>
                <Select name="accent" defaultValue="amber">
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{accentOptions.map((accent) => <SelectItem value={accent} key={accent}><i className={`select-dot accent-bg-${accent}`} /> {accent}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setNewBoardOpen(false)}>Cancelar</Button>
              <Button type="submit"><Plus /> Crear tablero</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(selectedTask)} onOpenChange={(open) => { if (!open) { setSelectedId(null); setDraft(null); } }}>
        <SheetContent className="task-sheet sm:max-w-[36rem]">
          <SheetHeader className="sheet-heading">
            <div className={`sheet-icon accent-${draft?.accent ?? "amber"}`}><IconFor name={draft?.icon ?? "book-open"} /></div>
            <div>
              <SheetTitle>Detalle de la tarea</SheetTitle>
              <SheetDescription>Edita la información y guarda tus cambios.</SheetDescription>
            </div>
          </SheetHeader>
          {draft && selectedTask && (
            <div className="sheet-body">
              <label className="sheet-field title-field"><span>Título</span><Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
              <div className="sheet-grid">
                <label className="sheet-field"><span>Estado</span>
                  <Select value={draft.status} onValueChange={(value) => setDraft({ ...draft, status: value as Status })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{statuses.map((status) => <SelectItem value={status.id} key={status.id}>{status.label}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
                <label className="sheet-field"><span>Fecha de entrega</span><Input type="date" value={draft.dueDate ?? ""} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value || null })} /></label>
                <label className="sheet-field"><span>Prioridad</span>
                  <Select value={draft.priority} onValueChange={(value) => setDraft({ ...draft, priority: value })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="baja">Baja</SelectItem><SelectItem value="media">Media</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent>
                  </Select>
                </label>
                <label className="sheet-field"><span>Color</span>
                  <Select value={draft.accent} onValueChange={(value) => setDraft({ ...draft, accent: value })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{accentOptions.map((accent) => <SelectItem value={accent} key={accent}><i className={`select-dot accent-bg-${accent}`} /> {accent}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
              </div>
              <div className="sheet-field">
                <span>Icono</span>
                <div className="icon-picker">
                  {iconOptions.map((item) => (
                    <button className={draft.icon === item.id ? "is-selected" : ""} type="button" key={item.id} onClick={() => setDraft({ ...draft, icon: item.id })} title={item.label} aria-label={item.label}>
                      <item.icon />
                    </button>
                  ))}
                </div>
              </div>
              <label className="sheet-field"><span>Notas</span><Textarea rows={7} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Agrega contexto, enlaces o ideas…" /></label>
              <button className="calendar-callout" type="button" onClick={() => void syncTask({ ...selectedTask, ...draft })}>
                <span><CalendarDays /></span>
                <span><strong>Sincronizar con Google Calendar</strong><small>{draft.dueDate ? formatDate(draft.dueDate) : "Primero agrega una fecha"}</small></span>
                <ChevronRight />
              </button>
            </div>
          )}
          <SheetFooter className="sheet-footer">
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="ghost" className="delete-button"><Trash2 /> Eliminar</Button></AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader><AlertDialogTitle>¿Eliminar esta tarea?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={deleteTask}>Eliminar</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={saveDraft}>Guardar cambios</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Toaster position="bottom-right" richColors theme={mode} />
    </div>
  );
}
