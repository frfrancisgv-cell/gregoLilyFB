const fs = require('fs');
fetch('https://raw.githubusercontent.com/bbloomf/jgabc/master/jgabc.js')
  .then(res => res.text())
  .then(text => fs.writeFileSync('src/lib/jgabc.js', text));
fetch('https://raw.githubusercontent.com/bbloomf/jgabc/master/psalmtones.js')
  .then(res => res.text())
  .then(text => fs.writeFileSync('src/lib/psalmtones.js', text));
fetch('https://raw.githubusercontent.com/bbloomf/jgabc/master/doctexts.js')
  .then(res => res.text())
  .then(text => fs.writeFileSync('src/lib/doctexts.js', text));
