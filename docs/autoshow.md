# GLT Autoshow — Guía de producto

> **Para quién es este documento:** product owners, gerencia comercial y cualquier persona que necesite entender qué hace la app del Autoshow, sin entrar en detalles técnicos.
>
> **Última actualización:** 8 de octubre de 2026

---

## 1. ¿Qué es?

**GLT Autoshow** es una app para **tablet** que usan los asesores de Jetour en el stand de un autoshow (feria de autos). Se abre en la dirección **`/autoshow`** de GLT Connect y se puede instalar en la tablet como si fuera una app.

Resuelve tres problemas típicos de una feria:

| Problema en el stand | Cómo lo resuelve el Autoshow |
|---|---|
| Los datos de los visitantes se anotan en papel o se pierden | Cada cliente queda registrado en menos de un minuto, con su interés y su "temperatura" de compra |
| Las cotizaciones tardan, salen con errores o nunca llegan al cliente | La cotización se arma en la tablet y el cliente la recibe al instante por **QR o WhatsApp** |
| Después del evento nadie le da seguimiento a los interesados | La app le dice a cada asesor **a quién contactar cada día** y le sugiere el mensaje |

Además, **gerencia ve en tiempo real** cuántos clientes se captaron, cuántos se cotizaron y cómo va cada asesor.

---

## 2. ¿Quién la usa?

| Rol | Qué hace en la app |
|---|---|
| **Asesor** | Muestra el catálogo, registra clientes, cotiza, envía la cotización y da seguimiento a *sus* clientes |
| **Gerente** | Todo lo anterior, más: ve el avance de todo el equipo, administra asesores, configura el evento y exporta los datos |
| **Cliente (visitante)** | No usa la tablet: recibe un **enlace** en su celular con su cotización personalizada |

---

## 3. El recorrido completo

```
 ┌───────────┐   ┌────────────┐   ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
 │ 1. Muestra│ → │ 2. Registra│ → │ 3. Cotiza   │ → │ 4. Envía por │ → │ 5. Da        │
 │ catálogo  │   │ al cliente │   │ en la tablet│   │ QR / WhatsApp│   │ seguimiento  │
 └───────────┘   └────────────┘   └─────────────┘   └──────────────┘   └──────────────┘
                                                            │
                                                            ▼
                                                 El cliente abre su cotización,
                                                 pide test drive o toca "Lo quiero"
                                                 → el asesor se entera al momento
```

### Paso 1 — Mostrar el catálogo
La pestaña **Catálogo** muestra los modelos en el orden definido por la marca, separados en:
- **En el stand:** los carros que el visitante puede ver en la feria.
- **Otros modelos:** versiones que no están exhibidas pero que también se pueden cotizar.

Se puede filtrar por **Gasolina** o **Híbridos PHEV**. Al tocar un modelo se abre su ficha con:
- Fotos desde varios ángulos (frente, lateral, trasera) en cada **color exterior** disponible.
- Los **colores de interior** disponibles.
- Precio (con IVA), bono del autoshow y garantía.
- Ficha técnica, videos y vista 360° del interior (cuando el modelo los tiene).

> Si un color todavía no tiene foto propia, se muestra la foto de otro color del mismo modelo con la etiqueta **"Foto referencial"**.

### Paso 2 — Registrar al cliente
Con **"＋ Registrar cliente"** el asesor anota en segundos:
- Nombre, teléfono y correo.
- Modelo de interés.
- **Temperatura** de compra (ver sección 4).
- Forma de pago (contado, financiado o "no sabe"), enganche aproximado y plazo en que piensa comprar.
- Si trae un carro a cuenta (parte de pago).
- Si **autoriza ser contactado por WhatsApp**.
- Notas libres.

### Paso 3 — Cotizar
En la misma pantalla el asesor arma la cotización:
- Modelo, **color exterior** y **color interior**.
- Accesorios opcionales.
- Bono del autoshow (viene precargado y se puede ajustar).
- Valor del carro que deja a cuenta.
- Si es financiado: **enganche, plazo (24 a 72 meses) y banco**, y la app calcula la **cuota mensual estimada**.

Los modelos con precio en dólares se convierten automáticamente a quetzales.

### Paso 4 — Enviar la cotización
Al generar la cotización aparecen dos opciones:
- **Código QR** en pantalla: el cliente lo escanea con su celular y la abre en el momento.
- **Botón de WhatsApp**: abre el chat con el número del cliente y un mensaje listo para enviar, por ejemplo:

> ¡Hola Ana! Soy **Carlos Pérez**, su asesor de Jetour 👋 Aquí está su cotización de la T2 Híbrido 4x4 Plata con el Bono Autoshow: *(enlace)*
>
> Cualquier duda, le atiendo por aquí.

En WhatsApp el enlace aparece como una **tarjeta con la foto del asesor**, el modelo cotizado y el texto "Le atiende Carlos Pérez".

### Paso 5 — Dar seguimiento
La pestaña **Seguimiento** es la lista de tareas de cada asesor. Le muestra:
- **A quién contactar hoy**, con los clientes calientes primero.
- Quién **ya abrió su cotización** y cuántas veces (una buena señal de interés).
- Quién está **atrasado**.
- Un **mensaje sugerido** de WhatsApp, que cambia según la temperatura del cliente y el número de contacto. El asesor lo puede editar antes de enviarlo.

Al registrar el contacto (WhatsApp o llamada), la app agenda automáticamente el siguiente.

---

## 4. Reglas del negocio

### Temperatura del cliente
| Temperatura | Significado | Primer contacto | Contactos siguientes (días después del anterior) |
|---|---|---|---|
| 🔥 **Caliente** | "Listo para comprar" | Al día siguiente | 2 → 4 → 7 |
| 🙂 **Tibio** | "Evaluando opciones" | A los 2 días | 4 → 7 → 14 |
| ❄️ **Frío** | "Solo viendo" | A los 4 días | 10 → 21 |

Los seguimientos se agendan para las **9:00 a. m.** (hora de Guatemala). Cuando se acaba la secuencia, el cliente sale de la lista de pendientes, pero su ficha sigue disponible.

### Etapas del cliente
**Nuevo → Contactado → Test drive → Negociación → Vendido** (o **Perdido**)

Algunas etapas cambian solas:
- El primer contacto pasa al cliente de *Nuevo* a *Contactado*.
- Si el cliente pide un **test drive** desde su cotización, pasa a *Test drive*.
- Si el cliente toca **"Lo quiero"**, pasa a *Negociación*, se marca como *Caliente* y sube a la lista de hoy del asesor.

Cuando un cliente se marca como **Perdido** se registra el motivo: precio, compró otra marca, no calificó al crédito, sin respuesta, pospuso la compra u otro.

### Vigencia de la cotización
Las cotizaciones vencen a los **15 días** (gerencia lo puede cambiar). La vigencia sirve de argumento en los mensajes de seguimiento ("el bono sigue vigente hasta el…").

---

## 5. Lo que ve el cliente

El cliente recibe una página web pensada para el celular, sin necesidad de instalar nada:

- El modelo cotizado, en el color elegido, con fotos desde varios ángulos.
- El color de interior elegido.
- El **bono del autoshow** destacado.
- El desglose: precio de lista, accesorios, bono, carro a cuenta y total.
- Un **simulador de cuota**: el cliente puede mover el enganche, el plazo y el banco por su cuenta.
- Videos, vista 360° del interior y ficha técnica.
- Una tarjeta **"Le atiende"** con la foto y el nombre de su asesor.
- Tres botones de acción:
  - **Test drive:** elige día y hora.
  - **WhatsApp:** escribe directo a su asesor.
  - **Lo quiero:** avisa que está listo para comprar.

Cada acción del cliente (abrir la cotización, pedir test drive, tocar "Lo quiero") **queda registrada en la ficha del cliente** y el asesor la ve en la tablet.

---

## 6. Panel de gerencia

Solo los usuarios con rol **Gerencia** ven esta pestaña:

**Avance**
- Indicadores: clientes captados (total y de hoy), calientes, cotizados, porcentaje de cotizaciones abiertas y vendidos (con monto).
- Tabla **por asesor**: clientes, captados hoy, calientes, cotizaciones, cotizaciones abiertas, contactados y **atrasados**. Al tocar un asesor se ven sus clientes.
- Gráfica de **interés por modelo**.

**Asesores**
- Alta y edición de asesores: nombre, WhatsApp, rol, **PIN de acceso** y **foto** (que el cliente ve en WhatsApp y en su cotización). La foto se puede tomar con la cámara de la tablet.
- Activar o desactivar usuarios.

**Evento**
- Nombre del evento y del stand.
- Monto y nombre del bono (general o **por modelo**).
- Días de vigencia de las cotizaciones.
- Código para activar tablets nuevas y botón para **desactivar todas las demás tablets** (por ejemplo, si se pierde una).

**Exportar a Excel**
- Descarga todos los clientes con su asesor, modelo, temperatura, etapa, cotizaciones, aperturas y próximo seguimiento.

---

## 7. Funciona sin internet

En las ferias la señal suele fallar, así que la app está preparada para eso:
- Las fotos del catálogo **se descargan en la tablet** con anticipación.
- Los clientes y cotizaciones que se registran sin señal **se guardan en la tablet** y se suben solos cuando vuelve la conexión.
- La parte superior de la pantalla indica el estado: **"Al día"**, **"X por subir"** o **"Sin señal"**.
- El **QR de la cotización ya es definitivo** aunque no haya señal. Si el cliente lo abre antes de que la tablet suba la cotización, ve "Su cotización viene en camino" y la página se actualiza sola.

---

## 8. Seguridad y privacidad

- **Tablets autorizadas:** cada tablet se activa una sola vez con un **código del evento**. Gerencia puede desactivar las tablets en cualquier momento.
- **Acceso por PIN:** cada asesor entra con su PIN de 4 a 6 dígitos. Después de 5 intentos fallidos, el PIN se bloquea 10 minutos.
- **Varios asesores, una tablet:** se puede cambiar de asesor con "Cambiar". Si quedaron cambios sin subir, la app avisa.
- **Cada asesor ve solo sus clientes.** Gerencia ve todos.
- **Consentimiento:** se registra si el cliente autorizó el contacto por WhatsApp.
- El enlace de cotización es único y difícil de adivinar. Solo muestra el **primer nombre** del cliente.

---

## 9. Catálogo actual

**En el stand**

| # | Modelo | Precio | Colores exteriores | Interior |
|---|---|---|---|---|
| 1 | X50 | Q149,900 | Negro, Blanco | Cuero negro |
| 2 | T1 Híbrido iMD | Q259,900 | Dorado, Negro, Negro mate, Plata mate, Plata | Crema, Negro |
| 3 | T2 Híbrido 4x4 | Q339,900 | Blanco, Negro, Plata mate, Plata, Verde mate | Negro |
| 4 | G700 5 | $59,900 | Blanco | Naranja terracota, Negro |
| 5 | G700 Full | $64,900 | Naranja mate, Azul, Blanco, Negro, Plata mate | Negro, Naranja |
| 6 | F700 | $57,900 | Blanco, Café, Negro, Plata mate, Plata | Negro |
| 7 | Dashing Plus | Q198,900 | Blanco, Gris, Gris claro, Rojo | Negro, Blanco |
| 8 | X70 Plus | Q198,900 | Negro, Plata, Rojo | Negro, Blanco |

**Otros modelos (no exhibidos)**

| # | Modelo | Precio | Colores exteriores | Interior |
|---|---|---|---|---|
| 9 | Dashing II Básica | Q174,900 | Blanco, Gris claro, Negro, Rojo, Verde | Negro |
| 10 | T1 Gasolina | Q229,900 | Blanco, Dorado, Negro, Verde | Negro, Verde |
| 11 | T2 III Básica | Q289,900 | Arena, Negro, Plata | Negro, Verde |
| 12 | T2 IV Full Gasolina | Q319,900 | Blanco, Negro mate, Plata mate, Plata, Verde mate | Café, Negro |
| 13 | X70 | Q154,900 | Negro | Negro |
| 14 | X90 Plus | Q249,900 | Azul, Blanco, Negro | Negro, Café |

*Fuera del catálogo por decisión de la marca: Dashing Youth y T2 iDM.*

---

## 10. Pendientes y próximos pasos

| Tema | Estado |
|---|---|
| Fotos de los asesores | ✅ La función está lista. Falta que gerencia cargue la foto de cada asesor |
| Fotos y ficha técnica del **F700** | ⏳ Pendiente de que la marca comparta el material. Hoy aparece como "Foto próximamente" |
| Fotos de los colores nuevos (mates, café, etc.) | ⏳ Hoy se muestran con "Foto referencial" |
| Ficha técnica propia de G700 5, Dashing II Básica y T2 IV Full | ⏳ Hoy muestran la ficha del modelo base |
| **Bancos y tasas de interés** reales, con opción de cotizar con 2 o más bancos a la vez | ⏳ Pendiente de que el cliente comparta los datos |
| Datos de cada vendedor (nombre y WhatsApp) | ⏳ Pendiente de que el cliente comparta los datos |
| Integración con el **inventario** | 🔍 Por evaluar. Pendiente de que el cliente comparta los datos |
| Enviar la cotización también **por correo** (en las pruebas no llegó) | 🔍 Por revisar |

---

## 11. Preguntas frecuentes

**¿Qué pasa si se va el internet en pleno evento?**
Se sigue trabajando normal. Todo se guarda en la tablet y se sube solo cuando vuelve la señal.

**¿Puede un asesor ver los clientes de otro?**
No. Cada asesor ve solo los suyos. Gerencia ve todos y puede reasignar clientes.

**¿Cómo sé si el cliente vio su cotización?**
En la ficha del cliente y en Seguimiento aparece **"Abrió su cotización N×"**. Gerencia ve el porcentaje de cotizaciones abiertas.

**¿Se pueden cambiar los precios o el bono durante el evento?**
El **bono** lo cambia gerencia desde la pestaña Evento. Los **precios, modelos y colores** se actualizan en el sistema a pedido (no hay pantalla para editarlos todavía).

**¿Qué pasa si se pierde una tablet?**
Desde Gerencia → Evento se pueden desactivar todas las demás tablets. Además, sin el PIN de un asesor no se pueden ver los datos.

**¿Los datos se pueden pasar a Excel?**
Sí, con el botón **"Exportar a Excel (CSV)"** del panel de gerencia.

---

## Glosario

| Término | Significado |
|---|---|
| **Lead / cliente** | Persona que visitó el stand y dejó sus datos |
| **Temperatura** | Qué tan cerca está el cliente de comprar: caliente, tibio o frío |
| **Seguimiento** | Contacto posterior al evento (WhatsApp o llamada) para avanzar la venta |
| **PHEV** | Híbrido enchufable: funciona con electricidad y con gasolina |
| **Bono Autoshow** | Descuento especial que se ofrece durante el evento |
| **Enganche** | Pago inicial cuando el carro se compra financiado |
| **Parte de pago** | Carro usado que el cliente deja a cuenta del nuevo |
| **Foto referencial** | Foto de otro color del mismo modelo, que se usa mientras no exista la foto del color elegido |
