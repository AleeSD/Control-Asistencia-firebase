import { MapPin } from "lucide-react";
import type { MarkType } from "./types";
import "./location.css";

export default function LocationPrompt({ type, busy, error, automatic = false, onConfirm, onClose }: {
  type: MarkType; busy: boolean; error: string; automatic?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return <div className="location-backdrop" role="presentation" onMouseDown={() => !busy && onClose()}>
    <div className="location-dialog" role="dialog" aria-modal="true" aria-labelledby="location-title" onMouseDown={event => event.stopPropagation()}>
      <div className="location-icon"><MapPin size={28} /></div>
      <h2 id="location-title">Ubicación obligatoria</h2>
      <p>Para marcar tu {type} necesitamos registrar la ubicación de este celular.</p>
      {automatic ? <>
        <p className="location-note" role="status">{busy ? "Esperando la ubicación del teléfono… Si aparece el permiso, toca «Permitir» y elige ubicación precisa." : "Activa la ubicación del teléfono y permite el acceso a esta página."}</p>
        {error && <ol><li>Activa la ubicación o GPS del celular.</li><li>En los permisos de esta página, cambia <strong>Ubicación</strong> a <strong>Permitir</strong> y vuelve a intentarlo.</li></ol>}
      </> : <ol>
        <li>Activa la ubicación o GPS del celular.</li>
        <li>Pulsa <strong>Continuar</strong> y elige <strong>Permitir</strong> si el navegador solicita acceso.</li>
      </ol>}
      <p className="location-note">Si no se obtiene la ubicación, la marcación no se guardará. Podrás intentarlo de nuevo.</p>
      {error && <p className="location-error" role="alert">{error}</p>}
      <div className="location-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Cancelar</button>{(!automatic || error) && <button type="button" className="primary-button" disabled={busy} onClick={onConfirm}>{busy ? "Obteniendo ubicación…" : automatic ? "Volver a solicitar ubicación" : "Continuar y permitir"}</button>}</div>
    </div>
  </div>;
}
