import {defineConfig,createLogger} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
import fs from 'node:fs';
import path from 'node:path';

// O código-fonte fica em src/. O build gera um index.html único (CSS, JS e logos embutidos)
// na raiz do repositório, que é o que o GitHub Pages publica. config.js e vendor/ ficam na raiz.
const raiz=path.resolve(import.meta.dirname);

// no `npm run dev`, serve config.js e vendor/ direto da raiz
const arquivosDaRaiz={
  name:'arquivos-da-raiz',
  configureServer(server){
    server.middlewares.use((req,res,next)=>{
      const url=(req.url||'').split('?')[0];
      if(url==='/config.js'||url.startsWith('/vendor/')){
        const f=path.join(raiz,url);
        if(f.startsWith(raiz)&&fs.existsSync(f)){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(f));return}
      }
      next();
    });
  }
};

// avisos esperados neste arranjo (saída na raiz e scripts clássicos) não precisam aparecer
const logger=createLogger();const warn=logger.warn;
logger.warn=(msg,o)=>{if(/can't be bundled without type="module"|build\.outDir must not be the same/.test(msg))return;warn(msg,o)};

export default defineConfig({
  customLogger:logger,
  root:'src',
  base:'./',
  publicDir:false,
  plugins:[viteSingleFile(),arquivosDaRaiz],
  build:{outDir:raiz,emptyOutDir:false,assetsInlineLimit:Infinity},
  test:{root:raiz,include:['test/**/*.test.js'],environment:'jsdom'}
});
