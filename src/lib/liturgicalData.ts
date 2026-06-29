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
  // --- ADVENT ---
  { id: 1, season: 'Advent', day: '1st Sunday of Advent', type: 'Introit', incipit: 'Ad te levavi', translation: 'To you, I lift up my soul', source: 'Ps 24(25): 1-3', verses: 'Ps 24(25): 4', cycle: 'All' },
  { id: 2, season: 'Advent', day: '1st Sunday of Advent', type: 'Offertory', incipit: 'Ad te Domine levavi', translation: 'To you, O Lord, I lift up my soul', source: 'Ps 24(25): 1-3', verses: 'Ps 24(25): 5 (Dirige me)', cycle: 'All' },
  { id: 3, season: 'Advent', day: '1st Sunday of Advent', type: 'Communion', incipit: 'Dominus dabit benignitatem', translation: 'The Lord will bestow his bounty', source: 'Ps 84(85): 13', verses: 'Ps 84(85)', cycle: 'All' },
  
  { id: 4, season: 'Advent', day: '2nd Sunday of Advent', type: 'Introit', incipit: 'Populus Sion', translation: 'People of Zion, behold', source: 'Is 30: 19, 30', verses: 'Ps 79(80): 2', cycle: 'All' },
  { id: 5, season: 'Advent', day: '2nd Sunday of Advent', type: 'Offertory', incipit: 'Deus, tu convertens', translation: 'Will you not turn again, O God', source: 'Ps 84(85): 7-8', verses: 'Ps 84(85): 2-3 (Benedixisti Domine)', cycle: 'All' },
  { id: 6, season: 'Advent', day: '2nd Sunday of Advent', type: 'Communion', incipit: 'Ierusalem, surge', translation: 'Arise, O Jerusalem', source: 'Bar 5: 5; 4: 36', verses: 'Ps 147', cycle: 'All' },

  { id: 7, season: 'Advent', day: '3rd Sunday of Advent', type: 'Introit', incipit: 'Gaudete in Domino', translation: 'Rejoice in the Lord always', source: 'Phil 4: 4-5', verses: 'Ps 84(85): 2', cycle: 'All' },
  { id: 8, season: 'Advent', day: '3rd Sunday of Advent', type: 'Offertory', incipit: 'Benedixisti, Domine', translation: 'Lord, you have blessed your land', source: 'Ps 84(85): 2', verses: 'Ps 84(85): 8 (Ostende nobis)', cycle: 'All' },
  { id: 9, season: 'Advent', day: '3rd Sunday of Advent', type: 'Communion', incipit: 'Dicite: Pusillanimes', translation: 'Say to the faint of heart', source: 'Is 35: 4', verses: 'Is 35', cycle: 'All' },

  { id: 10, season: 'Advent', day: '4th Sunday of Advent', type: 'Introit', incipit: 'Rorate caeli', translation: 'Drop down dew, ye heavens', source: 'Is 45: 8', verses: 'Ps 18(19): 2', cycle: 'All' },
  { id: 11, season: 'Advent', day: '4th Sunday of Advent', type: 'Offertory', incipit: 'Ave Maria', translation: 'Hail Mary, full of grace', source: 'Luke 1: 28, 42', verses: 'Luke 1: 34-35 (Quomodo fiet istud)', cycle: 'All' },
  { id: 12, season: 'Advent', day: '4th Sunday of Advent', type: 'Communion', incipit: 'Ecce virgo', translation: 'Behold, a Virgin shall conceive', source: 'Is 7: 14', verses: 'Ps 18(19)', cycle: 'All' },

  // --- CHRISTMAS & EPIPHANY ---
  { id: 13, season: 'Christmas', day: 'Christmas (Midnight Mass)', type: 'Introit', incipit: 'Dominus dixit ad me', translation: 'The Lord said unto me', source: 'Ps 2: 7', verses: 'Ps 2: 1', cycle: 'All' },
  { id: 14, season: 'Christmas', day: 'Christmas (Midnight Mass)', type: 'Offertory', incipit: 'Laetentur caeli', translation: 'Let the heavens rejoice', source: 'Ps 95(96): 11, 13', verses: 'Ps 95(96): 1-2 (Cantate Domino)', cycle: 'All' },
  { id: 15, season: 'Christmas', day: 'Christmas (Midnight Mass)', type: 'Communion', incipit: 'In splendoribus', translation: 'In the splendor of the holy ones', source: 'Ps 109(110): 3', verses: 'Ps 109(110)', cycle: 'All' },

  { id: 16, season: 'Christmas', day: 'Christmas (Mass of the Day)', type: 'Introit', incipit: 'Puer natus est nobis', translation: 'A child is born to us', source: 'Is 9: 6', verses: 'Ps 97(98): 1', cycle: 'All' },
  { id: 17, season: 'Christmas', day: 'Christmas (Mass of the Day)', type: 'Offertory', incipit: 'Tui sunt caeli', translation: 'Yours are the heavens', source: 'Ps 88(89): 12, 15', verses: 'Ps 88(89): 1-2 (Misericordias Domini)', cycle: 'All' },
  { id: 18, season: 'Christmas', day: 'Christmas (Mass of the Day)', type: 'Communion', incipit: 'Viderunt omnes', translation: 'All the ends of the earth have seen', source: 'Ps 97(98): 3', verses: 'Ps 97(98)', cycle: 'All' },

  { id: 19, season: 'Christmas', day: 'Epiphany', type: 'Introit', incipit: 'Ecce advenit', translation: 'Behold, the Lord, the Mighty One, has come', source: 'Mal 3: 1; 1 Chr 29: 12', verses: 'Ps 71(72): 1, 10-11', cycle: 'All' },
  { id: 20, season: 'Christmas', day: 'Epiphany', type: 'Offertory', incipit: 'Reges Tharsis', translation: 'The kings of Tarshish', source: 'Ps 71(72): 10-11', verses: 'Ps 71(72): 1-2 (Deus iudicium tuum)', cycle: 'All' },
  { id: 21, season: 'Christmas', day: 'Epiphany', type: 'Communion', incipit: 'Vidimus stellam', translation: 'We have seen his star', source: 'Matt 2: 2', verses: 'Ps 71(72)', cycle: 'All' },

  // --- LENT ---
  { id: 22, season: 'Lent', day: '1st Sunday of Lent', type: 'Introit', incipit: 'Invocabit me', translation: 'He will call upon me', source: 'Ps 90(91): 15-16', verses: 'Ps 90(91): 1', cycle: 'All' },
  { id: 23, season: 'Lent', day: '1st Sunday of Lent', type: 'Offertory', incipit: 'Scapulis suis', translation: 'He will conceal you with his pinions', source: 'Ps 90(91): 4-5', verses: 'Ps 90(91): 1-2 (Qui habitat)', cycle: 'All' },
  { id: 24, season: 'Lent', day: '1st Sunday of Lent', type: 'Communion', incipit: 'Scapulis suis', translation: 'He will conceal you with his pinions', source: 'Ps 90(91): 4-5', verses: 'Ps 90(91)', cycle: 'All' },

  { id: 25, season: 'Lent', day: '2nd Sunday of Lent', type: 'Introit', incipit: 'Tibi dixit / Reminiscere', translation: 'My heart has said to you / Remember your mercies', source: 'Ps 26(27): 8-9', verses: 'Ps 26(27): 1', cycle: 'All' },
  { id: 26, season: 'Lent', day: '2nd Sunday of Lent', type: 'Offertory', incipit: 'Meditabor', translation: 'I will meditate on your commandments', source: 'Ps 118(119): 47-48', verses: 'Ps 118(119): 1-2 (Beati immaculati)', cycle: 'All' },
  { id: 27, season: 'Lent', day: '2nd Sunday of Lent', type: 'Communion', incipit: 'Visionem', translation: 'Tell the vision to no one', source: 'Matt 17: 9', verses: 'Ps 44(45)', cycle: 'All' },

  { id: 28, season: 'Lent', day: '3rd Sunday of Lent', type: 'Introit', incipit: 'Oculi mei', translation: 'My eyes are ever toward the Lord', source: 'Ps 24(25): 15-16', verses: 'Ps 24(25): 1-2', cycle: 'All' },
  { id: 29, season: 'Lent', day: '3rd Sunday of Lent', type: 'Offertory', incipit: 'Iustitiae Domini', translation: 'The precepts of the Lord are right', source: 'Ps 18(19): 9-12', verses: 'Ps 18(19): 2 (Caeli enarrant)', cycle: 'All' },
  { id: 30, season: 'Lent', day: '3rd Sunday of Lent', type: 'Communion', incipit: 'Qui biberit aquam', translation: 'Whoever drinks the water', source: 'John 4: 13-14', verses: 'Ps 5', cycle: 'A' },
  { id: 31, season: 'Lent', day: '3rd Sunday of Lent', type: 'Communion', incipit: 'Passer invenit', translation: 'The sparrow has found a house', source: 'Ps 83(84): 4-5', verses: 'Ps 83(84)', cycle: 'B' },

  { id: 32, season: 'Lent', day: '4th Sunday of Lent', type: 'Introit', incipit: 'Laetare Ierusalem', translation: 'Rejoice, O Jerusalem', source: 'Is 66: 10-11', verses: 'Ps 121(122): 1', cycle: 'All' },
  { id: 33, season: 'Lent', day: '4th Sunday of Lent', type: 'Offertory', incipit: 'Laudate Dominum', translation: 'Praise the Lord', source: 'Ps 134(135): 3, 6', verses: 'Ps 134(135): 1-2 (Laudate nomen)', cycle: 'All' },
  { id: 34, season: 'Lent', day: '4th Sunday of Lent', type: 'Communion', incipit: 'Lutum fecit', translation: 'The Lord made clay', source: 'John 9: 11, 38', verses: 'Ps 26(27)', cycle: 'A' },
  { id: 35, season: 'Lent', day: '4th Sunday of Lent', type: 'Communion', incipit: 'Ierusalem, quae aedificatur', translation: 'Jerusalem, built as a city', source: 'Ps 121(122): 3-4', verses: 'Ps 121(122)', cycle: 'B' },

  { id: 36, season: 'Lent', day: '5th Sunday of Lent', type: 'Introit', incipit: 'Iudica me, Deus', translation: 'Vindicate me, O God', source: 'Ps 42(43): 1-2', verses: 'Ps 42(43): 3', cycle: 'All' },
  { id: 37, season: 'Lent', day: '5th Sunday of Lent', type: 'Offertory', incipit: 'Confitebor tibi', translation: 'I will praise you, O Lord', source: 'Ps 118(119): 7, 10, 17, 25', verses: 'Ps 118(119): 1-2 (Beati immaculati)', cycle: 'All' },
  { id: 38, season: 'Lent', day: '5th Sunday of Lent', type: 'Communion', incipit: 'Videns Dominus', translation: 'When the Lord saw', source: 'John 11: 33, 35, 43, 44, 39', verses: 'Ps 129(130)', cycle: 'A' },
  { id: 39, season: 'Lent', day: '5th Sunday of Lent', type: 'Communion', incipit: 'Nemo te condemnavit', translation: 'Has no one condemned you?', source: 'John 8: 10-11', verses: 'Ps 31(32)', cycle: 'C' },

  // --- EASTER & PENTECOST ---
  { id: 40, season: 'Easter', day: 'Easter Sunday', type: 'Introit', incipit: 'Resurrexi', translation: 'I have risen, and I am with you still', source: 'Ps 138(139): 18, 5-6', verses: 'Ps 138(139): 1-2', cycle: 'All' },
  { id: 41, season: 'Easter', day: 'Easter Sunday', type: 'Offertory', incipit: 'Terra tremuit', translation: 'The earth trembled and was still', source: 'Ps 75(76): 9-10', verses: 'Ps 75(76): 2 (Notus in Iudaea)', cycle: 'All' },
  { id: 42, season: 'Easter', day: 'Easter Sunday', type: 'Communion', incipit: 'Pascha nostrum', translation: 'Christ our Passover has been sacrificed', source: '1 Cor 5: 7-8', verses: 'Ps 117(118)', cycle: 'All' },

  { id: 43, season: 'Easter', day: '2nd Sunday of Easter', type: 'Introit', incipit: 'Quasimodo', translation: 'Like newborn infants', source: '1 Pet 2: 2', verses: 'Ps 80(81): 2', cycle: 'All' },
  { id: 44, season: 'Easter', day: '2nd Sunday of Easter', type: 'Offertory', incipit: 'Angelus Domini', translation: 'An angel of the Lord descended', source: 'Matt 28: 2, 5-6', verses: 'Ps 117(118): 1-2 (Confitemini Domino)', cycle: 'All' },
  { id: 45, season: 'Easter', day: '2nd Sunday of Easter', type: 'Communion', incipit: 'Mitte manum tuam', translation: 'Stretch forth your hand', source: 'John 20: 27', verses: 'Ps 117(118)', cycle: 'All' },

  { id: 46, season: 'Easter', day: 'Pentecost Sunday', type: 'Introit', incipit: 'Spiritus Domini', translation: 'The Spirit of the Lord has filled the whole world', source: 'Wis 1: 7', verses: 'Ps 67(68): 2', cycle: 'All' },
  { id: 47, season: 'Easter', day: 'Pentecost Sunday', type: 'Offertory', incipit: 'Confirma hoc, Deus', translation: 'Confirm, O God, what you have wrought in us', source: 'Ps 67(68): 29-30', verses: 'Ps 67(68): 2 (Exsurgat Deus)', cycle: 'All' },
  { id: 48, season: 'Easter', day: 'Pentecost Sunday', type: 'Communion', incipit: 'Factus est repente', translation: 'Suddenly there came a sound from heaven', source: 'Acts 2: 2, 4', verses: 'Ps 67(68)', cycle: 'All' },

  // --- ORDINARY TIME (Samples matching summer) ---
  { id: 100, season: 'Ordinary Time', day: '10th Sunday in Ordinary Time', type: 'Introit', incipit: 'Dominus illuminatio mea', translation: 'The Lord is my light and my salvation', source: 'Ps 26(27): 1-2', verses: 'Ps 26(27): 3', cycle: 'All' },
  { id: 101, season: 'Ordinary Time', day: '10th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Illumina oculos meos', translation: 'Enlighten my eyes', source: 'Ps 12(13): 4-5', verses: 'Ps 12(13): 2-3 (Usquequo Domine)', cycle: 'All' },
  { id: 102, season: 'Ordinary Time', day: '10th Sunday in Ordinary Time', type: 'Communion', incipit: 'Dominus firmamentum meum', translation: 'The Lord is my rock', source: 'Ps 17(18): 3', verses: 'Ps 17(18)', cycle: 'All' },

  { id: 103, season: 'Ordinary Time', day: '11th Sunday in Ordinary Time', type: 'Introit', incipit: 'Exaudi, Domine', translation: 'Hear, O Lord, my voice', source: 'Ps 26(27): 7, 9', verses: 'Ps 26(27): 1', cycle: 'All' },
  { id: 104, season: 'Ordinary Time', day: '11th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Benedicam Dominum', translation: 'I will bless the Lord', source: 'Ps 15(16): 7-8', verses: 'Ps 15(16): 1-2 (Conserva me)', cycle: 'All' },
  { id: 105, season: 'Ordinary Time', day: '11th Sunday in Ordinary Time', type: 'Communion', incipit: 'Unam petii', translation: 'One thing I have asked of the Lord', source: 'Ps 26(27): 4', verses: 'Ps 26(27)', cycle: 'All' },

  { id: 106, season: 'Ordinary Time', day: '12th Sunday in Ordinary Time', type: 'Introit', incipit: 'Dominus fortitudo plebis suae', translation: 'The Lord is the strength of his people', source: 'Ps 27(28): 8-9', verses: 'Ps 27(28): 1', cycle: 'All' },
  { id: 107, season: 'Ordinary Time', day: '12th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Perfice gressus meos', translation: 'Perfect thou my goings in thy paths', source: 'Ps 16(17): 5, 6-7', verses: 'Ps 16(17): 1-2 (Exaudi Domine)', cycle: 'All' },
  { id: 108, season: 'Ordinary Time', day: '12th Sunday in Ordinary Time', type: 'Communion', incipit: 'Qui vult venire post me', translation: 'If any man will come after me', source: 'Matt 16: 24', verses: 'Ps 33(34)', cycle: 'All' },

  { id: 109, season: 'Ordinary Time', day: '13th Sunday in Ordinary Time', type: 'Introit', incipit: 'Omnes gentes, plaudite manibus', translation: 'O clap your hands, all ye nations', source: 'Ps 46(47): 2', verses: 'Ps 46(47): 3', cycle: 'All' },
  { id: 110, season: 'Ordinary Time', day: '13th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Sicut in holocausto', translation: 'As in holocausts of rams', source: 'Dan 3: 40', verses: 'Dan 3: 41-42 (Et nunc sequimur)', cycle: 'All' },
  { id: 111, season: 'Ordinary Time', day: '13th Sunday in Ordinary Time', type: 'Communion', incipit: 'Christus resurgens', translation: 'Christ rising again from the dead', source: 'Rom 6: 9', verses: 'Ps 95(96)', cycle: 'All' },
  
  { id: 112, season: 'Ordinary Time', day: '14th Sunday in Ordinary Time', type: 'Introit', incipit: 'Suscepimus, Deus', translation: 'We have received thy mercy, O God', source: 'Ps 47(48): 10-11', verses: 'Ps 47(48): 2', cycle: 'All' },
  { id: 113, season: 'Ordinary Time', day: '14th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Populum humilem', translation: 'Thou wilt save the afflicted people', source: 'Ps 17(18): 28, 32', verses: 'Ps 17(18): 2-3 (Diligam te)', cycle: 'All' },
  { id: 114, season: 'Ordinary Time', day: '14th Sunday in Ordinary Time', type: 'Communion', incipit: 'Gustate et videte', translation: 'O taste, and see that the Lord is sweet', source: 'Ps 33(34): 9', verses: 'Ps 33(34)', cycle: 'All' },

  // --- PROPER OF SAINTS & SOLEMNITIES ---
  { id: 200, season: 'Proper of Saints', day: 'Nativity of St. John the Baptist (Jun 24)', type: 'Introit', incipit: 'De ventre matris', translation: 'From the womb of my mother', source: 'Is 49: 1-2', verses: 'Ps 91(92): 2', cycle: 'All' },
  { id: 201, season: 'Proper of Saints', day: 'Nativity of St. John the Baptist (Jun 24)', type: 'Offertory', incipit: 'Iustus ut palma', translation: 'The just shall flourish like the palm tree', source: 'Ps 91(92): 13', verses: 'Ps 91(92): 2 (Bonum est)', cycle: 'All' },
  { id: 202, season: 'Proper of Saints', day: 'Nativity of St. John the Baptist (Jun 24)', type: 'Communion', incipit: 'Tu, puer', translation: 'You, child, will be called the prophet', source: 'Luke 1: 76', verses: 'Luke 1: 68-75 (Benedictus)', cycle: 'All' },

  { id: 203, season: 'Proper of Saints', day: 'Ss. Peter & Paul (Jun 29)', type: 'Introit', incipit: 'Nunc scio vere', translation: 'Now I know in very deed', source: 'Acts 12: 11', verses: 'Ps 138(139): 1-2', cycle: 'All' },
  { id: 204, season: 'Proper of Saints', day: 'Ss. Peter & Paul (Jun 29)', type: 'Offertory', incipit: 'Constitues eos', translation: 'You will make them princes over all the earth', source: 'Ps 44(45): 17-18', verses: 'Ps 44(45): 2 (Eructavit cor meum)', cycle: 'All' },
  { id: 205, season: 'Proper of Saints', day: 'Ss. Peter & Paul (Jun 29)', type: 'Communion', incipit: 'Tu es Petrus', translation: 'You are Peter, and upon this rock', source: 'Matt 16: 18', verses: 'Ps 88(89)', cycle: 'All' },

  { id: 206, season: 'Proper of Saints', day: 'Assumption of Mary (Aug 15)', type: 'Introit', incipit: 'Signum magnum', translation: 'A great sign appeared in heaven', source: 'Rev 12: 1', verses: 'Ps 97(98): 1', cycle: 'All' },
  { id: 207, season: 'Proper of Saints', day: 'Assumption of Mary (Aug 15)', type: 'Offertory', incipit: 'Assumpta est Maria', translation: 'Mary is taken up into heaven', source: 'Gen text / Ps 44', verses: 'Ps 44(45): 2 (Eructavit)', cycle: 'All' },
  { id: 208, season: 'Proper of Saints', day: 'Assumption of Mary (Aug 15)', type: 'Communion', incipit: 'Beatam me dicent', translation: 'All generations will call me blessed', source: 'Luke 1: 48', verses: 'Luke 1: 46-55 (Magnificat)', cycle: 'All' },

  { id: 209, season: 'Proper of Saints', day: 'All Saints (Nov 1)', type: 'Introit', incipit: 'Gaudeamus omnes', translation: 'Let us all rejoice in the Lord', source: 'Traditional', verses: 'Ps 32(33): 1', cycle: 'All' },
  { id: 210, season: 'Proper of Saints', day: 'All Saints (Nov 1)', type: 'Offertory', incipit: 'Iustorum animae', translation: 'The souls of the just are in the hand of God', source: 'Wis 3: 1-2, 3', verses: 'Wis 5: 15-16', cycle: 'All' },
  { id: 211, season: 'Proper of Saints', day: 'All Saints (Nov 1)', type: 'Communion', incipit: 'Beati mundo corde', translation: 'Blessed are the clean of heart', source: 'Matt 5: 8-10', verses: 'Ps 33(34)', cycle: 'All' },

  // --- HOLY WEEK & TRIDUUM ---
  { id: 300, season: 'Lent', day: 'Ash Wednesday', type: 'Introit', incipit: 'Misereris omnium', translation: 'You are merciful to all, O Lord', source: 'Wis 11: 24-25, 27', verses: 'Ps 56(57): 2', cycle: 'All' },
  { id: 301, season: 'Lent', day: 'Ash Wednesday', type: 'Offertory', incipit: 'Exaltabo te', translation: 'I will extol you, O Lord', source: 'Ps 29(30): 2-3', verses: 'Ps 29(30): 4 (Domine eduxisti)', cycle: 'All' },
  { id: 302, season: 'Lent', day: 'Ash Wednesday', type: 'Communion', incipit: 'Qui meditabitur', translation: 'He who ponders the law of the Lord', source: 'Ps 1: 2-3', verses: 'Ps 1', cycle: 'All' },
  
  { id: 303, season: 'Lent', day: 'Palm Sunday', type: 'Introit', incipit: 'Hosanna filio David', translation: 'Hosanna to the Son of David', source: 'Matt 21: 9', verses: 'Ps 117(118): 1', cycle: 'All' },
  { id: 304, season: 'Lent', day: 'Palm Sunday', type: 'Offertory', incipit: 'Improperium', translation: 'My heart has awaited reproach and misery', source: 'Ps 68(69): 21-22', verses: 'Ps 68(69): 2-3 (Salvum me fac)', cycle: 'All' },
  { id: 305, season: 'Lent', day: 'Palm Sunday', type: 'Communion', incipit: 'Pater, si non potest', translation: 'Father, if this chalice cannot pass', source: 'Matt 26: 42', verses: 'Ps 21(22)', cycle: 'All' },

  { id: 306, season: 'Easter', day: 'Holy Thursday', type: 'Introit', incipit: 'Nos autem gloriari', translation: 'But it behooves us to glory in the cross', source: 'Gal 6: 14', verses: 'Ps 66(67): 2', cycle: 'All' },
  { id: 307, season: 'Easter', day: 'Holy Thursday', type: 'Offertory', incipit: 'Ubi caritas et amor', translation: 'Where charity and love are, God is there', source: 'Ancient Hymn', verses: 'Congregational verses', cycle: 'All' },
  { id: 308, season: 'Easter', day: 'Holy Thursday', type: 'Communion', incipit: 'Hoc corpus', translation: 'This is my body which is given for you', source: '1 Cor 11: 24-25', verses: 'Ps 22(23)', cycle: 'All' },

  // --- SOLEMNITIES OF THE LORD ---
  { id: 309, season: 'Ordinary Time', day: 'Trinity Sunday', type: 'Introit', incipit: 'Benedicta sit', translation: 'Blessed be the Holy Trinity', source: 'Tob 12: 6', verses: 'Ps 8: 2', cycle: 'All' },
  { id: 310, season: 'Ordinary Time', day: 'Trinity Sunday', type: 'Offertory', incipit: 'Benedictus sit', translation: 'Blessed be God the Father', source: 'Tob 12: 6', verses: 'Tob 13 (Benedicite Deum)', cycle: 'All' },
  { id: 311, season: 'Ordinary Time', day: 'Trinity Sunday', type: 'Communion', incipit: 'Benedicimus Deum', translation: 'We bless the God of heaven', source: 'Tob 12: 6', verses: 'Dan 3', cycle: 'All' },

  { id: 312, season: 'Ordinary Time', day: 'Corpus Christi', type: 'Introit', incipit: 'Cibavit eos', translation: 'He fed them with the finest of wheat', source: 'Ps 80(81): 17', verses: 'Ps 80(81): 2', cycle: 'All' },
  { id: 313, season: 'Ordinary Time', day: 'Corpus Christi', type: 'Offertory', incipit: 'Sacerdotes Domini', translation: 'The priests of the Lord offer incense', source: 'Lev 21: 6', verses: 'Lev 21: 8 (Sancti erunt)', cycle: 'All' },
  { id: 314, season: 'Ordinary Time', day: 'Corpus Christi', type: 'Communion', incipit: 'Qui manducat', translation: 'He who eats my flesh and drinks my blood', source: 'John 6: 57', verses: 'Ps 118(119)', cycle: 'All' },

  { id: 315, season: 'Ordinary Time', day: 'Sacred Heart of Jesus', type: 'Introit', incipit: 'Cogitationes Cordis', translation: 'The designs of his Heart are from age to age', source: 'Ps 32(33): 11, 19', verses: 'Ps 32(33): 1', cycle: 'All' },
  { id: 316, season: 'Ordinary Time', day: 'Sacred Heart of Jesus', type: 'Offertory', incipit: 'Improperium', translation: 'My heart has awaited reproach and misery', source: 'Ps 68(69): 21-22', verses: 'Ps 68(69): 2-3 (Salvum me fac)', cycle: 'All' },
  { id: 317, season: 'Ordinary Time', day: 'Sacred Heart of Jesus', type: 'Communion', incipit: 'Unus militum', translation: 'One of the soldiers pierced his side', source: 'John 19: 34', verses: 'Ps 88(89)', cycle: 'All' },

  { id: 318, season: 'Ordinary Time', day: 'Christ the King', type: 'Introit', incipit: 'Dignus est Agnus', translation: 'Worthy is the Lamb who was slain', source: 'Rev 5: 12; 1: 6', verses: 'Ps 71(72): 1', cycle: 'All' },
  { id: 319, season: 'Ordinary Time', day: 'Christ the King', type: 'Offertory', incipit: 'Postula a me', translation: 'Ask of me, and I will give you the nations', source: 'Ps 2: 8', verses: 'Ps 2: 2-3 (Astiterunt reges)', cycle: 'All' },
  { id: 320, season: 'Ordinary Time', day: 'Christ the King', type: 'Communion', incipit: 'Sedebit Dominus', translation: 'The Lord will sit as King forever', source: 'Ps 28(29): 10-11', verses: 'Ps 28(29)', cycle: 'All' },

  // --- MORE PROPER OF SAINTS ---
  { id: 321, season: 'Proper of Saints', day: 'St. Joseph (Mar 19)', type: 'Introit', incipit: 'Iustus ut palma', translation: 'The just shall flourish like the palm tree', source: 'Ps 91(92): 13-14', verses: 'Ps 91(92): 2', cycle: 'All' },
  { id: 322, season: 'Proper of Saints', day: 'St. Joseph (Mar 19)', type: 'Offertory', incipit: 'Veritas mea', translation: 'My truth and my mercy shall be with him', source: 'Ps 88(89): 25', verses: 'Ps 88(89): 2 (Misericordias Domini)', cycle: 'All' },
  { id: 323, season: 'Proper of Saints', day: 'St. Joseph (Mar 19)', type: 'Communion', incipit: 'Ioseph fili David', translation: 'Joseph, son of David, fear not', source: 'Matt 1: 20', verses: 'Ps 111(112)', cycle: 'All' },

  { id: 324, season: 'Proper of Saints', day: 'The Annunciation (Mar 25)', type: 'Introit', incipit: 'Rorate caeli', translation: 'Drop down dew, ye heavens', source: 'Is 45: 8', verses: 'Ps 18(19): 2', cycle: 'All' },
  { id: 325, season: 'Proper of Saints', day: 'The Annunciation (Mar 25)', type: 'Offertory', incipit: 'Ave Maria', translation: 'Hail Mary, full of grace', source: 'Luke 1: 28, 42', verses: 'Luke 1: 34-35 (Quomodo fiet istud)', cycle: 'All' },
  { id: 326, season: 'Proper of Saints', day: 'The Annunciation (Mar 25)', type: 'Communion', incipit: 'Ecce virgo', translation: 'Behold, a Virgin shall conceive', source: 'Is 7: 14', verses: 'Ps 18(19)', cycle: 'All' },

  { id: 327, season: 'Proper of Saints', day: 'The Transfiguration (Aug 6)', type: 'Introit', incipit: 'Tibi dixit / In illam die', translation: 'My heart has said to you / In that day', source: 'Ps 26(27): 8-9', verses: 'Ps 26(27): 1', cycle: 'All' },
  { id: 328, season: 'Proper of Saints', day: 'The Transfiguration (Aug 6)', type: 'Offertory', incipit: 'Gloria et honore', translation: 'You have crowned him with glory and honor', source: 'Ps 8: 6-7', verses: 'Ps 8: 2-3 (Domine Dominus noster)', cycle: 'All' },
  { id: 329, season: 'Proper of Saints', day: 'The Transfiguration (Aug 6)', type: 'Communion', incipit: 'Visionem', translation: 'Tell the vision to no one', source: 'Matt 17: 9', verses: 'Ps 44(45)', cycle: 'All' },
  
  { id: 330, season: 'Proper of Saints', day: 'Exaltation of the Holy Cross (Sep 14)', type: 'Introit', incipit: 'Nos autem gloriari', translation: 'But it behooves us to glory in the cross', source: 'Gal 6: 14', verses: 'Ps 66(67): 2', cycle: 'All' },
  { id: 331, season: 'Proper of Saints', day: 'Exaltation of the Holy Cross (Sep 14)', type: 'Offertory', incipit: 'Protege Domine', translation: 'Protect your people, O Lord, by the sign of the cross', source: 'Traditional', verses: 'Ps 140(141): 1-2', cycle: 'All' },
  { id: 332, season: 'Proper of Saints', day: 'Exaltation of the Holy Cross (Sep 14)', type: 'Communion', incipit: 'Per signum crucis', translation: 'By the sign of the cross, deliver us', source: 'Traditional', verses: 'Ps 17(18)', cycle: 'All' },

  { id: 333, season: 'Proper of Saints', day: 'Immaculate Conception (Dec 8)', type: 'Introit', incipit: 'Gaudens gaudebo', translation: 'I will greatly rejoice in the Lord', source: 'Is 61: 10', verses: 'Ps 29(30): 2', cycle: 'All' },
  { id: 334, season: 'Proper of Saints', day: 'Immaculate Conception (Dec 8)', type: 'Offertory', incipit: 'Ave Maria', translation: 'Hail Mary, full of grace', source: 'Luke 1: 28', verses: 'Luke 1: 34-35 (Quomodo fiet istud)', cycle: 'All' },
  { id: 335, season: 'Proper of Saints', day: 'Immaculate Conception (Dec 8)', type: 'Communion', incipit: 'Gloriosa', translation: 'Glorious things are spoken of you, O Mary', source: 'Ps 86(87): 3', verses: 'Luke 1: 46-55 (Magnificat)', cycle: 'All' },

  // --- MORE ORDINARY TIME (Late Summer/Fall) ---
  { id: 336, season: 'Ordinary Time', day: '15th Sunday in Ordinary Time', type: 'Introit', incipit: 'Dum clamarem', translation: 'When I cried to the Lord, he heard my voice', source: 'Ps 54(55): 17, 18, 20, 23', verses: 'Ps 54(55): 2', cycle: 'All' },
  { id: 337, season: 'Ordinary Time', day: '15th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Ad te Domine levavi', translation: 'To you, O Lord, I lift up my soul', source: 'Ps 24(25): 1-3', verses: 'Ps 24(25): 5 (Dirige me)', cycle: 'All' },
  { id: 338, season: 'Ordinary Time', day: '15th Sunday in Ordinary Time', type: 'Communion', incipit: 'Passer invenit', translation: 'The sparrow has found a house', source: 'Ps 83(84): 4-5', verses: 'Ps 83(84)', cycle: 'All' },

  { id: 339, season: 'Ordinary Time', day: '16th Sunday in Ordinary Time', type: 'Introit', incipit: 'Ecce Deus adiuvat me', translation: 'Behold, God is my helper', source: 'Ps 53(54): 6-7', verses: 'Ps 53(54): 3', cycle: 'All' },
  { id: 340, season: 'Ordinary Time', day: '16th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Iustitiae Domini', translation: 'The precepts of the Lord are right', source: 'Ps 18(19): 9-12', verses: 'Ps 18(19): 2 (Caeli enarrant)', cycle: 'All' },
  { id: 341, season: 'Ordinary Time', day: '16th Sunday in Ordinary Time', type: 'Communion', incipit: 'Acceptabis', translation: 'You will accept a sacrifice of righteousness', source: 'Ps 50(51): 21', verses: 'Ps 50(51)', cycle: 'All' },

  { id: 342, season: 'Ordinary Time', day: '17th Sunday in Ordinary Time', type: 'Introit', incipit: 'Deus in loco sancto suo', translation: 'God is in his holy place', source: 'Ps 67(68): 6-7, 36', verses: 'Ps 67(68): 2', cycle: 'All' },
  { id: 343, season: 'Ordinary Time', day: '17th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Exaltabo te', translation: 'I will extol you, O Lord', source: 'Ps 29(30): 2-3', verses: 'Ps 29(30): 4 (Domine eduxisti)', cycle: 'All' },
  { id: 344, season: 'Ordinary Time', day: '17th Sunday in Ordinary Time', type: 'Communion', incipit: 'Simile est regnum', translation: 'The kingdom of heaven is like a merchant', source: 'Matt 13: 45-46', verses: 'Ps 33(34)', cycle: 'All' },

  { id: 345, season: 'Ordinary Time', day: '18th Sunday in Ordinary Time', type: 'Introit', incipit: 'Deus in adiutorium', translation: 'O God, come to my assistance', source: 'Ps 69(70): 2-3', verses: 'Ps 69(70): 4', cycle: 'All' },
  { id: 346, season: 'Ordinary Time', day: '18th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Precatus est Moyses', translation: 'Moses prayed in the presence of the Lord', source: 'Exod 32: 11, 13, 14', verses: 'Exod 32: 31-33 (Reversus est)', cycle: 'All' },
  { id: 347, season: 'Ordinary Time', day: '18th Sunday in Ordinary Time', type: 'Communion', incipit: 'Panem de caelo', translation: 'You gave them bread from heaven', source: 'Wis 16: 20', verses: 'Ps 77(78)', cycle: 'All' },

  { id: 348, season: 'Ordinary Time', day: '19th Sunday in Ordinary Time', type: 'Introit', incipit: 'Respice, Domine', translation: 'Look to your covenant, O Lord', source: 'Ps 73(74): 20, 19, 22, 23', verses: 'Ps 73(74): 1', cycle: 'All' },
  { id: 349, season: 'Ordinary Time', day: '19th Sunday in Ordinary Time', type: 'Offertory', incipit: 'In te speravi', translation: 'In you I have put my trust, O Lord', source: 'Ps 30(31): 15-16', verses: 'Ps 30(31): 17-18 (Illumina faciem)', cycle: 'All' },
  { id: 350, season: 'Ordinary Time', day: '19th Sunday in Ordinary Time', type: 'Communion', incipit: 'Panis quem ego dedero', translation: 'The bread which I will give is my flesh', source: 'John 6: 52', verses: 'Ps 110(111)', cycle: 'All' },

  { id: 351, season: 'Ordinary Time', day: '20th Sunday in Ordinary Time', type: 'Introit', incipit: 'Protector noster', translation: 'Behold, O God, our protector', source: 'Ps 83(84): 10-11', verses: 'Ps 83(84): 2-3', cycle: 'All' },
  { id: 352, season: 'Ordinary Time', day: '20th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Immittet Angelus', translation: 'The angel of the Lord encamps', source: 'Ps 33(34): 8-9', verses: 'Ps 33(34): 2-3 (Benedicam Dominum)', cycle: 'All' },
  { id: 353, season: 'Ordinary Time', day: '20th Sunday in Ordinary Time', type: 'Communion', incipit: 'Primum quaerite', translation: 'Seek first the kingdom of God', source: 'Matt 6: 33', verses: 'Ps 36(37)', cycle: 'All' },

  // --- COMPLETING THE CHRISTMAS SEASON ---
  { id: 400, season: 'Christmas', day: 'Holy Family', type: 'Introit', incipit: 'Deus in loco sancto suo', translation: 'God is in his holy place', source: 'Ps 67(68): 6-7, 36', verses: 'Ps 67(68): 2', cycle: 'All' },
  { id: 401, season: 'Christmas', day: 'Holy Family', type: 'Offertory', incipit: 'Tulerunt Iesum', translation: 'They took Jesus up to Jerusalem', source: 'Luke 2: 22', verses: 'Luke 2: 23-24 (Ut sisterent)', cycle: 'All' },
  { id: 402, season: 'Christmas', day: 'Holy Family', type: 'Communion', incipit: 'Fili, quid fecisti', translation: 'Son, why have you done this to us?', source: 'Luke 2: 48-49', verses: 'Ps 26(27)', cycle: 'All' },

  { id: 403, season: 'Christmas', day: 'Mary, Mother of God (Jan 1)', type: 'Introit', incipit: 'Salve, sancta Parens', translation: 'Hail, Holy Mother', source: 'Sedulius', verses: 'Ps 44(45): 2', cycle: 'All' },
  { id: 404, season: 'Christmas', day: 'Mary, Mother of God (Jan 1)', type: 'Offertory', incipit: 'Felix namque es', translation: 'For you are happy, O holy Virgin Mary', source: 'Traditional', verses: 'Offertoriale melisma', cycle: 'All' },
  { id: 405, season: 'Christmas', day: 'Mary, Mother of God (Jan 1)', type: 'Communion', incipit: 'Exsulta, filia Sion', translation: 'Rejoice greatly, O daughter of Zion', source: 'Zech 9: 9', verses: 'Ps 44(45)', cycle: 'All' },

  { id: 406, season: 'Christmas', day: 'Baptism of the Lord', type: 'Introit', incipit: 'Dilexisti iustitiam', translation: 'You have loved justice', source: 'Ps 44(45): 8', verses: 'Ps 44(45): 2', cycle: 'All' },
  { id: 407, season: 'Christmas', day: 'Baptism of the Lord', type: 'Offertory', incipit: 'Benedictus qui venit', translation: 'Blessed is he who comes', source: 'Ps 117(118): 26-27', verses: 'Ps 117(118): 23, 28 (A Domino factum)', cycle: 'All' },
  { id: 408, season: 'Christmas', day: 'Baptism of the Lord', type: 'Communion', incipit: 'Omnes qui in Christo', translation: 'As many of you as have been baptized', source: 'Gal 3: 27', verses: 'Ps 28(29)', cycle: 'All' },

  // --- COMPLETING THE EASTER SEASON ---
  { id: 409, season: 'Easter', day: '3rd Sunday of Easter', type: 'Introit', incipit: 'Iubilate Deo, omnis terra', translation: 'Shout with joy to God, all the earth', source: 'Ps 65(66): 1-2', verses: 'Ps 65(66): 3', cycle: 'All' },
  { id: 410, season: 'Easter', day: '3rd Sunday of Easter', type: 'Offertory', incipit: 'Lauda, anima mea', translation: 'Praise the Lord, O my soul', source: 'Ps 145(146): 2', verses: 'Ps 145(146): 7-9 (Qui custodit)', cycle: 'All' },
  { id: 411, season: 'Easter', day: '3rd Sunday of Easter', type: 'Communion', incipit: 'Surrexit Dominus', translation: 'The Lord is risen', source: 'Luke 24: 34', verses: 'Ps 117(118)', cycle: 'A' },
  { id: 412, season: 'Easter', day: '3rd Sunday of Easter', type: 'Communion', incipit: 'Cognoverunt discipuli', translation: 'The disciples recognized the Lord', source: 'Luke 24: 35', verses: 'Ps 117(118)', cycle: 'B' },
  { id: 413, season: 'Easter', day: '3rd Sunday of Easter', type: 'Communion', incipit: 'Cantate Domino', translation: 'Sing to the Lord, alleluia', source: 'Ps 95(96): 2', verses: 'Ps 95(96)', cycle: 'C' },

  { id: 414, season: 'Easter', day: '4th Sunday of Easter', type: 'Introit', incipit: 'Misericordia Domini', translation: 'The earth is full of the goodness of the Lord', source: 'Ps 32(33): 5-6', verses: 'Ps 32(33): 1', cycle: 'All' },
  { id: 415, season: 'Easter', day: '4th Sunday of Easter', type: 'Offertory', incipit: 'Deus, Deus meus', translation: 'O God, my God, to you I watch at break of day', source: 'Ps 62(63): 2, 5', verses: 'Ps 62(63): 3-4 (In invio)', cycle: 'All' },
  { id: 416, season: 'Easter', day: '4th Sunday of Easter', type: 'Communion', incipit: 'Ego sum pastor bonus', translation: 'I am the good shepherd', source: 'John 10: 14', verses: 'Ps 22(23)', cycle: 'All' },

  { id: 417, season: 'Easter', day: '5th Sunday of Easter', type: 'Introit', incipit: 'Cantate Domino', translation: 'Sing to the Lord a new song', source: 'Ps 97(98): 1-2', verses: 'Ps 97(98): 3', cycle: 'All' },
  { id: 418, season: 'Easter', day: '5th Sunday of Easter', type: 'Offertory', incipit: 'Iubilate Deo universa terra', translation: 'Shout with joy to God, all the earth', source: 'Ps 65(66): 1-2, 16', verses: 'Ps 65(66): 13-15 (Introibo)', cycle: 'All' },
  { id: 419, season: 'Easter', day: '5th Sunday of Easter', type: 'Communion', incipit: 'Tanto tempore', translation: 'Have I been so long a time with you', source: 'John 14: 9', verses: 'Ps 32(33)', cycle: 'A' },
  { id: 420, season: 'Easter', day: '5th Sunday of Easter', type: 'Communion', incipit: 'Ego sum vitis vera', translation: 'I am the true vine', source: 'John 15: 5', verses: 'Ps 79(80)', cycle: 'B' },

  { id: 421, season: 'Easter', day: '6th Sunday of Easter', type: 'Introit', incipit: 'Vocem iucunditatis', translation: 'Declare it with the voice of joy', source: 'Is 48: 20', verses: 'Ps 65(66): 1-2', cycle: 'All' },
  { id: 422, season: 'Easter', day: '6th Sunday of Easter', type: 'Offertory', incipit: 'Benedicite, gentes', translation: 'O bless our God, you peoples', source: 'Ps 65(66): 8-9, 20', verses: 'Ps 65(66): 1-2 (Iubilate Deo)', cycle: 'All' },
  { id: 423, season: 'Easter', day: '6th Sunday of Easter', type: 'Communion', incipit: 'Non vos relinquam', translation: 'I will not leave you orphans', source: 'John 14: 18', verses: 'Ps 121(122)', cycle: 'All' },

  { id: 424, season: 'Easter', day: 'Ascension of the Lord', type: 'Introit', incipit: 'Viri Galilaei', translation: 'Men of Galilee', source: 'Acts 1: 11', verses: 'Ps 46(47): 2', cycle: 'All' },
  { id: 425, season: 'Easter', day: 'Ascension of the Lord', type: 'Offertory', incipit: 'Ascendit Deus', translation: 'God has gone up with a shout', source: 'Ps 46(47): 6', verses: 'Ps 46(47): 2-3 (Omnes gentes)', cycle: 'All' },
  { id: 426, season: 'Easter', day: 'Ascension of the Lord', type: 'Communion', incipit: 'Psallite Domino', translation: 'Sing to the Lord', source: 'Ps 67(68): 33-34', verses: 'Ps 67(68)', cycle: 'All' },

  // --- LATE ORDINARY TIME (WEEKS 21-25) ---
  { id: 427, season: 'Ordinary Time', day: '21st Sunday in Ordinary Time', type: 'Introit', incipit: 'Inclina, Domine', translation: 'Bow down your ear, O Lord', source: 'Ps 85(86): 1, 2-3', verses: 'Ps 85(86): 4', cycle: 'All' },
  { id: 428, season: 'Ordinary Time', day: '21st Sunday in Ordinary Time', type: 'Offertory', incipit: 'Exspectans exspectavi', translation: 'I have waited, waited for the Lord', source: 'Ps 39(40): 2, 3, 4', verses: 'Ps 39(40): 5-6 (Beatus vir)', cycle: 'All' },
  { id: 429, season: 'Ordinary Time', day: '21st Sunday in Ordinary Time', type: 'Communion', incipit: 'De fructu operum', translation: 'The earth shall be filled with the fruit', source: 'Ps 103(104): 13, 14-15', verses: 'Ps 103(104)', cycle: 'All' },

  { id: 430, season: 'Ordinary Time', day: '22nd Sunday in Ordinary Time', type: 'Introit', incipit: 'Miserere mihi, Domine', translation: 'Have mercy on me, O Lord', source: 'Ps 85(86): 3, 5', verses: 'Ps 85(86): 1', cycle: 'All' },
  { id: 431, season: 'Ordinary Time', day: '22nd Sunday in Ordinary Time', type: 'Offertory', incipit: 'Domine, in auxilium', translation: 'O Lord, make haste to help me', source: 'Ps 39(40): 14, 15', verses: 'Ps 39(40): 16 (Avertantur)', cycle: 'All' },
  { id: 432, season: 'Ordinary Time', day: '22nd Sunday in Ordinary Time', type: 'Communion', incipit: 'Domine, memorabor', translation: 'O Lord, I will be mindful', source: 'Ps 70(71): 16-17, 18', verses: 'Ps 70(71)', cycle: 'All' },

  { id: 433, season: 'Ordinary Time', day: '23rd Sunday in Ordinary Time', type: 'Introit', incipit: 'Iustus es, Domine', translation: 'You are just, O Lord', source: 'Ps 118(119): 137, 124', verses: 'Ps 118(119): 1', cycle: 'All' },
  { id: 434, season: 'Ordinary Time', day: '23rd Sunday in Ordinary Time', type: 'Offertory', incipit: 'Oravi Deum meum', translation: 'I prayed to my God', source: 'Dan 9: 4, 17, 19', verses: 'Dan 9: 20-21 (Adhuc me loquente)', cycle: 'All' },
  { id: 435, season: 'Ordinary Time', day: '23rd Sunday in Ordinary Time', type: 'Communion', incipit: 'Vovete, et reddite', translation: 'Vow, and pay to the Lord your God', source: 'Ps 75(76): 12-13', verses: 'Ps 75(76)', cycle: 'All' },
  
  { id: 436, season: 'Ordinary Time', day: '24th Sunday in Ordinary Time', type: 'Introit', incipit: 'Da pacem, Domine', translation: 'Give peace, O Lord', source: 'Sir 36: 18', verses: 'Ps 121(122): 1', cycle: 'All' },
  { id: 437, season: 'Ordinary Time', day: '24th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Sanctificavit Moyses', translation: 'Moses consecrated an altar', source: 'Exod 32: 11, 13, 14', verses: 'Exod 32: 31-33 (Reversus est)', cycle: 'All' },
  { id: 438, season: 'Ordinary Time', day: '24th Sunday in Ordinary Time', type: 'Communion', incipit: 'Tollite hostias', translation: 'Bring up sacrifices', source: 'Ps 95(96): 8-9', verses: 'Ps 95(96)', cycle: 'All' },
  
  { id: 439, season: 'Ordinary Time', day: '25th Sunday in Ordinary Time', type: 'Introit', incipit: 'Salus populi', translation: 'I am the salvation of the people', source: 'Traditional', verses: 'Ps 77(78): 1', cycle: 'All' },
  { id: 440, season: 'Ordinary Time', day: '25th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Si ambulavero', translation: 'If I shall walk in the midst of tribulation', source: 'Ps 137(138): 7', verses: 'Ps 137(138): 1-2 (Confitebor tibi)', cycle: 'All' },
  { id: 441, season: 'Ordinary Time', day: '25th Sunday in Ordinary Time', type: 'Communion', incipit: 'Tu mandasti', translation: 'You have commanded your commandments', source: 'Ps 118(119): 4-5', verses: 'Ps 118(119)', cycle: 'All' },

  // --- LATE ORDINARY TIME (WEEKS 26-33) ---
  { id: 442, season: 'Ordinary Time', day: '26th Sunday in Ordinary Time', type: 'Introit', incipit: 'Omnia quae fecisti', translation: 'All that you have done to us', source: 'Dan 3: 31, 29, 30, 43, 42', verses: 'Ps 118(119): 1', cycle: 'All' },
  { id: 443, season: 'Ordinary Time', day: '26th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Super flumina', translation: 'By the rivers of Babylon', source: 'Ps 136(137): 1', verses: 'Ps 136(137): 2-3 (In salicibus)', cycle: 'All' },
  { id: 444, season: 'Ordinary Time', day: '26th Sunday in Ordinary Time', type: 'Communion', incipit: 'Memento verbi tui', translation: 'Remember your word to your servant', source: 'Ps 118(119): 49-50', verses: 'Ps 118(119)', cycle: 'All' },
  
  { id: 445, season: 'Ordinary Time', day: '27th Sunday in Ordinary Time', type: 'Introit', incipit: 'In voluntate tua', translation: 'All things are in your will, O Lord', source: 'Esth 13: 9, 10-11', verses: 'Ps 118(119): 1', cycle: 'All' },
  { id: 446, season: 'Ordinary Time', day: '27th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Vir erat', translation: 'There was a man in the land of Hus', source: 'Job 1: 1; 2: 7', verses: 'Job 1: 1 (Numquid considerasti)', cycle: 'All' },
  { id: 447, season: 'Ordinary Time', day: '27th Sunday in Ordinary Time', type: 'Communion', incipit: 'In salutari tuo', translation: 'My soul is in your salvation', source: 'Ps 118(119): 81, 84, 86', verses: 'Ps 118(119)', cycle: 'All' },
  
  { id: 448, season: 'Ordinary Time', day: '28th Sunday in Ordinary Time', type: 'Introit', incipit: 'Si iniquitates', translation: 'If you, O Lord, should mark iniquities', source: 'Ps 129(130): 3-4', verses: 'Ps 129(130): 1-2', cycle: 'All' },
  { id: 449, season: 'Ordinary Time', day: '28th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Recordare mei', translation: 'Remember me, O Lord', source: 'Esth 14: 12-13', verses: 'Esth 14 (Everte cor eius)', cycle: 'All' },
  { id: 450, season: 'Ordinary Time', day: '28th Sunday in Ordinary Time', type: 'Communion', incipit: 'Aufer a me', translation: 'Remove from me reproach and contempt', source: 'Ps 118(119): 22, 24', verses: 'Ps 118(119)', cycle: 'All' },
  
  { id: 451, season: 'Ordinary Time', day: '29th Sunday in Ordinary Time', type: 'Introit', incipit: 'Ego clamavi', translation: 'I have cried out, for you hear me', source: 'Ps 16(17): 6, 8', verses: 'Ps 16(17): 1', cycle: 'All' },
  { id: 452, season: 'Ordinary Time', day: '29th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Meditabor', translation: 'I will meditate on your commandments', source: 'Ps 118(119): 47-48', verses: 'Ps 118(119): 57 (Portio mea)', cycle: 'All' },
  { id: 453, season: 'Ordinary Time', day: '29th Sunday in Ordinary Time', type: 'Communion', incipit: 'Domine, Dominus noster', translation: 'O Lord, our Lord, how admirable is your name', source: 'Ps 8: 2', verses: 'Ps 8', cycle: 'All' },
  
  { id: 454, season: 'Ordinary Time', day: '30th Sunday in Ordinary Time', type: 'Introit', incipit: 'Laetetur cor', translation: 'Let the hearts of those who seek the Lord rejoice', source: 'Ps 104(105): 3-4', verses: 'Ps 104(105): 1', cycle: 'All' },
  { id: 455, season: 'Ordinary Time', day: '30th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Domine, vivifica me', translation: 'O Lord, give me life according to your word', source: 'Ps 118(119): 107, 125', verses: 'Ps 118(119): 113-114 (Iniquos odio)', cycle: 'All' },
  { id: 456, season: 'Ordinary Time', day: '30th Sunday in Ordinary Time', type: 'Communion', incipit: 'Laetabimur', translation: 'We will rejoice in your salvation', source: 'Ps 19(20): 6', verses: 'Ps 19(20)', cycle: 'All' },
  
  { id: 457, season: 'Ordinary Time', day: '31st Sunday in Ordinary Time', type: 'Introit', incipit: 'Ne derelinquas me', translation: 'Forsake me not, O Lord', source: 'Ps 37(38): 22-23', verses: 'Ps 37(38): 2', cycle: 'All' },
  { id: 458, season: 'Ordinary Time', day: '31st Sunday in Ordinary Time', type: 'Offertory', incipit: 'Benedic, anima mea', translation: 'Bless the Lord, O my soul', source: 'Ps 102(103): 2, 5', verses: 'Ps 102(103): 1 (Benedic anima)', cycle: 'All' },
  { id: 459, season: 'Ordinary Time', day: '31st Sunday in Ordinary Time', type: 'Communion', incipit: 'Notas mihi', translation: 'You have made known to me the ways of life', source: 'Ps 15(16): 11', verses: 'Ps 15(16)', cycle: 'All' },
  
  { id: 460, season: 'Ordinary Time', day: '32nd Sunday in Ordinary Time', type: 'Introit', incipit: 'Intret oratio mea', translation: 'Let my prayer come before you', source: 'Ps 87(88): 3', verses: 'Ps 87(88): 2', cycle: 'All' },
  { id: 461, season: 'Ordinary Time', day: '32nd Sunday in Ordinary Time', type: 'Offertory', incipit: 'Gressus meos', translation: 'Direct my steps according to your word', source: 'Ps 118(119): 133', verses: 'Ps 118(119): 1-2 (Beati immaculati)', cycle: 'All' },
  { id: 462, season: 'Ordinary Time', day: '32nd Sunday in Ordinary Time', type: 'Communion', incipit: 'Dominus regit me', translation: 'The Lord is my shepherd', source: 'Ps 22(23): 1-2', verses: 'Ps 22(23)', cycle: 'All' },
  
  { id: 463, season: 'Ordinary Time', day: '33rd Sunday in Ordinary Time', type: 'Introit', incipit: 'Dicit Dominus: Ego cogito', translation: 'The Lord says: I think thoughts of peace', source: 'Jer 29: 11, 12, 14', verses: 'Ps 84(85): 2', cycle: 'All' },
  { id: 464, season: 'Ordinary Time', day: '33rd Sunday in Ordinary Time', type: 'Offertory', incipit: 'De profundis', translation: 'Out of the depths I have cried to you', source: 'Ps 129(130): 1-2', verses: 'Ps 129(130): 3 (Si iniquitates)', cycle: 'All' },
  { id: 465, season: 'Ordinary Time', day: '33rd Sunday in Ordinary Time', type: 'Communion', incipit: 'Amen dico vobis', translation: 'Amen I say to you, whatever you ask', source: 'Mark 11: 24', verses: 'Ps 60(61)', cycle: 'All' },

  // --- EARLY ORDINARY TIME (WEEKS 2-9) ---
  { id: 500, season: 'Ordinary Time', day: '2nd Sunday in Ordinary Time', type: 'Introit', incipit: 'Omnis terra', translation: 'Let all the earth worship you, O God', source: 'Ps 65(66): 4', verses: 'Ps 65(66): 1-2', cycle: 'All' },
  { id: 501, season: 'Ordinary Time', day: '2nd Sunday in Ordinary Time', type: 'Offertory', incipit: 'Iubilate Deo', translation: 'Shout with joy to God, all the earth', source: 'Ps 65(66): 1-2, 16', verses: 'Ps 65(66): 13-15 (Introibo)', cycle: 'All' },
  { id: 502, season: 'Ordinary Time', day: '2nd Sunday in Ordinary Time', type: 'Communion', incipit: 'Dicit Andreas', translation: 'Andrew says to his brother Simon', source: 'John 1: 41-42', verses: 'Ps 33(34)', cycle: 'A' },
  { id: 503, season: 'Ordinary Time', day: '2nd Sunday in Ordinary Time', type: 'Communion', incipit: 'Laetabimur', translation: 'We will rejoice in your salvation', source: 'Ps 19(20): 6', verses: 'Ps 19(20)', cycle: 'All' },

  { id: 504, season: 'Ordinary Time', day: '3rd Sunday in Ordinary Time', type: 'Introit', incipit: 'Dominus secus mare', translation: 'The Lord, walking by the sea of Galilee', source: 'Matt 4: 18-19', verses: 'Ps 18(19): 2', cycle: 'All' },
  { id: 505, season: 'Ordinary Time', day: '3rd Sunday in Ordinary Time', type: 'Offertory', incipit: 'Dextera Domini', translation: 'The right hand of the Lord has struck with power', source: 'Ps 117(118): 16-17', verses: 'Ps 117(118): 5-6 (De tribulatione)', cycle: 'All' },
  { id: 506, season: 'Ordinary Time', day: '3rd Sunday in Ordinary Time', type: 'Communion', incipit: 'Venite post me', translation: 'Come after me, and I will make you fishers of men', source: 'Matt 4: 19-20', verses: 'Ps 118(119)', cycle: 'All' },

  { id: 507, season: 'Ordinary Time', day: '4th Sunday in Ordinary Time', type: 'Introit', incipit: 'Laetetur cor', translation: 'Let the hearts of those who seek the Lord rejoice', source: 'Ps 104(105): 3-4', verses: 'Ps 104(105): 1', cycle: 'All' },
  { id: 508, season: 'Ordinary Time', day: '4th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Bonum est confiteri', translation: 'It is good to give praise to the Lord', source: 'Ps 91(92): 2', verses: 'Ps 91(92): 3 (Ad annuntiandum)', cycle: 'All' },
  { id: 509, season: 'Ordinary Time', day: '4th Sunday in Ordinary Time', type: 'Communion', incipit: 'Beati mundo corde', translation: 'Blessed are the clean of heart', source: 'Matt 5: 8-10', verses: 'Ps 33(34)', cycle: 'A' },
  { id: 510, season: 'Ordinary Time', day: '4th Sunday in Ordinary Time', type: 'Communion', incipit: 'Illumina faciem tuam', translation: 'Make your face to shine upon your servant', source: 'Ps 30(31): 17-18', verses: 'Ps 30(31)', cycle: 'All' },

  { id: 511, season: 'Ordinary Time', day: '5th Sunday in Ordinary Time', type: 'Introit', incipit: 'Venite, adoremus', translation: 'O come, let us worship and bow down', source: 'Ps 94(95): 6-7', verses: 'Ps 94(95): 1', cycle: 'All' },
  { id: 512, season: 'Ordinary Time', day: '5th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Perfice gressus meos', translation: 'Perfect my goings in your paths', source: 'Ps 16(17): 5, 6-7', verses: 'Ps 16(17): 1-2 (Exaudi Domine)', cycle: 'All' },
  { id: 513, season: 'Ordinary Time', day: '5th Sunday in Ordinary Time', type: 'Communion', incipit: 'Introibo', translation: 'I will go in to the altar of God', source: 'Ps 42(43): 4', verses: 'Ps 42(43)', cycle: 'All' },

  { id: 514, season: 'Ordinary Time', day: '6th Sunday in Ordinary Time', type: 'Introit', incipit: 'Esto mihi', translation: 'Be my rock of refuge', source: 'Ps 30(31): 3-4', verses: 'Ps 30(31): 2', cycle: 'All' },
  { id: 515, season: 'Ordinary Time', day: '6th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Benedictus es, Domine', translation: 'Blessed are you, O Lord', source: 'Ps 118(119): 12, 13', verses: 'Ps 118(119): 1-2 (Beati immaculati)', cycle: 'All' },
  { id: 516, season: 'Ordinary Time', day: '6th Sunday in Ordinary Time', type: 'Communion', incipit: 'Manducaverunt', translation: 'They ate and were fully satisfied', source: 'Ps 77(78): 29-30', verses: 'Ps 77(78)', cycle: 'All' },

  { id: 517, season: 'Ordinary Time', day: '7th Sunday in Ordinary Time', type: 'Introit', incipit: 'Domine, in tua misericordia', translation: 'O Lord, I have trusted in your mercy', source: 'Ps 12(13): 6', verses: 'Ps 12(13): 1', cycle: 'All' },
  { id: 518, season: 'Ordinary Time', day: '7th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Intende voci', translation: 'Hearken to the voice of my prayer', source: 'Ps 5: 3-4', verses: 'Ps 5: 2 (Verba mea)', cycle: 'All' },
  { id: 519, season: 'Ordinary Time', day: '7th Sunday in Ordinary Time', type: 'Communion', incipit: 'Narrabo omnia', translation: 'I will declare all your wondrous deeds', source: 'Ps 9: 2-3', verses: 'Ps 9', cycle: 'All' },

  { id: 520, season: 'Ordinary Time', day: '8th Sunday in Ordinary Time', type: 'Introit', incipit: 'Factus est Dominus', translation: 'The Lord became my protector', source: 'Ps 17(18): 19-20', verses: 'Ps 17(18): 2-3', cycle: 'All' },
  { id: 521, season: 'Ordinary Time', day: '8th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Domine, convertere', translation: 'Turn to me, O Lord, and deliver my soul', source: 'Ps 6: 5', verses: 'Ps 6: 2-3 (Domine ne in furore)', cycle: 'All' },
  { id: 522, season: 'Ordinary Time', day: '8th Sunday in Ordinary Time', type: 'Communion', incipit: 'Cantabo Domino', translation: 'I will sing to the Lord', source: 'Ps 12(13): 6', verses: 'Ps 12(13)', cycle: 'All' },

  { id: 523, season: 'Ordinary Time', day: '9th Sunday in Ordinary Time', type: 'Introit', incipit: 'Respice in me', translation: 'Look upon me, and have mercy on me', source: 'Ps 24(25): 16, 18', verses: 'Ps 24(25): 1-2', cycle: 'All' },
  { id: 524, season: 'Ordinary Time', day: '9th Sunday in Ordinary Time', type: 'Offertory', incipit: 'Sperent in te', translation: 'Let them trust in you who know your name', source: 'Ps 9: 11-12, 13', verses: 'Ps 9: 2-3 (Confitebor tibi)', cycle: 'All' },
  { id: 525, season: 'Ordinary Time', day: '9th Sunday in Ordinary Time', type: 'Communion', incipit: 'Ego clamavi', translation: 'I have cried out, for you hear me', source: 'Ps 16(17): 6', verses: 'Ps 16(17)', cycle: 'All' },

  // --- MISSING EASTER & CHRISTMAS MASSES ---
  { id: 600, season: 'Easter', day: '7th Sunday of Easter', type: 'Introit', incipit: 'Exaudi, Domine', translation: 'Hear, O Lord, my voice', source: 'Ps 26(27): 7, 8, 9', verses: 'Ps 26(27): 1', cycle: 'All' },
  { id: 601, season: 'Easter', day: '7th Sunday of Easter', type: 'Offertory', incipit: 'Ascendit Deus', translation: 'God has gone up with a shout', source: 'Ps 46(47): 6', verses: 'Ps 46(47): 2-3 (Omnes gentes)', cycle: 'All' },
  { id: 602, season: 'Easter', day: '7th Sunday of Easter', type: 'Communion', incipit: 'Pater, cum essem', translation: 'Father, while I was with them', source: 'John 17: 12, 13, 15', verses: 'Ps 121(122)', cycle: 'All' },

  { id: 603, season: 'Christmas', day: 'Christmas (Vigil Mass)', type: 'Introit', incipit: 'Hodie scietis', translation: 'Today you will know that the Lord will come', source: 'Exod 16: 6, 7', verses: 'Ps 23(24): 1', cycle: 'All' },
  { id: 604, season: 'Christmas', day: 'Christmas (Vigil Mass)', type: 'Offertory', incipit: 'Tollite portas', translation: 'Lift up your gates, O ye princes', source: 'Ps 23(24): 7, 9', verses: 'Ps 23(24): 1-2 (Domini est terra)', cycle: 'All' },
  { id: 605, season: 'Christmas', day: 'Christmas (Vigil Mass)', type: 'Communion', incipit: 'Revelabitur gloria', translation: 'The glory of the Lord shall be revealed', source: 'Is 40: 5', verses: 'Ps 23(24)', cycle: 'All' },

  { id: 606, season: 'Christmas', day: 'Christmas (Mass at Dawn)', type: 'Introit', incipit: 'Lux fulgebit', translation: 'A light shall shine upon us this day', source: 'Is 9: 2, 6', verses: 'Ps 92(93): 1', cycle: 'All' },
  { id: 607, season: 'Christmas', day: 'Christmas (Mass at Dawn)', type: 'Offertory', incipit: 'Deus enim firmavit', translation: 'For God has established the world', source: 'Ps 92(93): 1-2', verses: 'Ps 92(93): 3 (Elevaverunt flumina)', cycle: 'All' },
  { id: 608, season: 'Christmas', day: 'Christmas (Mass at Dawn)', type: 'Communion', incipit: 'Exsulta, filia Sion', translation: 'Rejoice greatly, O daughter of Zion', source: 'Zech 9: 9', verses: 'Ps 33(34)', cycle: 'All' },

  // --- ADDITIONAL SOLEMNITIES & FEASTS ---
  { id: 609, season: 'Proper of Saints', day: 'Presentation of the Lord (Feb 2)', type: 'Introit', incipit: 'Suscepimus, Deus', translation: 'We have received thy mercy, O God', source: 'Ps 47(48): 10-11', verses: 'Ps 47(48): 2', cycle: 'All' },
  { id: 610, season: 'Proper of Saints', day: 'Presentation of the Lord (Feb 2)', type: 'Offertory', incipit: 'Diffusa est gratia', translation: 'Grace is poured out on your lips', source: 'Ps 44(45): 3', verses: 'Ps 44(45): 5 (Specie tua)', cycle: 'All' },
  { id: 611, season: 'Proper of Saints', day: 'Presentation of the Lord (Feb 2)', type: 'Communion', incipit: 'Responsum accepit Simeon', translation: 'Simeon received an answer from the Holy Spirit', source: 'Luke 2: 26', verses: 'Ps 47(48)', cycle: 'All' },

  { id: 612, season: 'Proper of Saints', day: 'All Souls (Nov 2)', type: 'Introit', incipit: 'Requiem aeternam', translation: 'Eternal rest grant unto them, O Lord', source: '4 Esdras 2: 34, 35', verses: 'Ps 64(65): 2-3', cycle: 'All' },
  { id: 613, season: 'Proper of Saints', day: 'All Souls (Nov 2)', type: 'Offertory', incipit: 'Domine Iesu Christe', translation: 'Lord Jesus Christ, King of glory', source: 'Traditional', verses: 'Hostias et preces tibi (Traditional)', cycle: 'All' },
  { id: 614, season: 'Proper of Saints', day: 'All Souls (Nov 2)', type: 'Communion', incipit: 'Lux aeterna', translation: 'May light eternal shine upon them', source: '4 Esdras 2: 35', verses: 'Ps 129(130)', cycle: 'All' },

  { id: 615, season: 'Proper of Saints', day: 'Dedication of the Lateran Basilica (Nov 9)', type: 'Introit', incipit: 'Terribilis est', translation: 'Awesome is this place', source: 'Gen 28: 17', verses: 'Ps 83(84): 2-3', cycle: 'All' },
  { id: 616, season: 'Proper of Saints', day: 'Dedication of the Lateran Basilica (Nov 9)', type: 'Offertory', incipit: 'Domine Deus, in simplicitate', translation: 'O Lord God, in the simplicity of my heart', source: '1 Chr 29: 17, 18', verses: '1 Chr 29 (O Domine)', cycle: 'All' },
  { id: 617, season: 'Proper of Saints', day: 'Dedication of the Lateran Basilica (Nov 9)', type: 'Communion', incipit: 'Ierusalem, quae aedificatur', translation: 'Jerusalem, built as a city', source: 'Ps 121(122): 3-4', verses: 'Ps 121(122)', cycle: 'All' },

  // --- ADDITIONAL MISSING PROPERS (With Chant Indices) ---
  { id: 618, season: 'Proper of Saints', day: 'Nativity of Mary (Sep 8)', type: 'Introit', incipit: 'Salve, sancta Parens', translation: 'Hail, Holy Mother', source: 'Sedulius', verses: 'Ps 44(45): 2', cycle: 'All', chantIndex: 'GR 403' },
  { id: 619, season: 'Proper of Saints', day: 'Nativity of Mary (Sep 8)', type: 'Offertory', incipit: 'Beata es, Virgo Maria', translation: 'Blessed are you, O Virgin Mary', source: 'Traditional', verses: 'Luke 1: 28 (Ave Maria)', cycle: 'All', chantIndex: 'GR 412' },
  { id: 620, season: 'Proper of Saints', day: 'Nativity of Mary (Sep 8)', type: 'Communion', incipit: 'Beata viscera', translation: 'Blessed is the womb of the Virgin Mary', source: 'Traditional', verses: 'Ps 44(45)', cycle: 'All', chantIndex: 'GR 414' },

  { id: 621, season: 'Proper of Saints', day: 'St. Michael the Archangel (Sep 29)', type: 'Introit', incipit: 'Benedicite Dominum', translation: 'Bless the Lord, all you his angels', source: 'Ps 102(103): 20', verses: 'Ps 102(103): 1', cycle: 'All', chantIndex: 'GR 607' },
  { id: 622, season: 'Proper of Saints', day: 'St. Michael the Archangel (Sep 29)', type: 'Offertory', incipit: 'Stetit Angelus', translation: 'An angel stood near the altar of the temple', source: 'Rev 8: 3, 4', verses: 'Rev 8: 4 (In conspectu)', cycle: 'All', chantIndex: 'GR 610' },
  { id: 623, season: 'Proper of Saints', day: 'St. Michael the Archangel (Sep 29)', type: 'Communion', incipit: 'Benedicite, omnes angeli', translation: 'Bless the Lord, all you angels of the Lord', source: 'Dan 3: 58', verses: 'Dan 3', cycle: 'All', chantIndex: 'GR 611' },

  // --- APOSTLES, CHRISTMAS OCTAVE & ADDITIONAL FEASTS ---
  { id: 700, season: 'Christmas', day: 'St. Stephen (Dec 26)', type: 'Introit', incipit: 'Sederunt principes', translation: 'Princes sat and spoke against me', source: 'Ps 118(119): 23, 86', verses: 'Ps 118(119): 1', cycle: 'All', chantIndex: 'GR 41' },
  { id: 701, season: 'Christmas', day: 'St. Stephen (Dec 26)', type: 'Offertory', incipit: 'Elegerunt Apostoli', translation: 'The Apostles chose Stephen', source: 'Acts 6: 5', verses: 'Acts 6', cycle: 'All', chantIndex: 'GR 43' },
  { id: 702, season: 'Christmas', day: 'St. Stephen (Dec 26)', type: 'Communion', incipit: 'Video caelos', translation: 'I see the heavens opened', source: 'Acts 7: 56', verses: 'Ps 118(119)', cycle: 'All', chantIndex: 'GR 43' },

  { id: 703, season: 'Christmas', day: 'St. John the Apostle (Dec 27)', type: 'Introit', incipit: 'In medio Ecclesiae', translation: 'In the midst of the Church', source: 'Sir 15: 5', verses: 'Ps 91(92): 2', cycle: 'All', chantIndex: 'GR 472' },
  { id: 704, season: 'Christmas', day: 'St. John the Apostle (Dec 27)', type: 'Offertory', incipit: 'Iustus ut palma', translation: 'The just shall flourish like the palm tree', source: 'Ps 91(92): 13', verses: 'Ps 91(92): 2 (Bonum est)', cycle: 'All', chantIndex: 'GR 508' },
  { id: 705, season: 'Christmas', day: 'St. John the Apostle (Dec 27)', type: 'Communion', incipit: 'Exiit sermo', translation: 'This saying therefore went abroad', source: 'John 21: 23', verses: 'Ps 18(19)', cycle: 'All', chantIndex: 'GR 45' },

  { id: 706, season: 'Christmas', day: 'Holy Innocents (Dec 28)', type: 'Introit', incipit: 'Ex ore infantium', translation: 'Out of the mouths of infants', source: 'Ps 8: 2', verses: 'Ps 8: 2b', cycle: 'All', chantIndex: 'GR 427' },
  { id: 707, season: 'Christmas', day: 'Holy Innocents (Dec 28)', type: 'Offertory', incipit: 'Anima nostra', translation: 'Our soul has been delivered', source: 'Ps 123(124): 7', verses: 'Ps 123(124): 1-2 (Nisi quia Dominus)', cycle: 'All', chantIndex: 'GR 47' },
  { id: 708, season: 'Christmas', day: 'Holy Innocents (Dec 28)', type: 'Communion', incipit: 'Vox in Rama', translation: 'A voice was heard in Ramah', source: 'Matt 2: 18', verses: 'Ps 79(80)', cycle: 'All', chantIndex: 'GR 47' },

  { id: 709, season: 'Proper of Saints', day: 'Chair of St. Peter (Feb 22)', type: 'Introit', incipit: 'Statuit ei', translation: 'The Lord made a covenant of peace', source: 'Sir 45: 30', verses: 'Ps 131(132): 1', cycle: 'All', chantIndex: 'GR 444' },
  { id: 710, season: 'Proper of Saints', day: 'Chair of St. Peter (Feb 22)', type: 'Offertory', incipit: 'Tu es Petrus', translation: 'You are Peter, and upon this rock', source: 'Matt 16: 18', verses: 'Matt 16', cycle: 'All', chantIndex: 'GR 578' },
  { id: 711, season: 'Proper of Saints', day: 'Chair of St. Peter (Feb 22)', type: 'Communion', incipit: 'Tu es Petrus', translation: 'You are Peter, and upon this rock', source: 'Matt 16: 18', verses: 'Ps 88(89)', cycle: 'All', chantIndex: 'GR 580' },

  { id: 712, season: 'Proper of Saints', day: 'St. Mary Magdalene (Jul 22)', type: 'Introit', incipit: 'Me exspectaverunt', translation: 'The wicked have waited for me', source: 'Ps 118(119): 95-96', verses: 'Ps 118(119): 1', cycle: 'All', chantIndex: 'GR 521' },
  { id: 713, season: 'Proper of Saints', day: 'St. Mary Magdalene (Jul 22)', type: 'Offertory', incipit: 'Angelus Domini', translation: 'An angel of the Lord descended', source: 'Matt 28: 2, 5-6', verses: 'Ps 117(118): 1-2', cycle: 'All', chantIndex: 'GR 197' },
  { id: 714, season: 'Proper of Saints', day: 'St. Mary Magdalene (Jul 22)', type: 'Communion', incipit: 'Notas mihi', translation: 'You have made known to me the ways of life', source: 'Ps 15(16): 11', verses: 'Ps 15(16)', cycle: 'All', chantIndex: 'GR 362' },

  { id: 715, season: 'Proper of Saints', day: 'St. Lawrence (Aug 10)', type: 'Introit', incipit: 'Confessio et pulchritudo', translation: 'Praise and beauty are before him', source: 'Ps 95(96): 6', verses: 'Ps 95(96): 1', cycle: 'All', chantIndex: 'GR 584' },
  { id: 716, season: 'Proper of Saints', day: 'St. Lawrence (Aug 10)', type: 'Offertory', incipit: 'Oratio mea pura', translation: 'My prayer is pure', source: 'Job 16: 18; 34: 28', verses: 'Job 16', cycle: 'All', chantIndex: 'GR 585' },
  { id: 717, season: 'Proper of Saints', day: 'St. Lawrence (Aug 10)', type: 'Communion', incipit: 'Qui mihi ministrat', translation: 'If anyone serves me, let him follow me', source: 'John 12: 26', verses: 'Ps 16(17)', cycle: 'All', chantIndex: 'GR 484' },

  { id: 718, season: 'Proper of Saints', day: 'St. Andrew (Nov 30)', type: 'Introit', incipit: 'Dominus secus mare', translation: 'The Lord, walking by the sea of Galilee', source: 'Matt 4: 18-19', verses: 'Ps 18(19): 2', cycle: 'All', chantIndex: 'GR 264' },
  { id: 719, season: 'Proper of Saints', day: 'St. Andrew (Nov 30)', type: 'Offertory', incipit: 'Mihi autem nimis', translation: 'To me, your friends, O God, are very honorable', source: 'Ps 138(139): 17', verses: 'Ps 138(139): 1-2 (Domine probasti)', cycle: 'All', chantIndex: 'GR 428' },
  { id: 720, season: 'Proper of Saints', day: 'St. Andrew (Nov 30)', type: 'Communion', incipit: 'Venite post me', translation: 'Come after me, and I will make you fishers of men', source: 'Matt 4: 19-20', verses: 'Ps 118(119)', cycle: 'All', chantIndex: 'GR 267' },

  { id: 721, season: 'Proper of Saints', day: 'St. Thomas the Apostle (Jul 3)', type: 'Introit', incipit: 'Mihi autem nimis', translation: 'To me, your friends, O God, are very honorable', source: 'Ps 138(139): 17', verses: 'Ps 138(139): 1-2', cycle: 'All', chantIndex: 'GR 428' },
  { id: 722, season: 'Proper of Saints', day: 'St. Thomas the Apostle (Jul 3)', type: 'Offertory', incipit: 'Mirabilis Deus', translation: 'God is wonderful in his saints', source: 'Ps 67(68): 36', verses: 'Ps 67(68): 27', cycle: 'All', chantIndex: 'GR 432' },
  { id: 723, season: 'Proper of Saints', day: 'St. Thomas the Apostle (Jul 3)', type: 'Communion', incipit: 'Mitte manum tuam', translation: 'Stretch forth your hand', source: 'John 20: 27', verses: 'Ps 117(118)', cycle: 'All', chantIndex: 'GR 200' },

  { id: 724, season: 'Proper of Saints', day: 'St. James the Apostle (Jul 25)', type: 'Introit', incipit: 'Mihi autem nimis', translation: 'To me, your friends, O God, are very honorable', source: 'Ps 138(139): 17', verses: 'Ps 138(139): 1-2', cycle: 'All', chantIndex: 'GR 428' },
  { id: 725, season: 'Proper of Saints', day: 'St. James the Apostle (Jul 25)', type: 'Offertory', incipit: 'In omnem terram', translation: 'Their sound has gone forth into all the earth', source: 'Ps 18(19): 5', verses: 'Ps 18(19): 2 (Caeli enarrant)', cycle: 'All', chantIndex: 'GR 431' },
  { id: 726, season: 'Proper of Saints', day: 'St. James the Apostle (Jul 25)', type: 'Communion', incipit: 'Calicem salutaris', translation: 'I will take the chalice of salvation', source: 'Ps 115(116): 13', verses: 'Ps 115(116)', cycle: 'All', chantIndex: 'GR 435' },

  { id: 727, season: 'Proper of Saints', day: 'St. Bartholomew the Apostle (Aug 24)', type: 'Introit', incipit: 'Mihi autem nimis', translation: 'To me, your friends, O God, are very honorable', source: 'Ps 138(139): 17', verses: 'Ps 138(139): 1-2', cycle: 'All', chantIndex: 'GR 428' },
  { id: 728, season: 'Proper of Saints', day: 'St. Bartholomew the Apostle (Aug 24)', type: 'Offertory', incipit: 'Mihi autem nimis', translation: 'To me, your friends, O God, are very honorable', source: 'Ps 138(139): 17', verses: 'Ps 138(139): 1-2 (Domine probasti)', cycle: 'All', chantIndex: 'GR 428' },
  { id: 729, season: 'Proper of Saints', day: 'St. Bartholomew the Apostle (Aug 24)', type: 'Communion', incipit: 'Vos qui secuti', translation: 'You who have followed me will sit on thrones', source: 'Matt 19: 28', verses: 'Ps 138(139)', cycle: 'All', chantIndex: 'GR 438' },

  { id: 730, season: 'Proper of Saints', day: 'St. Matthew the Apostle (Sep 21)', type: 'Introit', incipit: 'Os iusti', translation: 'The mouth of the just utters wisdom', source: 'Ps 36(37): 30-31', verses: 'Ps 36(37): 1', cycle: 'All', chantIndex: 'GR 494' },
  { id: 731, season: 'Proper of Saints', day: 'St. Matthew the Apostle (Sep 21)', type: 'Offertory', incipit: 'Posuisti Domine', translation: 'You have placed on his head, O Lord', source: 'Ps 20(21): 4, 5', verses: 'Ps 20(21): 2 (Domine in virtute)', cycle: 'All', chantIndex: 'GR 479' },
  { id: 732, season: 'Proper of Saints', day: 'St. Matthew the Apostle (Sep 21)', type: 'Communion', incipit: 'Magna est gloria', translation: 'His glory is great in your salvation', source: 'Ps 20(21): 6', verses: 'Ps 20(21)', cycle: 'All', chantIndex: 'GR 481' },

  { id: 733, season: 'Proper of Saints', day: 'Ss. Simon & Jude (Oct 28)', type: 'Introit', incipit: 'Iudicant sancti', translation: 'The saints judge nations', source: 'Wis 3: 8', verses: 'Ps 32(33): 1', cycle: 'All', chantIndex: 'GR 429' },
  { id: 734, season: 'Proper of Saints', day: 'Ss. Simon & Jude (Oct 28)', type: 'Offertory', incipit: 'In omnem terram', translation: 'Their sound has gone forth into all the earth', source: 'Ps 18(19): 5', verses: 'Ps 18(19): 2 (Caeli enarrant)', cycle: 'All', chantIndex: 'GR 431' },
  { id: 735, season: 'Proper of Saints', day: 'Ss. Simon & Jude (Oct 28)', type: 'Communion', incipit: 'Vos qui secuti', translation: 'You who have followed me will sit on thrones', source: 'Matt 19: 28', verses: 'Ps 138(139)', cycle: 'All', chantIndex: 'GR 438' },

  { id: 736, season: 'Proper of Saints', day: 'Visitation of Mary (May 31)', type: 'Introit', incipit: 'Gaudeamus omnes', translation: 'Let us all rejoice in the Lord', source: 'Traditional', verses: 'Ps 44(45): 2', cycle: 'All', chantIndex: 'GR 405' },
  { id: 737, season: 'Proper of Saints', day: 'Visitation of Mary (May 31)', type: 'Offertory', incipit: 'Beata es, Virgo Maria', translation: 'Blessed are you, O Virgin Mary', source: 'Traditional', verses: 'Luke 1: 28 (Ave Maria)', cycle: 'All', chantIndex: 'GR 412' },
  { id: 738, season: 'Proper of Saints', day: 'Visitation of Mary (May 31)', type: 'Communion', incipit: 'Beatam me dicent', translation: 'All generations will call me blessed', source: 'Luke 1: 48', verses: 'Luke 1: 46-55 (Magnificat)', cycle: 'All', chantIndex: 'GR 592' },

  // --- REMAINING APOSTLES, EVANGELISTS & MAJOR FEASTS ---
  { id: 800, season: 'Proper of Saints', day: 'Conversion of St. Paul (Jan 25)', type: 'Introit', incipit: 'Scio cui credidi', translation: 'I know whom I have believed', source: '2 Tim 1: 12', verses: 'Ps 138(139): 1-2', cycle: 'All', chantIndex: 'GR 535' },
  { id: 801, season: 'Proper of Saints', day: 'Conversion of St. Paul (Jan 25)', type: 'Offertory', incipit: 'Mihi autem nimis', translation: 'To me, your friends, O God, are very honorable', source: 'Ps 138(139): 17', verses: 'Ps 138(139): 1-2', cycle: 'All', chantIndex: 'GR 428' },
  { id: 802, season: 'Proper of Saints', day: 'Conversion of St. Paul (Jan 25)', type: 'Communion', incipit: 'Amen dico vobis', translation: 'Amen I say to you, whatever you ask', source: 'Matt 19: 28', verses: 'Ps 138(139)', cycle: 'All', chantIndex: 'GR 436' },

  { id: 803, season: 'Proper of Saints', day: 'St. Mark the Evangelist (Apr 25)', type: 'Introit', incipit: 'Accipite iucunditatem', translation: 'Receive the joy of your glory', source: '4 Esdras 2: 36-37', verses: 'Ps 77(78): 1', cycle: 'All', chantIndex: 'GR 242' },
  { id: 804, season: 'Proper of Saints', day: 'St. Mark the Evangelist (Apr 25)', type: 'Offertory', incipit: 'Confitebuntur caeli', translation: 'The heavens shall confess your wonders', source: 'Ps 88(89): 6', verses: 'Ps 88(89): 2 (Misericordias)', cycle: 'All', chantIndex: 'GR 430' },
  { id: 805, season: 'Proper of Saints', day: 'St. Mark the Evangelist (Apr 25)', type: 'Communion', incipit: 'Laetabitur iustus', translation: 'The just shall rejoice in the Lord', source: 'Ps 63(64): 11', verses: 'Ps 63(64)', cycle: 'All', chantIndex: 'GR 442' },

  { id: 806, season: 'Proper of Saints', day: 'Ss. Philip & James (May 3)', type: 'Introit', incipit: 'Exclamaberunt ad te', translation: 'In the time of their tribulation they cried to you', source: 'Neh 9: 27', verses: 'Ps 32(33): 1', cycle: 'All', chantIndex: 'GR 425' },
  { id: 807, season: 'Proper of Saints', day: 'Ss. Philip & James (May 3)', type: 'Offertory', incipit: 'Confitebuntur caeli', translation: 'The heavens shall confess your wonders', source: 'Ps 88(89): 6', verses: 'Ps 88(89): 2 (Misericordias)', cycle: 'All', chantIndex: 'GR 430' },
  { id: 808, season: 'Proper of Saints', day: 'Ss. Philip & James (May 3)', type: 'Communion', incipit: 'Tanto tempore', translation: 'Have I been so long a time with you', source: 'John 14: 9', verses: 'Ps 32(33)', cycle: 'All', chantIndex: 'GR 553' },

  { id: 809, season: 'Proper of Saints', day: 'St. Matthias the Apostle (May 14)', type: 'Introit', incipit: 'Vocem iucunditatis', translation: 'Declare it with the voice of joy', source: 'Is 48: 20', verses: 'Ps 65(66): 1-2', cycle: 'All', chantIndex: 'GR 229' },
  { id: 810, season: 'Proper of Saints', day: 'St. Matthias the Apostle (May 14)', type: 'Offertory', incipit: 'In omnem terram', translation: 'Their sound has gone forth into all the earth', source: 'Ps 18(19): 5', verses: 'Ps 18(19): 2 (Caeli enarrant)', cycle: 'All', chantIndex: 'GR 431' },
  { id: 811, season: 'Proper of Saints', day: 'St. Matthias the Apostle (May 14)', type: 'Communion', incipit: 'Vos qui secuti', translation: 'You who have followed me will sit on thrones', source: 'Matt 19: 28', verses: 'Ps 138(139)', cycle: 'All', chantIndex: 'GR 438' },

  { id: 812, season: 'Proper of Saints', day: 'Our Lady of Sorrows (Sep 15)', type: 'Introit', incipit: 'Stabant iuxta crucem', translation: 'There stood by the cross of Jesus', source: 'John 19: 25', verses: 'Ps 55(56): 2', cycle: 'All', chantIndex: 'GR 600' },
  { id: 813, season: 'Proper of Saints', day: 'Our Lady of Sorrows (Sep 15)', type: 'Offertory', incipit: 'Recordare Virgo', translation: 'Remember, O Virgin Mother', source: 'Jer 18: 20', verses: 'Jer 18 (Everte cor)', cycle: 'All', chantIndex: 'GR 601' },
  { id: 814, season: 'Proper of Saints', day: 'Our Lady of Sorrows (Sep 15)', type: 'Communion', incipit: 'Felices sensus', translation: 'Happy the senses of the Blessed Virgin Mary', source: 'Traditional', verses: 'Ps 44(45)', cycle: 'All', chantIndex: 'GR 603' },

  { id: 815, season: 'Proper of Saints', day: 'St. Luke the Evangelist (Oct 18)', type: 'Introit', incipit: 'Mihi autem nimis', translation: 'To me, your friends, O God, are very honorable', source: 'Ps 138(139): 17', verses: 'Ps 138(139): 1-2', cycle: 'All', chantIndex: 'GR 428' },
  { id: 816, season: 'Proper of Saints', day: 'St. Luke the Evangelist (Oct 18)', type: 'Offertory', incipit: 'Mihi autem nimis', translation: 'To me, your friends, O God, are very honorable', source: 'Ps 138(139): 17', verses: 'Ps 138(139): 1-2 (Domine probasti)', cycle: 'All', chantIndex: 'GR 428' },
  { id: 817, season: 'Proper of Saints', day: 'St. Luke the Evangelist (Oct 18)', type: 'Communion', incipit: 'Tu mandasti', translation: 'You have commanded your commandments', source: 'Ps 118(119): 4-5', verses: 'Ps 118(119)', cycle: 'All', chantIndex: 'GR 342' },

  // --- EASTER OCTAVE (First 3 Days) ---
  { id: 818, season: 'Easter', day: 'Easter Monday', type: 'Introit', incipit: 'Introduxit vos', translation: 'The Lord has brought you into a land flowing with milk and honey', source: 'Exod 13: 5, 9', verses: 'Ps 104(105): 1', cycle: 'All', chantIndex: 'GR 198' },
  { id: 819, season: 'Easter', day: 'Easter Monday', type: 'Offertory', incipit: 'Angelus Domini', translation: 'An angel of the Lord descended', source: 'Matt 28: 2, 5-6', verses: 'Ps 117(118): 1-2', cycle: 'All', chantIndex: 'GR 197' },
  { id: 820, season: 'Easter', day: 'Easter Monday', type: 'Communion', incipit: 'Surrexit Dominus', translation: 'The Lord is risen', source: 'Luke 24: 34', verses: 'Ps 117(118)', cycle: 'All', chantIndex: 'GR 200' },

  { id: 821, season: 'Easter', day: 'Easter Tuesday', type: 'Introit', incipit: 'Aqua sapientiae', translation: 'He gave them the water of wisdom to drink', source: 'Sir 15: 3, 4', verses: 'Ps 104(105): 1', cycle: 'All', chantIndex: 'GR 201' },
  { id: 822, season: 'Easter', day: 'Easter Tuesday', type: 'Offertory', incipit: 'Intonuit de caelo', translation: 'The Lord thundered from heaven', source: 'Ps 17(18): 14, 16', verses: 'Ps 17(18): 2-3 (Diligam te)', cycle: 'All', chantIndex: 'GR 202' },
  { id: 823, season: 'Easter', day: 'Easter Tuesday', type: 'Communion', incipit: 'Si consurrexistis', translation: 'If you have risen with Christ', source: 'Col 3: 1-2', verses: 'Ps 104(105)', cycle: 'All', chantIndex: 'GR 204' },
  
  { id: 824, season: 'Easter', day: 'Easter Wednesday', type: 'Introit', incipit: 'Venite benedicti', translation: 'Come, blessed of my Father', source: 'Matt 25: 34', verses: 'Ps 95(96): 1', cycle: 'All', chantIndex: 'GR 205' },
  { id: 825, season: 'Easter', day: 'Easter Wednesday', type: 'Offertory', incipit: 'Portas caeli', translation: 'He opened the doors of heaven', source: 'Ps 77(78): 23-25', verses: 'Ps 77(78): 1-2 (Attendite popule)', cycle: 'All', chantIndex: 'GR 207' },
  { id: 826, season: 'Easter', day: 'Easter Wednesday', type: 'Communion', incipit: 'Christus resurgens', translation: 'Christ rising again from the dead', source: 'Rom 6: 9', verses: 'Ps 95(96)', cycle: 'All', chantIndex: 'GR 208' }
];
