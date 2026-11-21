let temporizador: number | undefined;

/** Mensaje breve en la parte de arriba (p. ej. "Enlace copiado"). */
export function avisar(texto: string) {
  let aviso = document.querySelector<HTMLElement>('.aviso');
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.className = 'aviso';
    aviso.setAttribute('role', 'status');
    document.body.append(aviso);
  }
  aviso.textContent = texto;
  aviso.classList.add('aviso--visible');
  clearTimeout(temporizador);
  temporizador = window.setTimeout(() => aviso.classList.remove('aviso--visible'), 2600);
}
