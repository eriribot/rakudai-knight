import { ABILITY_CLASSES, ARCANAS, PRESETS, cleanProfile } from "./engine.mjs";

const $ = (id) => document.getElementById(id);
export function setupCustomization({ getProfile, onSave }) {
  const form = $("custom-form");
  let draftAvatar = "",
    reading = false,
    readVersion = 0;
  const say = (id, value) => {
    $(id).textContent = value;
  };
  const values = () => Object.fromEntries(new FormData(form));
  $("ability-options").replaceChildren(
    ...Object.entries(ABILITY_CLASSES).map(([key, meta]) => {
      const label = document.createElement("label");
      label.className = "style-option ability-option";
      label.innerHTML = `<input type="radio" name="abilityClass" value="${key}"><span><strong>${meta.name}</strong><small>${meta.description}</small></span>`;
      return label;
    }),
  );

  function preview() {
    const p = cleanProfile(values());
    say("passport-name", p.name);
    say("passport-rank", p.rank);
    say("passport-device", p.deviceName);
    say("passport-art", p.nobleArtName);
    say("passport-style", ABILITY_CLASSES[p.abilityClass].name);
    say("passport-appearance", p.deviceAppearance || "未填写");
    say("appearance-count", `${$("appearance-input").value.length} / 300`);
    say("resonance-description", ARCANAS[p.arcana].description);
    $("avatar-preview").src = draftAvatar || "assets/knight-shield.svg";
    $("avatar-preview").classList.toggle("is-placeholder", !draftAvatar);
    $("avatar-remove").disabled = !draftAvatar || reading;
    $("profile-submit").disabled = reading;
  }

  function populate(p) {
    readVersion++;
    reading = false;
    draftAvatar = p.avatarDataUrl || "";
    for (const key of [
      "name",
      "rank",
      "style",
      "arcana",
      "pact",
      "abilityClass",
      "deviceName",
      "deviceAppearance",
      "nobleArtName",
      "nobleChant",
      "attackStatus",
    ]) {
      const field = form.elements.namedItem(key);
      if (field) field.value = p[key] || "";
    }
    $("avatar-input").value = "";
    say("avatar-message", "");
    say("profile-message", "");
    preview();
  }

  $("customize").addEventListener("click", () => {
    populate(getProfile());
    $("custom-dialog").showModal();
  });
  document.querySelectorAll(".preset-chip").forEach((button) =>
    button.addEventListener("click", () => {
      const preset = PRESETS[button.dataset.preset];
      if (preset)
        populate(
          cleanProfile({
            ...preset,
            avatarDataUrl: draftAvatar,
            deviceAppearance: $("appearance-input").value,
            attackStatus: $("attack-status-input").value,
          }),
        );
    }),
  );

  $("avatar-input").addEventListener("change", async (event) => {
    const file = event.target.files[0],
      version = ++readVersion;
    reading = false;
    if (!file) {
      preview();
      return;
    }
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      say("avatar-message", "请选择 2 MB 以内的 PNG、JPG 或 WebP 图片。");
      event.target.value = "";
      preview();
      return;
    }
    reading = true;
    say("avatar-message", "正在读取头像…");
    preview();
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(file);
      });
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      if (version !== readVersion) return;
      draftAvatar = dataUrl;
      say("avatar-message", "头像已预览，完成登记后保存。");
    } catch {
      if (version === readVersion)
        say("avatar-message", "这张图片无法读取，请换一张。");
    } finally {
      if (version === readVersion) {
        reading = false;
        preview();
      }
    }
  });
  document
    .querySelector(".passport-photo")
    .addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        $("avatar-input").click();
      }
    });
  $("avatar-remove").addEventListener("click", () => {
    readVersion++;
    draftAvatar = "";
    reading = false;
    $("avatar-input").value = "";
    say("avatar-message", "头像将在完成登记后移除。");
    preview();
  });
  $("custom-dialog").addEventListener("close", () => {
    readVersion++;
    reading = false;
  });
  form.addEventListener("input", preview);
  form.addEventListener("change", preview);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (reading) return;
    const p = cleanProfile({ ...values(), avatarDataUrl: draftAvatar });
    try {
      localStorage.setItem("ocgame.profile.v1", JSON.stringify(p));
    } catch {
      say(
        "profile-message",
        "浏览器未能保存档案。请换一张更小的头像，或检查浏览器存储空间后重试。",
      );
      return;
    }
    onSave(p);
  });
}
