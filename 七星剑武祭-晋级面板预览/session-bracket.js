// 仅用于离线抽签与赛果演示；不声明或写入任何 MVU 全国赛字段。
window.RK_PREVIEW_BRACKET = {
  create(canon, representatives) {
    const players = structuredClone(canon.players);
    const slots = canon.regions.map(region => region.matches.filter(m => m.round === 1).flatMap(m => [m.p1, m.p2]));
    const selected = new Set(representatives.map(row => row.name));
    for (const zone of slots) zone.forEach((id, index) => {
      if (players[id].school === '破军学园' && !selected.has(players[id].name)) {
        const vacant = `vacant-${id}`;
        players[vacant] = { name: '待公布席位', school: '本局代表待定', unnamed: true, pending: true };
        zone[index] = vacant;
      }
    });
    for (const row of representatives) {
      const existing = slots.flat().find(id => players[id].name === row.name);
      if (existing) { players[existing].player = row.player; players[existing].rosterId = row.id; continue; }
      const zone = slots.find(items => items.some(id => players[id].pending)) || slots.find(items => items.some(id => players[id].unnamed));
      const pendingIndex = zone.findIndex(id => players[id].pending);
      const index = pendingIndex >= 0 ? pendingIndex : zone.findIndex(id => players[id].unnamed);
      const id = `selection-${row.id}`;
      players[id] = { name: row.name, school: '破军学园', player: row.player, rosterId: row.id, unnamed: false };
      zone[index] = id;
    }
    const matches = [];
    const add = (id, round, zone, p1, p2, from = []) => matches.push({ id, round, zone, p1, p2, from, winner: null });
    slots.forEach((seats, index) => {
      const zone = 'ABCD'[index], key = zone.toLowerCase();
      for (let n = 0; n < 4; n++) add(`${key}-r1-${n + 1}`, 1, zone, seats[n * 2], seats[n * 2 + 1]);
      for (let n = 0; n < 2; n++) add(`${key}-r2-${n + 1}`, 2, zone, null, null, [`${key}-r1-${n * 2 + 1}`, `${key}-r1-${n * 2 + 2}`]);
      add(`${key}-r3-1`, 3, zone, null, null, [`${key}-r2-1`, `${key}-r2-2`]);
    });
    add('sf-1', 4, 'finals', null, null, ['a-r3-1', 'b-r3-1']);
    add('sf-2', 4, 'finals', null, null, ['c-r3-1', 'd-r3-1']);
    add('final', 5, 'finals', null, null, ['sf-1', 'sf-2']);
    return { players, slots, matches };
  },
  settle(bracket, id, winner) {
    const match = bracket.matches.find(item => item.id === id);
    if (!match.p1 || !match.p2 || [match.p1, match.p2].some(id => bracket.players[id].pending) || ![match.p1, match.p2].includes(winner)) return;
    match.winner = winner;
    for (const next of bracket.matches.filter(item => item.from.length)) {
      const sides = next.from.map(source => bracket.matches.find(item => item.id === source).winner);
      if (next.p1 !== sides[0] || next.p2 !== sides[1]) next.winner = null;
      [next.p1, next.p2] = sides;
    }
  },
};
