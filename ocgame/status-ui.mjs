import { STATUS_EFFECTS } from "./engine.mjs";

const $ = (id) => document.getElementById(id);
const paths = {
  poison:
    '<path d="M9 3h6m-5 0v6l-5 8a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-5-8V3M7 15h10"/><circle cx="10" cy="17" r=".6"/><circle cx="14" cy="18" r=".6"/>',
  bleed:
    '<path d="M12 2C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-13ZM8 15c0 2 1 3 3 4"/>',
  burn: '<path d="M12 2c1 5-4 6-3 11 2-1 3-3 3-5 5 4 8 7 6 11-2 4-10 4-12 0-3-5 2-8 6-17Z"/>',
};
export function statusIcon(kind) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg>`;
}

function openStatus(state, side, selected) {
  const owner = side === "enemy" ? "史黛菈" : state.profile.name;
  $("status-title").textContent = `${owner} · 战斗状态`;
  const active = Object.entries(state[side].statuses);
  $("status-current").textContent = active.length
    ? active
        .map(
          ([kind, v]) =>
            `${STATUS_EFFECTS[kind].name} ${v.stacks} 层 · 剩余 ${v.remaining} ${STATUS_EFFECTS[kind].unit}`,
        )
        .join("；")
    : "当前没有异常状态。";
  $("status-catalog").replaceChildren(
    ...Object.entries(STATUS_EFFECTS).map(([kind, meta]) => {
      const row = document.createElement("section");
      row.className = "status-explanation";
      row.dataset.selected = String(kind === selected);
      row.style.setProperty("--condition", meta.color);
      row.innerHTML = `${statusIcon(kind)}<div><strong>${meta.name}</strong><p>${meta.description}</p></div>`;
      return row;
    }),
  );
  $("status-dialog").showModal();
}

export function renderStatuses(state) {
  for (const side of ["player", "enemy"]) {
    const active = Object.entries(state[side].statuses);
    const buttons = active.map(([kind, value]) => {
      const meta = STATUS_EFFECTS[kind],
        button = document.createElement("button");
      button.type = "button";
      button.className = "condition-badge";
      button.dataset.status = kind;
      button.style.setProperty("--condition", meta.color);
      button.title = `${meta.description} 剩余 ${value.remaining} ${meta.unit}。`;
      button.innerHTML = `${statusIcon(kind)}<span>${meta.name}<b>${value.stacks}</b></span><small>余 ${value.remaining} ${meta.unit}</small>`;
      button.setAttribute(
        "aria-label",
        `${meta.name} ${value.stacks} 层，剩余 ${value.remaining} ${meta.unit}，查看说明`,
      );
      button.addEventListener("click", () => openStatus(state, side, kind));
      return button;
    });
    if (!buttons.length) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "condition-normal";
      button.textContent = "◇ 无异常 · 详情";
      button.addEventListener("click", () => openStatus(state, side));
      buttons.push(button);
    }
    $(`${side}-statuses`).replaceChildren(...buttons);
  }
}
