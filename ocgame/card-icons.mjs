const icons = {
  sword:
    '<path d="m24 53 27-40 3 15-22 31M24 53l8 6m-14-2 17 10M23 61l-7 12m-5-2 9 5"/><path d="m29 49 19-28"/>',
  thrust:
    '<path d="m9 69 45-51 3-11-11 4L9 69Zm0 0 9-3M12 58l13 12M5 74l7-8"/><path d="m38 18 5-6m-6 16-9 10m21-1-10 11" opacity=".4"/>',
  shield:
    '<path d="M14 20 35 10l21 10v23c0 14-21 28-21 28S14 57 14 43Z"/><path d="M21 25 35 18l14 7v17c0 10-14 21-14 21S21 52 21 42ZM35 22v35m-10-23 10 10 10-10"/>',
  focus:
    '<circle cx="35" cy="41" r="22"/><path d="m35 8 4 27 21 6-21 5-4 28-4-28-21-5 21-6Z"/><path d="m15 19 5 7m32-7-4 7m-33 35 6-7m31 8-5-8" opacity=".5"/>',
  step: '<path d="M43 11c6 5 10 14 6 21l-8 15-14-6 4-18ZM24 47l14 7-5 10c-3 7-13 7-15 0Z"/><path d="m12 22 12 2M8 33l13 2M5 44l11 2M42 64l11 2" opacity=".5"/>',
  heavy:
    '<path d="m21 56 20-44 11 1 5 11-28 38ZM42 19l7 7-22 30M16 53l20 13M23 63l-7 12m-6-1 12 6"/><path d="m12 21 8 20m36 6-15 11" opacity=".4"/>',
};

export function cardIcon(name) {
  return `<svg viewBox="0 0 70 82" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}
