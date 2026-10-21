import type { Metadata } from "next";
import LegalPage from "@/app/components/LegalPage";

export const metadata: Metadata = {
  title: "Política de privacidad (borrador) | nocito.coach",
  description: "Borrador de la política de privacidad de nocito.coach.",
  robots: { index: false, follow: false },
};

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de privacidad">
      <h2>1. Quién es el responsable</h2>
      <p>
        El responsable del tratamiento es José Nocito, que presta servicios bajo
        la marca <strong>nocito.coach</strong>. Datos legales pendientes:{" "}
        <span className="legal-todo">TODO-JOSE: razón social, CUIT y domicilio legal</span>.
        Contacto: <a href="mailto:nocito.coach@gmail.com">nocito.coach@gmail.com</a>.
      </p>

      <h2>2. Qué datos recopilamos</h2>
      <ul>
        <li>
          <strong>Datos de cuenta y contacto:</strong> nombre completo, nombre de
          usuario, email, teléfono/WhatsApp y PIN de acceso.
        </li>
        <li>
          <strong>Datos de salud y entrenamiento:</strong> edad, sexo, altura,
          peso, composición corporal estimada, lesiones, condiciones médicas que
          decidas informar, experiencia, disponibilidad, preferencias
          alimentarias y hábitos.
        </li>
        <li>
          <strong>Registros de uso:</strong> rutinas asignadas, series, cargas,
          repeticiones, RIR, molestias reportadas, notas de voz y fotos de
          progreso si las subís.
        </li>
        <li>
          <strong>Datos de pago:</strong> plan elegido y estado del pago. Los
          datos de tarjeta o cuenta los procesa Mercado Pago o el banco; no los
          almacenamos en la app.
        </li>
        <li>
          <strong>Datos técnicos:</strong> información agregada de uso y
          dispositivo para seguridad y mejora del servicio.
        </li>
      </ul>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Crear y administrar tu cuenta y tu acceso a la app privada.</li>
        <li>Diseñar, revisar y ajustar tu plan de entrenamiento y alimentación.</li>
        <li>Hacer seguimiento de tu progreso y responder tus consultas.</li>
        <li>Gestionar pagos, accesos y obligaciones legales.</li>
        <li>Enviarte avisos operativos y, si lo aceptás, comunicaciones del servicio.</li>
        <li>Prevenir fraudes, abusos y accesos no autorizados.</li>
      </ul>

      <h2>4. Quién puede acceder</h2>
      <p>
        Accede José Nocito y, cuando corresponde, proveedores tecnológicos que
        nos ayudan a operar el servicio (por ejemplo, alojamiento, base de datos,
        pagos, email y mensajería), con acceso limitado a lo necesario. No
        vendemos tus datos personales.
      </p>
      <p>
        <span className="legal-todo">
          TODO-JOSE: listar los proveedores definitivos y sus países de
          alojamiento si se requiere transferencia internacional.
        </span>
      </p>

      <h2>5. Cuánto tiempo los conservamos</h2>
      <p>
        Mientras tu cuenta esté activa y durante los plazos necesarios para
        cumplir obligaciones legales, contables o resolver reclamos. Si pedís la
        eliminación, borramos o anonimizamos los datos que no debamos conservar
        por ley.
      </p>

      <h2>6. Tus derechos</h2>
      <p>
        Podés solicitar acceso, rectificación, actualización, eliminación u
        oposición al tratamiento escribiendo a{" "}
        <a href="mailto:nocito.coach@gmail.com">nocito.coach@gmail.com</a> o por
        WhatsApp al{" "}
        <a href="https://wa.me/5492616224718" target="_blank" rel="noopener noreferrer">
          +54 9 2616 22-4718
        </a>
        . Responderemos en un plazo razonable. También podés presentar un reclamo
        ante la Agencia de Acceso a la Información Pública de Argentina.
      </p>

      <h2>7. Seguridad</h2>
      <p>
        Usamos conexiones cifradas (HTTPS), acceso restringido a la base de datos
        y el PIN se guarda hasheado, no en texto plano. Ningún sistema es
        infalible: si detectás un acceso sospechoso, avisanos de inmediato.
      </p>

      <h2>8. Menores de edad</h2>
      <p>
        El servicio está pensado para personas mayores de 18 años. No
        recopilamos deliberadamente datos de menores sin autorización de su
        representante legal.
      </p>

      <h2>9. Datos de salud y aviso importante</h2>
      <p>
        Los datos de salud que compartís se usan exclusivamente para adaptar tu
        plan. <strong>La asesoría no reemplaza una consulta médica</strong> ni un
        diagnóstico profesional. Ante lesiones, embarazo, cirugías o condiciones
        médicas, consultá primero con tu médico.
      </p>

      <h2>10. Cookies y analítica</h2>
      <p>
        Podemos usar mediciones agregadas de tráfico y rendimiento. Si en el
        futuro incorporamos cookies no esenciales, pediremos tu consentimiento
        cuando corresponda.
        <span className="legal-todo">
          {" "}TODO-JOSE: confirmar herramientas de analítica y cookies definitivas.
        </span>
      </p>

      <h2>11. Cambios</h2>
      <p>
        Podemos actualizar esta política. Publicaremos la versión vigente en esta
        página e indicaremos la fecha de actualización.
      </p>
    </LegalPage>
  );
}
