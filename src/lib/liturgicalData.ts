// Liturgical Calendar Utilities & Proper Antiphon Database
// Shared utilities for App.tsx

export interface ProperEntry {
  id: number;
  season: string;
  day: string;
  type: 'Introit' | 'Offertory' | 'Communion' | 'Alleluia' | 'Gradual' | 'Tract';
  incipit: string;
  translation: string;
  source: string;
  verses: string;
  cycle: string;
  chantIndex?: string;
}

export function getEaster(year: number): Date {
  const f = Math.floor;
  const G = year % 19, C = f(year / 100);
  const H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
  const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
  const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7;
  const L = I - J;
  const month = 3 + f((L + 40) / 44);
  const day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
}

export function getLiturgicalCycle(date: Date): string {
  const year = date.getFullYear();
  const dec25 = new Date(year, 11, 25);
  let offset = dec25.getDay();
  if (offset === 0) offset = 7;
  const advent1 = new Date(dec25.getTime() - (offset + 21) * 86400000);
  const liturgicalYear = date >= advent1 ? year + 1 : year;
  return ['C', 'A', 'B'][liturgicalYear % 3];
}

export function getUpcomingCelebrations(startDate: Date): string[] {
  const days: string[] = [];
  const fixedFeasts: Record<string, string> = {
    '01-01': 'Mary, Mother of God (Jan 1)',
    '01-06': 'Epiphany',
    '01-25': 'Conversion of St. Paul (Jan 25)',
    '02-02': 'Presentation of the Lord (Feb 2)',
    '02-22': 'Chair of St. Peter (Feb 22)',
    '03-19': 'St. Joseph (Mar 19)',
    '03-25': 'The Annunciation (Mar 25)',
    '04-25': 'St. Mark the Evangelist (Apr 25)',
    '05-03': 'Ss. Philip & James (May 3)',
    '05-14': 'St. Matthias the Apostle (May 14)',
    '05-31': 'Visitation of Mary (May 31)',
    '06-24': 'Nativity of St. John the Baptist (Jun 24)',
    '06-29': 'Ss. Peter & Paul (Jun 29)',
    '07-03': 'St. Thomas the Apostle (Jul 3)',
    '07-22': 'St. Mary Magdalene (Jul 22)',
    '07-25': 'St. James the Apostle (Jul 25)',
    '08-06': 'The Transfiguration (Aug 6)',
    '08-10': 'St. Lawrence (Aug 10)',
    '08-15': 'Assumption of Mary (Aug 15)',
    '08-24': 'St. Bartholomew the Apostle (Aug 24)',
    '09-08': 'Nativity of Mary (Sep 8)',
    '09-14': 'Exaltation of the Holy Cross (Sep 14)',
    '09-15': 'Our Lady of Sorrows (Sep 15)',
    '09-21': 'St. Matthew the Apostle (Sep 21)',
    '09-29': 'St. Michael the Archangel (Sep 29)',
    '10-18': 'St. Luke the Evangelist (Oct 18)',
    '10-28': 'Ss. Simon & Jude (Oct 28)',
    '11-01': 'All Saints (Nov 1)',
    '11-02': 'All Souls (Nov 2)',
    '11-09': 'Dedication of the Lateran Basilica (Nov 9)',
    '11-30': 'St. Andrew (Nov 30)',
    '12-08': 'Immaculate Conception (Dec 8)',
    '12-25': 'Christmas (Mass of the Day)',
    '12-26': 'St. Stephen (Dec 26)',
    '12-27': 'St. John the Apostle (Dec 27)',
    '12-28': 'Holy Innocents (Dec 28)',
  };

  const isSameDate = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  function getLiturgicalDayName(targetDate: Date): string {
    const year = targetDate.getFullYear();
    const date = new Date(year, targetDate.getMonth(), targetDate.getDate());
    const getDaysBetween = (d1: Date, d2: Date) => Math.round((d2.getTime() - d1.getTime()) / 86400000);
    const ord = (n: number): string => {
      const s = ['th','st','nd','rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const easter = getEaster(year);
    const ashWednesday = new Date(easter.getTime() - 46 * 86400000);
    const pentecost = new Date(easter.getTime() + 49 * 86400000);
    const trinity = new Date(pentecost.getTime() + 7 * 86400000);
    const corpusChristi = new Date(pentecost.getTime() + 14 * 86400000);
    const christmas = new Date(year, 11, 25);
    let offset = christmas.getDay();
    if (offset === 0) offset = 7;
    const advent1 = new Date(christmas.getTime() - (offset + 21) * 86400000);
    const christTheKing = new Date(advent1.getTime() - 7 * 86400000);
    const baptismLocal = new Date(year, 0, 6);
    baptismLocal.setDate(baptismLocal.getDate() + (7 - baptismLocal.getDay()));
    if (new Date(year, 0, 6).getDay() === 0) { baptismLocal.setDate(7); }

    if (date.getDay() === 0) {
      if (date >= advent1 && date < christmas) return `${ord(Math.floor(getDaysBetween(advent1, date) / 7) + 1)} Sunday of Advent`;
      if (date >= ashWednesday && date < easter) {
        const week = Math.floor(getDaysBetween(ashWednesday, date) / 7);
        if (week === 5) return 'Palm Sunday';
        return `${ord(week + 1)} Sunday of Lent`;
      }
      if (date >= easter && date <= pentecost) {
        const week = Math.floor(getDaysBetween(easter, date) / 7) + 1;
        if (week === 1) return 'Easter Sunday';
        if (week === 8) return 'Pentecost Sunday';
        return `${ord(week)} Sunday of Easter`;
      }
      if (isSameDate(date, trinity)) return 'Trinity Sunday';
      if (isSameDate(date, corpusChristi)) return 'Corpus Christi';
      if (isSameDate(date, christTheKing)) return 'Christ the King';
      if (isSameDate(date, baptismLocal)) return 'Baptism of the Lord';
      if (date > pentecost && date < christTheKing) return `${ord(34 - Math.floor(getDaysBetween(date, christTheKing) / 7))} Sunday in Ordinary Time`;
      if (date > baptismLocal && date < ashWednesday) return `${ord(2 + Math.floor(getDaysBetween(baptismLocal, date) / 7))} Sunday in Ordinary Time`;
    }
    return 'Ferial Day';
  }

  for (let i = 0; i < 8; i++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    const year = d.getFullYear();
    const easter = getEaster(year);
    const ashWednesday = new Date(easter.getTime() - 46 * 86400000);
    const ascension = new Date(easter.getTime() + 39 * 86400000);
    const pentecost = new Date(easter.getTime() + 49 * 86400000);
    const sacredHeart = new Date(pentecost.getTime() + 19 * 86400000);

    if (isSameDate(d, ashWednesday)) days.push('Ash Wednesday');
    if (isSameDate(d, new Date(easter.getTime() - 3 * 86400000))) days.push('Holy Thursday');
    if (isSameDate(d, new Date(easter.getTime() - 2 * 86400000))) days.push('Good Friday');
    if (isSameDate(d, new Date(easter.getTime() + 1 * 86400000))) days.push('Easter Monday');
    if (isSameDate(d, new Date(easter.getTime() + 2 * 86400000))) days.push('Easter Tuesday');
    if (isSameDate(d, new Date(easter.getTime() + 3 * 86400000))) days.push('Easter Wednesday');
    if (isSameDate(d, ascension)) days.push('Ascension of the Lord');
    if (isSameDate(d, sacredHeart)) days.push('Sacred Heart of Jesus');

    if (d.getDay() === 0) {
      const name = getLiturgicalDayName(d);
      if (name !== 'Ferial Day') days.push(name);
    }

    const mmdd = String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (fixedFeasts[mmdd]) days.push(fixedFeasts[mmdd]);
  }

  return [...new Set(days)];
}

export function getCelebrationDatesMap(startDate: Date): Record<string, Date> {
  const datesMap: Record<string, Date> = {};
  
  const fixedFeasts: Record<string, string> = {
    '01-01': 'Mary, Mother of God (Jan 1)',
    '01-06': 'Epiphany',
    '01-25': 'Conversion of St. Paul (Jan 25)',
    '02-02': 'Presentation of the Lord (Feb 2)',
    '02-22': 'Chair of St. Peter (Feb 22)',
    '03-19': 'St. Joseph (Mar 19)',
    '03-25': 'The Annunciation (Mar 25)',
    '04-25': 'St. Mark the Evangelist (Apr 25)',
    '05-03': 'Ss. Philip & James (May 3)',
    '05-14': 'St. Matthias the Apostle (May 14)',
    '05-31': 'Visitation of Mary (May 31)',
    '06-24': 'Nativity of St. John the Baptist (Jun 24)',
    '06-29': 'Ss. Peter & Paul (Jun 29)',
    '07-03': 'St. Thomas the Apostle (Jul 3)',
    '07-22': 'St. Mary Magdalene (Jul 22)',
    '07-25': 'St. James the Apostle (Jul 25)',
    '08-06': 'The Transfiguration (Aug 6)',
    '08-10': 'St. Lawrence (Aug 10)',
    '08-15': 'Assumption of Mary (Aug 15)',
    '08-24': 'St. Bartholomew the Apostle (Aug 24)',
    '09-08': 'Nativity of Mary (Sep 8)',
    '09-14': 'Exaltation of the Holy Cross (Sep 14)',
    '09-15': 'Our Lady of Sorrows (Sep 15)',
    '09-21': 'St. Matthew the Apostle (Sep 21)',
    '09-29': 'St. Michael the Archangel (Sep 29)',
    '10-18': 'St. Luke the Evangelist (Oct 18)',
    '10-28': 'Ss. Simon & Jude (Oct 28)',
    '11-01': 'All Saints (Nov 1)',
    '11-02': 'All Souls (Nov 2)',
    '11-09': 'Dedication of the Lateran Basilica (Nov 9)',
    '11-30': 'St. Andrew (Nov 30)',
    '12-08': 'Immaculate Conception (Dec 8)',
    '12-25': 'Christmas (Mass of the Day)',
    '12-26': 'St. Stephen (Dec 26)',
    '12-27': 'St. John the Apostle (Dec 27)',
    '12-28': 'Holy Innocents (Dec 28)',
  };

  const isSameDate = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  function getLiturgicalDayName(targetDate: Date): string {
    const year = targetDate.getFullYear();
    const date = new Date(year, targetDate.getMonth(), targetDate.getDate());
    const getDaysBetween = (d1: Date, d2: Date) => Math.round((d2.getTime() - d1.getTime()) / 86400000);
    const ord = (n: number): string => {
      const s = ['th','st','nd','rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const easter = getEaster(year);
    const ashWednesday = new Date(easter.getTime() - 46 * 86400000);
    const pentecost = new Date(easter.getTime() + 49 * 86400000);
    const trinity = new Date(pentecost.getTime() + 7 * 86400000);
    const corpusChristi = new Date(pentecost.getTime() + 14 * 86400000);
    const christmas = new Date(year, 11, 25);
    let offset = christmas.getDay();
    if (offset === 0) offset = 7;
    const advent1 = new Date(christmas.getTime() - (offset + 21) * 86400000);
    const christTheKing = new Date(advent1.getTime() - 7 * 86400000);
    const baptismLocal = new Date(year, 0, 6);
    baptismLocal.setDate(baptismLocal.getDate() + (7 - baptismLocal.getDay()));
    if (new Date(year, 0, 6).getDay() === 0) { baptismLocal.setDate(7); }

    if (date.getDay() === 0) {
      if (date >= advent1 && date < christmas) return `${ord(Math.floor(getDaysBetween(advent1, date) / 7) + 1)} Sunday of Advent`;
      if (date >= ashWednesday && date < easter) {
        const week = Math.floor(getDaysBetween(ashWednesday, date) / 7);
        if (week === 5) return 'Palm Sunday';
        return `${ord(week + 1)} Sunday of Lent`;
      }
      if (date >= easter && date <= pentecost) {
        const week = Math.floor(getDaysBetween(easter, date) / 7) + 1;
        if (week === 1) return 'Easter Sunday';
        if (week === 8) return 'Pentecost Sunday';
        return `${ord(week)} Sunday of Easter`;
      }
      if (isSameDate(date, trinity)) return 'Trinity Sunday';
      if (isSameDate(date, corpusChristi)) return 'Corpus Christi';
      if (isSameDate(date, christTheKing)) return 'Christ the King';
      if (isSameDate(date, baptismLocal)) return 'Baptism of the Lord';
      if (date > pentecost && date < christTheKing) return `${ord(34 - Math.floor(getDaysBetween(date, christTheKing) / 7))} Sunday in Ordinary Time`;
      if (date > baptismLocal && date < ashWednesday) return `${ord(2 + Math.floor(getDaysBetween(baptismLocal, date) / 7))} Sunday in Ordinary Time`;
    }
    return 'Ferial Day';
  }

  for (let i = 0; i < 380; i++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    const year = d.getFullYear();
    const easter = getEaster(year);
    const ashWednesday = new Date(easter.getTime() - 46 * 86400000);
    const ascension = new Date(easter.getTime() + 39 * 86400000);
    const pentecost = new Date(easter.getTime() + 49 * 86400000);
    const sacredHeart = new Date(pentecost.getTime() + 19 * 86400000);

    const checkAndAdd = (name: string, dateObj: Date) => {
      if (!datesMap[name]) {
        datesMap[name] = dateObj;
      }
    };

    if (isSameDate(d, ashWednesday)) checkAndAdd('Ash Wednesday', d);
    if (isSameDate(d, new Date(easter.getTime() - 3 * 86400000))) checkAndAdd('Holy Thursday', d);
    if (isSameDate(d, new Date(easter.getTime() - 2 * 86400000))) checkAndAdd('Good Friday', d);
    if (isSameDate(d, new Date(easter.getTime() + 1 * 86400000))) checkAndAdd('Easter Monday', d);
    if (isSameDate(d, new Date(easter.getTime() + 2 * 86400000))) checkAndAdd('Easter Tuesday', d);
    if (isSameDate(d, new Date(easter.getTime() + 3 * 86400000))) checkAndAdd('Easter Wednesday', d);
    if (isSameDate(d, ascension)) checkAndAdd('Ascension of the Lord', d);
    if (isSameDate(d, sacredHeart)) checkAndAdd('Sacred Heart of Jesus', d);

    if (d.getDay() === 0) {
      const name = getLiturgicalDayName(d);
      if (name !== 'Ferial Day') checkAndAdd(name, d);
    }

    const mmdd = String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (fixedFeasts[mmdd]) checkAndAdd(fixedFeasts[mmdd], d);
  }

  return datesMap;
}

/**
 * Parse the appointed verse reference to find the psalm file key.
 * Uses the first (Septuagint/Vulgate) number since our files are numbered that way.
 *   "Ps 24(25): 4"  -> "024"
 *   "Ps 84(85)"     -> "084"
 *   "Luke 1: 46-55 (Magnificat)" -> "Magnificat"
 */
export function extractPsalmKey(verses: string): string | null {
  // Match "Ps NN(MM)" or "Ps NN" patterns - use first number (LXX/Vulgate)
  const psMatch = verses.match(/Ps\s+(\d+)(?:\(\d+\))?/i);
  if (psMatch) {
    const primary = parseInt(psMatch[1], 10);
    return String(primary).padStart(3, '0');
  }
  if (/Magnificat/i.test(verses)) return 'Magnificat';
  if (/Benedictus/i.test(verses) || /Luke\s+1:\s*68/i.test(verses)) return 'Canticum Zachariae';
  if (/Nunc\s+dimittis/i.test(verses)) return 'Nunc dimittis';
  if (/Dan\s+3/i.test(verses)) return 'Canticum Trium puerorum';
  return null;
}

export const liturgicalData: ProperEntry[] = [
  // ADVENT
  { id: 1, season: 'Advent', day: '1st Sunday of Advent', type: 'Introit', incipit: 'Ad te levavi', translation: 'To you, I lift up my soul', source: 'Ps 24(25): 1-3', verses: 'Ps 24(25)', cycle: 'All' },
  { id: 2, season: 'Advent', day: '1st Sunday of Advent', type: 'Offertory', incipit: 'Ad te Domine levavi', translation: 'To you, O Lord, I lift up my soul', source: 'Ps 24(25): 1-3', verses: 'Ps 24(25)', cycle: 'All' },
  { id: 3, season: 'Advent', day: '1st Sunday of Advent', type: 'Communion', incipit: 'Dominus dabit benignitatem', translation: 'The Lord will bestow his bounty', source: 'Ps 84(85): 13', verses: 'Ps 84(85)', cycle: 'All' },
  { id: 4, season: 'Advent', day: '2nd Sunday of Advent', type: 'Introit', incipit: 'Populus Sion', translation: 'People of Zion, behold', source: 'Is 30: 19, 30', verses: 'Ps 79(80)', cycle: 'All' },
  { id: 5, season: 'Advent', day: '2nd Sunday of Advent', type: 'Offertory', incipit: 'Deus, tu convertens', translation: 'Will you not turn again, O God', source: 'Ps 84(85): 7-8', verses: 'Ps 84(85)', cycle: 'All' },
  { id: 6, season: 'Advent', day: '2nd Sunday of Advent', type: 'Communion', incipit: 'Ierusalem, surge', translation: 'Arise, O Jerusalem', source: 'Bar 5: 5; 4: 36', verses: 'Ps 147', cycle: 'All' },
  { id: 7, season: 'Advent', day: '3rd Sunday of Advent', type: 'Introit', incipit: 'Gaudete in Domino', translation: 'Rejoice in the Lord always', source: 'Phil 4: 4-5', verses: 'Ps 84(85)', cycle: 'All' },
  { id: 8, season: 'Advent', day: '3rd Sunday of Advent', type: 'Offertory', incipit: 'Benedixisti, Domine', translation: 'Lord, you have blessed your land', source: 'Ps 84(85): 2', verses: 'Ps 84(85)', cycle: 'All' },
  { id: 9, season: 'Advent', day: '3rd Sunday of Advent', type: 'Communion', incipit: 'Dicite: Pusillanimes', translation: 'Say to the faint of heart', source: 'Is 35: 4', verses: 'Ps 147', cycle: 'All' },
  { id: 10, season: 'Advent', day: '4th Sunday of Advent', type: 'Introit', incipit: 'Rorate caeli', translation: 'Drop down dew, ye heavens', source: 'Is 45: 8', verses: 'Ps 18(19)', cycle: 'All' },
  { id: 11, season: 'Advent', day: '4th Sunday of Advent', type: 'Offertory', incipit: 'Ave Maria', translation: 'Hail Mary, full of grace', source: 'Luke 1: 28, 42', verses: 'Luke 1: 46-55 (Magnificat)', cycle: 'All' },
  { id: 12, season: 'Advent', day: '4th Sunday of Advent', type: 'Communion', incipit: 'Ecce virgo', translation: 'Behold, a Virgin shall conceive', source: 'Is 7: 14', verses: 'Ps 18(19)', cycle: 'All' },
  // CHRISTMAS
  { id: 16, season: 'Christmas', day: 'Christmas (Mass of the Day)', type: 'Introit', incipit: 'Puer natus est nobis', translation: 'A child is born to us', source: 'Is 9: 6', verses: 'Ps 97(98)', cycle: 'All' },
  { id: 17, season: 'Christmas', day: 'Christmas (Mass of the Day)', type: 'Offertory', incipit: 'Tui sunt caeli', translation: 'Yours are the heavens', source: 'Ps 88(89): 12, 15', verses: 'Ps 88(89)', cycle: 'All' },
  { id: 18, season: 'Christmas', day: 'Christmas (Mass of the Day)', type: 'Communion', incipit: 'Viderunt omnes', translation: 'All the ends of the earth have seen', source: 'Ps 97(98): 3', verses: 'Ps 97(98)', cycle: 'All' },
  { id: 19, season: 'Christmas', day: 'Epiphany', type: 'Introit', incipit: 'Ecce advenit', translation: 'Behold, the Lord, the Mighty One, has come', source: 'Mal 3: 1', verses: 'Ps 71(72)', cycle: 'All' },
  { id: 20, season: 'Christmas', day: 'Epiphany', type: 'Offertory', incipit: 'Reges Tharsis', translation: 'The kings of Tarshish', source: 'Ps 71(72): 10-11', verses: 'Ps 71(72)', cycle: 'All' },
  { id: 21, season: 'Christmas', day: 'Epiphany', type: 'Communion', incipit: 'Vidimus stellam', translation: 'We have seen his star', source: 'Matt 2: 2', verses: 'Ps 71(72)', cycle: 'All' },
  { id: 400, season: 'Christmas', day: 'Holy Family', type: 'Introit', incipit: 'Deus in loco sancto suo', translation: 'God is in his holy place', source: 'Ps 67(68): 6-7, 36', verses: 'Ps 67(68)', cycle: 'All' },
  { id: 403, season: 'Christmas', day: 'Mary, Mother of God (Jan 1)', type: 'Introit', incipit: 'Salve, sancta Parens', translation: 'Hail, Holy Mother', source: 'Sedulius', verses: 'Ps 44(45)', cycle: 'All' },
  { id: 406, season: 'Christmas', day: 'Baptism of the Lord', type: 'Introit', incipit: 'Dilexisti iustitiam', translation: 'You have loved justice', source: 'Ps 44(45): 8', verses: 'Ps 28(29)', cycle: 'All' },
  { id: 407, season: 'Christmas', day: 'Baptism of the Lord', type: 'Offertory', incipit: 'Benedictus qui venit', translation: 'Blessed is he who comes', source: 'Ps 117(118): 26-27', verses: 'Ps 28(29)', cycle: 'All' },
  { id: 408, season: 'Christmas', day: 'Baptism of the Lord', type: 'Communion', incipit: 'Omnes qui in Christo', translation: 'As many of you as have been baptized', source: 'Gal 3: 27', verses: 'Ps 28(29)', cycle: 'All' },
  { id: 700, season: 'Christmas', day: 'St. Stephen (Dec 26)', type: 'Introit', incipit: 'Sederunt principes', translation: 'Princes sat and spoke against me', source: 'Ps 118(119): 23, 86', verses: 'Ps 118(119)', cycle: 'All' },
  { id: 703, season: 'Christmas', day: 'St. John the Apostle (Dec 27)', type: 'Introit', incipit: 'In medio Ecclesiae', translation: 'In the midst of the Church', source: 'Sir 15: 5', verses: 'Ps 91(92)', cycle: 'All' },
  { id: 706, season: 'Christmas', day: 'Holy Innocents (Dec 28)', type: 'Introit', incipit: 'Ex ore infantium', translation: 'Out of the mouths of infants', source: 'Ps 8: 2', verses: 'Ps 8', cycle: 'All' },
  // LENT
  { id: 300, season: 'Lent', day: 'Ash Wednesday', type: 'Introit', incipit: 'Misereris omnium', translation: 'You are merciful to all', source: 'Wis 11: 24-25, 27', verses: 'Ps 56(57)', cycle: 'All' },
  { id: 301, season: 'Lent', day: 'Ash Wednesday', type: 'Offertory', incipit: 'Exaltabo te', translation: 'I will extol you, O Lord', source: 'Ps 29(30): 2-3', verses: 'Ps 29(30)', cycle: 'All' },
  { id: 302, season: 'Lent', day: 'Ash Wednesday', type: 'Communion', incipit: 'Qui meditabitur', translation: 'He who ponders the law', source: 'Ps 1: 2-3', verses: 'Ps 1', cycle: 'All' },
  { id: 22, season: 'Lent', day: '1st Sunday of Lent', type: 'Introit', incipit: 'Invocabit me', translation: 'He will call upon me', source: 'Ps 90(91): 15-16', verses: 'Ps 90(91)', cycle: 'All' },
  { id: 23, season: 'Lent', day: '1st Sunday of Lent', type: 'Offertory', incipit: 'Scapulis suis', translation: 'He will conceal you with his pinions', source: 'Ps 90(91): 4-5', verses: 'Ps 90(91)', cycle: 'All' },
  { id: 24, season: 'Lent', day: '1st Sunday of Lent', type: 'Communion', incipit: 'Scapulis suis (Comm.)', translation: 'He will conceal you with his pinions', source: 'Ps 90(91): 4-5', verses: 'Ps 90(91)', cycle: 'All' },
  { id: 25, season: 'Lent', day: '2nd Sunday of Lent', type: 'Introit', incipit: 'Reminiscere', translation: 'Remember your mercies', source: 'Ps 26(27): 8-9', verses: 'Ps 26(27)', cycle: 'All' },
  { id: 28, season: 'Lent', day: '3rd Sunday of Lent', type: 'Introit', incipit: 'Oculi mei', translation: 'My eyes are ever toward the Lord', source: 'Ps 24(25): 15-16', verses: 'Ps 24(25)', cycle: 'All' },
  { id: 32, season: 'Lent', day: '4th Sunday of Lent', type: 'Introit', incipit: 'Laetare Ierusalem', translation: 'Rejoice, O Jerusalem', source: 'Is 66: 10-11', verses: 'Ps 121(122)', cycle: 'All' },
  { id: 36, season: 'Lent', day: '5th Sunday of Lent', type: 'Introit', incipit: 'Iudica me, Deus', translation: 'Vindicate me, O God', source: 'Ps 42(43): 1-2', verses: 'Ps 42(43)', cycle: 'All' },
  { id: 303, season: 'Lent', day: 'Palm Sunday', type: 'Introit', incipit: 'Hosanna filio David', translation: 'Hosanna to the Son of David', source: 'Matt 21: 9', verses: 'Ps 117(118)', cycle: 'All' },
  { id: 304, season: 'Lent', day: 'Palm Sunday', type: 'Offertory', incipit: 'Improperium', translation: 'My heart has awaited reproach', source: 'Ps 68(69): 21-22', verses: 'Ps 68(69)', cycle: 'All' },
  { id: 305, season: 'Lent', day: 'Palm Sunday', type: 'Communion', incipit: 'Pater, si non potest', translation: 'Father, if this chalice cannot pass', source: 'Matt 26: 42', verses: 'Ps 21(22)', cycle: 'All' },
  // EASTER TRIDUUM
  { id: 306, season: 'Easter', day: 'Holy Thursday', type: 'Introit', incipit: 'Nos autem gloriari', translation: 'It behooves us to glory in the cross', source: 'Gal 6: 14', verses: 'Ps 66(67)', cycle: 'All' },
  { id: 307, season: 'Easter', day: 'Holy Thursday', type: 'Offertory', incipit: 'Ubi caritas et amor', translation: 'Where charity and love are', source: 'Ancient Hymn', verses: 'Ps 22(23)', cycle: 'All' },
  { id: 308, season: 'Easter', day: 'Holy Thursday', type: 'Communion', incipit: 'Hoc corpus', translation: 'This is my body which is given for you', source: '1 Cor 11: 24-25', verses: 'Ps 22(23)', cycle: 'All' },
  // EASTER
  { id: 40, season: 'Easter', day: 'Easter Sunday', type: 'Introit', incipit: 'Resurrexi', translation: 'I have risen, and I am with you still', source: 'Ps 138(139): 18, 5-6', verses: 'Ps 138(139)', cycle: 'All' },
  { id: 41, season: 'Easter', day: 'Easter Sunday', type: 'Offertory', incipit: 'Terra tremuit', translation: 'The earth trembled and was still', source: 'Ps 75(76): 9-10', verses: 'Ps 75(76)', cycle: 'All' },
  { id: 42, season: 'Easter', day: 'Easter Sunday', type: 'Communion', incipit: 'Pascha nostrum', translation: 'Christ our Passover has been sacrificed', source: '1 Cor 5: 7-8', verses: 'Ps 117(118)', cycle: 'All' },
  { id: 818, season: 'Easter', day: 'Easter Monday', type: 'Introit', incipit: 'Introduxit vos', translation: 'The Lord has brought you into a land', source: 'Exod 13: 5, 9', verses: 'Ps 104(105)', cycle: 'All' },
  { id: 821, season: 'Easter', day: 'Easter Tuesday', type: 'Introit', incipit: 'Aqua sapientiae', translation: 'He gave them the water of wisdom', source: 'Sir 15: 3, 4', verses: 'Ps 104(105)', cycle: 'All' },
  { id: 824, season: 'Easter', day: 'Easter Wednesday', type: 'Introit', incipit: 'Venite benedicti', translation: 'Come, blessed of my Father', source: 'Matt 25: 34', verses: 'Ps 95(96)', cycle: 'All' },
  { id: 43, season: 'Easter', day: '2nd Sunday of Easter', type: 'Introit', incipit: 'Quasimodo', translation: 'Like newborn infants', source: '1 Pet 2: 2', verses: 'Ps 80(81)', cycle: 'All' },
  { id: 44, season: 'Easter', day: '2nd Sunday of Easter', type: 'Offertory', incipit: 'Angelus Domini', translation: 'An angel of the Lord descended', source: 'Matt 28: 2, 5-6', verses: 'Ps 117(118)', cycle: 'All' },
  { id: 45, season: 'Easter', day: '2nd Sunday of Easter', type: 'Communion', incipit: 'Mitte manum tuam', translation: 'Stretch forth your hand', source: 'John 20: 27', verses: 'Ps 117(118)', cycle: 'All' },
  { id: 409, season: 'Easter', day: '3rd Sunday of Easter', type: 'Introit', incipit: 'Iubilate Deo, omnis terra', translation: 'Shout with joy to God, all the earth', source: 'Ps 65(66): 1-2', verses: 'Ps 65(66)', cycle: 'All' },
  { id: 414, season: 'Easter', day: '4th Sunday of Easter', type: 'Introit', incipit: 'Misericordia Domini', translation: 'The earth is full of the goodness of the Lord', source: 'Ps 32(33): 5-6', verses: 'Ps 32(33)', cycle: 'All' },
  { id: 416, season: 'Easter', day: '4th Sunday of Easter', type: 'Communion', incipit: 'Ego sum pastor bonus', translation: 'I am the good shepherd', source: 'John 10: 14', verses: 'Ps 22(23)', cycle: 'All' },
  { id: 417, season: 'Easter', day: '5th Sunday of Easter', type: 'Introit', incipit: 'Cantate Domino', translation: 'Sing to the Lord a new song', source: 'Ps 97(98): 1-2', verses: 'Ps 97(98)', cycle: 'All' },
  { id: 421, season: 'Easter', day: '6th Sunday of Easter', type: 'Introit', incipit: 'Vocem iucunditatis', translation: 'Declare it with the voice of joy', source: 'Is 48: 20', verses: 'Ps 65(66)', cycle: 'All' },
  { id: 424, season: 'Easter', day: 'Ascension of the Lord', type: 'Introit', incipit: 'Viri Galilaei', translation: 'Men of Galilee', source: 'Acts 1: 11', verses: 'Ps 46(47)', cycle: 'All' },
  { id: 425, season: 'Easter', day: 'Ascension of the Lord', type: 'Offertory', incipit: 'Ascendit Deus', translation: 'God has gone up with a shout', source: 'Ps 46(47): 6', verses: 'Ps 46(47)', cycle: 'All' },
  { id: 426, season: 'Easter', day: 'Ascension of the Lord', type: 'Communion', incipit: 'Psallite Domino', translation: 'Sing to the Lord', source: 'Ps 67(68): 33-34', verses: 'Ps 67(68)', cycle: 'All' },
  { id: 600, season: 'Easter', day: '7th Sunday of Easter', type: 'Introit', incipit: 'Exaudi, Domine', translation: 'Hear, O Lord, my voice', source: 'Ps 26(27): 7, 8, 9', verses: 'Ps 26(27)', cycle: 'All' },
  { id: 46, season: 'Easter', day: 'Pentecost Sunday', type: 'Introit', incipit: 'Spiritus Domini', translation: 'The Spirit of the Lord has filled the whole world', source: 'Wis 1: 7', verses: 'Ps 67(68)', cycle: 'All' },
  { id: 47, season: 'Easter', day: 'Pentecost Sunday', type: 'Offertory', incipit: 'Confirma hoc, Deus', translation: 'Confirm, O God, what you have wrought in us', source: 'Ps 67(68): 29-30', verses: 'Ps 67(68)', cycle: 'All' },
  { id: 48, season: 'Easter', day: 'Pentecost Sunday', type: 'Communion', incipit: 'Factus est repente', translation: 'Suddenly there came a sound from heaven', source: 'Acts 2: 2, 4', verses: 'Ps 67(68)', cycle: 'All' },
  // ORDINARY TIME (Solemnities)
  { id: 309, season: 'Ordinary Time', day: 'Trinity Sunday', type: 'Introit', incipit: 'Benedicta sit', translation: 'Blessed be the Holy Trinity', source: 'Tob 12: 6', verses: 'Ps 8', cycle: 'All' },
  { id: 311, season: 'Ordinary Time', day: 'Trinity Sunday', type: 'Communion', incipit: 'Benedicimus Deum', translation: 'We bless the God of heaven', source: 'Tob 12: 6', verses: 'Ps 8', cycle: 'All' },
  { id: 312, season: 'Ordinary Time', day: 'Corpus Christi', type: 'Introit', incipit: 'Cibavit eos', translation: 'He fed them with the finest of wheat', source: 'Ps 80(81): 17', verses: 'Ps 80(81)', cycle: 'All' },
  { id: 314, season: 'Ordinary Time', day: 'Corpus Christi', type: 'Communion', incipit: 'Qui manducat', translation: 'He who eats my flesh and drinks my blood', source: 'John 6: 57', verses: 'Ps 118(119)', cycle: 'All' },
  { id: 315, season: 'Ordinary Time', day: 'Sacred Heart of Jesus', type: 'Introit', incipit: 'Cogitationes Cordis', translation: 'The designs of his Heart are from age to age', source: 'Ps 32(33): 11, 19', verses: 'Ps 32(33)', cycle: 'All' },
  { id: 318, season: 'Ordinary Time', day: 'Christ the King', type: 'Introit', incipit: 'Dignus est Agnus', translation: 'Worthy is the Lamb who was slain', source: 'Rev 5: 12; 1: 6', verses: 'Ps 71(72)', cycle: 'All' },
  { id: 320, season: 'Ordinary Time', day: 'Christ the King', type: 'Communion', incipit: 'Sedebit Dominus', translation: 'The Lord will sit as King forever', source: 'Ps 28(29): 10-11', verses: 'Ps 28(29)', cycle: 'All' },
  // ORDINARY TIME (Sundays 2-33)
  { id: 500, season: 'Ordinary Time', day: '2nd Sunday in Ordinary Time', type: 'Introit', incipit: 'Omnis terra', translation: 'Let all the earth worship you, O God', source: 'Ps 65(66): 4', verses: 'Ps 65(66)', cycle: 'All' },
  { id: 504, season: 'Ordinary Time', day: '3rd Sunday in Ordinary Time', type: 'Introit', incipit: 'Dominus secus mare', translation: 'The Lord, walking by the sea of Galilee', source: 'Matt 4: 18-19', verses: 'Ps 18(19)', cycle: 'All' },
  { id: 507, season: 'Ordinary Time', day: '4th Sunday in Ordinary Time', type: 'Introit', incipit: 'Laetetur cor', translation: 'Let the hearts of those who seek the Lord rejoice', source: 'Ps 104(105): 3-4', verses: 'Ps 104(105)', cycle: 'All' },
  { id: 511, season: 'Ordinary Time', day: '5th Sunday in Ordinary Time', type: 'Introit', incipit: 'Venite, adoremus', translation: 'O come, let us worship and bow down', source: 'Ps 94(95): 6-7', verses: 'Ps 94(95)', cycle: 'All' },
  { id: 514, season: 'Ordinary Time', day: '6th Sunday in Ordinary Time', type: 'Introit', incipit: 'Esto mihi', translation: 'Be my rock of refuge', source: 'Ps 30(31): 3-4', verses: 'Ps 30(31)', cycle: 'All' },
  { id: 517, season: 'Ordinary Time', day: '7th Sunday in Ordinary Time', type: 'Introit', incipit: 'Domine, in tua misericordia', translation: 'O Lord, I have trusted in your mercy', source: 'Ps 12(13): 6', verses: 'Ps 12(13)', cycle: 'All' },
  { id: 520, season: 'Ordinary Time', day: '8th Sunday in Ordinary Time', type: 'Introit', incipit: 'Factus est Dominus', translation: 'The Lord became my protector', source: 'Ps 17(18): 19-20', verses: 'Ps 17(18)', cycle: 'All' },
  { id: 523, season: 'Ordinary Time', day: '9th Sunday in Ordinary Time', type: 'Introit', incipit: 'Respice in me', translation: 'Look upon me, and have mercy on me', source: 'Ps 24(25): 16, 18', verses: 'Ps 24(25)', cycle: 'All' },
  { id: 101, season: 'Ordinary Time', day: '10th Sunday in Ordinary Time', type: 'Introit', incipit: 'Dominus illuminatio mea', translation: 'The Lord is my light and my salvation', source: 'Ps 26(27): 1-2', verses: 'Ps 26(27)', cycle: 'All' },
  { id: 102, season: 'Ordinary Time', day: '10th Sunday in Ordinary Time', type: 'Communion', incipit: 'Dominus firmamentum meum', translation: 'The Lord is my rock', source: 'Ps 17(18): 3', verses: 'Ps 17(18)', cycle: 'All' },
  { id: 103, season: 'Ordinary Time', day: '11th Sunday in Ordinary Time', type: 'Introit', incipit: 'Exaudi, Domine', translation: 'Hear, O Lord, my voice', source: 'Ps 26(27): 7, 9', verses: 'Ps 26(27)', cycle: 'All' },
  { id: 106, season: 'Ordinary Time', day: '12th Sunday in Ordinary Time', type: 'Introit', incipit: 'Dominus fortitudo plebis suae', translation: 'The Lord is the strength of his people', source: 'Ps 27(28): 8-9', verses: 'Ps 27(28)', cycle: 'All' },
  { id: 109, season: 'Ordinary Time', day: '13th Sunday in Ordinary Time', type: 'Introit', incipit: 'Omnes gentes, plaudite manibus', translation: 'O clap your hands, all ye nations', source: 'Ps 46(47): 2', verses: 'Ps 46(47)', cycle: 'All' },
  { id: 112, season: 'Ordinary Time', day: '14th Sunday in Ordinary Time', type: 'Introit', incipit: 'Suscepimus, Deus', translation: 'We have received thy mercy, O God', source: 'Ps 47(48): 10-11', verses: 'Ps 47(48)', cycle: 'All' },
  { id: 113, season: 'Ordinary Time', day: '14th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Populum humilem', translation: 'Thou wilt save the afflicted people', source: 'Ps 17(18): 28, 32', verses: 'Ps 17(18)', cycle: 'All' },
  { id: 114, season: 'Ordinary Time', day: '14th Sunday in Ordinary Time', type: 'Communion', incipit: 'Gustate et videte', translation: 'O taste, and see that the Lord is sweet', source: 'Ps 33(34): 9', verses: 'Ps 33(34)', cycle: 'All' },
  { id: 336, season: 'Ordinary Time', day: '15th Sunday in Ordinary Time', type: 'Introit', incipit: 'Dum clamarem', translation: 'When I cried to the Lord, he heard my voice', source: 'Ps 54(55): 17, 18, 20, 23', verses: 'Ps 54(55)', cycle: 'All' },
  { id: 338, season: 'Ordinary Time', day: '15th Sunday in Ordinary Time', type: 'Communion', incipit: 'Passer invenit', translation: 'The sparrow has found a house', source: 'Ps 83(84): 4-5', verses: 'Ps 83(84)', cycle: 'All' },
  { id: 339, season: 'Ordinary Time', day: '16th Sunday in Ordinary Time', type: 'Introit', incipit: 'Ecce Deus adiuvat me', translation: 'Behold, God is my helper', source: 'Ps 53(54): 6-7', verses: 'Ps 53(54)', cycle: 'All' },
  { id: 342, season: 'Ordinary Time', day: '17th Sunday in Ordinary Time', type: 'Introit', incipit: 'Deus in loco sancto suo', translation: 'God is in his holy place', source: 'Ps 67(68): 6-7, 36', verses: 'Ps 67(68)', cycle: 'All' },
  { id: 345, season: 'Ordinary Time', day: '18th Sunday in Ordinary Time', type: 'Introit', incipit: 'Deus in adiutorium', translation: 'O God, come to my assistance', source: 'Ps 69(70): 2-3', verses: 'Ps 69(70)', cycle: 'All' },
  { id: 348, season: 'Ordinary Time', day: '19th Sunday in Ordinary Time', type: 'Introit', incipit: 'Respice, Domine', translation: 'Look to your covenant, O Lord', source: 'Ps 73(74): 20, 19, 22, 23', verses: 'Ps 73(74)', cycle: 'All' },
  { id: 351, season: 'Ordinary Time', day: '20th Sunday in Ordinary Time', type: 'Introit', incipit: 'Protector noster', translation: 'Behold, O God, our protector', source: 'Ps 83(84): 10-11', verses: 'Ps 83(84)', cycle: 'All' },
  { id: 427, season: 'Ordinary Time', day: '21st Sunday in Ordinary Time', type: 'Introit', incipit: 'Inclina, Domine', translation: 'Bow down your ear, O Lord', source: 'Ps 85(86): 1, 2-3', verses: 'Ps 85(86)', cycle: 'All' },
  { id: 430, season: 'Ordinary Time', day: '22nd Sunday in Ordinary Time', type: 'Introit', incipit: 'Miserere mihi, Domine', translation: 'Have mercy on me, O Lord', source: 'Ps 85(86): 3, 5', verses: 'Ps 85(86)', cycle: 'All' },
  { id: 433, season: 'Ordinary Time', day: '23rd Sunday in Ordinary Time', type: 'Introit', incipit: 'Iustus es, Domine', translation: 'You are just, O Lord', source: 'Ps 118(119): 137, 124', verses: 'Ps 118(119)', cycle: 'All' },
  { id: 436, season: 'Ordinary Time', day: '24th Sunday in Ordinary Time', type: 'Introit', incipit: 'Da pacem, Domine', translation: 'Give peace, O Lord', source: 'Sir 36: 18', verses: 'Ps 121(122)', cycle: 'All' },
  { id: 439, season: 'Ordinary Time', day: '25th Sunday in Ordinary Time', type: 'Introit', incipit: 'Salus populi', translation: 'I am the salvation of the people', source: 'Traditional', verses: 'Ps 77(78)', cycle: 'All' },
  { id: 442, season: 'Ordinary Time', day: '26th Sunday in Ordinary Time', type: 'Introit', incipit: 'Omnia quae fecisti', translation: 'All that you have done to us', source: 'Dan 3: 31, 29, 30, 43, 42', verses: 'Ps 118(119)', cycle: 'All' },
  { id: 445, season: 'Ordinary Time', day: '27th Sunday in Ordinary Time', type: 'Introit', incipit: 'In voluntate tua', translation: 'All things are in your will, O Lord', source: 'Esth 13: 9, 10-11', verses: 'Ps 118(119)', cycle: 'All' },
  { id: 448, season: 'Ordinary Time', day: '28th Sunday in Ordinary Time', type: 'Introit', incipit: 'Si iniquitates', translation: 'If you, O Lord, should mark iniquities', source: 'Ps 129(130): 3-4', verses: 'Ps 129(130)', cycle: 'All' },
  { id: 451, season: 'Ordinary Time', day: '29th Sunday in Ordinary Time', type: 'Introit', incipit: 'Ego clamavi', translation: 'I have cried out, for you hear me', source: 'Ps 16(17): 6, 8', verses: 'Ps 16(17)', cycle: 'All' },
  { id: 454, season: 'Ordinary Time', day: '30th Sunday in Ordinary Time', type: 'Introit', incipit: 'Laetetur cor', translation: 'Let the hearts of those who seek the Lord rejoice', source: 'Ps 104(105): 3-4', verses: 'Ps 104(105)', cycle: 'All' },
  { id: 457, season: 'Ordinary Time', day: '31st Sunday in Ordinary Time', type: 'Introit', incipit: 'Ne derelinquas me', translation: 'Forsake me not, O Lord', source: 'Ps 37(38): 22-23', verses: 'Ps 37(38)', cycle: 'All' },
  { id: 460, season: 'Ordinary Time', day: '32nd Sunday in Ordinary Time', type: 'Introit', incipit: 'Intret oratio mea', translation: 'Let my prayer come before you', source: 'Ps 87(88): 3', verses: 'Ps 87(88)', cycle: 'All' },
  { id: 463, season: 'Ordinary Time', day: '33rd Sunday in Ordinary Time', type: 'Introit', incipit: 'Dicit Dominus: Ego cogito', translation: 'The Lord says: I think thoughts of peace', source: 'Jer 29: 11, 12, 14', verses: 'Ps 84(85)', cycle: 'All' },
  // PROPER OF SAINTS
  { id: 800, season: 'Proper of Saints', day: 'Conversion of St. Paul (Jan 25)', type: 'Introit', incipit: 'Scio cui credidi', translation: 'I know whom I have believed', source: '2 Tim 1: 12', verses: 'Ps 138(139)', cycle: 'All' },
  { id: 609, season: 'Proper of Saints', day: 'Presentation of the Lord (Feb 2)', type: 'Introit', incipit: 'Suscepimus, Deus', translation: 'We have received thy mercy', source: 'Ps 47(48): 10-11', verses: 'Ps 47(48)', cycle: 'All' },
  { id: 611, season: 'Proper of Saints', day: 'Presentation of the Lord (Feb 2)', type: 'Communion', incipit: 'Responsum accepit Simeon', translation: 'Simeon received an answer from the Holy Spirit', source: 'Luke 2: 26', verses: 'Ps 47(48)', cycle: 'All' },
  { id: 709, season: 'Proper of Saints', day: 'Chair of St. Peter (Feb 22)', type: 'Introit', incipit: 'Statuit ei', translation: 'The Lord made a covenant of peace', source: 'Sir 45: 30', verses: 'Ps 131(132)', cycle: 'All' },
  { id: 321, season: 'Proper of Saints', day: 'St. Joseph (Mar 19)', type: 'Introit', incipit: 'Iustus ut palma', translation: 'The just shall flourish like the palm tree', source: 'Ps 91(92): 13-14', verses: 'Ps 91(92)', cycle: 'All' },
  { id: 323, season: 'Proper of Saints', day: 'St. Joseph (Mar 19)', type: 'Communion', incipit: 'Ioseph fili David', translation: 'Joseph, son of David, fear not', source: 'Matt 1: 20', verses: 'Ps 111(112)', cycle: 'All' },
  { id: 324, season: 'Proper of Saints', day: 'The Annunciation (Mar 25)', type: 'Introit', incipit: 'Rorate caeli', translation: 'Drop down dew, ye heavens', source: 'Is 45: 8', verses: 'Ps 18(19)', cycle: 'All' },
  { id: 325, season: 'Proper of Saints', day: 'The Annunciation (Mar 25)', type: 'Offertory', incipit: 'Ave Maria', translation: 'Hail Mary, full of grace', source: 'Luke 1: 28, 42', verses: 'Luke 1: 46-55 (Magnificat)', cycle: 'All' },
  { id: 326, season: 'Proper of Saints', day: 'The Annunciation (Mar 25)', type: 'Communion', incipit: 'Ecce virgo', translation: 'Behold, a Virgin shall conceive', source: 'Is 7: 14', verses: 'Ps 18(19)', cycle: 'All' },
  { id: 803, season: 'Proper of Saints', day: 'St. Mark the Evangelist (Apr 25)', type: 'Introit', incipit: 'Accipite iucunditatem', translation: 'Receive the joy of your glory', source: '4 Esdras 2: 36-37', verses: 'Ps 77(78)', cycle: 'All' },
  { id: 806, season: 'Proper of Saints', day: 'Ss. Philip & James (May 3)', type: 'Introit', incipit: 'Exclamaberunt ad te', translation: 'In the time of their tribulation', source: 'Neh 9: 27', verses: 'Ps 32(33)', cycle: 'All' },
  { id: 808, season: 'Proper of Saints', day: 'Ss. Philip & James (May 3)', type: 'Communion', incipit: 'Tanto tempore', translation: 'Have I been so long a time with you', source: 'John 14: 9', verses: 'Ps 32(33)', cycle: 'All' },
  { id: 809, season: 'Proper of Saints', day: 'St. Matthias the Apostle (May 14)', type: 'Introit', incipit: 'Vocem iucunditatis', translation: 'Declare it with the voice of joy', source: 'Is 48: 20', verses: 'Ps 65(66)', cycle: 'All' },
  { id: 736, season: 'Proper of Saints', day: 'Visitation of Mary (May 31)', type: 'Introit', incipit: 'Gaudeamus omnes', translation: 'Let us all rejoice in the Lord', source: 'Traditional', verses: 'Ps 44(45)', cycle: 'All' },
  { id: 738, season: 'Proper of Saints', day: 'Visitation of Mary (May 31)', type: 'Communion', incipit: 'Beatam me dicent', translation: 'All generations will call me blessed', source: 'Luke 1: 48', verses: 'Luke 1: 46-55 (Magnificat)', cycle: 'All' },
  { id: 200, season: 'Proper of Saints', day: 'Nativity of St. John the Baptist (Jun 24)', type: 'Introit', incipit: 'De ventre matris', translation: 'From the womb of my mother', source: 'Is 49: 1-2', verses: 'Ps 91(92)', cycle: 'All' },
  { id: 201, season: 'Proper of Saints', day: 'Nativity of St. John the Baptist (Jun 24)', type: 'Offertory', incipit: 'Iustus ut palma', translation: 'The just shall flourish like the palm tree', source: 'Ps 91(92): 13', verses: 'Ps 91(92)', cycle: 'All' },
  { id: 202, season: 'Proper of Saints', day: 'Nativity of St. John the Baptist (Jun 24)', type: 'Communion', incipit: 'Tu, puer', translation: 'You, child, will be called the prophet', source: 'Luke 1: 76', verses: 'Luke 1: 68-79', cycle: 'All' },
  { id: 203, season: 'Proper of Saints', day: 'Ss. Peter & Paul (Jun 29)', type: 'Introit', incipit: 'Nunc scio vere', translation: 'Now I know in very deed', source: 'Acts 12: 11', verses: 'Ps 138(139)', cycle: 'All' },
  { id: 204, season: 'Proper of Saints', day: 'Ss. Peter & Paul (Jun 29)', type: 'Offertory', incipit: 'Constitues eos', translation: 'You will make them princes over all the earth', source: 'Ps 44(45): 17-18', verses: 'Ps 44(45)', cycle: 'All' },
  { id: 205, season: 'Proper of Saints', day: 'Ss. Peter & Paul (Jun 29)', type: 'Communion', incipit: 'Tu es Petrus', translation: 'You are Peter, and upon this rock', source: 'Matt 16: 18', verses: 'Ps 88(89)', cycle: 'All' },
  { id: 721, season: 'Proper of Saints', day: 'St. Thomas the Apostle (Jul 3)', type: 'Introit', incipit: 'Mihi autem nimis', translation: 'To me, your friends, O God', source: 'Ps 138(139): 17', verses: 'Ps 138(139)', cycle: 'All' },
  { id: 723, season: 'Proper of Saints', day: 'St. Thomas the Apostle (Jul 3)', type: 'Communion', incipit: 'Mitte manum tuam', translation: 'Stretch forth your hand', source: 'John 20: 27', verses: 'Ps 117(118)', cycle: 'All' },
  { id: 712, season: 'Proper of Saints', day: 'St. Mary Magdalene (Jul 22)', type: 'Introit', incipit: 'Me exspectaverunt', translation: 'The wicked have waited for me', source: 'Ps 118(119): 95-96', verses: 'Ps 118(119)', cycle: 'All' },
  { id: 724, season: 'Proper of Saints', day: 'St. James the Apostle (Jul 25)', type: 'Introit', incipit: 'Mihi autem nimis', translation: 'To me, your friends, O God', source: 'Ps 138(139): 17', verses: 'Ps 138(139)', cycle: 'All' },
  { id: 726, season: 'Proper of Saints', day: 'St. James the Apostle (Jul 25)', type: 'Communion', incipit: 'Calicem salutaris', translation: 'I will take the chalice of salvation', source: 'Ps 115(116): 13', verses: 'Ps 115(116)', cycle: 'All' },
  { id: 327, season: 'Proper of Saints', day: 'The Transfiguration (Aug 6)', type: 'Introit', incipit: 'Tibi dixit cor meum', translation: 'My heart has said to you', source: 'Ps 26(27): 8-9', verses: 'Ps 26(27)', cycle: 'All' },
  { id: 328, season: 'Proper of Saints', day: 'The Transfiguration (Aug 6)', type: 'Offertory', incipit: 'Gloria et honore', translation: 'You have crowned him with glory and honor', source: 'Ps 8: 6-7', verses: 'Ps 8', cycle: 'All' },
  { id: 329, season: 'Proper of Saints', day: 'The Transfiguration (Aug 6)', type: 'Communion', incipit: 'Visionem', translation: 'Tell the vision to no one', source: 'Matt 17: 9', verses: 'Ps 44(45)', cycle: 'All' },
  { id: 715, season: 'Proper of Saints', day: 'St. Lawrence (Aug 10)', type: 'Introit', incipit: 'Confessio et pulchritudo', translation: 'Praise and beauty are before him', source: 'Ps 95(96): 6', verses: 'Ps 95(96)', cycle: 'All' },
  { id: 717, season: 'Proper of Saints', day: 'St. Lawrence (Aug 10)', type: 'Communion', incipit: 'Qui mihi ministrat', translation: 'If anyone serves me, let him follow me', source: 'John 12: 26', verses: 'Ps 16(17)', cycle: 'All' },
  { id: 206, season: 'Proper of Saints', day: 'Assumption of Mary (Aug 15)', type: 'Introit', incipit: 'Signum magnum', translation: 'A great sign appeared in heaven', source: 'Rev 12: 1', verses: 'Ps 97(98)', cycle: 'All' },
  { id: 207, season: 'Proper of Saints', day: 'Assumption of Mary (Aug 15)', type: 'Offertory', incipit: 'Assumpta est Maria', translation: 'Mary is taken up into heaven', source: 'Ps 44', verses: 'Ps 44(45)', cycle: 'All' },
  { id: 208, season: 'Proper of Saints', day: 'Assumption of Mary (Aug 15)', type: 'Communion', incipit: 'Beatam me dicent', translation: 'All generations will call me blessed', source: 'Luke 1: 48', verses: 'Luke 1: 46-55 (Magnificat)', cycle: 'All' },
  { id: 727, season: 'Proper of Saints', day: 'St. Bartholomew the Apostle (Aug 24)', type: 'Introit', incipit: 'Mihi autem nimis', translation: 'To me, your friends, O God', source: 'Ps 138(139): 17', verses: 'Ps 138(139)', cycle: 'All' },
  { id: 618, season: 'Proper of Saints', day: 'Nativity of Mary (Sep 8)', type: 'Introit', incipit: 'Salve, sancta Parens', translation: 'Hail, Holy Mother', source: 'Sedulius', verses: 'Ps 44(45)', cycle: 'All' },
  { id: 330, season: 'Proper of Saints', day: 'Exaltation of the Holy Cross (Sep 14)', type: 'Introit', incipit: 'Nos autem gloriari', translation: 'It behooves us to glory in the cross', source: 'Gal 6: 14', verses: 'Ps 66(67)', cycle: 'All' },
  { id: 812, season: 'Proper of Saints', day: 'Our Lady of Sorrows (Sep 15)', type: 'Introit', incipit: 'Stabant iuxta crucem', translation: 'There stood by the cross of Jesus', source: 'John 19: 25', verses: 'Ps 55(56)', cycle: 'All' },
  { id: 730, season: 'Proper of Saints', day: 'St. Matthew the Apostle (Sep 21)', type: 'Introit', incipit: 'Os iusti', translation: 'The mouth of the just utters wisdom', source: 'Ps 36(37): 30-31', verses: 'Ps 36(37)', cycle: 'All' },
  { id: 732, season: 'Proper of Saints', day: 'St. Matthew the Apostle (Sep 21)', type: 'Communion', incipit: 'Magna est gloria', translation: 'His glory is great in your salvation', source: 'Ps 20(21): 6', verses: 'Ps 20(21)', cycle: 'All' },
  { id: 621, season: 'Proper of Saints', day: 'St. Michael the Archangel (Sep 29)', type: 'Introit', incipit: 'Benedicite Dominum', translation: 'Bless the Lord, all you his angels', source: 'Ps 102(103): 20', verses: 'Ps 102(103)', cycle: 'All' },
  { id: 815, season: 'Proper of Saints', day: 'St. Luke the Evangelist (Oct 18)', type: 'Introit', incipit: 'Mihi autem nimis', translation: 'To me, your friends, O God', source: 'Ps 138(139): 17', verses: 'Ps 138(139)', cycle: 'All' },
  { id: 733, season: 'Proper of Saints', day: 'Ss. Simon & Jude (Oct 28)', type: 'Introit', incipit: 'Iudicant sancti', translation: 'The saints judge nations', source: 'Wis 3: 8', verses: 'Ps 32(33)', cycle: 'All' },
  { id: 735, season: 'Proper of Saints', day: 'Ss. Simon & Jude (Oct 28)', type: 'Communion', incipit: 'Vos qui secuti', translation: 'You who have followed me will sit on thrones', source: 'Matt 19: 28', verses: 'Ps 138(139)', cycle: 'All' },
  { id: 209, season: 'Proper of Saints', day: 'All Saints (Nov 1)', type: 'Introit', incipit: 'Gaudeamus omnes', translation: 'Let us all rejoice in the Lord', source: 'Traditional', verses: 'Ps 32(33)', cycle: 'All' },
  { id: 210, season: 'Proper of Saints', day: 'All Saints (Nov 1)', type: 'Offertory', incipit: 'Iustorum animae', translation: 'The souls of the just are in the hand of God', source: 'Wis 3: 1-2, 3', verses: 'Ps 32(33)', cycle: 'All' },
  { id: 211, season: 'Proper of Saints', day: 'All Saints (Nov 1)', type: 'Communion', incipit: 'Beati mundo corde', translation: 'Blessed are the clean of heart', source: 'Matt 5: 8-10', verses: 'Ps 33(34)', cycle: 'All' },
  { id: 612, season: 'Proper of Saints', day: 'All Souls (Nov 2)', type: 'Introit', incipit: 'Requiem aeternam', translation: 'Eternal rest grant unto them, O Lord', source: '4 Esdras 2: 34, 35', verses: 'Ps 64(65)', cycle: 'All' },
  { id: 615, season: 'Proper of Saints', day: 'Dedication of the Lateran Basilica (Nov 9)', type: 'Introit', incipit: 'Terribilis est', translation: 'Awesome is this place', source: 'Gen 28: 17', verses: 'Ps 83(84)', cycle: 'All' },
  { id: 718, season: 'Proper of Saints', day: 'St. Andrew (Nov 30)', type: 'Introit', incipit: 'Dominus secus mare', translation: 'The Lord, walking by the sea of Galilee', source: 'Matt 4: 18-19', verses: 'Ps 18(19)', cycle: 'All' },
  { id: 720, season: 'Proper of Saints', day: 'St. Andrew (Nov 30)', type: 'Communion', incipit: 'Venite post me', translation: 'Come after me, and I will make you fishers of men', source: 'Matt 4: 19-20', verses: 'Ps 118(119)', cycle: 'All' },
  { id: 333, season: 'Proper of Saints', day: 'Immaculate Conception (Dec 8)', type: 'Introit', incipit: 'Gaudens gaudebo', translation: 'I will greatly rejoice in the Lord', source: 'Is 61: 10', verses: 'Ps 29(30)', cycle: 'All' },
  { id: 334, season: 'Proper of Saints', day: 'Immaculate Conception (Dec 8)', type: 'Offertory', incipit: 'Ave Maria', translation: 'Hail Mary, full of grace', source: 'Luke 1: 28', verses: 'Luke 1: 46-55 (Magnificat)', cycle: 'All' },
  { id: 335, season: 'Proper of Saints', day: 'Immaculate Conception (Dec 8)', type: 'Communion', incipit: 'Gloriosa', translation: 'Glorious things are spoken of you, O Mary', source: 'Ps 86(87): 3', verses: 'Luke 1: 46-55 (Magnificat)', cycle: 'All' },
];
