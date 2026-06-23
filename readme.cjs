fetch('https://raw.githubusercontent.com/bbloomf/jgabc/master/README.md').then(r=>r.text()).then(t=>console.log(t.substring(0, 1000)));
