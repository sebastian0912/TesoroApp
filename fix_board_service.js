const fs = require('fs');
let file = 'src/app/features/dashboard/submodule/matder/services/board.service.ts';
let code = fs.readFileSync(file, 'utf8');

// Replacements:
// `${this.base}/boards/`  -> `${this.base}/boards`
// `${this.base}/boards/${id}/` -> `${this.base}/boards/${id}`
code = code.replace(/\/\`\)/g, '\`)'); 
code = code.replace(/\/\`,/g, '\`,'); 

fs.writeFileSync(file, code);
console.log('Fixed trailing slashes in board.service.ts');
