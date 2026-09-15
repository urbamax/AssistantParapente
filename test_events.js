const args = ['PERFECT'];
const filter = args; // This is what AppEvents does: QuizView[action](args)
console.log(filter === 'PERFECT');
console.log(filter[0] === 'PERFECT');
