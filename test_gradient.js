function getGradient(letters) {
    const colorMap = {
        'V': 'rgba(34, 197, 94, 0.2)', // Vert
        'B': 'rgba(59, 130, 246, 0.2)', // Bleu
        'M': 'rgba(139, 69, 19, 0.2)', // Marron
        'T': 'rgba(168, 85, 247, 0.2)'  // Violet
    };
    const validLetters = letters.split('').filter(l => colorMap[l]);
    if (validLetters.length === 0) return '';
    if (validLetters.length === 1) return `background: ${colorMap[validLetters[0]]}; border: 1px solid ${colorMap[validLetters[0]].replace('0.2', '0.4')};`;
    
    // Multiple letters -> gradient
    let stops = [];
    const step = 100 / validLetters.length;
    validLetters.forEach((l, i) => {
        const color = colorMap[l];
        // Create sharp transitions
        stops.push(`${color} ${i * step}%`);
        stops.push(`${color} ${(i + 1) * step}%`);
    });
    
    // Add text colors
    const textColors = {
        'V': '#4ade80',
        'B': '#60a5fa',
        'M': '#c0773d',
        'T': '#c084fc'
    };
    
    return `background: linear-gradient(90deg, ${stops.join(', ')}); border: 1px solid rgba(255,255,255,0.1);`;
}

console.log("VB:", getGradient("VB"));
console.log("VBM:", getGradient("VBM"));
