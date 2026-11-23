// Guías para el cliente, en su idioma (Edurne, 2026-11-15). Los PDF están en el bucket público
// docs-publicos de Supabase; los mismos enlaces los usa el workflow "Responden formulario" de n8n
// para adjuntarlos en los correos. Si cambias un nombre de archivo, cámbialo también allí.
import type { Locale } from '../i18n/ui';

const DOCS = 'https://suslwmgqdzingeqhfrpw.supabase.co/storage/v1/object/public/docs-publicos/';
const SUFIJO: Record<Locale, string> = { es: 'ES', ca: 'CA', en: 'EN' };

// Guía del área de clientes (2026-11-23). Guia_Area_Clientes.pdf, sin sufijo, es copia de la ES para enlaces antiguos.
export const guiaAreaClientes = (lang: Locale) => `${DOCS}Guia_Area_Clientes_${SUFIJO[lang]}.pdf`;
export const guiaApoderamientoAeat = (lang: Locale) => `${DOCS}Apoderamiento_AEAT_${SUFIJO[lang]}.pdf`;
export const guiaApoderamientoSs = (lang: Locale) => `${DOCS}Apoderamiento_Seguridad_Social_${SUFIJO[lang]}.pdf`;

// Guía de la FNMT para exportar el certificado digital (Chrome en Windows). Solo existe en
// castellano: las versiones /ca/ y /en/ solo traducen el menú de la web.
const FNMT = 'preguntas-frecuentes/exp-imp-y-elim-de-certificados/-/asset_publisher/EwGOMAWPq4DV/content/1501-como-puedo-exportar-un-certificado-digital-con-google-chrome-en-windows-';
export const guiaExportarCertificado = (lang: Locale) => `https://www.sede.fnmt.gob.es/${lang === 'es' ? '' : lang + '/'}${FNMT}`;
