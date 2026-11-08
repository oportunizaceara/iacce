/* Datas civis (dia, sem hora) no fuso local. Evita o deslocamento de AAAA-MM-DD em UTC. */
(function (global) {
  function parseCivilDate(value) {
    if (value == null || value === '') return null;

    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      const utcMidnight = value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0 && value.getUTCMilliseconds() === 0;
      if (utcMidnight) {
        return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
      }
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    if (typeof value === 'number' && isFinite(value)) {
      const utc = new Date(Math.round((value - 25569) * 86400 * 1000));
      if (isNaN(utc.getTime())) return null;
      return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
    }

    const str = String(value).trim();
    let match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

    match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));

    match = str.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));

    const parsed = new Date(str);
    if (isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  function civilDateKey(value) {
    const date = parseCivilDate(value);
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function formatCivilDate(value) {
    const key = civilDateKey(value);
    if (!key) return '';
    const parts = key.split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  global.IACDates = {
    parseCivilDate: parseCivilDate,
    civilDateKey: civilDateKey,
    formatCivilDate: formatCivilDate,
    startOfToday: startOfToday
  };
})(window);
