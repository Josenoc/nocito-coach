"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import RegisterWizard from "@/app/components/RegisterWizard";
import PendingReviewDashboard from "@/app/components/PendingReviewDashboard";
import NutritionTracker from "@/app/components/NutritionTracker";
import PostSessionSummary from "@/app/components/PostSessionSummary";
import WeeklySummary from "@/app/components/WeeklySummary";
import AdherenceNudge from "@/app/components/AdherenceNudge";
import VoiceNoteRecorder from "@/app/components/VoiceNoteRecorder";
import DiscomfortReporter from "@/app/components/DiscomfortReporter";
import WelcomeScreen from "@/app/components/WelcomeScreen";
import OnboardingCelebration from "@/app/components/OnboardingCelebration";
import { computeMetabolic } from "@/app/lib/metabolic";
import type { Anamnesis, Exercise, NutritionPlan, Profile, Routine, SetLog, TrainingBlock } from "@/lib/app-types";
import {
  buildDaySummaryFromRows,
  mostImproved,
  resolveScenario,
  type MissedDay,
  type SessionScenario,
} from "@/app/lib/workout-analytics";
import { useWorkoutDetection } from "@/app/lib/useWorkoutDetection";
import { proposeProgression } from "@/app/lib/progression-advice";
import {
  exerciseAnatomySrc,
  exerciseGifSrc,
  exercisePdStill,
  exerciseDemoPreload,
  EXERCISE_MEDIA_MODE,
  GENERIC_ANATOMY_SRC,
} from "@/app/lib/exercise-media";
import { safeBase64ToUint8Array } from "@/app/lib/base64";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

const TEST_LOGIN_ENABLED =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN === "true";

// Fecha local del alumno en formato YYYY-MM-DD. Evita el desfase de UTC:
// un entrenamiento a las 22:00 en Argentina no debe quedar con la fecha del
// día siguiente (que es lo que devuelve toISOString() después de las 21:00).
function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Tiempo que permanece la confirmación de voz (con opción "Deshacer") antes de
// confirmar el guardado y auto-ocultarse. Durante esta ventana el alumno puede
// deshacer y no se persiste nada en el servidor.
const VOICE_CONFIRM_MS = 4000;

type SetRow = {
  set_number: number;
  actual_reps: string;
  actual_weight: string;
  rir: string;
  saved?: boolean;
  drops: { reps: string; weight: string }[];
};

type VoiceSet = { set_number: number; reps: number | null; weight: number | null };

// Confirmación de voz que vive dentro de la tarjeta del ejercicio.
type CardToast = {
  exId: string;
  kind: "ok" | "err" | "info";
  title: string;
  detail?: string;
  canUndo?: boolean;
  ms?: number;
  onUndo?: () => void;
};

function embedUrl(url?: string | null): { kind: "iframe" | "video" | "none"; src: string } {
  if (!url) return { kind: "none", src: "" };
  const yt = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/
  );
  if (yt) return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return { kind: "video", src: url };
  return { kind: "none", src: "" };
}

function ExerciseDemo({ name }: { name: string }) {
  const gif = EXERCISE_MEDIA_MODE === "gif" ? exerciseGifSrc(name) : null;
  const still = exercisePdStill(name);
  const anatomy = exerciseAnatomySrc(name);
  const fallback = Array.from(
    new Set([still, anatomy, GENERIC_ANATOMY_SRC].filter(Boolean))
  ) as string[];
  const [gifBroken, setGifBroken] = useState(false);
  const [idx, setIdx] = useState(0);

  if (gif && !gifBroken) {
    return (
      <figure className="anatomy-fallback is-motion">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="demo-media"
          src={gif}
          alt={`Demostración animada de ${name}`}
          loading="eager"
          onError={() => setGifBroken(true)}
        />
      </figure>
    );
  }

  const src = fallback[Math.min(idx, fallback.length - 1)];
  const isGeneric = src === GENERIC_ANATOMY_SRC;
  return (
    <figure className="anatomy-fallback">
      <span className="anatomy-badge">{isGeneric ? "3D" : "FOTO"}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="demo-media"
        src={src}
        alt={`Imagen de referencia de ${name}`}
        loading="eager"
        onError={() => setIdx((i) => (i < fallback.length - 1 ? i + 1 : i))}
      />
      <figcaption>
        <span className="anatomy-sub">Imagen de referencia de la técnica</span>
      </figcaption>
    </figure>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function Wave() {
  return (
    <span className="wave" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export default function ClientApp() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [mode, setMode] = useState<"login" | "register">("login");

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, SetRow[]>>({});
  const [loadingData, setLoadingData] = useState(false);
  const [planStatus, setPlanStatus] = useState<string>("active");
  const [nutrition, setNutrition] = useState<NutritionPlan | null>(null);
  const [anamnesis, setAnamnesis] = useState<Anamnesis | null>(null);
  const [view, setView] = useState<"train" | "nutrition">("train");
  const [trialExpired, setTrialExpired] = useState(false);
  const [addMenuEx, setAddMenuEx] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<
    "checking" | "idle" | "on" | "denied" | "unsupported" | "busy"
  >("checking");
  const [pushPrompt, setPushPrompt] = useState<"audit" | "weekly" | null>(null);
  const [pushResponse, setPushResponse] = useState("");

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setPushStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushStatus("denied");
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then(async (reg) => {
        if (!reg) return setPushStatus("idle");
        const sub = await reg.pushManager.getSubscription();
        setPushStatus(sub ? "on" : "idle");
      })
      .catch(() => setPushStatus("idle"));
  }, []);

  const enablePush = async () => {
    try {
      if (Notification.permission === "denied") {
        showToast(
          {
            exId: "",
            kind: "info",
            title: "Avisos bloqueados",
            detail:
              "Reactivalos desde el icono del candado en la barra de direcciones del navegador.",
          },
          6000
        );
        return;
      }
      if (!VAPID_PUBLIC_KEY) return setPushStatus("unsupported");
      const applicationServerKey = safeBase64ToUint8Array(VAPID_PUBLIC_KEY);
      if (!applicationServerKey) return setPushStatus("idle");
      setPushStatus("busy");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setPushStatus("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
      }
      const res = await fetch("/api/app/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      const json = await res.json();
      setPushStatus(json.ok ? "on" : "idle");
    } catch (err) {
      console.error("[push] enablePush", err);
      setPushStatus("idle");
    }
  };

  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const [voiceBusy, setVoiceBusy] = useState<string | null>(null);
  const [cardToast, setCardToast] = useState<CardToast | null>(null);
  const [toastClosing, setToastClosing] = useState(false);
  const [fillOrder, setFillOrder] = useState<Record<string, number>>({});
  const [liveText, setLiveText] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [savedFlash, setSavedFlash] = useState<Record<string, boolean>>({});
  const [week, setWeek] = useState<number>(1);
  const [today, setToday] = useState<string>("");
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [setRir, setSetRir] = useState<Record<string, number>>({});
  const [trainingBlock, setTrainingBlock] = useState<TrainingBlock | null>(null);

  // Resumen post-sesión / semanal / adherencia.
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [discomfortOpen, setDiscomfortOpen] = useState(false);
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [retroDate, setRetroDate] = useState<string | null>(null);
  const nudgeShownRef = useRef(false);
  const scenarioOverride = useRef<SessionScenario | null>(null);

  // Bienvenida cinematográfica + celebración del onboarding.
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [celebrateOpen, setCelebrateOpen] = useState(false);
  const welcomedRef = useRef(false);

  // Toast dentro de la tarjeta del ejercicio: temporizadores del auto-ocultado
  // y del guardado diferido (que se puede deshacer mientras está visible).
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<any>(null);
  const pendingVoice = useRef<{
    ex: Exercise;
    sets: VoiceSet[];
    snapshot: SetRow[];
  } | null>(null);

  const clearToastTimers = () => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    if (toastCloseTimer.current) {
      clearTimeout(toastCloseTimer.current);
      toastCloseTimer.current = null;
    }
  };

  const dismissToast = () => {
    clearToastTimers();
    setToastClosing(true);
    toastCloseTimer.current = setTimeout(() => {
      setCardToast(null);
      setToastClosing(false);
      toastCloseTimer.current = null;
    }, 240);
  };

  const showToast = (toast: CardToast, autoHideMs = 0, onExpire?: () => void) => {
    clearToastTimers();
    setToastClosing(false);
    setCardToast(toast);
    if (autoHideMs > 0) {
      toastTimer.current = setTimeout(() => {
        toastTimer.current = null;
        if (onExpire) onExpire();
        else dismissToast();
      }, autoHideMs);
    }
  };

  // Detecta soporte de reconocimiento de voz del navegador (para la vista previa
  // de transcripción en vivo durante la grabación).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SR);
  }, []);

  // Cancela temporizadores, frena el reconocimiento y confirma cualquier voz
  // pendiente al desmontar el componente.
  useEffect(() => {
    return () => {
      clearToastTimers();
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      const p = pendingVoice.current;
      if (p) {
        pendingVoice.current = null;
        for (const s of p.sets) {
          fetch("/api/app/sets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({
              exercise_id: p.ex.id,
              set_number: s.set_number,
              actual_reps: s.reps,
              actual_weight: s.weight,
              target_reps: p.ex.target_reps,
              target_weight: p.ex.target_weight,
              phantom_reference_10_percent: p.ex.target_weight,
              log_date: localISODate(),
            }),
          }).catch(() => {});
        }
      }
    };
    fetch("/api/app/push/flush", { method: "POST", keepalive: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flashSet = (exId: string, setNumber: number) => {
    const key = `${exId}:${setNumber}`;
    setSavedFlash((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setSavedFlash((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 900);
    // Disparador interno: procesa la cola de push en background.
    fetch("/api/app/push/flush", { method: "POST", keepalive: true }).catch(() => {});
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("registro") || params.get("onboarding") === "1") {
      setMode("register");
    }
    if (params.get("tab") === "nutrition") {
      setView("nutrition");
    }
    const sc = params.get("summary");
    if (sc === "success" || sc === "consistency" || sc === "incomplete" || sc === "discomfort") {
      scenarioOverride.current = sc;
    }
    if (params.get("demo") === "week") {
      setWeeklyOpen(true);
    }
    const p = params.get("push");
    if (p === "audit" || p === "weekly") setPushPrompt(p);
  }, []);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => {
        if (r.status === 403) {
          return r.json().then((j) => { if (j?.trialExpired) setTrialExpired(true); return null; });
        }
        return r.json();
      })
      .then((j) => {
        if (!j) return;
        if (j.ok && j.profile) {
          if (j.profile.role === "coach") {
            router.replace("/entrenador");
            return;
          }
          setProfile(j.profile);
          loadRoutine();
          // Suscripción automática si el permiso ya fue concedido.
          if (Notification.permission === "granted") {
            void enablePush();
          }
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // Polling suave: refleja en tiempo real los cambios que hace el coach (rutina, ejercicios).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try { await loadRoutine(); } catch { /* ignore */ }
    };
    const iv = window.setInterval(tick, 30000);
    return () => window.clearInterval(iv);
  }, []);


  useEffect(() => {
    const day = routines.find((r) => r.id === activeDay) ?? routines[0];
    for (const ex of day?.exercises ?? []) {
      if (embedUrl(ex.video_url).kind === "none") {
        for (const src of exerciseDemoPreload(ex.name)) {
          const img = new Image();
          img.src = src;
        }
      }
    }
  }, [routines, activeDay]);

  const submitPushResponse = async (responseType: "text" | "choice", value: string) => {
    try {
      await fetch("/api/app/push/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: pushPrompt,
          response_type: responseType,
          content: responseType === "text" ? value : null,
          choice: responseType === "choice" ? value : null,
        }),
      });
      showToast(
        { exId: "", kind: "ok", title: "Respuesta enviada", detail: "Gracias por tu feedback." },
        3000
      );
    } catch {
      showToast({ exId: "", kind: "err", title: "No se pudo enviar" }, 3000);
    } finally {
      setPushPrompt(null);
      setPushResponse("");
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("push");
        window.history.replaceState({}, "", url.toString());
      }
    }
  };

  const loadRoutine = async () => {
    setLoadingData(true);
    try {
      const res = await fetch("/api/app/routine", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) return;
      const rl: Routine[] = json.routines ?? [];
      const logsData: SetLog[] = json.logs ?? [];
      const rirMap = (json.setRir as Record<string, number>) ?? {};
      const todayStr = localISODate();
      setRoutines(rl);
      setPlanStatus(json.status ?? "active");
      setNutrition((json.nutrition as NutritionPlan | null) ?? null);
      setAnamnesis((json.anamnesis as Anamnesis | null) ?? null);
      setLogs(logsData);
      setSetRir(rirMap);
      setTrainingBlock((json.trainingBlock as TrainingBlock | null) ?? null);
      setToday(todayStr);
      setActiveDay((prev) => prev ?? rl[0]?.id ?? null);

      const weekNums = Array.from(new Set(rl.map((r) => r.week_number || 1))).sort(
        (a, b) => a - b
      );
      setWeek((prev) => (weekNums.includes(prev) ? prev : weekNums[0] ?? 1));

      const next: Record<string, SetRow[]> = {};
      for (const routine of rl) {
        for (const ex of routine.exercises ?? []) {
          const count = Math.max(1, Math.min(9, ex.target_sets || 3));
          const existing = logsData.filter(
            (l) => l.exercise_id === ex.id && l.log_date === todayStr
          );
          next[ex.id] = Array.from({ length: count + 1 }, (_, i) => {
            const setNumber = i;
            const log = existing.find((l) => l.set_number === setNumber);
            const rir = rirMap[ex.id + "|" + todayStr + "|" + setNumber];
            return {
              set_number: setNumber,
              actual_reps:
                log?.actual_reps !== null && log?.actual_reps !== undefined
                  ? String(log.actual_reps)
                  : "",
              actual_weight:
                log?.actual_weight !== null && log?.actual_weight !== undefined
                  ? String(log.actual_weight)
                  : "",
              rir: rir !== null && rir !== undefined ? String(rir) : "",
              // Sin esto, al recargar la app las series seguian guardadas en la
              // base pero perdian el check y parecia que no se habian guardado.
              saved: !!log,
              drops: Array.isArray(log?.drops)
                ? log.drops.map((d: any) => ({
                    reps: d?.reps != null ? String(d.reps) : "",
                    weight: d?.weight != null ? String(d.weight) : "",
                  }))
                : [],
            };
          });
        }
      }
      setRows(next);
    } finally {
      setLoadingData(false);
    }
  };

  // Muestra la bienvenida cinematográfica una vez por sesión de navegador.
  const maybeWelcome = () => {
    if (welcomedRef.current) return;
    welcomedRef.current = true;
    try {
      if (sessionStorage.getItem("nc_welcomed")) return;
      sessionStorage.setItem("nc_welcomed", "1");
    } catch {
      // sessionStorage no disponible: igual mostramos una vez.
    }
    setWelcomeOpen(true);
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const identifier = email.trim();
    if (!identifier) {
      setAuthError("Ingresá tu usuario o email.");
      return;
    }
    if (identifier.length > 120) {
      setAuthError("El usuario o email es demasiado largo.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setAuthError("El PIN debe tener 4 dígitos.");
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier, pin }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "No se pudo ingresar. Probá de nuevo.");
      }
      if (json.profile.role === "coach") {
        router.replace("/entrenador");
        return;
      }
      setProfile(json.profile);
      await loadRoutine();
      maybeWelcome();
    } catch (err: any) {
      setAuthError(err.message || "No se pudo ingresar");
    } finally {
      setAuthLoading(false);
    }
  };

  const testLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/test-login", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setProfile(json.profile);
      await loadRoutine();
      maybeWelcome();
    } catch (err: any) {
      setAuthError(err.message || "No se pudo iniciar sesión de prueba");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegistered = async (p: Profile) => {
    setProfile(p);
    await loadRoutine();
    // Tras crear la cuenta mostramos la celebración (y no la bienvenida).
    welcomedRef.current = true;
    try {
      sessionStorage.setItem("nc_welcomed", "1");
    } catch {
      // ignore
    }
    setCelebrateOpen(true);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setProfile(null);
    setRoutines([]);
    setRows({});
    setActiveDay(null);
    setPlanStatus("active");
    setNutrition(null);
    setAnamnesis(null);
    setWeek(1);
    setLogs([]);
    setSetRir({});
    setTrainingBlock(null);
  };

  const updateRow = (exId: string, setNumber: number, patch: Partial<SetRow>) => {
    setRows((prev) => ({
      ...prev,
      [exId]: (prev[exId] ?? []).map((r) =>
        r.set_number === setNumber ? { ...r, ...patch } : r
      ),
    }));
  };

  const addSet = (ex: Exercise, asWarmup: boolean) => {
    setRows((prev) => {
      const current = prev[ex.id] ?? [];
      if (current.length >= 10) return prev;
      let newSetNumber: number;
      if (asWarmup) {
        // Un solo slot de calentamiento (set_number 0).
        if (current.some((r) => r.set_number === 0)) return prev;
        newSetNumber = 0;
      } else {
        const used = new Set(current.map((r) => r.set_number));
        newSetNumber = 1;
        while (used.has(newSetNumber) && newSetNumber < 10) newSetNumber++;
        if (newSetNumber >= 10) return prev;
      }
      const newRow: SetRow = {
        set_number: newSetNumber,
        actual_reps: "",
        actual_weight: "",
        rir: "",
        saved: false,
        drops: [],
      };
      const next = [...current, newRow].sort((a, b) => a.set_number - b.set_number);
      return { ...prev, [ex.id]: next };
    });
  };

  const removeSet = async (ex: Exercise, setNumber: number) => {
    const row = (rows[ex.id] ?? []).find((r) => r.set_number === setNumber);
    if (row?.saved) {
      try {
        await fetch(
          "/api/app/sets?exercise_id=" + encodeURIComponent(ex.id) +
            "&set_number=" + encodeURIComponent(String(setNumber)) +
            "&log_date=" + encodeURIComponent(retroDate ?? today),
          { method: "DELETE" }
        );
      } catch { /* ignore */ }
    }
    setRows((prev) => ({
      ...prev,
      [ex.id]: (prev[ex.id] ?? []).filter((r) => r.set_number !== setNumber),
    }));
  };

  const removeLastSet = async (ex: Exercise) => {
    const current = (rows[ex.id] ?? []).slice().sort((a, b) => a.set_number - b.set_number);
    const baseCount = Math.max(1, Math.min(9, ex.target_sets || 3)) + 1;
    if (current.length <= baseCount) return;
    const last = current[current.length - 1];
    if (!last) return;
    if (last.saved) {
      try {
        await fetch(
          "/api/app/sets?exercise_id=" + encodeURIComponent(ex.id) +
            "&set_number=" + encodeURIComponent(String(last.set_number)) +
            "&log_date=" + encodeURIComponent(retroDate ?? today),
          { method: "DELETE" }
        );
      } catch { /* ignore */ }
    }
    setRows((prev) => ({
      ...prev,
      [ex.id]: (prev[ex.id] ?? []).filter((r) => r.set_number !== last.set_number),
    }));
  };

  const updateDrop = (exId: string, setNumber: number, dropIndex: number, field: "reps" | "weight", value: string) => {
    setRows((prev) => ({
      ...prev,
      [exId]: (prev[exId] ?? []).map((r) => {
        if (r.set_number !== setNumber) return r;
        const drops = [...(r.drops ?? [])];
        if (!drops[dropIndex]) drops[dropIndex] = { reps: "", weight: "" };
        drops[dropIndex] = { ...drops[dropIndex], [field]: value };
        return { ...r, drops };
      }),
    }));
  };

  const addDrop = (exId: string, setNumber: number) => {
    setRows((prev) => ({
      ...prev,
      [exId]: (prev[exId] ?? []).map((r) => {
        if (r.set_number !== setNumber) return r;
        const drops = [...(r.drops ?? []), { reps: "", weight: "" }];
        return { ...r, drops };
      }),
    }));
  };

  const saveSet = async (ex: Exercise, setNumber: number) => {
    const row = rows[ex.id]?.find((r) => r.set_number === setNumber);
    if (!row) return;
    const logDate = retroDate ?? today;
    try {
      const res = await fetch("/api/app/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_id: ex.id,
          set_number: setNumber,
          actual_reps: row.actual_reps,
          actual_weight: row.actual_weight,
          rir: row.rir,
          drops: row.drops.map((d) => ({ reps: d.reps, weight: d.weight })),
          target_reps: ex.target_reps,
          target_weight: ex.target_weight,
          phantom_reference_10_percent: ex.target_weight,
          log_date: logDate,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Error ${res.status} al guardar la serie`);
      }
      {
        updateRow(ex.id, setNumber, { saved: true });
        if (json.log) upsertLog(json.log as SetLog);
        if (today) {
          setSetRir((prev) => {
            const key = `${ex.id}|${logDate}|${setNumber}`;
            const next = { ...prev };
            const val = row.rir.trim();
            if (val === "") delete next[key];
            else next[key] = Number(val);
            return next;
          });
        }
        flashSet(ex.id, setNumber);

        // Feedback instantáneo al guardar manualmente, con "Deshacer" (4 s).
        if (row.actual_reps.trim() || row.actual_weight.trim()) {
          const prevLog = logs.find(
            (l) =>
              l.exercise_id === ex.id &&
              l.log_date === logDate &&
              l.set_number === setNumber
          );
          const prevReps = prevLog?.actual_reps != null ? String(prevLog.actual_reps) : "";
          const prevWeight =
            prevLog?.actual_weight != null ? String(prevLog.actual_weight) : "";
          const prevRir = prevLog?.rir != null ? String(prevLog.rir) : "";
          const persist = (reps: string, weight: string, rir: string) =>
            fetch("/api/app/sets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                exercise_id: ex.id,
                set_number: setNumber,
                actual_reps: reps,
                actual_weight: weight,
                rir,
                drops: prevLog?.drops ?? null,
                target_reps: ex.target_reps,
                target_weight: ex.target_weight,
                phantom_reference_10_percent: ex.target_weight,
                log_date: logDate,
              }),
            })
              .then((r) => r.json())
              .then((j) => {
                if (j?.ok && j.log) upsertLog(j.log as SetLog);
                fetch("/api/app/push/flush", { method: "POST", keepalive: true }).catch(() => {});
              })
              .catch(() => {});

          const changed =
            !prevLog ||
            String(prevLog.actual_reps ?? "") !== row.actual_reps.trim() ||
            String(prevLog.actual_weight ?? "") !== row.actual_weight.trim() ||
            String(prevLog.rir ?? "") !== row.rir.trim();

          if (changed) {
            showToast(
              {
                exId: ex.id,
                kind: "ok",
                title: `Serie ${setNumber} guardada`,
                detail: `${row.actual_reps || "—"} × ${row.actual_weight || "—"}${
                  row.actual_weight ? " kg" : ""
                }${row.rir ? ` · RIR ${row.rir}` : ""}`,
                canUndo: true,
                ms: 4000,
                onUndo: () => {
                  updateRow(ex.id, setNumber, {
                    actual_reps: prevReps,
                    actual_weight: prevWeight,
                    rir: prevRir,
                    saved: !!prevLog,
                  });
                  if (today) {
                    setSetRir((prev) => {
                      const key = `${ex.id}|${logDate}|${setNumber}`;
                      const next = { ...prev };
                      if (prevRir === "") delete next[key];
                      else next[key] = Number(prevRir);
                      return next;
                    });
                  }
                  persist(prevReps, prevWeight, prevRir);
                },
              },
              4000
            );
          }
        }
      }
    } catch (err: any) {
      // Antes el error se ignoraba en silencio: la serie quedaba "cargada"
      // en pantalla pero nunca llegaba a la base. Ahora revertimos el estado
      // y avisamos al alumno con el motivo real.
      updateRow(ex.id, setNumber, { saved: false });
      const msg = String(err?.message || "");
      const sessionExpired = /no autenticado|sesi[oó]n|session/i.test(msg);
      console.error("[app/sets] error al guardar", {
        exerciseId: ex.id,
        setNumber,
        message: msg,
      });
      showToast(
        {
          exId: ex.id,
          kind: "err",
          title: sessionExpired ? "Tu sesión venció" : "No se pudo guardar la serie",
          detail: sessionExpired
            ? "Volvé a iniciar sesión para seguir registrando."
            : `${msg || "Error de conexión"} · Intentá de nuevo.`,
        },
        6000
      );
    }
  };

  const startSpeech = () => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try {
      const rec = new SR();
      rec.lang = "es-AR";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e: any) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        setLiveText(text.trim());
      };
      rec.onerror = () => {};
      rec.start();
      recognitionRef.current = rec;
    } catch {
      /* ignore */
    }
  };

  const stopSpeech = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
  };

  // Confirma el guardado de la voz pendiente (al expirar el toast o al grabar
  // de nuevo): persiste las series y anima los checkmarks.
  async function finalizeVoice() {
    const p = pendingVoice.current;
    pendingVoice.current = null;
    dismissToast();
    if (!p) return;
    const saved = new Set<number>();
    let lastError = "";
    for (const s of p.sets) {
      try {
        const res = await fetch("/api/app/sets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exercise_id: p.ex.id,
            set_number: s.set_number,
            actual_reps: s.reps,
            actual_weight: s.weight,
            target_reps: p.ex.target_reps,
            target_weight: p.ex.target_weight,
            phantom_reference_10_percent: p.ex.target_weight,
            log_date: retroDate ?? today,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          lastError = json?.error || `Error ${res.status}`;
          continue;
        }
        saved.add(s.set_number);
        if (json.log) upsertLog(json.log as SetLog);
      } catch (err: any) {
        lastError = err?.message || "Error de conexión";
      }
    }
    if (!saved.size) {
      // Ninguna serie llegó a la base: no marcar nada como guardado.
      setRows((prev) => ({
        ...prev,
        [p.ex.id]: (prev[p.ex.id] ?? []).map((r) =>
          p.sets.some((s) => s.set_number === r.set_number) ? { ...r, saved: false } : r
        ),
      }));
      showToast(
        {
          exId: p.ex.id,
          kind: "err",
          title: "No se pudieron guardar las series",
          detail: `${lastError || "Error de conexión"} · Grabá de nuevo o cargá a mano.`,
        },
        7000
      );
      return;
    }
    setRows((prev) => ({
      ...prev,
      [p.ex.id]: (prev[p.ex.id] ?? []).map((r) =>
        p.sets.some((s) => s.set_number === r.set_number)
          ? { ...r, saved: saved.has(r.set_number) }
          : r
      ),
    }));
    saved.forEach((n) => flashSet(p.ex.id, n));
    if (saved.size < p.sets.length) {
      showToast(
        {
          exId: p.ex.id,
          kind: "err",
          title: "Algunas series no se guardaron",
          detail: `${saved.size} de ${p.sets.length} guardadas. ${lastError} · Revisá tu conexión.`,
        },
        7000
      );
    }
  }

  // Revierte el relleno por voz si el alumno toca "Deshacer".
  function undoVoice() {
    const p = pendingVoice.current;
    pendingVoice.current = null;
    dismissToast();
    if (!p) return;
    setRows((prev) => ({ ...prev, [p.ex.id]: p.snapshot }));
  }

  const startRec = async (ex: Exercise) => {
    // Si hay una confirmación de voz pendiente, se fija antes de empezar otra.
    if (pendingVoice.current) finalizeVoice();
    dismissToast();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const c: Blob[] = [];
      mr.ondataavailable = (ev) => ev.data.size > 0 && c.push(ev.data);
      mr.onstop = async () => {
        const blob = new Blob(c, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        await processVoice(blob, ex);
      };
      mediaRef.current = mr;
      mr.start();
      setRecordingFor(ex.id);
      setLiveText("");
      startSpeech();
    } catch {
      showToast(
        { exId: ex.id, kind: "err", title: "No se pudo acceder al micrófono." },
        6000
      );
    }
  };

  const stopRec = () => {
    stopSpeech();
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    setRecordingFor(null);
  };

  // Resumen corto de las series detectadas (p. ej. "4 × 10 con 14 kg").
  const summarizeSets = (sets: VoiceSet[]): string => {
    const reps = sets.map((s) => s.reps).filter((n): n is number => n !== null);
    const weights = sets.map((s) => s.weight).filter((n): n is number => n !== null);
    const n = sets.length;
    const sameReps = reps.length > 0 && new Set(reps).size === 1;
    const sameWeight = weights.length > 0 && new Set(weights).size === 1;
    if (sameReps && sameWeight) return `${n} × ${reps[0]} con ${weights[0]} kg`;
    if (sameReps) return `${n} × ${reps[0]} reps`;
    if (sameWeight) return `${n} series · ${weights[0]} kg`;
    return `${n} series registradas`;
  };

  // Rellena la tarjeta localmente (sin guardar) y deja el guardado en espera de
  // confirmación, de forma que "Deshacer" revierta por completo.
  const applyVoiceDraft = (ex: Exercise, sets: VoiceSet[]) => {
    const snapshot = (rows[ex.id] ?? []).map((r) => ({ ...r }));
    pendingVoice.current = { ex, sets, snapshot };

    const lastSet = sets.reduce((m, s) => Math.max(m, s.set_number), 0);
    const total = Math.min(
      10,
      Math.max(lastSet, (rows[ex.id]?.length ?? 0))
    );
    const order: Record<string, number> = {};
    sets.forEach((s, i) => {
      order[`${ex.id}:${s.set_number}`] = i;
    });

    setRows((prev) => {
      const base = (prev[ex.id] ?? []).map((r) => ({ ...r }));
      while (base.length - 1 < total) {
        base.push({ set_number: base.length, actual_reps: "", actual_weight: "", rir: "", drops: [] });
      }
      for (const s of sets) {
        const r = base.find((x) => x.set_number === s.set_number);
        if (!r) continue;
        if (s.reps !== null) r.actual_reps = String(s.reps);
        if (s.weight !== null) r.actual_weight = String(s.weight);
        r.saved = true;
      }
      return { ...prev, [ex.id]: base };
    });

    setFillOrder(order);
    window.setTimeout(() => setFillOrder({}), 1700);
  };

  const processVoice = async (blob: Blob, ex: Exercise) => {
    setVoiceBusy(ex.id);
    showToast({
      exId: ex.id,
      kind: "info",
      title: "Procesando audio…",
      detail: "Interpretando las series que dictaste.",
    });
    try {
      const fd = new FormData();
      fd.append("audio", blob, "nota.webm");
      fd.append("exercise_id", ex.id);
      const res = await fetch("/api/app/voice-sets", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "No se pudo procesar el audio");
      const sets: VoiceSet[] = Array.isArray(json.sets) ? json.sets : [];
      if (sets.length === 0) {
        showToast(
          {
            exId: ex.id,
            kind: "err",
            title: "No se detectaron series",
            detail: "Probá de nuevo, más cerca del micrófono.",
          },
          4500
        );
        return;
      }
      applyVoiceDraft(ex, sets);
      const n = sets.length;
      showToast(
        {
          exId: ex.id,
          kind: "ok",
          title: `${n} serie${n === 1 ? "" : "s"} cargada${n === 1 ? "" : "s"}`,
          detail: summarizeSets(sets),
          canUndo: true,
          ms: VOICE_CONFIRM_MS,
        },
        VOICE_CONFIRM_MS,
        finalizeVoice
      );
    } catch (err: any) {
      showToast(
        { exId: ex.id, kind: "err", title: err?.message || "No se pudo procesar el audio." },
        6000
      );
    } finally {
      setVoiceBusy(null);
    }
  };

  // Detección de adherencia / progreso (hooks: siempre antes de los returns).
  const detection = useWorkoutDetection({
    clientId: profile?.id ?? null,
    routines,
    logs,
    week,
    today,
    trainingDays: anamnesis?.training_days ?? 4,
    guideline: trainingBlock?.guideline,
  });

  // Actualiza el estado local de logs al guardar (para métricas instantáneas).
  const upsertLog = (log: SetLog) => {
    setLogs((prev) => {
      const key = (l: SetLog) =>
        `${l.exercise_id}|${l.log_date}|${l.set_number}`;
      const rest = prev.filter((l) => key(l) !== key(log));
      return [log, ...rest];
    });
  };

  // Muestra el nudge de adherencia una sola vez por sesión de app.
  useEffect(() => {
    if (
      profile &&
      planStatus === "active" &&
      detection.nudge.show &&
      !nudgeShownRef.current
    ) {
      nudgeShownRef.current = true;
      setNudgeVisible(true);
      detection.markNudgeShown();
      if (detection.nudge.missedDate) detection.dismissNudge(detection.nudge.missedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, planStatus, detection.nudge.show]);

  if (trialExpired) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0A", color: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 520, width: "100%", background: "#111", border: "1px solid #242424", borderRadius: 12, padding: 28, textAlign: "center" }}>
          <h1 style={{ color: "#FFC400", marginTop: 0 }}>Tu prueba gratuita vencio</h1>
          <p style={{ color: "#a1a1aa" }}>Tus 30 dias de prueba terminaron. Elegi un plan para seguir entrenando con Nocito Coach.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
            <a className="btn btn-primary" href="/planes" style={{ background: "#FFC400", color: "#000", borderColor: "#FFC400" }}>Ver planes y pagar</a>
            <a className="btn btn-outline" href="https://wa.me/5492616224718?text=Hola%20Jose%2C%20quiero%20activar%20mi%20plan." target="_blank" rel="noopener" style={{ borderColor: "#FFC400", color: "#f8fafc" }}>Consultar por WhatsApp</a>
          </div>
        </div>
      </div>
    );
  }

  if (checking) {
    return (
      <main className="auth-wrap">
        <p className="muted">Cargando…</p>
      </main>
    );
  }
  if (!profile) {
    return (
      <main className="auth-wrap">
        <div className="auth-card" style={{ maxWidth: mode === "register" ? 560 : 400 }}>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <span className="brand">
              <img
                className="brand-logo"
                src="/img/logo-nocitocoach.webp"
                width={636}
                height={547}
                alt="Nocito Coach"
                decoding="async"
              />
            </span>
          </div>
          <div className="card">
            {mode === "login" ? (
              <>
                <h1 style={{ margin: "0 0 4px", fontSize: "1.42rem" }}>Mi entrenamiento</h1>
                <p className="muted" style={{ marginTop: 0 }}>
                  Ingresá con tu usuario o email y tu PIN de 4 dígitos.
                </p>
                <form onSubmit={login} style={{ display: "grid", gap: 14, marginTop: 16 }}>
                  <div>
                    <label className="lbl" htmlFor="login-identifier">Usuario o email</label>
                    <input
                      id="login-identifier"
                      className="input"
                      type="text"
                      autoComplete="username"
                      maxLength={120}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="lbl" htmlFor="login-pin">PIN (4 dígitos)</label>
                    <input
                      id="login-pin"
                      className="input"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      autoComplete="one-time-code"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      style={{ letterSpacing: "0.5em", textAlign: "center", fontSize: "1.3rem" }}
                      required
                    />
                  </div>
                  <button className="btn btn-primary" disabled={authLoading}>
                    {authLoading ? "Ingresando…" : "Ingresar"}
                  </button>
                  {authError && <div className="toast err" role="alert">{authError}</div>}
                </form>
                {TEST_LOGIN_ENABLED && (
                  <div style={{ marginTop: 14 }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ width: "100%", fontSize: ".9rem" }}
                      disabled={authLoading}
                      onClick={testLogin}
                    >
                      {authLoading ? "Entrando…" : "Test Student Login"}
                    </button>
                    <p
                      className="muted"
                      style={{ marginTop: 8, fontSize: ".82rem", textAlign: "center" }}
                    >
                      Solo para pruebas: entra como Alumno Test (plan de 4 días).
                    </p>
                  </div>
                )}
                <p className="muted" style={{ marginTop: 14, textAlign: "center", fontSize: ".95rem" }}>
                  ¿Primera vez?{" "}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setMode("register");
                      setAuthError(null);
                    }}
                  >
                    Creá tu acceso
                  </a>
                </p>
              </>
            ) : (
              <>
                <RegisterWizard onSuccess={handleRegistered} onSwitchToLogin={() => setMode("login")} />
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  const weekPresent = Array.from(new Set(routines.map((r) => r.week_number || 1)));
  const maxPresent = weekPresent.length ? Math.max(...weekPresent) : 1;
  const totalWeeks = Math.max(trainingBlock?.weeks ?? 6, maxPresent);
  const weekList = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  const weekDays = routines
    .filter((r) => (r.week_number || 1) === week)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const current = weekDays.find((r) => r.id === activeDay) ?? weekDays[0];
  const exList = current?.exercises ?? [];

  const dayNameOf = (r?: Routine) => (r?.day_name || r?.name || "").trim().toLowerCase();
  const exerciseInWeek = (weekNum: number, dayName: string, ex: Exercise) => {
    const day = routines.find(
      (r) => (r.week_number || 1) === weekNum && dayNameOf(r) === dayName
    );
    return (day?.exercises ?? []).find(
      (e) => e.name.trim().toLowerCase() === ex.name.trim().toLowerCase()
    );
  };
  const latestLogFor = (exerciseId?: string) =>
    exerciseId ? logs.find((l) => l.exercise_id === exerciseId) : undefined;
  const fmtLog = (l?: SetLog) => {
    if (!l) return null;
    const reps = l.actual_reps ?? null;
    const weight = l.actual_weight ?? null;
    if (reps == null && weight == null) return null;
    return `${reps ?? "-"} × ${weight ?? "-"}${weight != null ? " kg" : ""}`;
  };
  const weekExercises = (weekNum: number) =>
    routines
      .filter((r) => (r.week_number || 1) === weekNum)
      .flatMap((r) => r.exercises ?? []);
  const weekDone = (weekNum: number) => {
    const exs = weekExercises(weekNum);
    return exs.length > 0 && exs.every((e) => logs.some((l) => l.exercise_id === e.id));
  };
  const firstIncomplete = weekList.find(
    (w) => weekExercises(w).length > 0 && !weekDone(w)
  );
  const statusOf = (weekNum: number): "done" | "active" | "upcoming" | "empty" => {
    if (weekExercises(weekNum).length === 0) return "empty";
    if (weekDone(weekNum)) return "done";
    return weekNum === firstIncomplete ? "active" : "upcoming";
  };
  // Semana "en curso": la primera incompleta (o la que se está viendo). Las semanas
  // posteriores son sobrecarga planificada y se muestran atenuadas.
  const activeWeek = firstIncomplete ?? week;

  // --- Resumen de sesión / semanal / adherencia ---
  const daySummary = current ? buildDaySummaryFromRows(current, rows) : null;
  const dayRowsComplete = !!daySummary && daySummary.allCompleted;

  const prevDayRoutine = weekDays.length
    ? prevWeekRoutinesFor(week - 1).find((r) => dayNameOf(r) === dayNameOf(current))
    : undefined;
  const improved = current
    ? mostImproved([current], prevDayRoutine ? [prevDayRoutine] : [], logs)
    : null;
  const discomfortReported = detection.discomfortZones.length > 0;
  const resolvedScenario: SessionScenario =
    scenarioOverride.current ??
    (daySummary
      ? resolveScenario({
          day: daySummary,
          improved: !!improved,
          discomfort: discomfortReported,
        })
      : "consistency");

  function prevWeekRoutinesFor(weekNum: number): Routine[] {
    return routines
      .filter((r) => (r.week_number || 1) === weekNum)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  const goToMissedDay = (missed: MissedDay) => {
    setRetroDate(missed.date);
    setWeek(missed.routine.week_number || 1);
    setActiveDay(missed.routine.id);
    setView("train");
    setWeeklyOpen(false);
    setNudgeVisible(false);
    detection.reportMissedDay(missed.date, "trained");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const dismissNudge = () => {
    setNudgeVisible(false);
    if (detection.nudge.missedDate) detection.dismissNudge(detection.nudge.missedDate);
  };

  const nudgeRest = () => {
    setNudgeVisible(false);
    if (detection.nudge.missedDate) detection.reportMissedDay(detection.nudge.missedDate, "rest");
  };

  const celebrationMetabolic = anamnesis
    ? computeMetabolic({
        sex: anamnesis.sex,
        weight_kg: anamnesis.weight_kg,
        height_cm: anamnesis.height_cm,
        age: anamnesis.age,
        goal: anamnesis.goal,
        activity_level: anamnesis.activity_level,
        training_days: anamnesis.training_days,
      })
    : null;

  return (
    <>
      <WelcomeScreen
        open={welcomeOpen}
        name={profile.full_name || profile.email.split("@")[0]}
        onDone={() => setWelcomeOpen(false)}
      />
      {celebrationMetabolic && (
        <OnboardingCelebration
          open={celebrateOpen}
          name={profile.full_name || profile.email.split("@")[0]}
          metabolic={celebrationMetabolic}
          onDone={() => setCelebrateOpen(false)}
        />
      )}
      <header className="app-header">
        <div className="app-header-inner">
          <span className="brand">
            <img
              className="brand-logo"
              src="/img/logo-nocitocoach.webp"
              width={636}
              height={547}
              alt="Nocito Coach"
              decoding="async"
            />
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="muted hide-sm" style={{ fontSize: ".9rem" }}>
              {profile.full_name || profile.email.split("@")[0]}
            </span>
            <button
              className={`btn ${pushStatus === "on" ? "btn-outline" : "btn-primary"}`}
              onClick={enablePush}
              disabled={pushStatus !== "idle" && pushStatus !== "denied"}
              style={{ padding: "8px 14px" }}
            >
              {pushStatus === "on"
                ? "Avisos activados"
                : pushStatus === "busy"
                ? "Activando…"
                : pushStatus === "denied"
                ? "Activar avisos"
                : pushStatus === "unsupported"
                ? "Avisos no disponibles"
                : pushStatus === "checking"
                ? "…"
                : "Activar avisos"}
            </button>
            <button className="btn btn-outline" onClick={logout} style={{ padding: "8px 14px" }}>
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="section">
        <div className="container">
          {planStatus === "pending_review" ? (
            <PendingReviewDashboard profile={profile} anamnesis={anamnesis} onRefresh={loadRoutine} />
          ) : (
            <>
          <div className="row-between" style={{ marginBottom: 18 }}>
            <div>
              <h1 style={{ margin: "0 0 2px", fontSize: "1.6rem" }}>
                Hola, {profile.full_name || profile.email.split("@")[0]}
              </h1>
              <span className="muted" style={{ fontSize: ".92rem" }}>
                Tu entrenamiento de hoy
              </span>
            </div>
          </div>

          <div className="app-tabs">
            <button
              className={`chip ${view === "train" ? "active" : ""}`}
              onClick={() => setView("train")}
            >
              Entrenamiento
            </button>
            <button
              className={`chip ${view === "nutrition" ? "active" : ""}`}
              onClick={() => setView("nutrition")}
            >
              Nutrición
            </button>
          </div>

          {view === "train" && (
            <>
          {loadingData && <p className="muted">Cargando tu rutina…</p>}

          {!loadingData && routines.length === 0 && (
            planStatus === "pending_review" ? (
              <div className="card notice-review">
                <span className="notice-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </span>
                <span className="badge">Supervisión profesional</span>
                <h3>Tus datos ya están en la mesa de trabajo de José Nocito</h3>
                <p className="muted">En breve tu programa personalizado estará activo.</p>
              </div>
            ) : (
              <div className="card">
                <span className="badge">Sin rutina asignada</span>
                <p className="muted" style={{ marginBottom: 0 }}>
                  Tu coach todavía no cargó una rutina. Volvé a intentar más tarde.
                </p>
              </div>
            )
          )}

          {routines.length > 0 && (
            <>
              {trainingBlock?.guideline && (
                <div className="block-guide">
                  <span className="block-guide-tag">Guía del bloque</span>
                  <p>{trainingBlock.guideline}</p>
                </div>
              )}

              <div className="week-selector">
                <span className="week-selector-label">Bloque</span>
                <div className="week-track">
                  {weekList.map((w) => {
                    const st = statusOf(w);
                    return (
                      <button
                        key={w}
                        className={`week-pill ${st} ${w === week ? "current" : ""}`}
                        onClick={() => {
                          setWeek(w);
                          setActiveDay(null);
                        }}
                        title={
                          st === "empty"
                            ? "Semana aún sin rutina cargada"
                            : st === "done"
                            ? "Semana completada"
                            : st === "active"
                            ? "Semana en curso"
                            : "Próxima semana"
                        }
                      >
                        <span className="week-pill-top">
                          {st === "done" ? "✓" : `Sem ${w}`}
                        </span>
                        <span className="week-pill-sub">
                          {st === "done"
                            ? `Sem ${w}`
                            : st === "active"
                            ? "En curso"
                            : st === "upcoming"
                            ? "Próxima"
                            : "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {weekDays.length > 0 ? (
                <div className="day-tabs">
                  {weekDays.map((r) => (
                    <button
                      key={r.id}
                      className={`chip ${r.id === current?.id ? "active" : ""}`}
                      onClick={() => setActiveDay(r.id)}
                    >
                      {r.day_name || r.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="card">
                  <span className="badge">Semana {week} en preparación</span>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Tu coach todavía no cargó la rutina de esta semana. Seguí con la semana en
                    curso.
                  </p>
                </div>
              )}

              <div className="row-between" style={{ marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <span className="badge">
                  Sem {week} · {exList.length} ejercicio{exList.length === 1 ? "" : "s"}
                </span>
                {detection.isWeekCompleted && (
                  <button
                    className="btn btn-outline weekly-cta"
                    onClick={() => setWeeklyOpen(true)}
                  >
                    Ver resumen de la semana
                  </button>
                )}
                <span className="muted" style={{ fontSize: ".85rem" }}>
                  Registrás hoy · {today}
                </span>
              </div>

              {retroDate && (
                <div className="retro-banner">
                  <span className="retro-banner-ic">↺</span>
                  <div>
                    <strong>Cargando series del {retroDate}</strong>
                    <span>Completá lo que entrenaste ese día. Se guarda con esa fecha.</span>
                  </div>
                  <button
                    className="btn btn-outline"
                    onClick={() => setRetroDate(null)}
                    style={{ padding: "7px 12px" }}
                  >
                    Volver a hoy
                  </button>
                </div>
              )}

              {exList.map((ex, idx) => {
                const media = embedUrl(ex.video_url);
                const notes = (ex.technique_notes ?? "").split("\n").filter(Boolean);
                const recording = recordingFor === ex.id;
                const processing = voiceBusy === ex.id;
                const prevWeek = week - 1;
                const prevEx =
                  prevWeek >= 1 ? exerciseInWeek(prevWeek, dayNameOf(current), ex) : undefined;
                const prevText = fmtLog(latestLogFor(prevEx?.id));
                const dayName = dayNameOf(current);
                const weeklyBests: (number | null)[] = [];
                for (let w = 1; w < week; w++) {
                  const past = exerciseInWeek(w, dayName, ex);
                  const best = past
                    ? logs
                        .filter((l) => l.exercise_id === past.id && l.actual_weight != null)
                        .reduce<number | null>(
                          (m, l) => (m === null || Number(l.actual_weight) > m ? Number(l.actual_weight) : m),
                          null
                        )
                    : null;
                  weeklyBests.push(best);
                }
                const advice = proposeProgression({
                  exercise: ex,
                  sets: (rows[ex.id] ?? []).filter((r) => r.set_number > 0),
                  weeklyBests,
                  unit: ex.unit,
                });
                return (
                  <div
                    className="exercise-card block-card view-fade-item"
                    style={{
                      animationDelay: `${Math.min(idx, 6) * 40}ms`,
                      borderLeft: ex.technique_type === "superset" ? "4px solid #FFC400" : undefined,
                    }}
                    key={`${week}-${dayNameOf(current)}-${ex.id}`}
                  >
                    <div className="workout-grid">
                      <div>
                        <div className="exercise-head">
                          <span className="ex-badge">{idx + 1}</span>
                          <h3 className="exercise-name">{ex.name}</h3>
                          {ex.technique_type && ex.technique_type !== "normal" && (
                            <span
                              style={{
                                fontSize: ".7rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: ".06em",
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: "rgba(255,196,0,.15)",
                                color: "#FFC400",
                                border: "1px solid rgba(255,196,0,.4)",
                              }}
                            >
                              {ex.technique_type === "superset"
                                ? "Superset"
                                : ex.technique_type === "drop_set"
                                ? "Drop set"
                                : ex.technique_type === "rest_pause"
                                ? "Rest-pause"
                                : ex.technique_type}
                            </span>
                          )}
                          <span className="target-chip">
                            <b>{ex.target_sets ?? "-"}</b> × <b>{ex.target_reps ?? "-"}</b>
                            {ex.target_weight ? (
                              <>
                                {" · "}
                                <b>
                                  {ex.target_weight} {ex.unit}
                                </b>
                              </>
                            ) : null}
                          </span>
                        </div>
                        {media.kind === "iframe" && (
                          <div className="video-frame">
                            <iframe
                              src={media.src}
                              title={ex.name}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        )}
                        {media.kind === "video" && (
                          <div className="video-frame">
                            <video src={media.src} controls playsInline />
                          </div>
                        )}
                        {media.kind === "none" && <ExerciseDemo name={ex.name} />}
                        {notes.length > 0 && (
                          <ul className="tech-list">
                            {notes.map((n, i) => (
                              <li key={i}>{n.replace(/^[-•]\s*/, "")}</li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <div className="track-head">
                          <h4>Mis series</h4>
                          {prevWeek >= 1 && (
                            <span className="prev-ref">
                              {prevText
                                ? `Sem ${prevWeek}: ${prevText}`
                                : `Sem ${prevWeek}: sin registro`}
                            </span>
                          )}
                        </div>
                        <table className="track-table">
                          <thead>
                            <tr>
                              <th>Tipo de serie</th>
                              <th>Reps</th>
                              <th>Peso ({ex.unit})</th>
                              <th>RIR</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {(rows[ex.id] ?? []).map((r) => {
                              const fillKey = `${ex.id}:${r.set_number}`;
                              const stagger = fillOrder[fillKey];
                              return ( <> 
                              <tr
                                key={r.set_number}
                                className={[
                                  r.set_number === 0 ? "warmup-row" : "",
                                  savedFlash[fillKey] ? "row-flash" : "",
                                  stagger !== undefined ? "row-fill" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ") || undefined}
                                style={
                                  stagger !== undefined
                                    ? ({ "--stagger": `${stagger * 70}ms` } as CSSProperties)
                                    : undefined
                                }
                              >
                                <td className="set-index">
                                  {r.set_number === 0 ? "Calentamiento" : "Efectiva"}
                                </td>
                                <td>
                                  <div className="cell-wrap">
                                    <span className="phantom">{ex.target_reps ?? ""}</span>
                                    <input
                                      className="num-input"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={r.actual_reps}
                                      onChange={(e) =>
                                        updateRow(ex.id, r.set_number, {
                                          actual_reps: e.target.value.replace(/[^\d]/g, ""),
                                        })
                                      }
                                      onBlur={() => saveSet(ex, r.set_number)}
                                    />
                                  </div>
                                </td>
                                <td>
                                  <div className="cell-wrap">
                                    <span className="phantom">{ex.target_weight ?? ""}</span>
                                    <input
                                      className="num-input"
                                      inputMode="decimal"
                                      value={r.actual_weight}
                                      onChange={(e) =>
                                        updateRow(ex.id, r.set_number, {
                                          actual_weight: e.target.value.replace(/[^\d.,]/g, ""),
                                        })
                                      }
                                      onBlur={() => saveSet(ex, r.set_number)}
                                    />
                                  </div>
                                </td>
                                <td>
                                  <div className="cell-wrap">
                                    <input
                                      className="num-input rir-input"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={r.rir}
                                      placeholder="—"
                                      onChange={(e) =>
                                        updateRow(ex.id, r.set_number, {
                                          rir: e.target.value.replace(/[^\d]/g, "").slice(0, 1),
                                        })
                                      }
                                      onBlur={() => saveSet(ex, r.set_number)}
                                    />
                                  </div>
                                </td>
                                <td>
                                  <div className="save-flag">{r.saved ? "✓" : ""}</div>
                                </td>
                              </tr>
                              {ex.technique_type === "drop_set" && (
                                <tr key={`drop-${r.set_number}`}>
                                  <td colSpan={5} style={{ padding: "4px 8px", background: "rgba(255,196,0,.04)" }}>
                                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                      <span style={{ fontSize: ".75rem", color: "#a1a1aa" }}>Caídas:</span>
                                      {(r.drops || []).map((d, di) => (
                                        <span key={di} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                                          <input className="num-input" style={{ width: 52, padding: "6px 4px" }} placeholder="reps" value={d.reps} onChange={(e) => updateDrop(ex.id, r.set_number, di, "reps", e.target.value)} onBlur={() => saveSet(ex, r.set_number)} />
                                          <input className="num-input" style={{ width: 60, padding: "6px 4px" }} placeholder="kg" value={d.weight} onChange={(e) => updateDrop(ex.id, r.set_number, di, "weight", e.target.value)} onBlur={() => saveSet(ex, r.set_number)} />
                                        </span>
                                      ))}
                                      <button type="button" onClick={() => addDrop(ex.id, r.set_number)} style={{ background: "transparent", border: "1px solid #FFC400", color: "#FFC400", borderRadius: 6, padding: "2px 8px", fontSize: ".75rem", cursor: "pointer" }}>+ caída</button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                              </> );
                            })}
                          </tbody>
                        </table>
                        <p className="muted" style={{ fontSize: ".78rem", margin: "8px 0 0" }}>
                          RIR = repeticiones en reserva: cuántas repeticiones te quedaban antes del fallo.
                        </p>

                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, marginBottom: 8, alignItems: "center" }}>
              <button type="button" onClick={() => setAddMenuEx(addMenuEx === ex.id ? null : ex.id)} style={{ background: "#FFC400", border: "none", color: "#000", fontWeight: 700, borderRadius: 8, padding: "6px 14px", fontSize: ".8rem", cursor: "pointer" }}>+ Agregar serie</button>
              <button type="button" onClick={() => void removeLastSet(ex)} disabled={(rows[ex.id] || []).length <= Math.max(1, Math.min(9, ex.target_sets || 3)) + 1} style={{ background: "transparent", border: "1px solid #FFC400", color: "#FFC400", fontWeight: 700, borderRadius: 8, padding: "6px 14px", fontSize: ".8rem", cursor: "pointer" }}>- Sacar serie</button>
              {addMenuEx === ex.id && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" disabled={(rows[ex.id] || []).some((r) => r.set_number === 0)} onClick={() => { addSet(ex, true); setAddMenuEx(null); }} style={{ background: "transparent", border: "1px solid #FFC400", color: "#FFC400", borderRadius: 8, padding: "6px 10px", fontSize: ".78rem", cursor: "pointer" }}>Calentamiento</button>
                  <button type="button" disabled={(rows[ex.id] || []).length >= 10} onClick={() => { addSet(ex, false); setAddMenuEx(null); }} style={{ background: "transparent", border: "1px solid #FFC400", color: "#FFC400", borderRadius: 8, padding: "6px 10px", fontSize: ".78rem", cursor: "pointer" }}>Efectiva</button>
                </div>
              )}
              <span className="muted" style={{ fontSize: ".72rem" }}>{(rows[ex.id] || []).length} / 10</span>
            </div>
            <div style={{ marginTop: 14 }}>
                          <button
                            className={`mic-btn ${recording ? "rec" : ""} ${processing ? "proc" : ""}`}
                            disabled={processing || (voiceBusy !== null && !processing)}
                            onClick={() => (recording ? stopRec() : startRec(ex))}
                          >
                            {processing ? (
                              "Procesando…"
                            ) : recording ? (
                              <>
                                <Wave />
                                Escuchando…
                              </>
                            ) : (
                              <>
                                <MicIcon />
                                Dictar series por voz
                              </>
                            )}
                          </button>
                          <p className="muted" style={{ fontSize: ".9rem", marginTop: 8 }}>
                            {recording
                              ? "Tocá para detener y cargar las series."
                              : "Dictá tus series por voz, por ejemplo «3 series de 10 con 50 kilos»."}
                          </p>
                          {recording && (
                            <div className="voice-live">
                              <Wave />
                              <span className="voice-live-label">Escuchando…</span>
                              {liveText ? (
                                <p className="voice-live-text">“{liveText}”</p>
                              ) : (
                                <p className="voice-live-text placeholder">
                                  {speechSupported
                                    ? "Decí tus series…"
                                    : "Grabando… al detener se interpretan tus series."}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {advice && (
                      <div className={`advice-card ${advice.kind}`}>
                        <span className="advice-ic" aria-hidden="true">
                          {advice.kind === "progress"
                            ? "↑"
                            : advice.kind === "deload"
                            ? "↓"
                            : advice.kind === "variation"
                            ? "⇄"
                            : "◎"}
                        </span>
                        <div className="advice-body">
                          <strong>{advice.title}</strong>
                          <span>{advice.detail}</span>
                        </div>
                        {advice.nextWeight != null && (
                          <span className="advice-next">
                            Próx. {advice.nextReps ?? "-"} ×{" "}
                            {Number.isInteger(advice.nextWeight)
                              ? advice.nextWeight
                              : advice.nextWeight.toFixed(1).replace(".", ",")}{" "}
                            {ex.unit ?? "kg"}
                          </span>
                        )}
                      </div>
                    )}
                    {cardToast?.exId === ex.id && (
                      <div
                        className={`card-toast ${cardToast.kind} ${
                          toastClosing ? "closing" : ""
                        }`}
                        role="status"
                      >
                        <span className="card-toast-ic" aria-hidden="true">
                          {cardToast.kind === "ok" ? "✓" : cardToast.kind === "err" ? "!" : "…"}
                        </span>
                        <div className="card-toast-body">
                          <strong>{cardToast.title}</strong>
                          {cardToast.detail && <span>{cardToast.detail}</span>}
                        </div>
                        {cardToast.canUndo && (
                          <button
                            className="card-toast-undo"
                            onClick={() => {
                              if (cardToast.onUndo) {
                                cardToast.onUndo();
                                dismissToast();
                              } else {
                                undoVoice();
                              }
                            }}
                          >
                            Deshacer
                          </button>
                        )}
                        {cardToast.ms ? (
                          <span
                            className="card-toast-timer"
                            style={{ animationDuration: `${cardToast.ms}ms` }}
                          />
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}

              {current && exList.length > 0 && (
                <div className="finish-wrap">
                  <button
                    className="finish-btn"
                    disabled={!dayRowsComplete}
                    title={
                      dayRowsComplete
                        ? "Ver el resumen de tu sesión"
                        : "Completa todos los ejercicios para finalizar"
                    }
                    onClick={() => dayRowsComplete && setSummaryOpen(true)}
                  >
                    Finalizar rutina del día
                  </button>
                  <div className="finish-secondary">
                    <button
                      className="finish-ghost"
                      onClick={() => setDiscomfortOpen(true)}
                    >
                      Reportar molestia
                    </button>
                    <button
                      className="finish-ghost"
                      onClick={() => setVoiceOpen(true)}
                    >
                      Nota de voz al coach
                    </button>
                  </div>
                  {!dayRowsComplete && (
                    <span className="finish-hint">
                      Completa todos los ejercicios para finalizar
                    </span>
                  )}
                </div>
              )}

              {current && exList.length > 0 && (
                <div className="card progression-card">
                  <div
                    className="row-between"
                    style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}
                  >
                    <h3 style={{ margin: 0 }}>Progresión del Bloque</h3>
                    <span className="muted" style={{ fontSize: ".85rem" }}>
                      {current.day_name || current.name}
                    </span>
                  </div>
                  <div className="scroll-x">
                    <table className="data-table progression-table" style={{ minWidth: 560 }}>
                      <thead>
                        <tr>
                          <th>Ejercicio</th>
                          {weekList.map((w) => {
                            const cls =
                              [
                                w === week ? "col-current" : "",
                                w > activeWeek ? "prog-future" : "",
                              ]
                                .filter(Boolean)
                                .join(" ") || undefined;
                            return (
                              <th key={w} className={cls}>
                                Sem {w}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {exList.map((ex) => (
                          <tr key={ex.id}>
                            <td>
                              <b>{ex.name}</b>
                            </td>
                            {weekList.map((w) => {
                              const wkEx = exerciseInWeek(w, dayNameOf(current), ex);
                              const logged = fmtLog(latestLogFor(wkEx?.id));
                              let target: string | null = null;
                              if (
                                wkEx &&
                                (wkEx.target_reps != null || wkEx.target_weight != null)
                              ) {
                                target =
                                  wkEx.target_weight != null
                                    ? `${wkEx.target_reps ?? "-"} × ${wkEx.target_weight} kg`
                                    : wkEx.target_reps != null
                                    ? `${wkEx.target_reps} reps`
                                    : null;
                              }
                              const cellCls =
                                [
                                  w === week ? "col-current" : "",
                                  w > activeWeek ? "prog-future" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ") || undefined;
                              return (
                                <td key={w} className={cellCls}>
                                  {logged ? (
                                    <span className="prog-done">{logged}</span>
                                  ) : target ? (
                                    <span className="prog-target">{target}</span>
                                  ) : (
                                    <span className="muted">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="muted" style={{ margin: "10px 0 0", fontSize: ".82rem" }}>
                    <span className="prog-done">Registrado</span> · {" "}
                    <span className="prog-target">objetivo del coach</span> ·{" "}
                    <span style={{ color: "rgba(252, 211, 77, 0.6)" }}>
                      semanas futuras = sobrecarga planificada
                    </span>
                  </p>
                </div>
              )}
            </>
          )}

            </>
          )}

          {view === "nutrition" && <NutritionTracker nutrition={nutrition} />}
            </>
          )}
        </div>
      </main>

      {daySummary && current && (
        <PostSessionSummary
          open={summaryOpen}
          onClose={() => setSummaryOpen(false)}
          studentName={profile.full_name || profile.email.split("@")[0]}
          day={daySummary}
          scenario={resolvedScenario}
          improvedExercise={improved}
          discomfort={
            discomfortReported
              ? { zone: detection.discomfortZones[0], exercise: exList[0]?.name ?? "" }
              : null
          }
          onSendVoiceNote={() => {
            setSummaryOpen(false);
            setVoiceOpen(true);
          }}
        />
      )}

      <WeeklySummary
        open={weeklyOpen}
        onClose={() => setWeeklyOpen(false)}
        weekNumber={week}
        studentName={profile.full_name || profile.email.split("@")[0]}
        summary={detection.weekSummary}
        missedDays={detection.missedDays}
        onReport={(date, kind) => detection.reportMissedDay(date, kind)}
        onRetroLoad={goToMissedDay}
        onViewNextWeek={() => {
          const next = Math.min(totalWeeks, week + 1);
          setWeek(next);
          setActiveDay(null);
          setWeeklyOpen(false);
        }}
      />

      <AdherenceNudge
        open={nudgeVisible}
        studentName={profile.full_name || profile.email.split("@")[0]}
        weekday={detection.nudge.weekday}
        onDismiss={dismissNudge}
        onTrained={() => {
          setNudgeVisible(false);
          if (detection.nudge.missedDate) {
            const missedDate = detection.nudge.missedDate;
            const target = detection.missedDays[0];
            if (target) {
              goToMissedDay(target);
            } else {
              setRetroDate(missedDate);
              detection.dismissNudge(missedDate);
            }
          }
        }}
        onRest={nudgeRest}
      />

      {pushPrompt && (
        <div className="modal-overlay" onClick={() => setPushPrompt(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ background: "#0A0A0A", border: "1px solid #242424", maxWidth: 420 }}>
            <h3 style={{ marginTop: 0, color: "#f8fafc" }}>{pushPrompt === "audit" ? "¿Qué pasó hoy?" : "Resumen semanal"}</h3>
            <p className="muted" style={{ marginTop: -6, marginBottom: 14 }}>{pushPrompt === "audit" ? "Decime si no fuiste a entrenar o te olvidaste de completar los datos en la app." : "Elegí una opción o dejá tu feedback con texto o dictado."}</p>
            {pushPrompt === "weekly" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {["Mejoré mis cargas", "Cumplí la semana", "Necesito ajustar la rutina"].map((opt) => (
                  <button key={opt} className="btn btn-outline" onClick={() => void submitPushResponse("choice", opt)} style={{ justifyContent: "flex-start", borderColor: "#FFC400", color: "#f8fafc" }}>{opt}</button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea className="input" rows={4} placeholder={pushPrompt === "audit" ? "Contame qué pasó..." : "Dejá tu comentario..."} value={pushResponse} onChange={(e) => setPushResponse(e.target.value)} style={{ width: "100%", background: "#0f0f0f", border: "1px solid #242424", color: "#f8fafc" }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
                <button className="btn btn-outline" onClick={() => { try { const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; if (!SR) { showToast({ exId: "", kind: "err", title: "Dictado no disponible" }, 2500); return; } const rec = new SR(); rec.lang = "es-AR"; rec.interimResults = false; rec.maxAlternatives = 1; rec.onresult = (ev: any) => { const t = ev.results[0][0].transcript; setPushResponse((p) => (p ? p + " " + t : t)); }; rec.onerror = () => showToast({ exId: "", kind: "err", title: "No se pudo dictar" }, 2500); rec.start(); showToast({ exId: "", kind: "ok", title: "Escuchando..." }, 1500); } catch { showToast({ exId: "", kind: "err", title: "Dictado no disponible" }, 2500); } }} style={{ borderColor: "#FFC400", color: "#f8fafc" }}>Dictar por voz</button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-outline" onClick={() => setPushPrompt(null)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={() => void submitPushResponse("text", pushResponse)} disabled={!pushResponse.trim()} style={{ background: "#FFC400", color: "#000", borderColor: "#FFC400" }}>Enviar respuesta</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <VoiceNoteRecorder open={voiceOpen} onClose={() => setVoiceOpen(false)} />

      <DiscomfortReporter
        open={discomfortOpen}
        onClose={() => setDiscomfortOpen(false)}
        onSubmit={(zones) => {
          detection.reportDiscomfort(today, zones);
          setSummaryOpen(true);
        }}
      />
    </>
  );
}
