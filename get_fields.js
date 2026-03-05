const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function main() {
    const bytes = fs.readFileSync('C:/Users/sebst/Documents/GITGUB/APOYO_LABORAL/TesoroApp/public/Docs/Ficha social.pdf');
    const pdf = await PDFDocument.load(bytes);
    const form = pdf.getForm();
    const fields = form.getFields();

    const result = fields.map(f => {
        return { nombre: f.getName(), tipo: f.constructor.name };
    });

    console.log(JSON.stringify(result, null, 2));
}
main();
