async function exportAsteriskArchiveImage() {
  if (!requireCompleteProfile()) return;
  var button = document.getElementById("export-image-button");
  if (!button || button.disabled) return;
  button.disabled = true;
  button.textContent = "正在生成图片…";
  try {
    // Freeze the validated export, including school labels, before loading its photo.
    var draft = JSON.parse(JSON.stringify(validateArchive(readOpeningDraft())));
    if (draft.world_id !== "asterisk" || !AST_SCHOOLS[draft.school_id]) {
      throw new Error("请先选择有效学园，再导出学战档案。");
    }
    var school = Object.assign({}, AST_SCHOOLS[draft.school_id]);
    var profile = draft.profile;
    var registration = draft.asterisk;
    var rankLabel = asteriskRankLabel(registration);
    var weaponLabel = asteriskWeaponLabel(registration.weapon_type);
    var filename = archiveFilename(draft, "png");
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器无法创建档案图片，请导出 JSON 保存完整设定。");

    var bodyFont = '25px "Microsoft YaHei", sans-serif';
    var labelFont = 'bold 23px "Microsoft YaHei", sans-serif';
    var nameFont = 'bold 48px "Microsoft YaHei", sans-serif';
    var smallFont = '21px "Microsoft YaHei", sans-serif';
    var ink = "#1e3443", muted = "#536d7c", accent = "#087fa7";
    var sections = [];

    function valueText(value, empty) {
      return typeof value === "string" && value.trim() ? value : (empty || "未填写");
    }
    function wrap(text, width, font) {
      ctx.font = font;
      var lines = [], line = "";
      Array.from(String(text).replace(/\r\n?/g, "\n")).forEach(function (character) {
        if (character === "\n") {
          lines.push(line); line = "";
          return;
        }
        if (line && ctx.measureText(line + character).width > width) {
          lines.push(line); line = "";
        }
        line += character;
      });
      lines.push(line);
      return lines;
    }
    function addRows(title, rows) {
      var measured = rows.map(function (row) {
        var lines = wrap(valueText(row[1]), 636, bodyFont);
        return { label: row[0], lines: lines, height: Math.max(58, lines.length * 38 + 22) };
      });
      sections.push({ title: title, rows: measured, height: 82 + measured.reduce(function (sum, row) { return sum + row.height; }, 0) });
    }
    function addText(title, text) {
      var lines = wrap(valueText(text), 848, bodyFont);
      sections.push({ title: title, lines: lines, height: 94 + lines.length * 38 });
    }

    var nameLines = wrap(valueText(profile.name, "未命名"), 650, nameFont);
    var englishLines = wrap(valueText(school.en, "ASTERISK ACADEMY"), 650, smallFont);
    var headerHeight = Math.max(278, 168 + englishLines.length * 30 + nameLines.length * 59);
    addRows("PERSONAL DATA · 人物资料", [
      ["姓名", profile.name], ["所属学园", profile.school || school.name],
      ["性格关键词", profile.personality], ["处事风格", profile.conduct]
    ]);
    addText("PROFILE · 外貌、背景与经历", profile.desc);
    addRows("REGISTRATION · 学园登记", [
      ["学园序列", rankLabel], ["星辰力", registration.prana],
      ["武装类别", weaponLabel], ["武装名称", profile.device],
      ["能力类型", profile.category], ["武装条件", registration.weapon_notes]
    ]);
    addRows("ABILITY · 能力机制", [
      ["能力本质", profile.ability], ["共通限制", profile.limits], ["战斗风格", profile.style]
    ]);
    addText("TECHNIQUES · 能力招式", valueText(profile.nobleArt, "未登记命名招式"));
    addText("SKILLS · 其他技艺", valueText(profile.otherAbilities, "未登记其他技艺"));
    addRows("CONTEXT · 本局状态补充", Object.keys(draft.context || {}).map(function (key) {
      return [key, draft.context[key]];
    }));
    addRows("SCENE · 切入场景", Object.keys(draft.scene || {}).map(function (key) {
      return [key, draft.scene[key]];
    }));
    addText("OPENING · 玩家开场白", draft.greeting);
    var height = Math.ceil(headerHeight + sections.reduce(function (sum, section) { return sum + section.height + 20; }, 0) + 158);
    if (!Number.isFinite(height) || height > 28000) {
      throw new Error("档案文字过长，完整图片会超过安全尺寸；本次未截断或导出，请改用 JSON 保存全部设定。");
    }

    var portrait = null;
    if (draft.avatar) {
      portrait = await loadArchiveImage(draft.avatar);
      if (!portrait.naturalWidth || !portrait.naturalHeight || portrait.naturalWidth > 4096 || portrait.naturalHeight > 4096) {
        throw new Error("档案照片尺寸不受支持，请重新上传照片；本次未导出缺少照片的档案。");
      }
    }
    canvas.width = 1000;
    canvas.height = height;
    ctx.fillStyle = "#f2f7fa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(24, 24, 952, height - 48);
    ctx.strokeStyle = "#c8dce7"; ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, 952, height - 48);
    ctx.fillStyle = accent;
    ctx.fillRect(24, 24, 952, 10);
    ctx.fillStyle = school.accent || accent;
    ctx.fillRect(24, 34, 12, headerHeight - 34);

    ctx.textBaseline = "top";
    ctx.fillStyle = accent; ctx.font = 'bold 21px "Microsoft YaHei", sans-serif';
    ctx.fillText("ASTERISK / STUDENT PROFILE", 62, 61);
    ctx.fillStyle = ink; ctx.font = 'bold 30px "Microsoft YaHei", sans-serif';
    ctx.fillText(school.name, 62, 101);
    ctx.fillStyle = muted; ctx.font = smallFont;
    englishLines.forEach(function (line, index) { ctx.fillText(line, 62, 143 + index * 30); });
    ctx.fillStyle = ink; ctx.font = nameFont;
    nameLines.forEach(function (line, index) { ctx.fillText(line, 62, 157 + englishLines.length * 30 + index * 59); });

    ctx.fillStyle = "#e9f3f8"; ctx.fillRect(766, 74, 168, 168);
    if (portrait) {
      var side = Math.min(portrait.naturalWidth, portrait.naturalHeight);
      ctx.drawImage(portrait, (portrait.naturalWidth - side) / 2, (portrait.naturalHeight - side) / 2, side, side, 766, 74, 168, 168);
    } else {
      ctx.fillStyle = accent; ctx.font = 'bold 68px "Microsoft YaHei", sans-serif';
      ctx.textAlign = "center"; ctx.fillText("U", 850, 116); ctx.textAlign = "left";
    }
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.strokeRect(766, 74, 168, 168);
    ctx.fillStyle = muted; ctx.font = '18px "Microsoft YaHei", sans-serif';
    ctx.textAlign = "center"; ctx.fillText("DRAFT / 设定草稿", 850, 253); ctx.textAlign = "left";

    var y = headerHeight;
    sections.forEach(function (section) {
      ctx.fillStyle = "#edf6fa"; ctx.fillRect(48, y, 904, 48);
      ctx.fillStyle = accent; ctx.fillRect(48, y, 5, 48);
      ctx.font = 'bold 23px "Microsoft YaHei", sans-serif';
      ctx.fillText(section.title, 67, y + 11);
      var lineY = y + 70;
      if (section.rows) {
        section.rows.forEach(function (row) {
          ctx.font = labelFont; ctx.fillStyle = muted;
          ctx.fillText(row.label, 68, lineY);
          ctx.font = bodyFont; ctx.fillStyle = ink;
          row.lines.forEach(function (line, index) { ctx.fillText(line, 280, lineY + index * 38); });
          lineY += row.height;
        });
      } else {
        ctx.font = bodyFont; ctx.fillStyle = ink;
        section.lines.forEach(function (line, index) { ctx.fillText(line, 68, lineY + index * 38); });
      }
      y += section.height + 20;
    });
    ctx.strokeStyle = "#c8dce7"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(62, y + 8); ctx.lineTo(938, y + 8); ctx.stroke();
    ctx.fillStyle = muted; ctx.font = smallFont;
    ctx.fillText("本图为学战开局设定草稿；不表示已登记序列、获得武装或写入聊天。", 62, y + 30);
    ctx.fillText("继续编辑与完整恢复请同时保存 JSON。", 62, y + 66);

    var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); });
    if (!blob) throw new Error("浏览器无法生成图片，请导出 JSON 保存全部档案。");
    if (archivePreviewUrl) URL.revokeObjectURL(archivePreviewUrl);
    archivePreviewUrl = URL.createObjectURL(blob);
    document.getElementById("archive-image-preview").src = archivePreviewUrl;
    var imageDownload = document.getElementById("archive-image-download");
    imageDownload.href = archivePreviewUrl;
    imageDownload.download = filename;
    document.getElementById("archive-image-result").hidden = false;
    document.getElementById("archive-image-result").open = true;
    downloadArchiveBlob(blob, filename);
    archiveLocalFeedback(school.name + "档案图片已生成并交给浏览器下载，包含导出时的完整设定；请同时保存 JSON 以便继续编辑。");
  } catch (error) {
    archiveLocalFeedback("图片导出失败：" + error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "保存档案图片";
  }
}
