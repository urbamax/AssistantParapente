const sourceData = [
  { code: 'A3V', theme: 'Météo' },
  { code: 'A8V', theme: 'Météo' },
  { code: 'A1B', theme: 'Météo' }
];
const level = 'BP';
const hasLevel = (code, letter) => code.replace(/^[a-zA-Z]+\d+/, '').includes(letter);

let filtered = sourceData;
if (level === 'BI') {
    filtered = filtered.filter(q => hasLevel(q.code, 'V'));
} else if (level === 'BP') {
    filtered = filtered.filter(q => hasLevel(q.code, 'B'));
}
console.log(filtered);
