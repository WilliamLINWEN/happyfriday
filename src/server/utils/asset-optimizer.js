// asset-optimizer.js - Node script to minify frontend assets (JS/CSS)
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');

const jsFiles = [
  path.join(__dirname, '../../client/js/formHandler.js'),
  path.join(__dirname, '../../client/js/config.js')
];
const cssFiles = [
  path.join(__dirname, '../../client/css/form-styles.css')
];

function minifyJS(file) {
  const code = fs.readFileSync(file, 'utf8');
  return minify(code).then(result => {
    const minPath = file.replace(/\.js$/, '.min.js');
    fs.writeFileSync(minPath, result.code, 'utf8');
    console.log(`Minified JS: ${minPath}`);
  });
}

function minifyCSS(file) {
  const code = fs.readFileSync(file, 'utf8');
  const minified = new CleanCSS().minify(code).styles;
  const minPath = file.replace(/\.css$/, '.min.css');
  fs.writeFileSync(minPath, minified, 'utf8');
  console.log(`Minified CSS: ${minPath}`);
}

(async () => {
  for (const js of jsFiles) await minifyJS(js);
  for (const css of cssFiles) minifyCSS(css);
})();
