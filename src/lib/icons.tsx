'use client'
import {
  AlertTriangle, AlertCircle, Target, BarChart3, ClipboardList, FileText, PenLine,
  RefreshCw, Footprints, Activity, Clock, Leaf, Pill, Stethoscope, Pin, Star,
  Search, Dumbbell, Tag, Calendar, Check, CheckSquare, Briefcase, Sun, Moon,
  CloudSun, User, Baby, Flower2, HeartPulse, AlarmClock, Plus, Save, X, Circle,
  Bandage, ClipboardCheck, Ruler, Users, BookOpen, Wrench, Settings, Wallet,
  LogOut, Heart, MessageCircle, HelpCircle, CheckCircle2, TrendingUp, TrendingDown,
  Lightbulb, Trophy, Bell, Mail, Phone, Home, Trash2, Pencil, Eye, Lock, Package,
  Receipt, Banknote, Folder, Euro, Percent, Building2, GraduationCap, Info, Zap,
  Flag, MapPin, Camera, Image as ImageIcon, Download, Upload, Play, ListChecks,
  CalendarDays, Droplet, Utensils, Cross, Pause, Shuffle, UserMinus, ChevronDown,
  MoreHorizontal, ArrowLeft, IdCard, PersonStanding, Copy, ChevronUp,
} from 'lucide-react'

const MAP: Record<string, any> = {
  abajo: ChevronDown,
  arriba: ChevronUp,
  acciones: MoreHorizontal,
  cuerpo: PersonStanding,
  atras: ArrowLeft,
  dni: IdCard,
  alerta: AlertTriangle,
  intolerancia: AlertCircle,
  objetivo: Target,
  progreso: BarChart3,
  anamnesis: ClipboardList,
  nota: PenLine,
  informe: FileText,
  recuperar: RefreshCw,
  plantillas: Footprints,
  deporte: Activity,
  reloj: Clock,
  alergia: Leaf,
  medicamento: Pill,
  patologia: Stethoscope,
  molestia: Bandage,
  pin: Pin,
  estrella: Star,
  buscar: Search,
  fuerza: Dumbbell,
  etiqueta: Tag,
  calendario: Calendar,
  check: Check,
  checkbox: CheckSquare,
  trabajo: Briefcase,
  sol: Sun,
  luna: Moon,
  nube: CloudSun,
  usuario: User,
  bebe: Baby,
  pilates: Flower2,
  rehab: HeartPulse,
  alarma: AlarmClock,
  mas: Plus,
  guardar: Save,
  cerrar: X,
  copiar: Copy,
  firmar: PenLine,
  punto: Circle,
  test: ClipboardCheck,
  regla: Ruler,
  agenda: Calendar,
  pacientes: Users,
  biblioteca: BookOpen,
  taller: Wrench,
  valoracion: ClipboardList,
  stats: BarChart3,
  ajustes: Settings,
  finanzas: Wallet,
  salir: LogOut,
  ficha: FileText,
  historial: Clock,
  salud: Heart,
  entreno: Dumbbell,
  resultados: BarChart3,
  lesion: Bandage,
  hospital: Cross,
  mensaje: MessageCircle,
  ayuda: HelpCircle,
  ok: CheckCircle2,
  corazon: Heart,
  sube: TrendingUp,
  baja: TrendingDown,
  idea: Lightbulb,
  trofeo: Trophy,
  cactus: Cactus,
  campana: Bell,
  mail: Mail,
  telefono: Phone,
  casa: Home,
  papelera: Trash2,
  editar: Pencil,
  ojo: Eye,
  candado: Lock,
  caja: Package,
  recibo: Receipt,
  dinero: Banknote,
  carpeta: Folder,
  euro: Euro,
  porcentaje: Percent,
  clinica: Building2,
  formacion: GraduationCap,
  info: Info,
  rayo: Zap,
  bandera: Flag,
  ubicacion: MapPin,
  camara: Camera,
  imagen: ImageIcon,
  descargar: Download,
  subir: Upload,
  play: Play,
  lista: ListChecks,
  agua: Droplet,
  comida: Utensils,
  cruz: Cross,
  pausa: Pause,
  cambio: Shuffle,
  altabaja: UserMinus,
}

export const ICON_NAMES = Object.keys(MAP)
export const isIcon = (n?: string) => !!n && Object.prototype.hasOwnProperty.call(MAP, n)

/**
 * Cactus. No está en lucide, así que se dibuja aquí con la misma firma que los suyos
 * —size, strokeWidth, color heredado— para que `Ic` no tenga que saber que es distinto.
 *
 * Marca la habilidad del paciente: entiende lo que hace, lo recuerda, y lo hace bien.
 */
function Cactus({ size = 14, strokeWidth = 1.75, ...resto }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" {...resto}>
      {/* El tronco, de la maceta hacia arriba */}
      <path d="M12 20V7a2.5 2.5 0 0 1 5 0v1" />
      {/* Los dos brazos, a distinta altura como en uno de verdad */}
      <path d="M12 13H9.5A2.5 2.5 0 0 1 7 10.5V9" />
      <path d="M12 10h2.5A2.5 2.5 0 0 0 17 7.5" />
      {/* La maceta */}
      <path d="M8 20h8l-.6 2.4a.8.8 0 0 1-.8.6h-5.2a.8.8 0 0 1-.8-.6z" />
    </svg>
  )
}

export function Ic({ name, size = 14, strokeWidth = 1.75, className = '', style = {} }: any) {
  const C = MAP[name] || Circle
  return <C size={size} strokeWidth={strokeWidth} className={className} style={{ flexShrink: 0, ...style }} aria-hidden />
}
