const fs = require('fs');

const content = fs.readFileSync('js/views/quiz.js', 'utf-8');
const match = content.match(/const hasLevel =.*?;/);
console.log("hasLevel implementation:", match ? match[0] : "Not found");
