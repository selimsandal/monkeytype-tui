export function createMouseParser() {
  let sgr = null;
  let x10 = null;
  return (str, key) => {
    if (key?.sequence === '\x1b[M') { x10 = ''; return { consumed: true }; }
    if (x10 !== null) {
      x10 += str ?? key?.sequence ?? '';
      if (x10.length < 3) return { consumed: true };
      const [button, col, row] = [...x10].map(char => char.charCodeAt(0) - 32);
      x10 = null;
      return { consumed: true, click: button === 0 ? { row, col } : null };
    }
    if (key?.sequence?.startsWith('\x1b[<')) sgr = key.sequence;
    else if (sgr !== null) sgr += str ?? key?.sequence ?? '';
    else return { consumed: false };
    const match = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/.exec(sgr);
    if (match) {
      sgr = null;
      return { consumed: true, click: match[4] === 'M' && Number(match[1]) === 0
        ? { col: Number(match[2]), row: Number(match[3]) } : null };
    }
    if (sgr.length > 40 || /[Mm]$/.test(sgr)) sgr = null;
    return { consumed: true };
  };
}
