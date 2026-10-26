import type { Metadata } from "next";
import LegalPage from "@/app/components/LegalPage";

export const metadata: Metadata = {
  title: "Términos y condiciones | nocito.coach",
  description: "Términos y condiciones de uso de nocito.coach: planes, pagos, responsabilidad y contacto.",
  robots: { index: true, follow: true },
};

export default function TerminosPage() {
  return (
    <LegalPage title="Términos y condiciones">
      <h2>1. Qué es el servicio</h2>
      <p>
        nocito.coach ofrece asesoría de entrenamiento y alimentación, con planes
        personalizados y acceso a una app privada para hacer seguimiento. El
        servicio lo presta <strong>José Nocito</strong>, CUIT{" "}
        <strong>20-25272544-0</strong>, domiciliado en{" "}
        <strong>Pasaje Babilonia 12, Ciudad de Mendoza, Provincia de Mendoza</strong>,
        bajo la marca <strong>nocito.coach</strong>.
      </p>

      <h2>2. Planes, precios y pagos</h2>
      <ul>
        <li>
          Los planes por frecuencia se abonan mensualmente. El precio y la
          frecuencia se muestran en la sección Planes.
        </li>
        <li>
          El plan Rut&Nut es un pago único e incluye rutina y plan de
          alimentación, sin seguimiento mensual.
        </li>
        <li>
          Podés pagar por transferencia bancaria o Mercado Pago. El acceso se
          habilita cuando se confirma el pago y se recibe el comprobante cuando
          corresponda.
        </li>
        <li>
          Precios vigentes: <strong>Plan Estándar</strong> — $49.000 ARS/mes (3
          días/semana); <strong>Plan Pro</strong> — $69.000 ARS/mes (4
          días/semana); <strong>Plan Elite</strong> — $89.000 ARS/mes (5
          días/semana). Los precios pueden actualizarse y la versión vigente es la
          publicada en la sección Planes.
        </li>
        <li>
          Transferencia bancaria: alias <strong>doce.contenidos</strong> · CVU{" "}
          <strong>0000003100074304139861</strong>.
        </li>
      </ul>

      <h2>3. Cuenta y acceso</h2>
      <p>
        Para usar la app privada necesitás una cuenta con datos veraces y un PIN
        personal de 4 dígitos. Sos responsable de mantener la confidencialidad
        del PIN y de toda actividad realizada con tu cuenta. No compartas tu
        acceso con terceros.
      </p>

      <h2>4. Salud y responsabilidad</h2>
      <p>
        <strong>El servicio no reemplaza la consulta médica.</strong> Antes de
        empezar, declarás que estás en condiciones de entrenar o que consultaste
        con un profesional de la salud. Informá lesiones, cirugías, embarazo o
        condiciones médicas relevantes. Seguí las indicaciones y detené el
        ejercicio si sentís dolor o malestar.
      </p>
      <p>
        No se garantizan resultados específicos: dependen de tu constancia,
        descanso, alimentación, genética y otros factores ajenos al servicio.
      </p>

      <h2>5. Cancelación y reembolsos</h2>
      <p>
        Los planes mensuales se renuevan mes a mes. Podés cancelar antes de la
        próxima renovación escribiendo a{" "}
        <a href="mailto:nocito.coach@gmail.com">nocito.coach@gmail.com</a> o por
        WhatsApp. Mantenés el acceso hasta el final del período ya pagado. Los
        reembolsos se evalúan conforme a la normativa aplicable y no alcanzan
        períodos ya utilizados, salvo obligación legal.
      </p>

      <h2>6. Uso aceptable</h2>
      <ul>
        <li>No compartir, revender ni publicar el material del plan.</li>
        <li>No suplantar a otra persona ni usar datos falsos.</li>
        <li>No intentar acceder a cuentas ajenas ni vulnerar la seguridad.</li>
        <li>No usar el servicio para fines ilegales o lesivos.</li>
      </ul>
      <p>
        Podemos suspender o cancelar el acceso ante un incumplimiento grave,
        informando el motivo cuando sea posible.
      </p>

      <h2>7. Propiedad intelectual</h2>
      <p>
        Los planes, textos, videos, marcas y demás contenidos de nocito.coach son
        de su titular. Te otorgamos una licencia personal, limitada y no
        transferible para usar el material mientras tu plan esté activo.
      </p>

      <h2>8. Disponibilidad y cambios</h2>
      <p>
        Buscamos que la app esté disponible, pero puede haber mantenimientos o
        interrupciones. Podemos actualizar estos términos; la versión vigente se
        publica en esta página con su fecha.
      </p>

      <h2>9. Ley aplicable y jurisdicción</h2>
      <p>
        Estos términos se rigen por las leyes de la República Argentina. Cualquier
        controversia será resuelta ante los tribunales competentes de la{" "}
        <strong>Ciudad de Mendoza, Provincia de Mendoza</strong>.
      </p>

      <h2>10. Contacto</h2>
      <p>
        Por consultas sobre estos términos:{" "}
        <a href="mailto:nocito.coach@gmail.com">nocito.coach@gmail.com</a> o{" "}
        <a href="https://wa.me/5492616224718" target="_blank" rel="noopener noreferrer">
          WhatsApp +54 9 2616 22-4718
        </a>
        .
      </p>
    </LegalPage>
  );
}
