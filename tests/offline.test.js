const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const code = fs.readFileSync('app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const KEY = 'messpro.jamazon.pendingCloud.v1';
const TOWN = 'messpro.jamazon.townFilter.v1';
function boot(store = new Map()) {
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([,id]) => [id, {
    value:'', textContent:'', innerHTML:'', dataset:{}, hidden:false, listeners:{},
    addEventListener(n, f) { this.listeners[n] = f; },
    classList:{ toggle(){} }, reset(){}, focus(){}, close(){}, showModal(){},
  }]));
  const events = {};
  const c = vm.createContext({
    document:{getElementById:id=>elements.get(id)||null,querySelectorAll:()=>[],querySelector:()=>null,hidden:false,addEventListener(n,f){events['doc:'+n]=f;}},
    localStorage:{getItem:k=>store.get(k)??null,setItem(k,v){store.set(k,v);},removeItem:k=>store.delete(k)},
    navigator:{onLine:false},window:{addEventListener(n,f){events[n]=f;}},
    crypto, AbortController, console:{error(){},info(){}},setTimeout:()=>1,clearTimeout(){},setInterval(){},
    confirm:()=>true, fetch:async()=>{throw Error('offline');},
  });
  vm.runInContext(code,c);
  return { c, store, elements, events, run:s=>vm.runInContext(s,c) };
}
const sample = (id='a') => ({id,fullName:'Cliente Playa',phone:'555',latitude:23.1,longitude:-82.4,description:'Portal azul'});
test('municipio escrito, múltiple y vacío sobreviven reapertura',()=>{
 const b=boot(); b.elements.get('jamazonTownFilter').value='Playa'; b.run("handleJamazonTownInput({target:$('jamazonTownFilter')})");
 assert.equal(boot(b.store).elements.get('jamazonTownFilter').value,'Playa; ');
 b.elements.get('jamazonTownSelect').value='Bauta';b.run("handleJamazonTownSelect({target:$('jamazonTownSelect')})");
 assert.equal(boot(b.store).elements.get('jamazonTownFilter').value,'Playa; Bauta; ');
 b.elements.get('jamazonTownFilter').value='';b.run("handleJamazonTownInput({target:$('jamazonTownFilter')})");
 assert.equal(b.store.get(TOWN),''); assert.equal(boot(b.store).elements.get('jamazonTownFilter').value,'');
});
test('guardar formulario offline, reabrir, buscar y enviar teléfono después',async()=>{
 const b=boot();for(const [id,v] of Object.entries({fullName:'Cliente Playa',identity:'555',latitude:'23.1',longitude:'-82.4',description:'Portal azul'})) b.elements.get(id).value=v;
 await b.run('saveClient({preventDefault(){}})');assert.equal(JSON.parse(b.store.get(KEY)).length,1);
 const reopened=boot(b.store);reopened.elements.get('searchInput').value='Playa';await reopened.run('searchClients()');assert.match(reopened.elements.get('results').innerHTML,/Portal azul/);
 let calls=0;reopened.c.navigator.onLine=true;reopened.c.fetch=async(u,o)=>{calls++;assert.equal(o.method,'POST');assert.match(u,/on_conflict=id/);assert.match(o.headers.Prefer,/merge-duplicates/);assert.equal(JSON.parse(o.body).telefono,'555');return {ok:true};};
 await reopened.run('flushJamazonPendingCloud()');assert.equal(calls,1);assert.equal(JSON.parse(b.store.get(KEY)).length,0);
 assert.equal(reopened.run('loadClients().length'),1);
});
test('sincronización elimina caché borrada en nube y conserva pendientes',async()=>{
 const store=new Map([['rutaCliente.clients.v1',JSON.stringify([{...sample('old'),fullName:'Borrado en nube'}])],[KEY,JSON.stringify([sample('pending')])]]);
 const b=boot(store);b.c.navigator.onLine=true;b.c.fetch=async()=>({ok:true,json:async()=>[{id:'cloud',nombre_completo:'Cliente Nube',telefono:'222',latitud:1,longitud:2}]});
 assert.equal(await b.run('syncCloudClients()'),true);assert.equal(b.run("loadClients().some(x=>x.id==='old')"),false);assert.equal(b.run("loadClients().some(x=>x.id==='pending')"),true);
 b.elements.get('searchInput').value='222';b.run('renderResults()');assert.match(b.elements.get('results').innerHTML,/Cliente Nube/);
});
test('fallo HTTP y respuesta perdida conservan cola; reintentos usan mismo UUID',async()=>{
 const b=boot();b.c.item=sample();b.run('queueClient(item)');b.c.navigator.onLine=true;let ids=[];
 b.c.fetch=async(u,o)=>{ids.push(JSON.parse(o.body).id);throw Error('response lost');};await b.run('flushJamazonPendingCloud()');assert.equal(JSON.parse(b.store.get(KEY)).length,1);
 b.c.fetch=async(u,o)=>{ids.push(JSON.parse(o.body).id);return {ok:false,status:503};};await b.run('flushJamazonPendingCloud()');assert.equal(JSON.parse(b.store.get(KEY)).length,1);
 b.c.fetch=async(u,o)=>{ids.push(JSON.parse(o.body).id);return {ok:true};};await b.run('flushJamazonPendingCloud()');assert.deepEqual(ids,['a','a','a']);assert.equal(JSON.parse(b.store.get(KEY)).length,0);
});
test('sincronizaciones simultáneas y edición durante envío no pierden cambios',async()=>{
 const b=boot();b.c.item=sample();b.run('queueClient(item)');b.c.navigator.onLine=true;let release,calls=0;
 b.c.fetch=()=>{calls++;return new Promise(r=>release=r);};const first=b.run('flushJamazonPendingCloud()');const second=b.run('flushJamazonPendingCloud()');assert.equal(calls,1);
 b.c.item={...sample(),latitude:24};b.run('queueClient(item)');release({ok:true});await Promise.all([first,second]);
 assert.equal(JSON.parse(b.store.get(KEY))[0].latitude,24);
 b.c.fetch=async()=>({ok:true});await b.run('flushJamazonPendingCloud()');assert.equal(JSON.parse(b.store.get(KEY)).length,0);assert.equal(b.run('loadClients()[0].latitude'),24);
});
test('búsqueda nube usa nombre o teléfono y no pisa coordenadas pendientes',async()=>{
 const b=boot();b.c.item=sample();b.run('queueClient(item)');b.c.navigator.onLine=true;
 b.c.fetch=async(u)=>{assert.match(u,/telefono\.ilike/);return {ok:true,json:async()=>[{id:'a',nombre_completo:'Cliente Playa',telefono:'555',latitud:0,longitud:0},{id:'b',nombre_completo:'Otro Playa',telefono:'999',latitud:2,longitud:3}]};};
 b.elements.get('searchInput').value='playa';await b.run('searchClients()');assert.equal(b.run('loadClients().length'),2);assert.equal(b.run("loadClients().find(x=>x.id==='a').latitude"),23.1);
 b.c.navigator.onLine=false;const r=boot(b.store);r.elements.get('searchInput').value='Otro';await r.run('searchClients()');assert.match(r.elements.get('results').innerHTML,/Otro Playa/);
});
test('Jamazon guarda antes de red y mantiene identificador entre guardados',async()=>{
 const b=boot();b.run("jamazonSelected={nombre:'Excel Playa',telefono:'123',latitud:23,longitud:-82};jamazonRows=[jamazonSelected]");
 b.elements.get('cloudDescriptionText').value='Esquina';await b.run('uploadJamazonToCloudAfterDescription()');const first=JSON.parse(b.store.get(KEY))[0];
 assert.equal(first.description,'Esquina');await b.run('uploadJamazonToCloudAfterDescription()');assert.equal(JSON.parse(b.store.get(KEY)).length,1);assert.equal(JSON.parse(b.store.get(KEY))[0].id,first.id);
 const r=boot(b.store);assert.equal(r.run('loadClients()[0].fullName'),'Excel Playa');
});
test('almacenamiento lleno no da guardado exitoso ni limpia formulario',async()=>{
 const b=boot();for(const [id,v] of Object.entries({fullName:'Cliente Playa',latitude:'23',longitude:'-82'})) b.elements.get(id).value=v;
 b.c.localStorage.setItem=()=>{throw Error('quota');};await b.run('saveClient({preventDefault(){}})');assert.equal(b.elements.get('dialogTitle').textContent,'No se pudo guardar');assert.equal(b.elements.get('fullName').value,'Cliente Playa');
});
test('coordenadas vacías rechazadas y borrado offline no resucita en sincronización',async()=>{
 const b=boot();await b.run('saveClient({preventDefault(){}})');assert.equal(b.elements.get('dialogTitle').textContent,'Coordenadas inválidas');
 b.c.item=sample();b.run('queueClient(item)');await b.run("deleteClient('a')");const r=boot(b.store);assert.equal(r.run('loadClients().length'),0);let method;r.c.navigator.onLine=true;r.c.fetch=async(u,o)=>{method=o.method;return {ok:true};};await r.run('flushJamazonPendingCloud()');assert.equal(method,'DELETE');assert.equal(r.run('loadClients().length'),0);
});
