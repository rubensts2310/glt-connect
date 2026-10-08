// Foto del asesor (o sus iniciales si aún no tiene) y recorte de la foto antes de subirla
import { assetFile } from "../lib/supabase";
import { initials } from "../lib/format";

export const sellerPhoto = (s) => (s?.photo ? assetFile(s.photo) : null);

export function Avatar({ person, className = "as-av", style }) {
  const src = sellerPhoto(person);
  return src
    ? <img className={`${className} as-av-img`} src={src} alt={person.name} style={style} />
    : <span className={className} style={style}>{initials(person?.name || "")}</span>;
}

// Recorta al centro en cuadrado y reduce a JPEG liviano (lo que acepta el servidor)
export function squarePhoto(file, size = 480) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const c = document.createElement("canvas");
      c.width = c.height = size;
      c.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("No se pudo leer la foto"));
    img.src = URL.createObjectURL(file);
  });
}
