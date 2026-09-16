# ng-hub-ui-signature

[English](./README.md) | **Español**

Campo de firma para formularios Angular respaldado por SVG. Registra ratón, táctil y lápiz mediante Pointer Events —o flechas y Espacio, para firmar sin puntero—, guarda un SVG escalable en el modelo del formulario y puede exportar el lienzo a PNG.

Forma parte de [Hub UI](https://hubui.dev/es/). Documentación y ejemplos en vivo: [hubui.dev/es/signature/overview/](https://hubui.dev/es/signature/overview/). Incidencias, roadmap y guía para contribuir: [github.com/hub-env/hub-ui](https://github.com/hub-env/hub-ui).

## Migrar desde angular2-signaturepad

`angular2-signaturepad` no publica nada desde febrero de 2022. **[Lee la guía de migración](./MIGRATION.md)** (en inglés): recorre la API completa, trae código que funciona y dice sin rodeos qué no se puede trasladar: las firmas guardadas como data URL en PNG no se pueden recargar para editarlas, y un SVG guardado solo se recarga fielmente en un campo renderizado con el mismo ancho.

## Instalación

```bash
npm install ng-hub-ui-signature ng-hub-ui-forms ng-hub-ui-utils
```

Después carga la hoja de estilos de forms una sola vez, en los estilos globales de la aplicación. El
elemento raíz del campo es `class="hub-field hub-signature"` y todo lo que rodea al lienzo —la fila
de la etiqueta, el texto de ayuda, los mensajes de validación y la interrogación que los abre— está
definido en `ng-hub-ui-forms`, no en la hoja de la propia firma. Sin esta línea el lienzo se ve bien
y lo demás no: la ayuda y los errores caen a texto sin estilo, y la interrogación, cuyo símbolo y
cuyo círculo salen de esa hoja, se queda en un botón vacío.

```scss
// styles.scss
@use 'ng-hub-ui-forms/styles';

// Solo si usas formTextType="tooltip": el bocadillo se añade al <body>, fuera del alcance de
// cualquier cosa que declare la hoja anterior.
@use 'ng-hub-ui-utils/styles/tooltip';
```

`@use 'ng-hub-ui-signature/styles'` no sustituye a ninguna de las dos: ese punto de entrada reexporta
el mixin de tematización que se describe más abajo y no emite nada de esa estructura.

## Uso

```typescript
import { HubSignatureComponent } from 'ng-hub-ui-signature';

@Component({
	standalone: true,
	imports: [HubSignatureComponent],
	template: `<hub-signature formControlName="signature" label="Firma" />`
})
export class ContractFormComponent {}
```

El valor del control es un string SVG. Usa `toDataUrl('image/png')` para exportación bitmap, o `clear()`, `undo()` y `redo()` para controlar el campo mediante código.

## Entradas

| Entrada | Tipo | Por defecto | Qué hace |
| --- | --- | --- | --- |
| `label` | `string` | `''` | Etiqueta visible, y nombre accesible de la superficie. Ver [Cómo se nombra el campo](#cómo-se-nombra-el-campo). |
| `labelType` | `HubLabelType` | `'stacked'` | `'horizontal'` pone la etiqueta en una primera columna junto a la superficie. `'floating'` cae a apilada. |
| `formText` | `string` | `''` | Texto de ayuda. Una plantilla `<ng-template hubFormText>` proyectada lo sustituye por marcado. |
| `formTextType` | `'bottom' \| 'tooltip'` | `'bottom'` | Dónde va la ayuda: bajo la superficie, o tras una `?` al final de la fila de la etiqueta. |
| `height` | `number` | `160` | Altura lógica de la superficie en píxeles CSS. Es viva: el bitmap y el `viewBox` guardado la siguen. |
| `strokeColor` | `string` | `'currentColor'` | Tinta que se guarda en los trazos nuevos, resuelta a un color concreto antes de capturarlos. |
| `strokeWidth` | `number` | `2` | Grosor base que se guarda en los trazos nuevos. |
| `readonly` | `boolean` | `false` | Mantiene la firma legible y enfocable, y rechaza trazos nuevos. |
| `controls` | `boolean` | `true` | Muestra la fila integrada de borrar / deshacer / rehacer. |
| `ariaLabel` | `string` | `''` | Nombre accesible de una superficie **sin** `[label]` visible; se ignora si la hay. |
| `labels` | `Partial<HubSignatureLabels>` | `{}` | Sobrescritura por campo de las etiquetas de acción traducidas. |
| `classlist` | `string` | `''` | Clases extra en el elemento anfitrión, `<hub-signature>`, no en el lienzo. |
| `formControlName` | `string` | — | Nombre del control dentro del grupo de formulario. Sigue haciendo falta importar `ReactiveFormsModule`. |
| `required` | `boolean \| null` | `null` | De doble vía. Con un enlace reactivo se deriva de los validadores del control, así que solo se fija a mano fuera de ahí. |
| `disabled` | `boolean` | `false` | De doble vía, y lo escribe `setDisabledState()`. En un campo reactivo, mejor `control.disable()`. |
| `showValid` | `boolean` | `false` | Estado de éxito opcional; por defecto toma el global de `provideHubForms({ showValid })`. |
| `validFeedback` | `string \| null` | `null` | Mensaje de éxito, visible solo con `[showValid]` activo y el campo tocado y válido. |
| `invalidFeedbackTemplateFn` | `((key: string, value: any) => string) \| null` | `null` | Sobrescritura por campo del constructor de mensajes de error. |

`height`, `strokeColor` y `strokeWidth` describen la superficie y la pluma; las seis últimas se
heredan del contrato de campo de `ng-hub-ui-forms`, y por eso se comportan exactamente igual que en
`hub-input`.

## Preguntar qué contiene el campo

`toSvg()` es el valor del formulario y, durante mucho tiempo, también la única forma de preguntar
cualquier cosa sobre el campo: saber si estaba firmado obligaba a buscar un trazo dentro de la
cadena. Tres añadidos responden a eso directamente.

```ts
@ViewChild(HubSignatureComponent) signature!: HubSignatureComponent;

// Validar sin analizar el valor serializado.
const signed = !this.signature.isEmpty();

// La geometría en sí, que el valor SVG no transporta.
const strokes = this.signature.toStrokes(); // HubSignatureStroke[]
this.other.fromStrokes(strokes);            // repinta; no notifica cambio de usuario a Angular forms
```

`toStrokes()` / `fromStrokes()` **no** se llaman `toData` / `fromData`, los nombres que usa
`angular2-signaturepad`, y es deliberado: el `toData()` de esa biblioteca devuelve
`Array<Array<{x, y, time}>>` y este devuelve `{ points: [{ x, y, pressure }], color, width }[]`. El
mismo nombre con una carga incompatible dejaría compilar una migración para que fallara en silencio
allí donde el valor esté tipado como `any`.

## Reaccionar mientras se dibuja

| Salida | Carga | Se emite |
| --- | --- | --- |
| `valueChange` | `string` | Tras un cambio del usuario, con el SVG |
| `drawStart` | `HubSignatureDrawEvent` | Al empezar un trazo |
| `drawEnd` | `HubSignatureDrawEvent` | Al terminar y consolidar un trazo |

`drawStart` y `drawEnd` permiten al anfitrión reaccionar a la actividad de dibujo —pausar un
autoguardado, armar un botón de envío— sin sondear el valor. Solo se emiten para el dibujo del
usuario, así que una escritura por código nunca parece una, y un trazo cancelado en vez de
terminado no emite `drawEnd`.

`HubSignatureDrawEvent` es `PointerEvent | KeyboardEvent`, porque un trazo puede escribirse de
cualquiera de las dos formas. Usa `instanceof` para estrechar el tipo cuando importe el dispositivo.

## Firmar con el teclado

El campo se puede usar sin puntero. Con la superficie enfocada:

| Teclas | Efecto |
| --- | --- |
| Flechas | Mueven el lápiz; con Shift, a paso más largo |
| Espacio o Enter | Bajan el lápiz, y al pulsarlas de nuevo lo levantan y consolidan el trazo |
| Escape | Descarta el trazo en curso |

El trazo resultante es uno normal: mismo `HubSignatureStroke`, mismo `toSvg()`, mismo valor
reportado, mismos `drawStart` / `drawEnd`. Respeta `readonly` y `disabled` igual que la ruta de
puntero, y las instrucciones se anuncian a los lectores de pantalla mediante `aria-describedby`
—tradúcelas bajo `HUBUI.SIGNATURE.KEYBOARD_HINT`.

El lienzo lleva `role="application"` para que los lectores de pantalla le entreguen las flechas en
lugar de usarlas para navegar por el documento. Ten en cuenta que una firma hecha con el teclado es
una polilínea, no escritura manual; decide de forma deliberada si eso sirve para aquello de lo que
la firma es prueba.

## Cómo se nombra el campo

`[label]` es el nombre accesible. La superficie de dibujo se enlaza a él con `aria-labelledby`, así
que el texto que lee una persona vidente y el que anuncia un lector de pantalla son el mismo nodo y
no pueden separarse. Traducir `[label]` traduce el anuncio; no hay que enlazar nada dos veces. Al
hacer clic en la etiqueta se enfoca la superficie.

```html
<hub-signature [label]="'CONSENT.SIGNATURE' | transloco" />
```

`[ariaLabel]` nombra una superficie **sin** etiqueta visible —un recuadro desnudo dentro de una
maquetación que lo etiqueta de otro modo—. En un campo que sí tiene `[label]` no se consulta, así
que no lo enlaces ahí. Vacío, se resuelve como las etiquetas de acción: `[labels]` /
`provideHubSignature()`, luego `HUBUI.SIGNATURE.ARIA_LABEL`, y por último el respaldo en inglés
`Signature`.

```html
<hub-signature [controls]="false" [ariaLabel]="'CONSENT.SIGNATURE' | transloco" />
```

No se usa `<label for>` a propósito: `for` solo asocia con elementos *labelable* —`button`, `input`,
`meter`, `output`, `progress`, `select`, `textarea`— y un `<canvas>` no es ninguno, así que el
atributo se quedaría en el marcado reclamando una asociación que el navegador nunca hace.

## Acciones traducibles

El componente no depende de ningún sistema de traducción. Configura una vez el adaptador compartido de Hub UI durante el arranque; entrega el mismo diccionario a todas las bibliotecas compatibles, incluida Signature. Usa `labels` solo para una excepción de un campo:

```ts
import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { provideHubTranslationAdapter } from 'ng-hub-ui-utils';

bootstrapApplication(AppComponent, {
	providers: [
		provideHubTranslationAdapter(() => {
			const transloco = inject(TranslocoService);
			return {
				dictionary: transloco.selectTranslation('HUBUI'),
				namespace: 'HUBUI'
			};
		})
	]
});
```

Añade `HUBUI.SIGNATURE.ACTION.CLEAR`, `HUBUI.SIGNATURE.ACTION.UNDO` y `HUBUI.SIGNATURE.ACTION.REDO` a los archivos de idioma habituales de la aplicación. La raíz `HUBUI` evita colisiones con claves de la aplicación. El adaptador actualiza todos los campos Signature cuando el servicio emite un cambio de idioma; `overrides` permite mapear deliberadamente una acción a otra clave reactiva del servicio. Consulta la documentación de Utils para la configuración completa con Transloco y ngx-translate.

```ts
// Una única excepción puede sobrescribir una etiqueta global.
<hub-signature [labels]="{ clear: 'Borrar definitivamente' }" />
```

## Personalización

Cada superficie del campo se personaliza con variables `--hub-signature-*`. Los valores por defecto heredan el contrato de campo de `ng-hub-ui-forms` — la superficie de dibujo lee los tokens de control `--hub-input-*`, la etiqueta lee `--hub-label-*` y el estado deshabilitado lee `--hub-form-disabled-opacity` —, de modo que dar tema a un formulario se lo da también a su campo de firma, sin reglas adicionales.

```scss
@use 'ng-hub-ui-signature/styles' as hub;

.contract-form {
	@include hub.hub-signature-theme($border-radius: 0.75rem);
}
```

La validación forma parte de esa herencia: los estados inválido y válido colorean la superficie de
dibujo desde `--hub-form-invalid-*` y `--hub-form-valid-*`, así que la firma se pone en rojo junto a
los inputs que la rodean en vez de imprimir un mensaje bajo un lienzo que sigue pareciendo correcto.

**Poner las variables en un contenedor no hace nada.** El componente declara los once slots sobre el
propio elemento del campo, y una custom property declarada en un elemento siempre gana a la heredada
de un ancestro —la especificidad no entra en juego, porque son elementos distintos—. Apunta al
campo, que es lo que hace el mixin por ti:

```scss
/* No hace nada: el campo lo sobrescribe sobre sí mismo. */
.contract-form {
	--hub-signature-bg: #0f172a;
}

/* Funciona, y es lo que emite @include hub-signature-theme(). */
.contract-form .hub-signature {
	--hub-signature-bg: #0f172a;
}
```

El mismo tropiezo aparece dentro de un componente con encapsulación emulada: Angular reescribe la
regla con el atributo `_ngcontent` de ese componente, que el DOM del campo no lleva. Da tema desde
una hoja global, o usa `ViewEncapsulation.None`.
