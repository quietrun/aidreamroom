import fs from 'fs'
import path from 'path'
function findTextFiles(folderPath) {
    const result = []
    const files = fs.readdirSync(folderPath)
    return files;
}
const result = findTextFiles(`E:/workshop/ai_dreamroom/src/assets`);
const str = result.map(e => {
    return `import ${e.replace('.png', '').replace('.jpg', '').replaceAll('-', '_')} from '@/${e}'\n`
})
const str2 = result.map(e => {
    return `${e.replace('.png', '').replace('.jpg', '').replaceAll('-', '_')},\n`
})
fs.writeFileSync('result.js', str.join('') + `export default {${str2.join('')}}`);
console.log(result);